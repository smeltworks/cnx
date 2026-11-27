import { describe, expect, it } from "vitest";
import CPointerArgumentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CPointerArgumentAnalyzer";
import CallbackAssignmentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CallbackAssignmentAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import type ICParameterInfo from "../../../../../cnx/types/symbols/c/ICParameterInfo";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #2348 review: where a cstring, which is const char* (ADR-046), may land is
 * decided from the C type of the place (`CLandingType`): E0900 for a char*
 * C may write through, E0879 for a function returning one.
 */
const HEADER = "places.h";

const common = {
  sourceLanguage: ESourceLanguage.C as const,
  sourceFile: HEADER,
  span: TestSourceSpan.at(1),
  visibility: "public" as const,
};

const parameter = (
  type: string,
  extra: Partial<ICParameterInfo> = {},
): ICParameterInfo => ({
  name: "p",
  type,
  isConst: false,
  isArray: false,
  ...extra,
});

function headers(): SymbolTable {
  const table = new SymbolTable();
  const variable = (name: string, type: string, dimensions: number[] = []) =>
    table.addCSymbol({
      ...common,
      name,
      kind: "variable",
      type,
      isArray: dimensions.length > 0,
      ...(dimensions.length > 0 && { arrayDimensions: dimensions }),
      isExtern: false,
    });
  const typedef = (name: string, type: string) =>
    table.addCSymbol({ ...common, name, kind: "type", type });
  const fn = (name: string, parameters: ICParameterInfo[]) =>
    table.addCSymbol({
      ...common,
      name,
      kind: "function",
      type: "uint32_t",
      parameters,
    });
  variable("g_name", "char*");
  variable("g_label", "const char*");
  variable("g_names", "char*", [2]);
  typedef("text_ptr", "char*");
  typedef("const_text_ptr", "const char*");
  typedef("writable_fn", "char* (*)(void)");
  typedef("const_fn", "const char* (*)(void)");
  table.addStructField(
    "Customer",
    "name",
    "char*",
    undefined,
    undefined,
    HEADER,
  );
  table.addStructField(
    "Customer",
    "tag",
    "const char*",
    undefined,
    undefined,
    HEADER,
  );
  table.addStructField(
    "Getter",
    "get",
    "char* (*)(void)",
    undefined,
    undefined,
    HEADER,
  );
  fn("ptr_len", [parameter("text_ptr")]);
  fn("const_len", [parameter("char*", { isConst: true })]);
  fn("fill", [parameter("char", { isArray: true })]);
  fn("any", [parameter("void*")]);
  fn("call_len", [parameter("char*", { isFunctionPointer: true })]);
  fn("const_call_len", [
    parameter("char*", { isConst: true, isFunctionPointer: true }),
  ]);
  fn("on_writable", [parameter("writable_fn")]);
  fn("on_const", [parameter("const_fn")]);
  return table;
}

function errors(source: string): string[] {
  const { syntax, context } = testAnalysisContextFor(source, {
    symbolTable: headers(),
    cppMode: false,
  });
  const positions = ValuePositions.of(syntax, context);
  return [
    ...new CPointerArgumentAnalyzer(context).analyze(syntax, positions),
    ...new CallbackAssignmentAnalyzer(context).analyze(syntax, positions),
  ]
    .filter((error) => error.code === "E0900" || error.code === "E0879")
    .map((error) => `${error.code}@${error.span.line}:${error.span.column}`);
}

describe("CLandingType: where a cstring may land (#2348 review)", () => {
  it("rejects a char* variable, an element and a typedef of char*", () => {
    expect(
      errors(
        [
          "void t() {",
          '    cstring text <- "a";',
          "    g_name <- text;",
          "    g_names[0] <- text;",
          "    text_ptr p <- text;",
          "    u32 n <- ptr_len(text);",
          "}",
        ].join("\n"),
      ),
    ).toEqual(["E0900@3:14", "E0900@4:18", "E0900@5:18", "E0900@6:21"]);
  });

  it("takes a const char* variable, typedef and parameter", () => {
    expect(
      errors(
        [
          "void t() {",
          '    cstring text <- "a";',
          "    g_label <- text;",
          "    const_text_ptr p <- text;",
          "    u32 n <- const_len(text);",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("rejects a char* field, a char array parameter and a void* one", () => {
    expect(
      errors(
        [
          "void t() {",
          '    cstring text <- "a";',
          "    mut Customer c <- { name: text, tag: text };",
          "    c.name <- text;",
          "    c.tag <- text;",
          "    u32 a <- fill(text);",
          "    u32 b <- any(text);",
          "}",
        ].join("\n"),
      ),
    ).toEqual(["E0900@3:30", "E0900@4:14", "E0900@6:18", "E0900@7:17"]);
  });

  it("rejects a cstring return where C calls a char*-returning function", () => {
    expect(
      errors(
        [
          'cstring label() { return "a"; }',
          "void t() {",
          "    u32 a <- call_len(label);",
          "    u32 b <- on_writable(label);",
          "    Getter g <- { get: label };",
          "    u32 c <- const_call_len(label);",
          "    u32 d <- on_const(label);",
          "}",
        ].join("\n"),
      ),
    ).toEqual(["E0879@3:22", "E0879@4:25", "E0879@5:23"]);
  });

  it("judges a variable named like the function as the variable", () => {
    expect(
      errors(
        [
          'cstring label() { return "a"; }',
          "void t(writable_fn label) {",
          "    u32 a <- on_writable(label);",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
