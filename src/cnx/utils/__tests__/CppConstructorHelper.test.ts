import { describe, it, expect } from "vitest";
import CppConstructorHelper from "../CppConstructorHelper";

describe("CppConstructorHelper", () => {
  describe("extractClassName", () => {
    it("extracts class name from qualified name", () => {
      expect(CppConstructorHelper.extractClassName("TestNS::MyClass")).toBe(
        "MyClass",
      );
    });

    it("handles deeply nested namespaces", () => {
      expect(
        CppConstructorHelper.extractClassName("Outer::Inner::MyClass"),
      ).toBe("MyClass");
    });

    it("returns the name for unqualified types", () => {
      expect(CppConstructorHelper.extractClassName("MyClass")).toBe("MyClass");
    });
  });

  describe("buildConstructorName", () => {
    it("builds constructor name pattern", () => {
      expect(
        CppConstructorHelper.buildConstructorName("TestNS::MyClass", "MyClass"),
      ).toBe("TestNS::MyClass::MyClass");
    });

    it("handles simple class names", () => {
      expect(
        CppConstructorHelper.buildConstructorName("MyClass", "MyClass"),
      ).toBe("MyClass::MyClass");
    });
  });

  describe("hasConstructor", () => {
    it("returns false when symbolTable is null", () => {
      expect(CppConstructorHelper.hasConstructor("MyClass", null)).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(CppConstructorHelper.hasConstructor("MyClass", undefined)).toBe(
        false,
      );
    });

    it("returns false when constructor symbol not found", () => {
      const mockSymbolTable = {
        getSymbol: () => undefined,
      };
      expect(
        CppConstructorHelper.hasConstructor("MyClass", mockSymbolTable),
      ).toBe(false);
    });

    it("returns false when symbol is not a function", () => {
      const mockSymbolTable = {
        getSymbol: () => ({ kind: "variable" as const }),
      };
      expect(
        CppConstructorHelper.hasConstructor("MyClass", mockSymbolTable),
      ).toBe(false);
    });

    it("returns true when constructor function found", () => {
      const mockSymbolTable = {
        getSymbol: (name: string) => {
          if (name === "MyClass::MyClass") {
            return { kind: "function" as const };
          }
          return undefined;
        },
      };
      expect(
        CppConstructorHelper.hasConstructor("MyClass", mockSymbolTable),
      ).toBe(true);
    });

    it("reads a C name as-is rather than re-spelling it as C++", () => {
      const mockSymbolTable = {
        getSymbol: (name: string) => {
          if (name === "TestNS::MyClass::MyClass") {
            return { kind: "function" as const };
          }
          return undefined;
        },
      };
      expect(
        CppConstructorHelper.hasConstructor("TestNS__MyClass", mockSymbolTable),
      ).toBe(false);
    });

    it("handles namespaced types with :: format", () => {
      const mockSymbolTable = {
        getSymbol: (name: string) => {
          if (name === "TestNS::MyClass::MyClass") {
            return { kind: "function" as const };
          }
          return undefined;
        },
      };
      expect(
        CppConstructorHelper.hasConstructor("TestNS::MyClass", mockSymbolTable),
      ).toBe(true);
    });
  });
});
