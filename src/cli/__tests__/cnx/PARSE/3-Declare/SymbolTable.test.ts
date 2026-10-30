/**
 * Unit tests for SymbolTable
 * Issue #221: Function parameters should not cause conflicts
 * ADR-055 Phase 7: Fully typed symbol storage using TSymbol, TCSymbol, TCppSymbol
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TSymbol from "../../../../../cnx/types/symbols/TSymbol";
import IVariableSymbol from "../../../../../cnx/types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../../../cnx/types/symbols/IFunctionSymbol";
import IEnumSymbol from "../../../../../cnx/types/symbols/IEnumSymbol";
import TargetResolver from "../../../../TargetResolver";
import TTypeUtils from "../../../../../cnx/utils/TTypeUtils";
import TCSymbol from "../../../../../cnx/types/symbols/c/TCSymbol";
import TCppSymbol from "../../../../../cnx/types/symbols/cpp/TCppSymbol";
import TestSymbolUtils from "../../../../../cnx/PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import TVisibility from "../../../../../cnx/types/TVisibility";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import NodeFileSystem from "../../../../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // TSymbol (cnx) Operations
  // ========================================================================

  describe("addTSymbol and getTSymbol", () => {
    it("should add and retrieve a TSymbol by name", () => {
      const symbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "myVar",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      };

      symbolTable.addTSymbol(symbol);
      const retrieved = symbolTable.getTSymbol("myVar");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myVar");
      expect(retrieved?.kind).toBe("variable");
    });

    it("should return undefined for non-existent symbol", () => {
      const retrieved = symbolTable.getTSymbol("nonExistent");
      expect(retrieved).toBeUndefined();
    });

    it("should return first symbol when multiple exist with same name", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "",
          sourceFile: "first.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "",
          sourceFile: "second.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      const retrieved = symbolTable.getTSymbol("duplicate");
      expect(retrieved?.sourceFile).toBe("first.cnx");
    });
  });

  describe("addTSymbols", () => {
    it("should add multiple TSymbols at once", () => {
      const symbols: TSymbol[] = [
        {
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "var1",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(1),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        },
        {
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "var2",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(2),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          type: TTypeUtils.createPrimitive("i32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        },
      ];

      symbolTable.addTSymbols(symbols);

      expect(symbolTable.getTSymbol("var1")).toBeDefined();
      expect(symbolTable.getTSymbol("var2")).toBeDefined();
    });
  });

  // ========================================================================
  // TCSymbol (C) Operations
  // ========================================================================

  describe("addCSymbol and getCSymbol", () => {
    it("should add and retrieve a C symbol", () => {
      const symbol: TCSymbol = {
        kind: "function",
        name: "c_function",
        sourceFile: "test.h",
        span: TestSourceSpan.at(10),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "int",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      };

      symbolTable.addCSymbol(symbol);
      const retrieved = symbolTable.getCSymbol("c_function");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("c_function");
      expect(retrieved?.kind).toBe("function");
      expect(retrieved?.sourceLanguage).toBe(ESourceLanguage.C);
    });
  });

  // ========================================================================
  // TCppSymbol (C++) Operations
  // ========================================================================

  describe("addCppSymbol and getCppSymbol", () => {
    it("should add and retrieve a C++ symbol", () => {
      const symbol: TCppSymbol = {
        kind: "class",
        name: "MyClass",
        unqualifiedName: "MyClass",
        sourceFile: "test.hpp",
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
      };

      symbolTable.addCppSymbol(symbol);
      const retrieved = symbolTable.getCppSymbol("MyClass");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("MyClass");
      expect(retrieved?.kind).toBe("class");
      expect(retrieved?.sourceLanguage).toBe(ESourceLanguage.Cpp);
    });

    it("finds a member by its owner and unqualified name (#2116)", () => {
      const at = {
        sourceFile: "test.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
      } as const;
      symbolTable.addCppSymbol({
        ...at,
        kind: "namespace",
        name: "Outer",
        unqualifiedName: "Outer",
      });
      symbolTable.addCppSymbol({
        ...at,
        kind: "class",
        name: "Outer::Widget",
        unqualifiedName: "Widget",
        parent: "Outer",
      });

      expect(symbolTable.getCppMembers(undefined, "Outer")[0]?.name).toBe(
        "Outer",
      );
      expect(symbolTable.getCppMembers("Outer", "Widget")[0]?.name).toBe(
        "Outer::Widget",
      );
      expect(symbolTable.getCppMembers(undefined, "Widget")).toEqual([]);
    });
  });

  // ========================================================================
  // Cross-Language Operations
  // ========================================================================

  describe("getAllSymbols", () => {
    it("should return symbols from all languages", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "cnxVar",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addCSymbol({
        kind: "variable",
        name: "cVar",
        sourceFile: "test.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "int",
      });

      symbolTable.addCppSymbol({
        kind: "variable",
        name: "cppVar",
        unqualifiedName: "cppVar",
        sourceFile: "test.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        type: "int",
      });

      const all = symbolTable.getAllSymbols();
      expect(all).toHaveLength(3);
    });
  });

  describe("getOverloads", () => {
    it("should return overloads from all languages", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "process",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      symbolTable.addCppSymbol({
        kind: "function",
        name: "process",
        unqualifiedName: "process",
        sourceFile: "test.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        type: "void",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      });

      const overloads = symbolTable.getOverloads("process");
      expect(overloads).toHaveLength(2);
    });
  });

  // ========================================================================
  // Conflict Detection
  // ========================================================================

  // ========================================================================
  // Struct Field Information
  // ========================================================================

  describe("struct fields", () => {
    it("should add and retrieve struct field information", () => {
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      expect(symbolTable.getStructFields("Point")?.get("x")?.type).toBe("int");
      expect(symbolTable.getStructFields("Point")?.get("y")?.type).toBe("int");
    });

    it("should return undefined for non-existent struct or field", () => {
      expect(
        symbolTable.getStructFields("NonExistent")?.get("x")?.type,
      ).toBeUndefined();
    });

    it("should get all fields for a struct", () => {
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      const fields = symbolTable.getStructFields("Point");
      expect(fields?.size).toBe(2);
    });

    it("Issue #981: addCSymbol should register struct fields with macro dimensions", () => {
      // When a C struct with macro-sized array fields is added via addCSymbol,
      // the fields should be registered in structFields for the operand typer's field lookups
      const cStructSymbol: TCSymbol = {
        kind: "struct",
        name: "msg_t",
        sourceFile: "fake_lib.h",
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
        fields: new Map([
          [
            "data",
            { name: "data", type: "uint8_t", arrayDimensions: ["BUF_SIZE"] },
          ],
        ]),
      };

      symbolTable.addCSymbol(cStructSymbol);

      // Struct fields should now be registered
      const fields = symbolTable.getStructFields("msg_t");
      expect(fields).toBeDefined();
      expect(fields?.size).toBe(1);

      // Field info should include the macro-sized array dimension
      const dataField = symbolTable.getStructFieldInfo("msg_t", "data");
      expect(dataField).toBeDefined();
      expect(dataField?.type).toBe("uint8_t");
      expect(dataField?.arrayDimensions).toEqual(["BUF_SIZE"]);
    });
  });

  // ========================================================================
  // Needs Struct Keyword Tracking
  // ========================================================================

  describe("needsStructKeyword", () => {
    it("should track structs requiring struct keyword", () => {
      symbolTable.markNeedsStructKeyword("RawStruct");

      expect(symbolTable.checkNeedsStructKeyword("RawStruct")).toBe(true);
      expect(symbolTable.checkNeedsStructKeyword("OtherStruct")).toBe(false);
    });
  });

  // ========================================================================
  // Enum Bit Width Tracking
  // ========================================================================

  describe("enumBitWidth", () => {
    it("should track enum bit widths", () => {
      symbolTable.addEnumBitWidth("SmallEnum", 8);
      symbolTable.addEnumBitWidth("LargeEnum", 32);

      expect(symbolTable.getEnumBitWidth("SmallEnum")).toBe(8);
      expect(symbolTable.getEnumBitWidth("LargeEnum")).toBe(32);
      expect(symbolTable.getEnumBitWidth("UnknownEnum")).toBeUndefined();
    });
  });

  // ========================================================================
  // Opaque Type Tracking (Issue #948)
  // ========================================================================

  describe("Opaque Type Tracking", () => {
    it("should mark and check opaque types", () => {
      symbolTable.markOpaqueType("widget_t");
      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
      expect(symbolTable.isOpaqueType("other_t")).toBe(false);
    });

    it("should resolve opaque type as non-opaque when struct tag has body", () => {
      // typedef struct _point point_t; → mark opaque + register alias
      symbolTable.markOpaqueType("point_t");
      symbolTable.registerStructTagAlias("_point", "point_t");
      expect(symbolTable.isOpaqueType("point_t")).toBe(true);

      // struct _point { int x; int y; }; → mark body
      symbolTable.markStructTagHasBody("_point");
      // Query-time resolution: no longer opaque
      expect(symbolTable.isOpaqueType("point_t")).toBe(false);
    });

    it("should keep opaque type when no body found for struct tag", () => {
      symbolTable.markOpaqueType("handle_t");
      symbolTable.registerStructTagAlias("_handle", "handle_t");
      // No markStructTagHasBody call → stays opaque
      expect(symbolTable.isOpaqueType("handle_t")).toBe(true);
    });

    it("should get all opaque types", () => {
      symbolTable.markOpaqueType("handle_t");
      symbolTable.markOpaqueType("context_t");
      const all = symbolTable.getAllOpaqueTypes();
      expect(all).toContain("handle_t");
      expect(all).toContain("context_t");
      expect(all).toHaveLength(2);
    });

    it("should restore opaque types from cache", () => {
      // Issue #1225: round-trip through the real serializer rather than a
      // hand-built payload -- a payload the production path never writes can
      // pass while the production path is broken.
      const source = new SymbolTable();
      source.markOpaqueType("widget_t");
      source.markOpaqueType("handle_t");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
      expect(symbolTable.isOpaqueType("handle_t")).toBe(true);
      expect(symbolTable.getAllOpaqueTypes()).toHaveLength(2);
    });

    it("clearStructTagHasBody restores opacity for a phantom body (#985)", () => {
      symbolTable.markOpaqueType("obj_t");
      symbolTable.registerStructTagAlias("_obj", "obj_t");
      symbolTable.markStructTagHasBody("_obj"); // phantom body from a blob parse
      expect(symbolTable.isOpaqueType("obj_t")).toBe(false);

      symbolTable.clearStructTagHasBody("_obj");
      expect(symbolTable.isOpaqueType("obj_t")).toBe(true);
      expect(symbolTable.getAllStructTagsWithBodies()).not.toContain("_obj");
    });

    it("clearStructTagHasBody is a no-op when the tag has no body", () => {
      // Must not throw or spuriously mutate when the tag was never marked.
      expect(() => symbolTable.clearStructTagHasBody("_never")).not.toThrow();
      expect(symbolTable.getAllStructTagsWithBodies()).not.toContain("_never");
    });

    it("getStructTagForTypedef returns the aliased tag or undefined", () => {
      symbolTable.registerStructTagAlias("_lv_obj_t", "lv_obj_t");
      expect(symbolTable.getStructTagForTypedef("lv_obj_t")).toBe("_lv_obj_t");
      expect(symbolTable.getStructTagForTypedef("unknown_t")).toBeUndefined();
    });
  });

  // ========================================================================
  // External Declaration Names (Issue #985 macro recovery)
  // ========================================================================

  describe("External Declaration Names", () => {
    it("registers and looks up recovered function-like macro names", () => {
      expect(symbolTable.hasExternalDeclaration("pdMS_TO_TICKS")).toBe(false);
      symbolTable.addExternalDeclarationNames(
        new Set(["pdMS_TO_TICKS", "portTICK_PERIOD_MS"]),
      );
      expect(symbolTable.hasExternalDeclaration("pdMS_TO_TICKS")).toBe(true);
      expect(symbolTable.hasExternalDeclaration("portTICK_PERIOD_MS")).toBe(
        true,
      );
      expect(symbolTable.hasExternalDeclaration("not_recovered")).toBe(false);
    });

    it("accumulates across calls and tolerates an empty set", () => {
      symbolTable.addExternalDeclarationNames(new Set(["A"]));
      symbolTable.addExternalDeclarationNames(new Set());
      symbolTable.addExternalDeclarationNames(new Set(["B"]));
      expect(symbolTable.hasExternalDeclaration("A")).toBe(true);
      expect(symbolTable.hasExternalDeclaration("B")).toBe(true);
    });
  });

  // Typedef struct type tracking (#958) had its own mark and its own copy of
  // the #948 body rule. StructCollector set it under exactly the condition it
  // sets the opaque mark, so it is folded into that mark; the opaque tests
  // above (mark, #948 body resolution, restore from cache) cover it.

  // ========================================================================
  // Struct Tag Aliases and Body Tracking (Issue #958)
  // ========================================================================

  describe("Struct Tag Aliases and Body Tracking", () => {
    it("should register and retrieve struct tag aliases", () => {
      symbolTable.registerStructTagAlias("_widget", "widget_t");
      expect(symbolTable.getStructTagForTypedef("widget_t")).toBe("_widget");
      expect(symbolTable.getStructTagForTypedef("unknown_t")).toBeUndefined();
    });

    it("should track struct tags with bodies", () => {
      symbolTable.markStructTagHasBody("_widget");
      const bodies = symbolTable.getAllStructTagsWithBodies();
      expect(bodies).toContain("_widget");
    });

    it("should restore struct tag aliases from cache", () => {
      const source = new SymbolTable();
      source.registerStructTagAlias("_foo", "foo_t");
      source.registerStructTagAlias("_bar", "bar_t");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.getStructTagForTypedef("foo_t")).toBe("_foo");
      expect(symbolTable.getStructTagForTypedef("bar_t")).toBe("_bar");
    });

    it("should restore reverse map (typedefToTag) so isOpaqueType resolves after cache restore", () => {
      const opaque = new SymbolTable();
      opaque.registerStructTagAlias("_widget", "widget_t");
      opaque.markOpaqueType("widget_t");

      symbolTable.restoreStructState(opaque.serializeStructState());

      // widget_t is opaque (no body for _widget)
      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);

      // Now restore a body — isOpaqueType resolves via typedefToTag, which
      // only works because serializeStructState captures that map too.
      const withBody = new SymbolTable();
      withBody.markStructTagHasBody("_widget");
      symbolTable.restoreStructState(withBody.serializeStructState());

      expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
    });

    it("should restore struct tags with bodies from cache", () => {
      const source = new SymbolTable();
      source.markStructTagHasBody("_foo");
      source.markStructTagHasBody("_bar");

      symbolTable.restoreStructState(source.serializeStructState());

      const bodies = symbolTable.getAllStructTagsWithBodies();
      expect(bodies).toContain("_foo");
      expect(bodies).toContain("_bar");
    });

    it("carries pointer typedefs across the cache round trip (#1225)", () => {
      // #1164 recorded `typedef struct opaque_t* handle_t` in structState and
      // nothing captured it, so a warm-cache build forgot that handle_t is a
      // pointer and forward-declared it as an incomplete struct -- a different
      // type, in a header that cannot compile.
      const source = new SymbolTable();
      source.markPointerTypedef("handle_t");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.isPointerTypedef("handle_t")).toBe(true);
    });

    it("carries a struct's layout across the cache round trip (#1975 review)", () => {
      // A warm-cache build that forgot `Un` is a union would sum its fields
      const source = new SymbolTable();
      source.setStructLayout("Un", "union");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.getStructLayout("Un")).toBe("union");
      expect(symbolTable.getStructLayout("Cfg")).toBeNull();
    });

    it("drops a cached layout it does not know", () => {
      const state = new SymbolTable().serializeStructState();

      symbolTable.restoreStructState({
        ...state,
        // A cache written by a build that knew a layout this one does not
        structLayouts: JSON.parse('[["Un", "padded"]]'),
      });

      expect(symbolTable.getStructLayout("Un")).toBeNull();
    });
  });

  // ========================================================================
  // Clear
  // ========================================================================

  // ========================================================================
  // MISRA C:2012 Rule 5.1 - External Identifier Length (issue #1307)
  // ========================================================================

  describe("detectMISRA51Conflicts", () => {
    const LONG_SCOPE = "TemperatureSensorController";

    // A real catalog row, budget 31: C99's guarantee
    const targetCaps = TargetResolver.byName(
      "cortex-m7",
      NodeFileSystem.instance,
    )!;

    /** A scope member variable, public unless told otherwise. */
    function scopeVariable(
      name: string,
      line: number,
      visibility: TVisibility = "public",
      scopeName = LONG_SCOPE,
    ): IVariableSymbol {
      return {
        ...TestSymbolUtils.base({
          kind: "variable",
          name,
          scopePath: scopeName,
          sourceFile: "sensor.cnx",
          span: TestSourceSpan.at(line),
          visibility,
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      };
    }

    it("reports the two members that share a truncated prefix", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const conflicts = table.detectMISRA51Conflicts(targetCaps);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe("error");
      expect(conflicts[0].definitions).toHaveLength(2);
      expect(conflicts[0].message).toContain("MISRA C:2012 Rule 5.1");
      // The code is a field on the conflict, not text inside the message: the
      // consumer renders `error[<code>]`. Asserting it in the message text is
      // what let #1339's producer and #1342's consumer each apply a code
      // independently.
      expect(conflicts[0].code).toBe("E0204");
      expect(conflicts[0].message).not.toContain("E0204");
      // Position comes from the conflict, not re-derived downstream.
      expect(conflicts[0].line).toBe(2);
      expect(conflicts[0].column).toBe(0);
    });

    it("names the cnx names the author wrote, not the generated ones", () => {
      // #1292: `TemperatureSensorController__calibrationOffsetValue` appears in
      // no source file, so pointing at it does not help anyone rename anything.
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const message = table.detectMISRA51Conflicts(targetCaps)[0].message;

      expect(message).toContain(
        `${LONG_SCOPE}.calibrationOffsetValue (sensor.cnx:2)`,
      );
      expect(message).toContain(
        `${LONG_SCOPE}.calibrationOffsetLimit (sensor.cnx:3)`,
      );
      expect(message).not.toContain(`${LONG_SCOPE}__calibrationOffsetValue`);
    });

    it("groups three colliding members into one diagnostic", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));
      table.addTSymbol(scopeVariable("calibrationOffsetScale", 4));

      const conflicts = table.detectMISRA51Conflicts(targetCaps);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].definitions).toHaveLength(3);
    });

    it("stays silent when the names diverge inside the limit", () => {
      const table = new SymbolTable();
      // "...__re" vs "...__ra" -- they differ at exactly the 31st character.
      table.addTSymbol(scopeVariable("readValue", 2));
      table.addTSymbol(scopeVariable("rawValue", 3));

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("stays silent for a declaration registered more than once", () => {
      // One file reached along two include paths is one identifier, not two.
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it.each([
      { limit: 63, expected: 0, why: "a wider budget separates them" },
      { limit: 31, expected: 1, why: "C99's guarantee does not" },
      { limit: 20, expected: 1, why: "a narrower budget does not either" },
    ])("honours the target's limit of $limit ($why)", ({ limit, expected }) => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const conflicts = table.detectMISRA51Conflicts({
        ...targetCaps,
        external_identifier_chars: limit,
      });

      expect(conflicts).toHaveLength(expected);
    });

    it("ignores private members, which are emitted static", () => {
      // ADR-016 emits `private` as `static`. Internal linkage gets 63
      // significant characters under a different rule, not 31 under 5.1.
      const table = new SymbolTable();
      table.addTSymbol(
        scopeVariable("shadowRegisterMirrorAlpha", 2, "private"),
      );
      table.addTSymbol(
        scopeVariable("shadowRegisterMirrorOmega", 3, "private"),
      );

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("ignores types, which name nothing the linker resolves", () => {
      const table = new SymbolTable();
      const scopePath = LONG_SCOPE;
      for (const [name, line] of [
        ["calibrationProfileAlpha", 2],
        ["calibrationProfileOmega", 3],
      ] as Array<[string, number]>) {
        table.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "enum",
            name,
            scopePath,
            sourceFile: "sensor.cnx",
            span: TestSourceSpan.at(line),
          }),
          members: [],
        } as unknown as IEnumSymbol);
      }

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("ignores C and C++ header symbols", () => {
      // A header's identifiers are not this transpiler's to rename, and C++
      // names are mangled rather than truncated.
      const table = new SymbolTable();
      const colliding = [
        "TemperatureSensorController__calibrationValue",
        "TemperatureSensorController__calibrationLimit",
      ];

      table.addCSymbol({
        kind: "function",
        name: colliding[0],
        sourceFile: "sensor.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "void",
        parameters: [],
      } as TCSymbol);
      table.addCppSymbol({
        kind: "function",
        name: colliding[1],
        sourceFile: "sensor.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        returnType: "void",
        returnOverflowBehavior: "clamp",
        parameters: [],
      } as unknown as TCppSymbol);

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("reports a global colliding with a scope member", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "TemperatureSensorController__calibrationOffsetLimit",
          sourceFile: "sensor.cnx",
          span: TestSourceSpan.at(9),
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      } as IVariableSymbol);

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(1);
    });
  });

  // #1610: a C typedef's null-pointer fact, followed through typedef chains
  describe("isCPointerTypedef", () => {
    const typedefs = (
      entries: ReadonlyArray<[string, string]>,
    ): SymbolTable => {
      const table = new SymbolTable();
      for (const [name, type] of entries) {
        table.addCSymbol({
          name,
          kind: "type",
          sourceLanguage: ESourceLanguage.C,
          sourceFile: "types.h",
          span: TestSourceSpan.at(1),
          visibility: "public",
          type,
        });
      }
      return table;
    };

    it("is true for a typedef spelling `*` or `(*)`", () => {
      const table = typedefs([
        ["vhandle_t", "void *"],
        ["isr_t", "void (*)(void)"],
      ]);
      expect(table.isCPointerTypedef("vhandle_t")).toBe(true);
      expect(table.isCPointerTypedef("isr_t")).toBe(true);
    });

    it("follows a typedef of a pointer typedef, through qualifiers", () => {
      const table = typedefs([
        ["vhandle_t", "void *"],
        ["vh2_t", "vhandle_t"],
        ["vh3_t", "const vh2_t"],
      ]);
      expect(table.isCPointerTypedef("vh2_t")).toBe(true);
      expect(table.isCPointerTypedef("vh3_t")).toBe(true);
    });

    it("is false for a non-pointer chain, an unknown name and a cycle", () => {
      const table = typedefs([
        ["u32_t", "unsigned int"],
        ["count_t", "u32_t"],
        ["loop_a", "loop_b"],
        ["loop_b", "loop_a"],
      ]);
      expect(table.isCPointerTypedef("count_t")).toBe(false);
      expect(table.isCPointerTypedef("nope_t")).toBe(false);
      expect(table.isCPointerTypedef("loop_a")).toBe(false);
    });
  });
});
