/**
 * Tests for TranspileState - centralized code generation state management
 */

import TestSymbolTable from "../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import ProgramLowering from "../../../../cnx/PARSE/2-Parse/ProgramLowering";
import type IScopeSymbol from "../../../../cnx/types/symbols/IScopeSymbol";
import { describe, it, expect, beforeEach } from "vitest";
import DeclaredPointer from "../../../../cnx/utils/DeclaredPointer";
import installMockSymbols from "../../../../cnx/TRANSPILE/__tests__/installMockSymbols";
import TranspileState from "../../../../cnx/TRANSPILE/TranspileState";
import SymbolRegistry from "../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import ScopeUtils from "../../../../cnx/utils/ScopeUtils";
import Program from "../../../../cnx/PARSE/4-Resolve/Program";
import CnxResolver from "../../../../cnx/PARSE/3-Declare/cnx/index";
import parse from "../../../../cnx/PARSE/3-Declare/cnx/__tests__/testHelpers";

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

/**
 * #1452 box 3: register a scope AND publish the graph, because
 * `setCurrentScopeByPath` reads it off `state.program` now rather than
 * off a global registry. Both halves live here so the tests below -- which call
 * the guarded method directly on purpose -- state what they are setting up
 * rather than repeating the wiring.
 */
function registerScope(path: string): IScopeSymbol {
  const scope = registry.getOrCreateScope(path);
  state.program = Program.build([], { cppMode: false, registry });
  return scope;
}

let state = new TranspileState();

describe("TranspileState", () => {
  beforeEach(() => {
    state = new TranspileState();
    TestSymbolTable.install(state);
  });

  describe("Scope Member Helpers", () => {
    it("getScopeMembers returns undefined for unknown scope", () => {
      expect(state.getScopeMembers("UnknownScope")).toBeUndefined();
    });

    it("getScopeMembers returns members for known scope", () => {
      const members = new Set(["member1", "member2"]);
      state.setScopeMembers("TestScope", members);

      expect(state.getScopeMembers("TestScope")).toBe(members);
    });
  });

  describe("Type Registration Helpers", () => {
    it("setCurrentScopeByPath resolves a DOTTED PATH to the registered scope", () => {
      // The contract is a path, not a leaf. This proves the API is chain-capable,
      // so the fix for #1304 is on the caller side: codegen can only supply a
      // leaf today because `scopeMember` admits no `scopeDeclaration`.
      const inner = registerScope("Outer.Inner");

      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(ScopeUtils.pathOf(inner)).toBe("Outer.Inner");
      expect(ScopeUtils.qualifyInScope("tick", state.currentScopePath)).toBe(
        "Outer__Inner__tick",
      );
    });

    it("setCurrentScopeByPath with a LEAF now fails loudly (#1304)", () => {
      // This test used to DOCUMENT the gap: a leaf did not fail, it minted a
      // fresh scope parented to global, and every qualification through it
      // silently lost the outer component. #1304 closes that -- the registry is
      // the authority, so a path it does not know is a broken promise about the
      // symbols pass rather than something to create here.
      registerScope("Outer.Inner");

      expect(() => state.setCurrentScopeByPath("Inner")).toThrow();

      // The failed entry must not have left the state half-updated, and must
      // not have registered `Inner` as a side effect.
      expect(state.currentScopePath).toBe("");
      expect(registry.getScope("Inner")).toBeNull();
    });

    it("setCurrentScopeByPath still enters a scope the registry knows", () => {
      // NEGATIVE CONTROL for the guard above: it must fire only on a path the
      // registry does not hold, not on every entry. Without this the assertion
      // above would pass just as well if the method rejected everything.
      registerScope("Outer.Inner");

      expect(() => state.setCurrentScopeByPath("Outer.Inner")).not.toThrow();
      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(ScopeUtils.qualifyInScope("tick", state.currentScopePath)).toBe(
        "Outer__Inner__tick",
      );
    });

    it("exitFunctionBody drops the function's locals", () => {
      state.floatBitShadows.add("count");

      state.exitFunctionBody();

      expect(state.floatBitShadows.size).toBe(0);
    });
  });

  // #1668 (C8): the "Variable Type Info API" describe stood here and is
  // deleted with the per-file type registry it tested. A name's type is its
  // binding's -- `DeclaredTypeInfo`, whose tests carry the #978 C-header and
  // #1360 dimension-slot cases this block asserted through the registry's
  // cross-file fallback.

  describe("C++ Mode Helpers", () => {
    it("getNextTempVarName returns incrementing names", () => {
      state = new TranspileState(); // Reset counter
      expect(state.getNextTempVarName()).toBe("cnx_tmp0");
      expect(state.getNextTempVarName()).toBe("cnx_tmp1");
      expect(state.getNextTempVarName()).toBe("cnx_tmp2");
    });
  });

  describe("Symbol Lookup Helpers", () => {
    it("isKnownScope returns false without symbols", () => {
      state.symbols = null;
      expect(state.isKnownScope("MyScope")).toBe(false);
    });

    it("isKnownScope returns true for known scope", () => {
      installMockSymbols(state, {
        knownScopes: new Set(["MyScope"]),
      });

      expect(state.isKnownScope("MyScope")).toBe(true);
      expect(state.isKnownScope("UnknownScope")).toBe(false);
    });

    /**
     * ADR-030: the one "held through a pointer" decision, which a
     * declaration's own pointer-ness (`DeclaredPointer.of`) and 1.4's
     * parameter stamp (#1722) share. #948 and #958 each gated it with a mark
     * and a copy of the "did a body arrive" rule of their own; StructCollector
     * set both marks under one condition, so they are one mark now, resolved
     * by `OpaqueTypeResolution` (measured: the two never disagreed across the
     * 1412 fixtures). A complete type is not a handle.
     */
    it.each<[string, boolean, boolean]>([
      ["a typedef of a forward-declared struct", true, true],
      ["a complete type", false, false],
    ])(
      "isHeldThroughPointer answers for %s",
      (_label, isTypedefStruct, expected) => {
        if (isTypedefStruct) {
          TestSymbolTable.of(state).markOpaqueType("Dev");
        }

        expect(state.isHeldThroughPointer("Dev")).toBe(expected);
        expect(state.isHeldThroughPointer("Dev")).toBe(
          DeclaredPointer.isHandleType("Dev", state.symbolTable),
        );
      },
    );
  });

  describe("Scope Type Qualification (ADR-057)", () => {
    it("binds a bare scope type for the file being generated, from the program (#1724)", () => {
      // `declares.cnx` declares three scope types. `includer.cnx` includes it;
      // `sibling.cnx` is in the same run and does not. Codegen used to ask the
      // run-wide symbol table, which holds all three for every file -- so a
      // bare name in `sibling.cnx` qualified to a type its generated C cannot
      // see, while 1.4 had settled the header's copy the same wrong way.
      const declares = CnxResolver.resolve(
        ProgramLowering.program(
          parse(
            `scope A { public enum B { X } public struct S { u8 f; } public bitmap8 Flags { Ready, Mode[3], Reserved[4] } }`,
          ),
          null,
        ),
        "declares.cnx",
        registry,
      );
      const includer = CnxResolver.resolve(
        ProgramLowering.program(parse(`u32 x <- 1;`), null),
        "includer.cnx",
        registry,
      );
      const sibling = CnxResolver.resolve(
        ProgramLowering.program(parse(`u32 y <- 1;`), null),
        "sibling.cnx",
        registry,
      );
      state.program = Program.build([declares, includer, sibling], {
        cppMode: false,
        registry,
        visibility: {
          cnxIncludesByFile: new Map([
            ["includer.cnx", [{ path: "declares.cnx" }]],
          ]),
        },
      });

      const cName = (name: string): string | undefined =>
        state.typeBindingDeps().scopeTypeCName?.("A", name);
      state.sourcePath = "includer.cnx";
      expect(cName("B")).toBe("A__B");
      expect(cName("S")).toBe("A__S");
      expect(cName("Flags")).toBe("A__Flags");
      expect(cName("Nope")).toBeUndefined();

      state.sourcePath = "sibling.cnx";
      expect(cName("S")).toBeUndefined();
    });

    it("binds no scope type without a program", () => {
      state.program = null;
      state.sourcePath = "includer.cnx";
      expect(
        state.typeBindingDeps().scopeTypeCName?.("A", "B"),
      ).toBeUndefined();
    });

    // #1452: four `qualifyScopeType` cases lived here. The method had no
    // production caller -- codegen binds the predicate through
    // `typeBindingDeps` instead -- so it is deleted along with the CLAUDE.md
    // rule that named it. The SEMANTICS stay covered on the live utility:
    // `ScopeUtils.test.ts` asserts the chain-qualified lookup, the fall-through
    // to a bare name when a scope member is not a type, and that a different
    // scope's type is not reachable bare. What is gone with them is only the
    // binding to `currentScopePath`, which the `typeBindingDeps` cases above
    // cover (#2116: by identity, through `scopeTypeCName`).
  });

  // #1447: the derivation moved to `Program` -- which fields a header's struct
  // has is a cross-file fact. These call `program.externalStructFields()`
  // directly, which IS the route `InitializationAnalyzer` takes
  // (`context.program.externalStructFields()`). They went through a
  // `TranspileState` wrapper that said so in a comment while having no
  // production caller left.
  describe("external struct fields, via Program", () => {
    it("returns empty map when no struct fields exist", () => {
      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();
      expect(result.size).toBe(0);
    });

    it("includes non-array fields in result", () => {
      // Manually add struct fields to the symbol table
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const pointFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      pointFields.set("x", { type: "i32" });
      pointFields.set("y", { type: "i32" });
      structFields.set("Point", pointFields);

      // Use restoreStructFields to populate the symbol table
      TestSymbolTable.of(state).restoreStructFields(structFields);

      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      expect(result.has("Point")).toBe(true);
      const fields = result.get("Point");
      expect(fields?.has("x")).toBe(true);
      expect(fields?.has("y")).toBe(true);
    });

    it("excludes array fields from result (Issue #355)", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const bufferFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      bufferFields.set("size", { type: "u32" }); // Non-array
      bufferFields.set("data", { type: "u8", arrayDimensions: [256] }); // Array

      structFields.set("Buffer", bufferFields);
      TestSymbolTable.of(state).restoreStructFields(structFields);

      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      expect(result.has("Buffer")).toBe(true);
      const fields = result.get("Buffer");
      expect(fields?.has("size")).toBe(true); // Non-array included
      expect(fields?.has("data")).toBe(false); // Array excluded
    });

    it("excludes structs with only array fields", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const arrayOnlyFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      arrayOnlyFields.set("items", { type: "u8", arrayDimensions: [10] });
      arrayOnlyFields.set("values", { type: "i32", arrayDimensions: [5] });

      structFields.set("ArrayOnly", arrayOnlyFields);
      TestSymbolTable.of(state).restoreStructFields(structFields);

      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      // Struct should not be included since all fields are arrays
      expect(result.has("ArrayOnly")).toBe(false);
    });

    it("handles mixed structs correctly", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();

      // Struct with mixed fields
      const mixedFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      mixedFields.set("id", { type: "u32" });
      mixedFields.set("name", { type: "string", arrayDimensions: [32] });
      mixedFields.set("count", { type: "u16" });

      // Struct with only non-array
      const simpleFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      simpleFields.set("value", { type: "f32" });

      structFields.set("Mixed", mixedFields);
      structFields.set("Simple", simpleFields);
      TestSymbolTable.of(state).restoreStructFields(structFields);

      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      // Mixed struct should have only non-array fields
      expect(result.get("Mixed")?.size).toBe(2);
      expect(result.get("Mixed")?.has("id")).toBe(true);
      expect(result.get("Mixed")?.has("count")).toBe(true);
      expect(result.get("Mixed")?.has("name")).toBe(false);

      // Simple struct should have its field
      expect(result.get("Simple")?.has("value")).toBe(true);
    });
  });

  /**
   * Issue #1450 box 4: `withScopePath` exists for the `finally`.
   *
   * Two sites hand-rolled the save/restore with the restore as a plain trailing
   * statement, so a throw anywhere in the body left `currentScopePath` pointing
   * at the wrong scope. That is the same defect #872 extracted
   * `withExpectedType` (now `withPlannedExpectedType`) to fix -- its doc says "add exception safety" -- and
   * scope path never got the same treatment.
   *
   * The happy path is already covered by 1247 fixtures; it is the THROWING path
   * that had no coverage and is the entire reason the helper exists, so that is
   * what this pins. Mutation: replacing the `finally` with a trailing
   * assignment reddens exactly this test.
   */
  /**
   * #1295 and #1304 are two halves of ONE decision: a scope's identity is its
   * `cnxScopedName`, and the producer (`TSymbolInfoAdapter.processScope`, which
   * keys `scopeMembers` by it) and the reader (`currentScopePath`) must name the
   * same scope OBJECT.
   *
   * They agree by construction rather than by coincidence, because
   * `setCurrentScopeByPath` does not store its argument -- it reads the path back
   * off the registered scope. The single way to break that is for the registry to
   * hand back a different scope than the producer keyed from, which is exactly
   * what `getOrCreateScope` did when handed a leaf: it minted a fresh orphan
   * parented to global, and the producer's key then missed in silence.
   *
   * These tests drive the READERS. The `TSymbolInfoAdapter` block covers the
   * producer; before this, re-inlining `ScopeUtils.leafOf` at any reader site
   * left the whole suite green.
   */
});
