/**
 * Integration tests for CppResolver.
 * Verifies that the resolver correctly extracts symbols from 1.2's lowered C++ headers (#1991).
 */

import { describe, it, expect, beforeEach } from "vitest";
import CppResolver from "../index";
import SymbolTable from "../../SymbolTable";
import TestHelpers from "./testHelpers";

describe("CppResolver", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  describe("pointer typedefs (#1164)", () => {
    it("records a typedef of a pointer to a struct rather than collecting a variable", () => {
      const source = `struct opaque_t { int value; };
typedef struct opaque_t* handle_t;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "handles.hpp", symbolTable);

      // A pointer typedef is a type. Collected as a variable it became
      // "handle_t of type int", and the generated header then forward-declared
      // `typedef struct handle_t handle_t;` -- a different type entirely.
      expect(symbolTable.isPointerTypedef("handle_t")).toBe(true);
      expect(
        result.symbols.filter(
          (symbol) => symbol.name === "handle_t" && symbol.kind === "variable",
        ),
      ).toHaveLength(0);
    });

    it("leaves an ordinary variable declaration alone", () => {
      const source = `int counter;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "vars.hpp", symbolTable);

      expect(symbolTable.isPointerTypedef("counter")).toBe(false);
      expect(
        result.symbols.some(
          (symbol) => symbol.name === "counter" && symbol.kind === "variable",
        ),
      ).toBe(true);
    });
  });

  describe("namespace collection", () => {
    it("collects a simple namespace", () => {
      const source = `namespace MyNamespace { }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "namespace",
        name: "MyNamespace",
        sourceFile: "test.hpp",
      });
    });

    it("collects nested namespaces", () => {
      const source = `namespace Outer { namespace Inner { } }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0].name).toBe("Outer");
      expect(result.symbols[1].name).toBe("Outer::Inner");
    });
  });

  describe("class collection", () => {
    it("collects a simple class", () => {
      const source = `class MyClass { };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "class",
        name: "MyClass",
        sourceFile: "test.hpp",
      });
    });

    it("collects a class with fields", () => {
      const source = `class Point { int x; int y; };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      const classSymbol = result.symbols[0];
      expect(classSymbol.kind).toBe("class");

      // Verify fields are stored in symbol table
      const xType = symbolTable.getStructFields("Point")?.get("x")?.type;
      expect(xType).toBe("int");

      const yType = symbolTable.getStructFields("Point")?.get("y")?.type;
      expect(yType).toBe("int");
    });

    it("collects class in namespace", () => {
      const source = `namespace NS { class MyClass { }; }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const classSymbol = result.symbols.find((s) => s.kind === "class");
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.name).toBe("NS::MyClass");
      expect(classSymbol!.parent).toBe("NS");
    });

    it("collects member functions", () => {
      const source = `class MyClass { void doSomething(); int getValue(); };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbols = result.symbols.filter((s) => s.kind === "function");
      expect(funcSymbols).toHaveLength(2);
      expect(funcSymbols[0].name).toBe("MyClass::doSomething");
      expect(funcSymbols[1].name).toBe("MyClass::getValue");
    });

    it("collects inline member function definitions", () => {
      const source = `class MyClass { void inline_func() { } };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols.find((s) => s.kind === "function");
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.name).toBe("MyClass::inline_func");
    });

    it("records which member functions are declared `const` (ADR-071)", () => {
      const source = `class C { int get() const; void set(int v); int peek() const { return 0; } };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const constness = result.symbols
        .filter((s) => s.kind === "function")
        .map((s) => [
          s.name,
          s.kind === "function" && s.isConstMember === true,
        ]);
      expect(constness).toEqual([
        ["C::get", true],
        ["C::set", false],
        ["C::peek", true],
      ]);
    });
  });

  describe("enum collection", () => {
    it("collects a simple enum", () => {
      const source = `enum Color { RED, GREEN, BLUE };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(4);
      expect(result.symbols[0]).toMatchObject({
        kind: "enum",
        name: "Color",
        sourceFile: "test.hpp",
      });
      // #2510 review: an unscoped enum's constants are file-scope names
      expect(result.symbols.slice(1).map((s) => [s.kind, s.name])).toEqual([
        ["enum_member", "RED"],
        ["enum_member", "GREEN"],
        ["enum_member", "BLUE"],
      ]);
    });

    it("scopes a class enum's constants to the class, and records none for an enum class (#2510 review)", () => {
      const source = `namespace ns { struct P { enum { N = 3 } kind; enum class K { A }; }; enum { TOP }; }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);
      const members = result.symbols.filter((s) => s.kind === "enum_member");
      expect(members).toEqual([
        expect.objectContaining({
          name: "ns::P::N",
          unqualifiedName: "N",
          parent: "ns",
          inStruct: "ns::P",
        }),
        expect.objectContaining({ name: "ns::TOP", unqualifiedName: "TOP" }),
      ]);
      expect(members[1]).not.toHaveProperty("inStruct");
    });

    it("collects typed enum with bit width", () => {
      const source = `enum class EPressureType : uint8_t { PSIA, PSIG };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const enumSymbol = result.symbols.find((s) => s.kind === "enum");
      expect(enumSymbol).toBeDefined();
      expect(enumSymbol!.name).toBe("EPressureType");

      // Check that bit width was stored in symbol table
      const bitWidth = symbolTable.getEnumBitWidth("EPressureType");
      expect(bitWidth).toBe(8);
    });
  });

  describe("function collection", () => {
    it("collects a free function definition", () => {
      const source = `void myFunction() { }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "function",
        name: "myFunction",
        type: "void",
      });
    });

    it("collects function with parameters", () => {
      const source = `int add(int a, int b) { return a + b; }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols[0];
      expect(funcSymbol.kind).toBe("function");
      if (funcSymbol.kind === "function") {
        expect(funcSymbol.parameters).toHaveLength(2);
        expect(funcSymbol.parameters![0].name).toBe("a");
        expect(funcSymbol.parameters![0].type).toBe("int");
      }
    });

    it("collects function declaration (prototype)", () => {
      const source = `int myFunc(int x);`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols[0];
      expect(funcSymbol.kind).toBe("function");
      if (funcSymbol.kind === "function") {
        expect(funcSymbol.isDeclaration).toBe(true);
      }
    });

    it("collects function in namespace", () => {
      const source = `namespace NS { void foo() { } }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols.find((s) => s.kind === "function");
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.name).toBe("NS::foo");
    });
  });

  // #1760 review: a data member records its declarator's indirection as the
  // C side does, and a function-pointer member is a data member -- it had no
  // name, so it was dropped
  describe("data member declarators", () => {
    it("records pointer and function-pointer members, a reference as its base", () => {
      const tree = TestHelpers.parseCpp(`struct Ops {
    float (*readLevel)();
    uint8_t *buf;
    int &r;
    uint8_t flags;
};`);
      expect(tree).not.toBeNull();
      CppResolver.resolve(tree!, "ops.hpp", symbolTable);
      const fields = symbolTable.getStructFields("Ops");
      expect(fields?.get("readLevel")?.type).toBe("float (*)()");
      expect(fields?.get("buf")?.type).toBe("uint8_t*");
      expect(fields?.get("r")?.type).toBe("int");
      // Control: a plain member is its type
      expect(fields?.get("flags")?.type).toBe("uint8_t");
    });
  });

  describe("variable collection", () => {
    it("collects a global variable", () => {
      const source = `int globalVar;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "variable",
        name: "globalVar",
        type: "int",
      });
    });

    // #1760 review: a C++ variable's spelling keeps `volatile` too
    it("keeps volatile in a variable's spelling", () => {
      const tree = TestHelpers.parseCpp(`extern volatile float cvf;`);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);
      expect(result.symbols[0]).toMatchObject({
        kind: "variable",
        name: "cvf",
        type: "volatile float",
      });
    });

    it("collects array variable", () => {
      const source = `int buffer[32];`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const varSymbol = result.symbols[0];
      expect(varSymbol.kind).toBe("variable");
      if (varSymbol.kind === "variable") {
        expect(varSymbol.isArray).toBe(true);
        expect(varSymbol.arrayDimensions).toEqual([32]);
      }
    });
  });

  describe("type alias collection", () => {
    it("collects a using alias", () => {
      const source = `using MyInt = int;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "type",
        name: "MyInt",
      });
    });
  });

  describe("anonymous struct typedef", () => {
    it("collects anonymous struct with typedef name", () => {
      const source = `struct { int x; int y; } Point;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const classSymbol = result.symbols.find((s) => s.kind === "class");
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.name).toBe("Point");
    });
  });

  // ADR-058: "length" is no longer reserved since .length was deprecated
  describe("warnings", () => {
    it("does not warn about 'length' field names after ADR-058", () => {
      const source = `class MyStruct { int length; };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      // No warnings since "length" is no longer reserved
      expect(result.warnings).toHaveLength(0);
    });
  });
});
