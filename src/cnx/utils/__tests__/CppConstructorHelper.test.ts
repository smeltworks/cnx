import { describe, it, expect } from "vitest";
import CppConstructorHelper from "../CppConstructorHelper";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import TestSourceSpan from "../../types/__testUtils__/testSourceSpan";

const AT = {
  sourceFile: "Class.hpp",
  span: TestSourceSpan.at(1),
  sourceLanguage: ESourceLanguage.Cpp,
  visibility: "public",
} as const;

/** `Outer::Widget` with a member `memberName` of `memberKind` */
const tableWith = (
  memberName: string,
  memberKind: "function" | "variable",
): SymbolTable => {
  const table = new SymbolTable();
  table.addCppSymbol({
    ...AT,
    kind: "class",
    name: "Outer::Widget",
    unqualifiedName: "Widget",
    parent: "Outer",
  });
  table.addCppSymbol(
    memberKind === "function"
      ? {
          ...AT,
          kind: "function",
          name: `Outer::Widget::${memberName}`,
          unqualifiedName: memberName,
          parent: "Outer::Widget",
          type: "void",
        }
      : {
          ...AT,
          kind: "variable",
          name: `Outer::Widget::${memberName}`,
          unqualifiedName: memberName,
          parent: "Outer::Widget",
          type: "int",
        },
  );
  return table;
};

describe("CppConstructorHelper", () => {
  describe("hasConstructor", () => {
    it("returns false when symbolTable is null", () => {
      expect(CppConstructorHelper.hasConstructor("Widget", null)).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(CppConstructorHelper.hasConstructor("Widget", undefined)).toBe(
        false,
      );
    });

    it("finds a function the class declares under its own name", () => {
      expect(
        CppConstructorHelper.hasConstructor(
          "Outer::Widget",
          tableWith("Widget", "function"),
        ),
      ).toBe(true);
    });

    it("returns false when the class declares no function of its name", () => {
      expect(
        CppConstructorHelper.hasConstructor(
          "Outer::Widget",
          tableWith("reset", "function"),
        ),
      ).toBe(false);
    });

    it("returns false when the member of its name is not a function", () => {
      expect(
        CppConstructorHelper.hasConstructor(
          "Outer::Widget",
          tableWith("Widget", "variable"),
        ),
      ).toBe(false);
    });

    it("reads a C name as-is rather than re-spelling it as C++", () => {
      expect(
        CppConstructorHelper.hasConstructor(
          "Outer__Widget",
          tableWith("Widget", "function"),
        ),
      ).toBe(false);
    });
  });
});
