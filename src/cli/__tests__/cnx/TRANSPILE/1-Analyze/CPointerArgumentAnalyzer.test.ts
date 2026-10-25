import { describe, expect, it } from "vitest";
import CPointerArgumentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CPointerArgumentAnalyzer";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1991: the check walks 1.2's syntax. A call by name to a C function with a
 * pointer parameter is checked argument by argument; anything chained after
 * the call is not a call by name.
 */
const at = (body: string[]): string[] => {
  const symbolTable = new SymbolTable();
  for (const [name, type, isConst, isArray] of [
    ["take", "uint8_t *", false, false],
    ["peek", "const uint8_t *", false, false],
    ["any", "void *", false, false],
    ["fill", "uint8_t", false, true],
    ["scan", "uint8_t", true, true],
  ] as const) {
    symbolTable.addCSymbol({
      name,
      kind: "function",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "c.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type: "uint8_t",
      parameters: [{ name: "p", type, isConst, isArray }],
    });
  }
  const source = ["void t() {", ...body.map((line) => `    ${line}`), "}"].join(
    "\n",
  );
  const { syntax, context } = testAnalysisContextFor(source, {
    symbolTable,
    cppMode: false,
  });
  return new CPointerArgumentAnalyzer(context)
    .analyze(syntax)
    .map((e) => `${e.code}@${e.span.line}:${e.span.column} ${e.message}`);
};

describe("CPointerArgumentAnalyzer on 1.2's syntax (#1991)", () => {
  it("warns that cnx cannot see what a C function does with a pointer", () => {
    expect(at(["mut u8 b <- 1;", "take(b);", "any(b);"])).toEqual([
      "E0896@3:9 cnx cannot see how 'take' uses parameter 1, so passing 'b' to it is not memory safe",
      "E0896@4:8 cnx cannot see how 'any' uses parameter 1, so passing 'b' to it is not memory safe",
    ]);
  });

  it("rejects an argument of another type, spelt as written", () => {
    expect(at(["u16 w <- 1;", "take(w);"])).toEqual([
      "E0895@3:9 'w' is uint16_t, and parameter 1 of 'take' points to uint8_t",
    ]);
  });

  it("rejects a const argument only where the C pointer is not const", () => {
    expect(at(["u8 c <- 1;", "take(c);", "peek(c);"])).toEqual([
      "E0900@3:9 'c' is read-only uint8_t, and parameter 1 of 'take' is a pointer 'take' may write through",
      "E0896@4:9 cnx cannot see how 'peek' uses parameter 1, so passing 'c' to it is not memory safe",
    ]);
  });

  it("reaches the object `&x` hands the pointer (ADR-071)", () => {
    expect(at(["u8 c <- 1;", "take(&c);", "peek(&c);"])).toEqual([
      "E0900@3:9 '&c' is read-only uint8_t, and parameter 1 of 'take' is a pointer 'take' may write through",
      "E0896@4:9 cnx cannot see how 'peek' uses parameter 1, so passing '&c' to it is not memory safe",
    ]);
  });

  it("rejects a read-only array only where the C array is not const (#986)", () => {
    expect(
      at([
        "u8[4] r <- [0*];",
        "mut u8[4] m <- [0*];",
        "fill(r);",
        "fill(m);",
        "scan(r);",
      ]),
    ).toEqual([
      "E0900@4:9 'r' is read-only, and parameter 1 of 'fill' is an array 'fill' may write through",
    ]);
  });

  it("checks no call with anything chained after it", () => {
    expect(at(["u8 b <- 1;", "u8 r <- take(b)[0];"])).toEqual([]);
  });
});

describe("CPointerArgumentAnalyzer through `global.` (#2103)", () => {
  it("takes a typedef and the struct tag it aliases as one type (#958)", () => {
    const symbolTable = new SymbolTable();
    symbolTable.registerStructTagAlias("_widget_t", "widget_t");
    symbolTable.addCSymbol({
      name: "poke",
      kind: "function",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "c.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type: "void",
      parameters: [
        { name: "w", type: "widget_t *", isConst: false, isArray: false },
      ],
    });
    const { syntax, context } = testAnalysisContextFor(
      "void t(mut _widget_t w) {\n    global.poke(w);\n}",
      { symbolTable, cppMode: false },
    );
    expect(
      new CPointerArgumentAnalyzer(context).analyze(syntax).map((e) => e.code),
    ).toEqual(["E0896"]);
  });

  it("checks `global.f(a)` as it checks `f(a)`", () => {
    expect(at(["u8 c <- 1;", "global.take(c);"])).toEqual([
      "E0900@3:16 'c' is read-only uint8_t, and parameter 1 of 'take' is a pointer 'take' may write through",
    ]);
  });
});
