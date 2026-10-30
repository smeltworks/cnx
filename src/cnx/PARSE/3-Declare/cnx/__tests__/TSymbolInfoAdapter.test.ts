/**
 * Unit tests for TSymbolInfoAdapter.
 * Tests conversion from TSymbol[] to ISymbolInfo interface for CodeGenerator.
 *
 * ADR-055 Phase 5: These tests verify that the adapter correctly converts
 * discriminated union symbols into the flat map format expected by CodeGenerator.
 */

import { describe, expect, it } from "vitest";
import TSymbolInfoAdapter from "../adapters/TSymbolInfoAdapter";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import TypeResolver from "../../../../utils/TypeResolver";
import TestScopeUtils from "./testUtils";
import TestSymbolUtils from "./testSymbolUtils";
import TestSourceSpan from "../../../../types/__testUtils__/testSourceSpan";
import TestEnumMembers from "../../../../types/__testUtils__/testEnumMembers";
import TestMembers from "../../../../types/__testUtils__/testMembers";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TVisibility from "../../../../types/TVisibility";
import TestExpression from "../../../../types/__testUtils__/testExpression";

describe("TSymbolInfoAdapter", () => {
  // Reset global scope between tests to avoid state pollution

  describe("convert structs", () => {
    it("should populate knownStructs set", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Point",
          new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
            [
              "y",
              {
                name: "y",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.knownStructs.has("Point")).toBe(true);
    });

    it("should populate structFields map", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Point",
          new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
            [
              "y",
              {
                name: "y",
                type: TypeResolver.resolve("f32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFields.get("Point")?.get("x")).toBe("i32");
      expect(info.structFields.get("Point")?.get("y")).toBe("f32");
    });

    it("should populate structFieldArrays for array fields", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Buffer",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Buffer",
          new Map([
            [
              "data",
              {
                name: "data",
                type: TypeResolver.resolve("u8"),
                isArray: true,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
                dimensions: [256],
              },
            ],
            [
              "size",
              {
                name: "size",
                type: TypeResolver.resolve("u32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFieldArrays.get("Buffer")?.has("data")).toBe(true);
      expect(info.structFieldArrays.get("Buffer")?.has("size")).toBe(false);
    });

    it("should populate structFieldDimensions for array fields", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Matrix",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Matrix",
          new Map([
            [
              "values",
              {
                name: "values",
                type: TypeResolver.resolve("f32"),
                isArray: true,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
                dimensions: [4, 4],
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFieldDimensions.get("Matrix")?.get("values")).toEqual([
        4, 4,
      ]);
    });
  });

  describe("convert enums", () => {
    it("should populate knownEnums set", () => {
      const enumSym: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "Color",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        members: TestEnumMembers.of("Color", { Red: 0, Green: 1, Blue: 2 }),
      };

      const info = TSymbolInfoAdapter.convert([enumSym]);

      expect(info.knownEnums.has("Color")).toBe(true);
    });

    it("should populate enumMembers map", () => {
      const enumSym: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "Priority",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        members: TestEnumMembers.of("Priority", { LOW: 0, MEDIUM: 1, HIGH: 2 }),
      };

      const info = TSymbolInfoAdapter.convert([enumSym]);

      expect(info.enumMembers.get("Priority")?.get("LOW")).toBe(0);
      expect(info.enumMembers.get("Priority")?.get("MEDIUM")).toBe(1);
      expect(info.enumMembers.get("Priority")?.get("HIGH")).toBe(2);
    });
  });

  describe("convert bitmaps", () => {
    it("should populate knownBitmaps set", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Status",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        backingType: "uint8_t",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "Status",
          new Map([["enabled", { offset: 0, width: 1 }]]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      expect(info.knownBitmaps.has("Status")).toBe(true);
    });

    it("should populate bitmapBackingType and bitmapBitWidth", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Control",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        backingType: "uint16_t",
        bitWidth: 16,
        fields: TestMembers.asBitmapFields(
          "Control",
          new Map([
            ["mode", { offset: 0, width: 4 }],
            ["channel", { offset: 4, width: 4 }],
            ["reserved", { offset: 8, width: 8 }],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      expect(info.bitmapBackingType.get("Control")).toBe("uint16_t");
      expect(info.bitmapBitWidth.get("Control")).toBe(16);
    });

    it("should populate bitmapFields with offset and width", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Flags",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        backingType: "uint8_t",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "Flags",
          new Map([
            ["enabled", { offset: 0, width: 1 }],
            ["mode", { offset: 1, width: 3 }],
            ["reserved", { offset: 4, width: 4 }],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      const fields = info.bitmapFields.get("Flags");
      expect(fields?.get("enabled")).toEqual({ offset: 0, width: 1 });
      expect(fields?.get("mode")).toEqual({ offset: 1, width: 3 });
      expect(fields?.get("reserved")).toEqual({ offset: 4, width: 4 });
    });
  });

  describe("convert scopes", () => {
    it("should populate knownScopes set", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      (motorScope.members as string[]).push("init", "run");
      (motorScope.memberVisibility as Map<string, string>).set(
        "init",
        "public",
      );
      (motorScope.memberVisibility as Map<string, string>).set(
        "run",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([motorScope]);

      expect(info.knownScopes.has("Motor")).toBe(true);
    });

    it("should populate scopeMembers with member names", () => {
      const ledScope = TestScopeUtils.createMockScope("LED");
      (ledScope.members as string[]).push("on", "off", "toggle");
      (ledScope.memberVisibility as Map<string, string>).set("on", "public");
      (ledScope.memberVisibility as Map<string, string>).set("off", "public");
      (ledScope.memberVisibility as Map<string, string>).set(
        "toggle",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([ledScope]);

      const members = info.scopeMembers.get("LED");
      expect(members?.has("on")).toBe(true);
      expect(members?.has("off")).toBe(true);
      expect(members?.has("toggle")).toBe(true);
    });

    it("should populate scopeMemberVisibility", () => {
      const timerScope = TestScopeUtils.createMockScope("Timer");
      (timerScope.members as string[]).push("start", "stop", "reset");
      (timerScope.memberVisibility as Map<string, string>).set(
        "start",
        "public",
      );
      (timerScope.memberVisibility as Map<string, string>).set(
        "stop",
        "public",
      );
      (timerScope.memberVisibility as Map<string, string>).set(
        "reset",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([timerScope]);

      const visibility = info.scopeMemberVisibility.get("Timer");
      expect(visibility?.get("start")).toBe("public");
      expect(visibility?.get("stop")).toBe("public");
      expect(visibility?.get("reset")).toBe("private");
    });
  });

  describe("convert registers", () => {
    it("should populate knownRegisters set", () => {
      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "GPIO",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        baseAddress: TestExpression.hex("0x40000000"),
        members: TestMembers.asRegisterMembers(
          "GPIO",
          new Map([
            [
              "DATA",
              {
                offset: TestExpression.hex("0x00"),
                type: TypeResolver.resolve("u32"),
                access: "rw",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.knownRegisters.has("GPIO")).toBe(true);
    });

    it("should populate registerBaseAddresses", () => {
      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "UART",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        baseAddress: TestExpression.hex("0x40001000"),
        members: TestMembers.asRegisterMembers(
          "UART",
          new Map([
            [
              "TX",
              {
                offset: TestExpression.hex("0x00"),
                type: TypeResolver.resolve("u32"),
                access: "wo",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.registerBaseAddresses.get("UART")).toMatchObject({
        text: "0x40001000",
      });
    });

    it("should populate register member info maps", () => {
      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "SPI",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        baseAddress: TestExpression.hex("0x40002000"),
        members: TestMembers.asRegisterMembers(
          "SPI",
          new Map([
            [
              "DATA",
              {
                offset: TestExpression.hex("0x00"),
                type: TypeResolver.resolve("u32"),
                access: "rw",
              },
            ],
            [
              "STATUS",
              {
                offset: TestExpression.hex("0x04"),
                type: TypeResolver.resolve("u8"),
                access: "ro",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.registerMemberAccess.get("SPI__DATA")).toBe("rw");
      expect(info.registerMemberAccess.get("SPI__STATUS")).toBe("ro");
      expect(info.registerMemberOffsets.get("SPI__DATA")).toMatchObject({
        text: "0x00",
      });
      expect(info.registerMemberOffsets.get("SPI__STATUS")).toMatchObject({
        text: "0x04",
      });
      expect(info.registerMemberCTypes.get("SPI__DATA")).toBe("uint32_t");
      expect(info.registerMemberCTypes.get("SPI__STATUS")).toBe("uint8_t");
    });

    it("should track bitmap types for register members", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "StatusFlags",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        backingType: "uint8_t",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "StatusFlags",
          new Map([["ready", { offset: 0, width: 1 }]]),
        ),
      };

      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "CTRL",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        baseAddress: TestExpression.hex("0x40003000"),
        members: TestMembers.asRegisterMembers(
          "CTRL",
          new Map([
            [
              "FLAGS",
              {
                offset: TestExpression.hex("0x00"),
                type: TypeResolver.resolve("StatusFlags"),
                access: "rw",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([bitmap, register]);

      // #1514: a bitmap member's C type is the bitmap's name, which is what
      // makes it a bitmap member wherever that bitmap is visible
      expect(info.registerMemberCTypes.get("CTRL__FLAGS")).toBe("StatusFlags");
      expect(info.knownBitmaps.has("StatusFlags")).toBe(true);
    });
  });

  describe("convert variables", () => {
    /**
     * #1398: a scoped variable is reached through its scope path, never bare.
     */
    const makeValue = (name: string, scopePath: string): IVariableSymbol => ({
      ...TestSymbolUtils.base({
        kind: "variable",
        name,
        scopePath,
        sourceFile: "lib.cnx",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cnx,
        visibility: "public",
      }),
      type: TypeResolver.resolve("u32"),
      isConst: true,
      isAtomic: false,
      isVolatile: false,
      overflowBehavior: "clamp",
      isArray: false,
      initialValue: "42",
    });

    it("records a scoped variable in scopeMembers", () => {
      const info = TSymbolInfoAdapter.convert([
        makeValue("MAX_SPEED", "Motor"),
      ]);

      expect(info.scopeMembers.get("Motor")?.has("MAX_SPEED")).toBe(true);
    });

    /**
     * #1295: `processVariable` is the OTHER half of the producer and had no
     * guard -- reverting its key to `ScopeUtils.leafOf(...)` left the entire
     * suite green, so the PR's mutation result covered `processScope` only. It
     * must file a nested scope's variable under the scope's WHOLE path, which
     * is the key `processScope` writes.
     *
     * The two halves must also agree regardless of EMISSION ORDER.
     * `processScope` replaced the member set unconditionally while
     * `processVariable` get-or-creates and adds, so a symbol array listing the
     * variable first lost it when the scope was processed after. Nothing
     * asserted that order -- it held only because `_collectScopeDeclaration`
     * happens to push the scope before its members, which is a coincidence of
     * emission, not a decision.
     */
    it("files a nested scope's variable under the whole path, in either order", () => {
      const scope: IScopeSymbol = {
        ...TestScopeUtils.createMockScope("Inner", "Outer"),
        members: ["token"],
        memberVisibility: new Map<string, TVisibility>([["token", "public"]]),
      };
      const variable = makeValue("count", "Outer.Inner");

      for (const order of [
        [scope, variable],
        [variable, scope],
      ]) {
        const info = TSymbolInfoAdapter.convert(order);

        expect(info.scopeMembers.get("Outer.Inner")?.has("count")).toBe(true);
        expect(info.scopeMembers.get("Outer.Inner")?.has("token")).toBe(true);
        // NEGATIVE CONTROL: the leaf must not be a key at all, or this would
        // pass just as well against the behavior it exists to forbid.
        expect(info.scopeMembers.has("Inner")).toBe(false);
      }
    });
  });

  describe("mixed symbols", () => {
    it("should handle array of different symbol types", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      (motorScope.members as string[]).push("init");
      (motorScope.memberVisibility as Map<string, string>).set(
        "init",
        "public",
      );

      const symbols = [
        {
          ...TestSymbolUtils.base({
            kind: "struct",
            name: "Point",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(1),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          fields: TestMembers.asStructFields(
            "Point",
            new Map([
              [
                "x",
                {
                  name: "x",
                  type: TypeResolver.resolve("i32"),
                  isArray: false,
                  isConst: false,
                  isAtomic: false,
                  isVolatile: false,
                  overflowBehavior: "clamp",
                },
              ],
            ]),
          ),
        } as IStructSymbol,
        {
          ...TestSymbolUtils.base({
            kind: "enum",
            name: "Color",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(5),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          members: TestEnumMembers.of("Color", { Red: 0, Green: 1 }),
        } as IEnumSymbol,
        motorScope,
        {
          ...TestSymbolUtils.base({
            kind: "function",
            name: "main",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(15),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          returnType: TypeResolver.resolve("void"),
          returnOverflowBehavior: "clamp",
          visibility: "public",
          parameters: [],
        } as IFunctionSymbol,
      ];

      const info = TSymbolInfoAdapter.convert(symbols);

      expect(info.knownStructs.has("Point")).toBe(true);
      expect(info.knownEnums.has("Color")).toBe(true);
      expect(info.knownScopes.has("Motor")).toBe(true);
    });
  });

  // Issue #1333: a scope may be reopened across files, so an included file's
  // scope types must cross the include boundary. Only knownEnums did -- and
  // enumMembers crossed with it, which is why enums were the only kind that
  // ever worked. A bitmap's NAME alone lets the type resolve and then hard-error
  // on the field lookup behind it.
  //
  // Covered here rather than only in tests/bugs/issue-1333-scope-reopening/
  // because integration fixtures do not feed the coverage metric.

  describe("#1301: convert() must not read arrayDimensions", () => {
    /**
     * #1301 shares one declare between transpiler stages 3 and 5, so `convert()`
     * now receives symbols that Stage 3b has already mutated:
     * `SymbolTable.resolveVariableArrayDimensions` casts the readonly view away and
     * REPLACES `arrayDimensions` wholesale, between the cache write and the cache
     * read. Unlike the other mutations of a shared symbol, that one is destructive
     * rather than additive.
     *
     * It is benign only because `convert()` never reads the field. That is a
     * property, not a coincidence to be remembered, so it is asserted here: two
     * symbols differing ONLY in `arrayDimensions` must convert identically. If
     * `convert()` ever starts reading it, this fails and whoever made that change
     * learns that the sharing in #1301 is what their change interacts with.
     */
    it("produces identical output for symbols differing only in arrayDimensions", () => {
      const makeVariable = (
        dimensions: (number | string)[],
      ): IVariableSymbol => ({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "BUFFER",
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TypeResolver.resolve("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: dimensions,
        initialValue: undefined,
      });

      // "BUF_LEN" is the unresolved macro form; [16] is what Stage 3b replaces it
      // with. Both must convert to the same ICodeGenSymbols.
      const unresolved = TSymbolInfoAdapter.convert([
        makeVariable(["BUF_LEN"]),
      ]);
      const resolved = TSymbolInfoAdapter.convert([makeVariable([16])]);

      expect(JSON.stringify(resolved, jsonReplacer)).toBe(
        JSON.stringify(unresolved, jsonReplacer),
      );
    });
  });

  /**
   * #1295: the three scope collections are keyed by the scope's identity, not by
   * its leaf name. Two distinct scopes sharing a leaf collide, and the second
   * write silently replaces the first.
   *
   * This is a unit test rather than a fixture because it has to be. `scopeMember`
   * admits no `scopeDeclaration` and ADR-016 makes that prohibition permanent
   * (#1306), so no `.cnx` program can build two scopes sharing a leaf -- nothing
   * under `tests/` can redden. The collision is reachable only through the symbol
   * model, which is exactly why it went unnoticed.
   */
  describe("scope collections are keyed by identity, not leaf (#1295)", () => {
    const scopeWithMembers = (
      name: string,
      parentPath: string,
      memberVisibility: ReadonlyMap<string, TVisibility>,
    ): IScopeSymbol => ({
      ...TestScopeUtils.createMockScope(name, parentPath),
      members: [...memberVisibility.keys()],
      memberVisibility,
    });

    /** `Outer.Inner` and `Other.Inner` -- distinct scopes, same leaf. */
    const outerInner = scopeWithMembers(
      "Inner",
      "Outer",
      new Map<string, TVisibility>([["token", "public"]]),
    );
    const otherInner = scopeWithMembers(
      "Inner",
      "Other",
      new Map<string, TVisibility>([["hidden", "private"]]),
    );

    it("keeps two scopes that share a leaf name distinct", () => {
      const symbols = TSymbolInfoAdapter.convert([outerInner, otherInner]);

      expect(symbols.knownScopes.has("Outer.Inner")).toBe(true);
      expect(symbols.knownScopes.has("Other.Inner")).toBe(true);
    });

    it("does not leak one scope's members into the other", () => {
      const symbols = TSymbolInfoAdapter.convert([outerInner, otherInner]);

      expect(symbols.scopeMembers.get("Outer.Inner")?.has("token")).toBe(true);
      expect(symbols.scopeMembers.get("Outer.Inner")?.has("hidden")).toBe(
        false,
      );
      expect(symbols.scopeMembers.get("Other.Inner")?.has("hidden")).toBe(true);
      expect(symbols.scopeMembers.get("Other.Inner")?.has("token")).toBe(false);
    });

    /**
     * The sharper consequence named by the issue: a `private` member of one
     * scope checked against the other scope's visibility map decides cross-scope
     * access control with the wrong scope's rules.
     */
    it("decides member visibility with the owning scope's rules", () => {
      const symbols = TSymbolInfoAdapter.convert([outerInner, otherInner]);

      expect(
        symbols.scopeMemberVisibility.get("Outer.Inner")?.get("token"),
      ).toBe("public");
      expect(
        symbols.scopeMemberVisibility.get("Other.Inner")?.get("hidden"),
      ).toBe("private");
    });

    /**
     * NEGATIVE CONTROL. Every assertion above is also satisfied by a lookup that
     * simply misses, so a change breaking every key would pass them. A file-scope
     * scope has no enclosing path, so its identity IS its leaf: these must keep
     * resolving on the bare name, and this case must stay green throughout.
     */
    it("leaves file-scope scopes addressable by their bare name", () => {
      const motor = scopeWithMembers(
        "Motor",
        "",
        new Map<string, TVisibility>([["start", "public"]]),
      );
      const pump = scopeWithMembers(
        "Pump",
        "",
        new Map<string, TVisibility>([["prime", "private"]]),
      );
      const symbols = TSymbolInfoAdapter.convert([motor, pump]);

      expect(symbols.knownScopes.has("Motor")).toBe(true);
      expect(symbols.scopeMembers.get("Motor")?.has("start")).toBe(true);
      expect(symbols.scopeMemberVisibility.get("Pump")?.get("prime")).toBe(
        "private",
      );
    });
  });
});

/** Maps and Sets do not survive JSON.stringify on their own. */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return { __map: [...value.entries()] };
  }
  if (value instanceof Set) {
    return { __set: [...value] };
  }
  return value;
}
