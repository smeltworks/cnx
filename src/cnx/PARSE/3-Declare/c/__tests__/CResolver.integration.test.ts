/**
 * Integration tests for CResolver
 * Migrated from CSymbolCollector tests to test the new composable collector pattern.
 */

import { describe, expect, it } from "vitest";
import CResolver from "../index";
import TestHelpers from "./testHelpers";
import SymbolTable from "../../SymbolTable";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("CResolver - Basic Functionality", () => {
  it("returns empty result for empty translation unit", () => {
    const tree = TestHelpers.parseC("");
    expect(tree).toBeDefined();
    const result = CResolver.resolve(tree!, "test.h");
    expect(result.symbols).toEqual([]);
  });

  it("tracks source file correctly", () => {
    const tree = TestHelpers.parseC(`void foo();`);
    const result = CResolver.resolve(tree!, "myfile.h");
    expect(result.symbols[0].sourceFile).toBe("myfile.h");
  });

  it("tracks source line numbers", () => {
    const tree = TestHelpers.parseC(`

void foo();`);
    const result = CResolver.resolve(tree!, "test.h");
    expect(result.symbols[0].span.line).toBe(3);
  });

  it("sets source language to C", () => {
    const tree = TestHelpers.parseC(`void foo();`);
    const result = CResolver.resolve(tree!, "test.h");
    expect(result.symbols[0].sourceLanguage).toBe(ESourceLanguage.C);
  });

  it("returns empty warnings initially", () => {
    const tree = TestHelpers.parseC(`void foo();`);
    const result = CResolver.resolve(tree!, "test.h");
    expect(result.warnings).toEqual([]);
  });
});

describe("CResolver - Function Definitions", () => {
  it("collects function definition", () => {
    const tree = TestHelpers.parseC(`void foo() { }`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    const symbol = result.symbols[0];
    expect(symbol.name).toBe("foo");
    expect(symbol.kind).toBe("function");
    if (symbol.kind === "function") {
      expect(symbol.type).toBe("void");
      expect(symbol.isDeclaration).toBe(false);
    }
    expect(symbol.visibility).toBe("public");
  });

  it("collects function with return type", () => {
    const tree = TestHelpers.parseC(`int getCount() { return 0; }`);
    const result = CResolver.resolve(tree!, "test.h");

    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].type).toBe("int");
    }
  });

  it("collects function with complex return type", () => {
    const tree = TestHelpers.parseC(`unsigned long getValue() { return 0; }`);
    const result = CResolver.resolve(tree!, "test.h");

    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].type).toBe("unsigned long");
    }
  });

  it("defaults to int when no return type specified", () => {
    const tree = TestHelpers.parseC(`foo() { }`);
    const result = CResolver.resolve(tree!, "test.h");

    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].type).toBe("int");
    }
  });

  it("collects multiple function definitions", () => {
    const tree = TestHelpers.parseC(`
      void init() { }
      int process() { return 0; }
      void cleanup() { }
    `);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(3);
    expect(result.symbols.map((s) => s.name)).toEqual([
      "init",
      "process",
      "cleanup",
    ]);
  });
});

describe("CResolver - Function Prototypes", () => {
  it("collects function prototype", () => {
    const tree = TestHelpers.parseC(`void bar();`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    const symbol = result.symbols[0];
    expect(symbol.name).toBe("bar");
    expect(symbol.kind).toBe("function");
    if (symbol.kind === "function") {
      expect(symbol.isDeclaration).toBe(true);
    }
    expect(symbol.visibility).toBe("public");
  });

  it("collects extern function prototype", () => {
    const tree = TestHelpers.parseC(`extern void externalFunc();`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("externalFunc");
    expect(result.symbols[0].visibility).toBe("public");
    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].isDeclaration).toBe(true);
    }
  });

  it("collects function prototype with parameters", () => {
    const tree = TestHelpers.parseC(`int add(int a, int b);`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("add");
    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].type).toBe("int");
    }
  });
});

describe("CResolver - Variable Declarations", () => {
  it("collects global variable", () => {
    const tree = TestHelpers.parseC(`int counter;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    const symbol = result.symbols[0];
    expect(symbol.name).toBe("counter");
    expect(symbol.kind).toBe("variable");
    if (symbol.kind === "variable") {
      expect(symbol.type).toBe("int");
    }
    expect(symbol.visibility).toBe("public");
  });

  // #1760 review: the spelling keeps `volatile`, as a struct field's does, so
  // the typer knows a read of it has a side effect
  it("keeps volatile in a variable's and a typedef's spelling", () => {
    const tree = TestHelpers.parseC(`extern volatile float vf;
typedef volatile float volatile_float_t;
typedef volatile float vec3[3];
extern float nf;`);
    const result = CResolver.resolve(tree!, "test.h");
    const typeOf = (name: string) => {
      const symbol = result.symbols.find((s) => s.name === name);
      return symbol && "type" in symbol ? symbol.type : undefined;
    };
    expect(typeOf("vf")).toBe("volatile float");
    expect(typeOf("volatile_float_t")).toBe("volatile float");
    // An array typedef keeps its dimensions when it is volatile too
    const vec3 = result.symbols.find((s) => s.name === "vec3");
    expect(vec3).toMatchObject({
      type: "volatile float",
      arrayDimensions: [3],
    });
    // Control: a plain variable is unchanged
    expect(typeOf("nf")).toBe("float");
  });

  it("collects extern variable", () => {
    const tree = TestHelpers.parseC(`extern int globalValue;`);
    const result = CResolver.resolve(tree!, "test.h");

    const symbol = result.symbols[0];
    expect(symbol.name).toBe("globalValue");
    expect(symbol.kind).toBe("variable");
    expect(symbol.visibility).toBe("public");
    if (symbol.kind === "variable") {
      expect(symbol.isExtern).toBe(true);
    }
  });

  it("collects multiple variables in one declaration", () => {
    const tree = TestHelpers.parseC(`int x, y, z;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(3);
    expect(result.symbols.map((s) => s.name)).toEqual(["x", "y", "z"]);
    result.symbols.forEach((s) => {
      expect(s.kind).toBe("variable");
      if (s.kind === "variable") {
        expect(s.type).toBe("int");
      }
    });
  });

  it("detects pointer type in variable declaration (Issue #978)", () => {
    const tree = TestHelpers.parseC(
      `typedef struct { int x; } point_t;\nextern const point_t *origin;`,
    );
    const result = CResolver.resolve(tree!, "test.h");

    const varSymbol = result.symbols.find((s) => s.name === "origin");
    expect(varSymbol).toBeDefined();
    expect(varSymbol?.kind).toBe("variable");
    if (varSymbol?.kind === "variable") {
      expect(varSymbol.type).toBe("point_t*");
    }
  });

  it("does not add pointer suffix for non-pointer variables (Issue #978)", () => {
    const tree = TestHelpers.parseC(
      `typedef struct { int x; } point_t;\nextern const point_t origin;`,
    );
    const result = CResolver.resolve(tree!, "test.h");

    const varSymbol = result.symbols.find((s) => s.name === "origin");
    expect(varSymbol).toBeDefined();
    expect(varSymbol?.kind).toBe("variable");
    if (varSymbol?.kind === "variable") {
      expect(varSymbol.type).toBe("point_t");
    }
  });
});

describe("CResolver - Typedefs", () => {
  it("collects simple typedef", () => {
    const tree = TestHelpers.parseC(`typedef int MyInt;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    const symbol = result.symbols[0];
    expect(symbol.name).toBe("MyInt");
    expect(symbol.kind).toBe("type");
    if (symbol.kind === "type") {
      expect(symbol.type).toBe("int");
    }
    expect(symbol.visibility).toBe("public");
  });

  it("collects typedef with unsigned type", () => {
    const tree = TestHelpers.parseC(`typedef unsigned char uint8_t;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("uint8_t");
    expect(result.symbols[0].kind).toBe("type");
  });

  // #1668: `getText()` concatenated a specifier's tokens, running the
  // keyword into the tag, which no lookup matches -- so a C enum operand had
  // no essential type. One spelling for every declaration shape.
  it.each([
    [
      "enum tag_e { A, B };\ntypedef enum tag_e tagged_t;",
      "tagged_t",
      "enum tag_e",
    ],
    [
      "typedef enum { C_RED, C_GREEN } c_color_t;",
      "c_color_t",
      "enum {C_RED,C_GREEN}",
    ],
    ["struct foo { int x; };\ntypedef struct foo foo_t;", "foo_t", "foo"],
    ["enum tag_e { A, B };\nextern enum tag_e ev;", "ev", "enum tag_e"],
    ["struct foo { int x; };\nextern struct foo gv;", "gv", "foo"],
    ["typedef unsigned int u_t;", "u_t", "unsigned int"],
  ])("spells the specifier in %j as %j: %j", (source, name, type) => {
    const tree = TestHelpers.parseC(source);
    const result = CResolver.resolve(tree!, "test.h");

    const symbol = result.symbols.find((s) => s.name === name);
    expect(symbol && "type" in symbol ? symbol.type : undefined).toBe(type);
  });

  it("spells a struct return type by its tag", () => {
    const tree = TestHelpers.parseC(
      "struct foo { int x; };\nstruct foo get(void);",
    );
    const result = CResolver.resolve(tree!, "test.h");

    const symbol = result.symbols.find((s) => s.name === "get");
    expect(symbol?.kind === "function" ? symbol.type : undefined).toBe("foo");
  });

  it("collects multiple typedefs", () => {
    const tree = TestHelpers.parseC(`
      typedef int Int32;
      typedef unsigned int UInt32;
    `);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(2);
    expect(result.symbols[0].name).toBe("Int32");
    expect(result.symbols[1].name).toBe("UInt32");
  });
});

describe("CResolver - Structs", () => {
  it("collects named struct", () => {
    const tree = TestHelpers.parseC(`struct Point { int x; int y; };`);
    const result = CResolver.resolve(tree!, "test.h");

    const structSym = result.symbols.find((s) => s.name === "Point");
    expect(structSym).toBeDefined();
    expect(structSym?.kind).toBe("struct");
    expect(structSym?.visibility).toBe("public");
  });

  it("marks named struct as needing struct keyword", () => {
    const tree = TestHelpers.parseC(`struct Point { int x; int y; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.checkNeedsStructKeyword("Point")).toBe(true);
  });

  it("collects typedef struct (anonymous)", () => {
    const tree = TestHelpers.parseC(`typedef struct { int x; int y; } Point;`);
    const result = CResolver.resolve(tree!, "test.h");

    const structSym = result.symbols.find(
      (s) => s.name === "Point" && s.kind === "struct",
    );
    expect(structSym).toBeDefined();
  });

  it("does not mark typedef struct as needing struct keyword", () => {
    const tree = TestHelpers.parseC(`typedef struct { int x; int y; } Point;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.checkNeedsStructKeyword("Point")).toBe(false);
  });

  it("collects typedef struct with tag name", () => {
    const tree = TestHelpers.parseC(
      `typedef struct _Point { int x; int y; } Point;`,
    );
    const result = CResolver.resolve(tree!, "test.h");

    const structSym = result.symbols.find(
      (s) => s.name === "_Point" && s.kind === "struct",
    );
    expect(structSym).toBeDefined();
  });

  it("collects union", () => {
    const tree = TestHelpers.parseC(`union Data { int i; float f; };`);
    const result = CResolver.resolve(tree!, "test.h");

    const unionSym = result.symbols.find((s) => s.name === "Data");
    expect(unionSym).toBeDefined();
    expect(unionSym?.kind).toBe("struct");
    if (unionSym?.kind === "struct") {
      expect(unionSym.isUnion).toBe(true);
    }
  });

  it("skips anonymous struct without typedef", () => {
    const tree = TestHelpers.parseC(`struct { int x; } point;`);
    const result = CResolver.resolve(tree!, "test.h");

    // Should only have the variable, no struct symbol
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("point");
    expect(result.symbols[0].kind).toBe("variable");
  });
});

describe("CResolver - Struct Fields", () => {
  it("collects struct fields into symbol table", () => {
    const tree = TestHelpers.parseC(`struct Point { int x; int y; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Point");
    expect(fieldsMap).toBeDefined();
    expect(fieldsMap?.size).toBe(2);
    expect(fieldsMap?.get("x")?.type).toBe("int");
    expect(fieldsMap?.get("y")?.type).toBe("int");
  });

  it("collects struct fields with different types", () => {
    const tree = TestHelpers.parseC(
      `struct Person { char name[32]; int age; float height; };`,
    );
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Person");
    expect(fieldsMap).toBeDefined();
    expect(fieldsMap?.size).toBe(3);
    expect(fieldsMap?.get("name")?.type).toBe("char");
    expect(fieldsMap?.get("age")?.type).toBe("int");
    expect(fieldsMap?.get("height")?.type).toBe("float");
  });

  it("collects array field dimensions", () => {
    const tree = TestHelpers.parseC(`struct Buffer { char data[256]; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Buffer");
    expect(fieldsMap?.get("data")?.arrayDimensions).toEqual([256]);
  });

  it("collects multi-dimensional array fields", () => {
    const tree = TestHelpers.parseC(`struct Matrix { int data[3][3]; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Matrix");
    expect(fieldsMap?.get("data")?.arrayDimensions).toEqual([3, 3]);
  });

  it("collects nested struct field type correctly", () => {
    const tree = TestHelpers.parseC(`
      struct Inner { int value; };
      struct Outer { struct Inner inner; };
    `);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Outer");
    expect(fieldsMap?.get("inner")?.type).toBe("Inner");
  });

  // ADR-058: "length" is no longer reserved since .length was deprecated
  it("does not warn about 'length' field names after ADR-058", () => {
    const tree = TestHelpers.parseC(`struct Test { int length; };`);
    const symbolTable = new SymbolTable();
    const result = CResolver.resolve(tree!, "test.h", symbolTable);

    // No warnings since "length" is no longer reserved
    expect(result.warnings).toHaveLength(0);
  });
});

// #1760 review: a field records its declarator's indirection, by the rule a
// typedef's type follows -- it recorded its specifiers alone
describe("CResolver - Struct field declarators", () => {
  it("records a pointer field and a function-pointer field as such", () => {
    const table = new SymbolTable();
    const tree = TestHelpers.parseC(`typedef struct {
    float (*readLevel)(void);
    uint8_t *buf;
    uint8_t **grid;
    uint8_t arr[4];
} Ops;`);
    CResolver.resolve(tree!, "ops.h", table);
    const fields = table.getStructFields("Ops");
    expect(fields?.get("readLevel")?.type).toBe("float (*)(void)");
    expect(fields?.get("buf")?.type).toBe("uint8_t*");
    expect(fields?.get("grid")?.type).toBe("uint8_t**");
    // Control: an array field keeps its element type and its dimensions
    expect(fields?.get("arr")).toMatchObject({
      type: "uint8_t",
      arrayDimensions: [4],
    });
  });
});

describe("CResolver - Enums", () => {
  it("collects named enum", () => {
    const tree = TestHelpers.parseC(`enum Color { RED, GREEN, BLUE };`);
    const result = CResolver.resolve(tree!, "test.h");

    const enumSym = result.symbols.find(
      (s) => s.name === "Color" && s.kind === "enum",
    );
    expect(enumSym).toBeDefined();
    expect(enumSym?.visibility).toBe("public");
  });

  it("collects enum members", () => {
    const tree = TestHelpers.parseC(`enum Color { RED, GREEN, BLUE };`);
    const result = CResolver.resolve(tree!, "test.h");

    const members = result.symbols.filter((s) => s.kind === "enum_member");
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.name)).toEqual(["RED", "GREEN", "BLUE"]);
    members.forEach((m) => {
      if (m.kind === "enum_member") {
        expect(m.parent).toBe("Color");
      }
      expect(m.visibility).toBe("public");
    });
  });

  it("collects enum member line numbers", () => {
    const tree = TestHelpers.parseC(`enum Status {
      OK,
      ERROR,
      PENDING
    };`);
    const result = CResolver.resolve(tree!, "test.h");

    const members = result.symbols.filter((s) => s.kind === "enum_member");
    expect(members[0].span.line).toBe(2);
    expect(members[1].span.line).toBe(3);
    expect(members[2].span.line).toBe(4);
  });

  it("skips anonymous enum", () => {
    const tree = TestHelpers.parseC(`enum { OPTION_A, OPTION_B };`);
    const result = CResolver.resolve(tree!, "test.h");

    // Anonymous enums don't create an Enum symbol
    const enumSym = result.symbols.find((s) => s.kind === "enum");
    expect(enumSym).toBeUndefined();
  });

  it("collects an anonymous enum's constants, with no parent (#2396)", () => {
    const tree = TestHelpers.parseC(`enum { OPTION_A, OPTION_B };`);
    const result = CResolver.resolve(tree!, "test.h");

    const members = result.symbols.filter((s) => s.kind === "enum_member");
    expect(members.map((m) => [m.name, m.parent])).toEqual([
      ["OPTION_A", null],
      ["OPTION_B", null],
    ]);
  });
});

describe("CResolver - Complex Declarators", () => {
  it("handles array variable declaration", () => {
    const tree = TestHelpers.parseC(`int values[10];`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("values");
    expect(result.symbols[0].kind).toBe("variable");
  });

  it("handles function pointer typedef", () => {
    const tree = TestHelpers.parseC(`typedef void (*Callback)(int);`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("Callback");
    expect(result.symbols[0].kind).toBe("type");
  });

  it("handles function pointer typedef with multiple pointer params (Issue #895)", () => {
    const tree = TestHelpers.parseC(
      `typedef void (*flush_cb_t)(widget_t *, const rect_t *, uint8_t *);`,
    );
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("flush_cb_t");
    expect(result.symbols[0].kind).toBe("type");
    if (result.symbols[0].kind === "type") {
      // Verify the type string captures pointer params for TypedefParamParser
      // Note: getText() removes spaces between tokens
      expect(result.symbols[0].type).toContain("(*)");
      expect(result.symbols[0].type).toContain("widget_t*");
      expect(result.symbols[0].type).toContain("rect_t*");
      expect(result.symbols[0].type).toContain("uint8_t*");
    }
  });

  it("handles pointer variable", () => {
    const tree = TestHelpers.parseC(`int *ptr;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("ptr");
    expect(result.symbols[0].kind).toBe("variable");
  });

  it("handles array field declarator (Issue #355)", () => {
    const tree = TestHelpers.parseC(`struct Test { char buf[8]; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Test");
    expect(fieldsMap?.get("buf")).toBeDefined();
    expect(fieldsMap?.get("buf")?.arrayDimensions).toEqual([8]);
  });

  it("handles multi-dimensional array field declarator", () => {
    const tree = TestHelpers.parseC(`struct Matrix { int data[4][4]; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Matrix");
    expect(fieldsMap?.get("data")).toBeDefined();
    expect(fieldsMap?.get("data")?.arrayDimensions).toEqual([4, 4]);
  });
});

describe("CResolver - Edge Cases", () => {
  it("handles struct with single field", () => {
    const tree = TestHelpers.parseC(`struct Minimal { int x; };`);
    const symbolTable = new SymbolTable();
    const result = CResolver.resolve(tree!, "test.h", symbolTable);

    expect(result.symbols.find((s) => s.name === "Minimal")).toBeDefined();
    expect(symbolTable.getStructFields("Minimal")?.size).toBe(1);
  });

  it("handles struct with type qualifiers", () => {
    const tree = TestHelpers.parseC(`struct Test { const int value; };`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Test");
    expect(fieldsMap?.get("value")).toBeDefined();
  });

  it("handles declaration without init declarator list", () => {
    const tree = TestHelpers.parseC(`struct Point { int x; };`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].kind).toBe("struct");
  });

  it("handles static storage class", () => {
    const tree = TestHelpers.parseC(`static int privateVar;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("privateVar");
  });

  it("handles const qualifier", () => {
    const tree = TestHelpers.parseC(`const int MAX_VALUE = 100;`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("MAX_VALUE");
    expect(result.symbols[0].kind).toBe("variable");
  });

  it("handles mixed declarations", () => {
    const tree = TestHelpers.parseC(`
      typedef int Int;
      struct Point { int x; int y; };
      enum Status { OK, ERROR };
      void init();
      extern int counter;
    `);
    const result = CResolver.resolve(tree!, "test.h");

    const typedef = result.symbols.find((s) => s.name === "Int");
    const struct = result.symbols.find((s) => s.name === "Point");
    const enumSym = result.symbols.find(
      (s) => s.name === "Status" && s.kind === "enum",
    );
    const func = result.symbols.find((s) => s.name === "init");
    const variable = result.symbols.find((s) => s.name === "counter");

    expect(typedef?.kind).toBe("type");
    expect(struct?.kind).toBe("struct");
    expect(enumSym?.kind).toBe("enum");
    expect(func?.kind).toBe("function");
    expect(variable?.kind).toBe("variable");
  });
});

describe("CResolver - Additional Edge Cases", () => {
  it("does not duplicate named enum as variable", () => {
    const tree = TestHelpers.parseC(`enum Status { OK, ERROR };`);
    const result = CResolver.resolve(tree!, "test.h");

    const enumSymbols = result.symbols.filter((s) => s.name === "Status");
    expect(enumSymbols).toHaveLength(1);
    expect(enumSymbols[0].kind).toBe("enum");
  });

  it("handles struct field with anonymous struct type", () => {
    const tree = TestHelpers.parseC(
      `struct Outer { struct { int x; } inner; };`,
    );
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    const fieldsMap = symbolTable.getStructFields("Outer");
    expect(fieldsMap?.get("inner")).toBeDefined();
  });

  it("handles function returning pointer", () => {
    const tree = TestHelpers.parseC(`int* getPtr();`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols[0].name).toBe("getPtr");
    expect(result.symbols[0].kind).toBe("function");
  });

  it("collects pointer return type from function definition (Issue #945)", () => {
    // Tests that collectFromDefinition detects pointer return types
    const tree = TestHelpers.parseC(
      `widget_t *create_label(void *parent) { return 0; }`,
    );
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    const symbol = result.symbols[0];
    expect(symbol.name).toBe("create_label");
    expect(symbol.kind).toBe("function");
    if (symbol.kind === "function") {
      expect(symbol.type).toBe("widget_t*");
      expect(symbol.isDeclaration).toBe(false);
    }
  });

  it("collects non-pointer return type from function definition (Issue #945)", () => {
    const tree = TestHelpers.parseC(`int getValue(void) { return 42; }`);
    const result = CResolver.resolve(tree!, "test.h");

    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].type).toBe("int");
      expect(result.symbols[0].isDeclaration).toBe(false);
    }
  });

  it("collects pointer return type from function prototype (Issue #895 Bug B)", () => {
    const tree = TestHelpers.parseC(`widget_t *widget_create(int w, int h);`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols).toHaveLength(1);
    const symbol = result.symbols[0];
    expect(symbol.name).toBe("widget_create");
    expect(symbol.kind).toBe("function");
    if (symbol.kind === "function") {
      expect(symbol.type).toBe("widget_t*");
      expect(symbol.parameters).toHaveLength(2);
    }
  });

  it("collects non-pointer return type correctly (Issue #895 Bug B)", () => {
    const tree = TestHelpers.parseC(`int getValue();`);
    const result = CResolver.resolve(tree!, "test.h");

    if (result.symbols[0].kind === "function") {
      expect(result.symbols[0].type).toBe("int");
    }
  });
});

describe("CResolver - Without SymbolTable", () => {
  it("still collects symbols without symbolTable", () => {
    const tree = TestHelpers.parseC(`struct Point { int x; int y; };`);
    const result = CResolver.resolve(tree!, "test.h");

    expect(result.symbols.find((s) => s.name === "Point")).toBeDefined();
  });

  it("does not crash when collecting struct fields without symbolTable", () => {
    const tree = TestHelpers.parseC(`struct Point { int x; int y; };`);
    expect(() => CResolver.resolve(tree!, "test.h")).not.toThrow();
  });
});

describe("CResolver - Opaque Type Detection (Issue #948)", () => {
  it("marks typedef struct forward declaration as opaque", () => {
    const tree = TestHelpers.parseC(`typedef struct _widget_t widget_t;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
  });

  it("does not mark typedef struct with named body as opaque", () => {
    const tree = TestHelpers.parseC(
      `typedef struct _point { int x; int y; } point_t;`,
    );
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.isOpaqueType("point_t")).toBe(false);
  });

  it("aliases a typedef to its struct tag whether or not it has a body (#2103)", () => {
    const tree = TestHelpers.parseC(
      `typedef struct _point { int x; int y; } point_t;\ntypedef struct _foo foo_t;`,
    );
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.getStructTagForTypedef("point_t")).toBe("_point");
    expect(symbolTable.getStructTagForTypedef("foo_t")).toBe("_foo");
  });

  it("does not mark typedef struct with anonymous body as opaque", () => {
    const tree = TestHelpers.parseC(`typedef struct { int x; } point_t;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);
    expect(symbolTable.isOpaqueType("point_t")).toBe(false);
  });

  it("resolves opaque type as non-opaque when full definition is found in separate parse", () => {
    // Forward declaration first
    const tree1 = TestHelpers.parseC(`typedef struct _foo foo_t;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree1!, "test.h", symbolTable);

    expect(symbolTable.isOpaqueType("foo_t")).toBe(true);

    // Full definition later — query-time resolution sees body
    const tree2 = TestHelpers.parseC(`struct _foo { int value; };`);
    CResolver.resolve(tree2!, "test.h", symbolTable);

    expect(symbolTable.isOpaqueType("foo_t")).toBe(false);
  });

  it("resolves opaque type as non-opaque when full definition follows typedef in same parse", () => {
    const tree = TestHelpers.parseC(`
      typedef struct _point_t point_t;
      struct _point_t { int x; int y; };
    `);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);
    expect(symbolTable.isOpaqueType("point_t")).toBe(false);
  });

  it("handles multiple forward declarations", () => {
    const tree = TestHelpers.parseC(`
      typedef struct _widget_t widget_t;
      typedef struct _display_t display_t;
    `);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
    expect(symbolTable.isOpaqueType("display_t")).toBe(true);
  });

  it("registers struct tag to typedef alias relationship", () => {
    const tree = TestHelpers.parseC(`typedef struct _widget_t widget_t;`);
    const symbolTable = new SymbolTable();
    CResolver.resolve(tree!, "test.h", symbolTable);

    expect(symbolTable.getStructTagForTypedef("widget_t")).toBe("_widget_t");
  });
});

describe("CResolver - a declarator's pointer depth", () => {
  /** The symbol the resolver recorded under `name`. */
  const symbolNamed = (source: string, name: string) => {
    const tree = TestHelpers.parseC(source);
    const { symbols } = CResolver.resolve(tree!, "test.h", new SymbolTable());
    const symbol = symbols.find((s) => s.name === name);
    expect(symbol).toBeDefined();
    return symbol!;
  };

  it("records every pointer level of a parameter", () => {
    // `Dev **out` is ONE `pointer` context holding two `*`. Recorded as
    // `Dev*`, an out-parameter looked like a handle parameter, and codegen
    // passed the handle where its address belongs.
    const symbol = symbolNamed(
      `typedef struct Dev Dev; void dev_create_into(Dev **out, Dev *keep);`,
      "dev_create_into",
    );
    expect(symbol.kind).toBe("function");
    const types =
      symbol.kind === "function"
        ? (symbol.parameters ?? []).map((p) => p.type)
        : [];
    expect(types).toEqual(["Dev**", "Dev*"]);
  });

  it("records every pointer level of a variable and a return type", () => {
    const variable = symbolNamed(`extern char **names;`, "names");
    expect(variable.kind === "variable" && variable.type).toBe("char**");

    const func = symbolNamed(`char **list_names(void);`, "list_names");
    expect(func.kind === "function" && func.type).toBe("char**");
  });

  it("adds no pointer where the declarator has none", () => {
    const variable = symbolNamed(`extern int count;`, "count");
    expect(variable.kind === "variable" && variable.type).toBe("int");
  });
});
