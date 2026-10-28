import { describe, expect, it, beforeEach } from "vitest";
import DeclarationSite from "../../../../utils/DeclarationSite";
import parse from "./testHelpers";
import FirstDeclaration from "./FirstDeclaration";
import ScopeCollector from "../collectors/ScopeCollector";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import SymbolGuards from "../../../../types/symbols/SymbolGuards";
import SymbolRegistry from "../../SymbolRegistry";
import TypeResolver from "../../../../utils/TypeResolver";
import SettledEnumValues from "../../../../utils/__testUtils__/SettledEnumValues";
import QualifiedTypeNames from "../QualifiedTypeNames";

const NONE_WRITTEN = new Map<string, string>();

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("ScopeCollector", () => {
  // Issue #1334: a scope may be reopened (ADR-016), so it has MANY declaration
  // sites. getOrCreateScope caches by path and this collector used to assign
  // sourceFile/sourceLine on the shared object unconditionally, so a reopened
  // scope reported whichever block was collected last and every earlier site was
  // lost -- which is why a conflict naming two definitions printed one location
  // twice.
  //
  // The .cnx fixture at tests/bugs/issue-1334-scope-declaration-sites/ proves the
  // four-file program RUNS. It cannot prove the sites are retained: execution is
  // unaffected by collapsing them. This is where that is pinned.
  describe("declaration sites across reopened blocks", () => {
    const collectBlock = (
      code: string,
      sourceFile: string,
    ): ReturnType<typeof ScopeCollector.collect> => {
      const tree = parse(code);
      return ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        sourceFile,
      );
    };

    it("records every block of a scope spanning four files", () => {
      collectBlock(`scope Span {\n  u32 a;\n}`, "span4-a.cnx");
      collectBlock(`scope Span {\n  u32 b;\n}`, "span4-b.cnx");
      collectBlock(`scope Span {\n  u32 c;\n}`, "span4-c.cnx");
      const last = collectBlock(`scope Span {\n  u32 d;\n}`, "span4-d.cnx");

      expect(
        [...last.scopeSymbol.declarationSites].sort(DeclarationSite.compare),
      ).toEqual([
        "span4-a.cnx:1",
        "span4-b.cnx:1",
        "span4-c.cnx:1",
        "span4-d.cnx:1",
      ]);
    });

    it("keeps the FIRST site in the scalar sourceFile/sourceLine", () => {
      collectBlock(`scope Span {\n  u32 a;\n}`, "span4-a.cnx");
      const last = collectBlock(`scope Span {\n  u32 d;\n}`, "span4-d.cnx");

      // Not the last block: that was the defect. Lossless because the complete
      // record lives in declarationSites.
      expect(last.scopeSymbol.sourceFile).toBe("span4-a.cnx");
    });

    it("does not duplicate a site when the same block is collected twice", () => {
      // CnxResolver.resolve runs more than once per file on some paths.
      collectBlock(`scope Span {\n  u32 a;\n}`, "span4-a.cnx");
      const again = collectBlock(`scope Span {\n  u32 a;\n}`, "span4-a.cnx");

      expect(again.scopeSymbol.declarationSites.size).toBe(1);
      // members is a plain array with no such protection -- guarded at the push.
      expect(again.scopeSymbol.members).toEqual(["a"]);
    });
  });

  describe("basic scope extraction", () => {
    it("collects an empty scope", () => {
      const code = `
        scope Motor {
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      expect(result.scopeSymbol.kind).toBe("scope");
      expect(result.scopeSymbol.name).toBe("Motor");
      expect(result.scopeSymbol.members).toEqual([]);
      expect(result.scopeSymbol.sourceFile).toBe("test.cnx");
      expect(result.scopeSymbol.sourceLanguage).toBe(ESourceLanguage.Cnx);
      expect(result.scopeSymbol.visibility).toBe("public");

      expect(result.memberSymbols).toEqual([]);
    });

    it("collects scope with functions", () => {
      // ADR-016: Functions are public by default, use explicit 'private' for internal functions
      const code = `
        scope Motor {
          void init() {
          }
          private void update() {
          }
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      expect(result.scopeSymbol.members).toEqual(["init", "update"]);
      // init() is public by default (no modifier)
      expect(result.scopeSymbol.memberVisibility.get("init")).toBe("public");
      // update() has explicit 'private' keyword
      expect(result.scopeSymbol.memberVisibility.get("update")).toBe("private");

      expect(result.memberSymbols).toHaveLength(2);

      // Functions now have bare names with scope references
      const initFunc = result.memberSymbols.find((s) => s.name === "init");
      expect(initFunc).toBeDefined();
      expect(SymbolGuards.isFunction(initFunc!)).toBe(true);
      if (SymbolGuards.isFunction(initFunc!)) {
        expect(initFunc.visibility).toBe("public");
        expect(initFunc.scopePath).toBe("Motor");
      }

      const updateFunc = result.memberSymbols.find((s) => s.name === "update");
      expect(updateFunc).toBeDefined();
      expect(SymbolGuards.isFunction(updateFunc!)).toBe(true);
      if (SymbolGuards.isFunction(updateFunc!)) {
        expect(updateFunc.visibility).toBe("private");
        expect(updateFunc.scopePath).toBe("Motor");
      }
    });

    it("collects scope with variables", () => {
      const code = `
        scope Motor {
          u32 position;
          public u32 speed;
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      expect(result.scopeSymbol.members).toEqual(["position", "speed"]);
      expect(result.scopeSymbol.memberVisibility.get("position")).toBe(
        "private",
      );
      expect(result.scopeSymbol.memberVisibility.get("speed")).toBe("public");

      expect(result.memberSymbols).toHaveLength(2);

      // Variables now have bare names with scope references
      const posVar = result.memberSymbols.find((s) => s.name === "position");
      expect(posVar).toBeDefined();
      expect(SymbolGuards.isVariable(posVar!)).toBe(true);
      if (SymbolGuards.isVariable(posVar!)) {
        expect(TypeResolver.getTypeName(posVar.type)).toBe("u32");
        expect(posVar.visibility).toBe("private");
        expect(posVar.scopePath).toBe("Motor");
      }
    });
  });

  describe("nested type declarations", () => {
    it("collects scope with nested enum", () => {
      const code = `
        scope Motor {
          public enum State {
            Off,
            Running,
            Error
          }
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      expect(result.scopeSymbol.members).toEqual(["State"]);

      // Enum has bare name with scope reference
      const enumSymbol = result.memberSymbols.find((s) => s.name === "State");
      expect(enumSymbol).toBeDefined();
      expect(SymbolGuards.isEnum(enumSymbol!)).toBe(true);
      if (SymbolGuards.isEnum(enumSymbol!)) {
        // 1.3 records each value as written; 1.4 settles it (#1669)
        expect(enumSymbol.members.get("Off")?.value).toBeNull();
        expect(SettledEnumValues.of(enumSymbol)).toEqual([0, 1, 2]);
        expect(enumSymbol.scopePath).toBe("Motor");
      }
    });

    it("collects scope with nested struct", () => {
      const code = `
        scope Motor {
          public struct Config {
            u32 maxSpeed;
            u32 acceleration;
          }
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      // Struct has bare name with scope reference
      const structSymbol = result.memberSymbols.find(
        (s) => s.name === "Config",
      );
      expect(structSymbol).toBeDefined();
      expect(SymbolGuards.isStruct(structSymbol!)).toBe(true);
      if (SymbolGuards.isStruct(structSymbol!)) {
        expect(structSymbol.fields.get("maxSpeed")).toBeDefined();
        expect(structSymbol.fields.get("acceleration")).toBeDefined();
        expect(structSymbol.scopePath).toBe("Motor");
      }
    });

    it("collects scope with nested bitmap", () => {
      const code = `
        scope Motor {
          bitmap8 Status {
            enabled,
            running,
            error,
            warning,
            reserved[4]
          }
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      // Bitmap has bare name with scope reference
      const bitmapSymbol = result.memberSymbols.find(
        (s) => s.name === "Status",
      );
      expect(bitmapSymbol).toBeDefined();
      expect(SymbolGuards.isBitmap(bitmapSymbol!)).toBe(true);
      if (SymbolGuards.isBitmap(bitmapSymbol!)) {
        expect(bitmapSymbol.backingType).toBe("uint8_t");
        expect(bitmapSymbol.fields.get("enabled")).toMatchObject({
          offset: 0,
          width: 1,
        });
        expect(bitmapSymbol.scopePath).toBe("Motor");
      }
    });

    it("collects scope with nested register", () => {
      const code = `
        scope Motor {
          register CTRL @ 0x40001000 {
            STATUS: u32 rw @ 0x00,
            COMMAND: u32 wo @ 0x04,
          }
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      // Register has bare name with scope reference
      const regSymbol = result.memberSymbols.find((s) => s.name === "CTRL");
      expect(regSymbol).toBeDefined();
      expect(SymbolGuards.isRegister(regSymbol!)).toBe(true);
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(regSymbol.baseAddress).toMatchObject({
          kind: "literal",
          text: "0x40001000",
        });
        expect(regSymbol.members.get("STATUS")?.access).toBe("rw");
        expect(regSymbol.members.get("COMMAND")?.access).toBe("wo");
        expect(regSymbol.scopePath).toBe("Motor");
      }
    });
  });

  describe("mixed members", () => {
    it("collects scope with multiple member types", () => {
      const code = `
        scope Motor {
          u32 position;

          public void init() {
          }

          enum State {
            Off,
            On
          }
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      expect(result.scopeSymbol.members).toEqual(["position", "init", "State"]);
      expect(result.memberSymbols).toHaveLength(3);

      // Verify each type was collected correctly with bare names
      const varSymbol = result.memberSymbols.find((s) => s.name === "position");
      expect(SymbolGuards.isVariable(varSymbol!)).toBe(true);
      expect(varSymbol!.scopePath).toBe("Motor");

      const funcSymbol = result.memberSymbols.find((s) => s.name === "init");
      expect(SymbolGuards.isFunction(funcSymbol!)).toBe(true);
      expect(funcSymbol!.scopePath).toBe("Motor");

      const enumSymbol = result.memberSymbols.find((s) => s.name === "State");
      expect(SymbolGuards.isEnum(enumSymbol!)).toBe(true);
      expect(enumSymbol!.scopePath).toBe("Motor");
    });
  });

  describe("bitmap resolution in registers", () => {
    it("resolves scoped bitmap types in registers", () => {
      const code = `
        scope Motor {
          register CTRL @ 0x40001000 {
            FLAGS: MotorFlags rw @ 0x00,
          }
        }
      `;
      const tree = parse(code);
      const knownBitmaps = new Set(["Motor__MotorFlags"]);
      // Production always threads this predicate down from CnxResolver's
      // pass 0b; supplying it is what makes the test model production. Nothing
      // below the ladder re-qualifies a resolved name (#1472).
      const isScopeType = (qualifiedName: string): boolean =>
        knownBitmaps.has(qualifiedName);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
        {
          isScopeType,
          qualifiedTypeName: (written) =>
            QualifiedTypeNames.read(NONE_WRITTEN, written),
        },
      );

      const regSymbol = result.memberSymbols.find((s) => s.name === "CTRL");
      expect(SymbolGuards.isRegister(regSymbol!)).toBe(true);
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(
          TypeResolver.getTypeName(regSymbol.members.get("FLAGS")!.type),
        ).toBe("Motor__MotorFlags");
      }
    });

    it("keeps an explicit global. bitmap out of the scope's reach", () => {
      const code = `
        scope Motor {
          register CTRL @ 0x40001000 {
            FLAGS: global.MotorFlags rw @ 0x00,
          }
        }
      `;
      const tree = parse(code);
      // Both names are known bitmaps, so only ADR-057's `global.` opt-out
      // distinguishes them. Re-qualifying the resolved name would bind the
      // scoped one and emit a register typed with the wrong bit layout.
      const knownBitmaps = new Set(["Motor__MotorFlags", "MotorFlags"]);
      const isScopeType = (qualifiedName: string): boolean =>
        knownBitmaps.has(qualifiedName);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
        {
          isScopeType,
          qualifiedTypeName: (written) =>
            QualifiedTypeNames.read(NONE_WRITTEN, written),
        },
      );

      const regSymbol = result.memberSymbols.find((s) => s.name === "CTRL");
      expect(SymbolGuards.isRegister(regSymbol!)).toBe(true);
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(
          TypeResolver.getTypeName(regSymbol.members.get("FLAGS")!.type),
        ).toBe("MotorFlags");
      }
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        scope OnLine3 {
        }
      `;
      const tree = parse(code);
      const result = ScopeCollector.collect(
        registry,
        FirstDeclaration.scope(tree),
        "test.cnx",
      );

      expect(result.scopeSymbol.span.line).toBe(3);
    });
  });
});
