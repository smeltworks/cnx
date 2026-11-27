import { describe, expect, it } from "vitest";
import CStringArgument from "../CStringArgument";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import TestSourceSpan from "../../types/__testUtils__/testSourceSpan";

/** #2348 review: which C parameters a string is built for, and which returns may point into it */
const symbols = (): SymbolTable => {
  const table = new SymbolTable();
  for (const [name, type, isConst] of [
    ["text_t", "char*", true],
    ["chars_t", "char*", false],
    ["alias_t", "text_t", false],
    ["bytes_t", "uint8_t*", false],
    ["character", "char", false],
    ["letter", "char", true],
  ] as const) {
    table.addCSymbol({
      name,
      kind: "type",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "c.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type,
      ...(isConst ? { isConst: true } : {}),
    });
  }
  return table;
};

describe("CStringArgument", () => {
  it("builds for a char pointer, however it is spelled", () => {
    const table = symbols();
    for (const type of [
      "char*",
      "const char *",
      "text_t",
      "alias_t",
      "character*",
    ]) {
      expect(CStringArgument.isBuiltFor({ type }, table)).toBe(true);
    }
    expect(
      CStringArgument.isBuiltFor({ type: "const char", isArray: true }, table),
    ).toBe(true);
    expect(
      CStringArgument.isBuiltFor({ type: "character", isArray: true }, table),
    ).toBe(true);
  });

  it("builds for nothing else", () => {
    const table = symbols();
    expect(CStringArgument.isBuiltFor(undefined, table)).toBe(false);
    for (const type of ["uint8_t*", "bytes_t", "char", "char**", "void*"]) {
      expect(CStringArgument.isBuiltFor({ type }, table)).toBe(false);
    }
    expect(
      CStringArgument.isBuiltFor({ type: "uint8_t", isArray: true }, table),
    ).toBe(false);
    expect(CStringArgument.isBuiltFor({ type: "text_t" }, null)).toBe(false);
  });

  it("finds a return that can point at characters", () => {
    const table = symbols();
    for (const type of [
      "char*",
      "unsigned char*",
      "void*",
      "text_t",
      "character*",
    ]) {
      expect(CStringArgument.mayPointInto(type, table)).toBe(true);
    }
    for (const type of ["FILE*", "int", "bytes_t"]) {
      expect(CStringArgument.mayPointInto(type, table)).toBe(false);
    }
    expect(CStringArgument.mayPointInto(null, table)).toBe(false);
  });

  it("finds a char pointer C may write through", () => {
    const table = symbols();
    expect(CStringArgument.isWritableCharPointer("char*", table)).toBe(true);
    expect(CStringArgument.isWritableCharPointer("chars_t", table)).toBe(true);
    expect(CStringArgument.isWritableCharPointer("character*", table)).toBe(
      true,
    );
    for (const type of [
      "const char*",
      "text_t",
      "alias_t",
      "uint8_t*",
      "letter*",
    ]) {
      expect(CStringArgument.isWritableCharPointer(type, table)).toBe(false);
    }
  });
});
