/**
 * Unit tests for CppNamespaceUtils
 * Tests C++ namespace detection and conversion utilities.
 */
import { describe, it, expect, beforeEach } from "vitest";
import CppNamespaceUtils from "../CppNamespaceUtils";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import ScopeUtils from "../ScopeUtils";
import type TCppSymbol from "../../types/symbols/cpp/TCppSymbol";
import type TCSymbol from "../../types/symbols/c/TCSymbol";
import type IScopeSymbol from "../../types/symbols/IScopeSymbol";
import TestSourceSpan from "../../types/__testUtils__/testSourceSpan";

describe("CppNamespaceUtils", () => {
  let symbolTable: SymbolTable;

  // Helper to create a C++ namespace symbol
  function makeCppNamespace(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "namespace",
      name,
      unqualifiedName: name,
      sourceFile,
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
    };
  }

  // Helper to create a C++ class symbol
  function makeCppClass(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "class",
      name,
      unqualifiedName: name,
      sourceFile,
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
    };
  }

  // Helper to create a C++ enum symbol
  function makeCppEnum(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "enum",
      name,
      unqualifiedName: name,
      sourceFile,
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
    };
  }

  // Helper to create a C++ function symbol
  function makeCppFunction(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "function",
      name,
      unqualifiedName: name,
      sourceFile,
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      type: "void",
    };
  }

  // Helper to create a C struct symbol
  function makeCStruct(name: string, sourceFile: string): TCSymbol {
    return {
      kind: "struct",
      name,
      sourceFile,
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      isUnion: false,
    };
  }

  // Helper to create a cnx scope symbol.
  //
  // Built through the real factories. This once hand-built a self-parented
  // scope under a non-empty name, which no factory produced and which hung any
  // caller that walked the chain to reach global. #1298 removed the chain
  // entirely -- a scope names its container with a string -- so that shape is
  // no longer representable, and the factory is used here for the identity pair
  // rather than to avoid the hang.
  function makeCnxScope(name: string, sourceFile: string): IScopeSymbol {
    return { ...ScopeUtils.createScope(name, ""), sourceFile };
  }

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // isCppNamespace
  // ========================================================================

  describe("isCppNamespace", () => {
    it("should return false with no symbol table", () => {
      expect(CppNamespaceUtils.isCppNamespace("SeaDash", undefined)).toBe(
        false,
      );
    });

    it("should return false for unknown symbol", () => {
      expect(CppNamespaceUtils.isCppNamespace("Unknown", symbolTable)).toBe(
        false,
      );
    });

    it("should return true for C++ namespace", () => {
      symbolTable.addCppSymbol(makeCppNamespace("SeaDash", "SeaDash.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("SeaDash", symbolTable)).toBe(
        true,
      );
    });

    it("should return true for C++ class", () => {
      symbolTable.addCppSymbol(makeCppClass("MyClass", "MyClass.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("MyClass", symbolTable)).toBe(
        true,
      );
    });

    it("should return true for C++ enum (scoped enum)", () => {
      symbolTable.addCppSymbol(makeCppEnum("MyEnum", "MyEnum.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("MyEnum", symbolTable)).toBe(
        true,
      );
    });

    it("should return false for cnx namespace (scope)", () => {
      symbolTable.addTSymbol(makeCnxScope("MyScope", "MyScope.cnx"));
      expect(CppNamespaceUtils.isCppNamespace("MyScope", symbolTable)).toBe(
        false,
      );
    });

    it("should return false for C struct", () => {
      symbolTable.addCSymbol(makeCStruct("MyStruct", "MyStruct.h"));
      expect(CppNamespaceUtils.isCppNamespace("MyStruct", symbolTable)).toBe(
        false,
      );
    });

    it("should return false for C++ function", () => {
      symbolTable.addCppSymbol(makeCppFunction("myFunction", "funcs.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("myFunction", symbolTable)).toBe(
        false,
      );
    });
  });

  describe("qualify", () => {
    it.each([
      ["Lib", "Type", "Lib::Type"],
      ["Lib::Sub", "Type", "Lib::Sub::Type"],
      [undefined, "Type", "Type"],
      [null, "Type", "Type"],
      ["", "Type", "Type"],
    ])("qualifies %s and %s as %s", (scope, name, expected) => {
      expect(CppNamespaceUtils.qualify(scope, name)).toBe(expected);
    });

    it("joins parts with ::", () => {
      expect(CppNamespaceUtils.fromParts(["A", "B", "C"])).toBe("A::B::C");
    });
  });
});
