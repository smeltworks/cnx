import { describe, expect, it } from "vitest";
import ElementCount from "../../../../cnx/utils/ElementCount";
import testAnalysisContextFor from "../TRANSPILE/1-Analyze/testAnalysisContextFor";
import type TConstExpr from "../../../../cnx/types/TConstExpr";

/** After each source's one declaration, where a use sees it (#1643) */
const AT = { line: 2, column: 0, endLine: 2, endColumn: 0 };
const lit = (digits: string): TConstExpr => ({
  kind: "literal",
  digits,
  text: digits,
  typeName: null,
});
const name = (...path: string[]): TConstExpr => ({
  kind: "name",
  root: null,
  path,
  at: AT,
});
const bin = (
  op: Extract<TConstExpr, { kind: "binary" }>["op"],
  left: TConstExpr,
  right: TConstExpr,
): TConstExpr => ({ kind: "binary", op, left, right });

describe("ElementCount (#1283)", () => {
  const { context } = testAnalysisContextFor("u8 SIX <- 6;", {
    cppMode: false,
    macros: {
      N: {
        kind: "integer",
        valueByIntBits: new Map([
          [16, 3],
          [32, 3],
        ]),
      },
      UNREAD: {
        kind: "integer",
        valueByIntBits: new Map([
          [16, null],
          [32, null],
        ]),
      },
      RATIO: { kind: "floating", typeName: "f32" },
    },
  });
  const count = (expr: TConstExpr) =>
    ElementCount.of(expr, context.program, context.sourceFile);

  it.each([
    ["a literal", lit("4"), 4],
    ["a cnx const", name("SIX"), 6],
    ["a readable header macro", name("N"), 3],
    [
      "arithmetic over a macro and a const",
      bin("+", name("N"), name("SIX")),
      9,
    ],
  ])("counts %s", (_label, expr, expected) => {
    expect(count(expr)).toBe(expected);
  });

  it.each([
    ["an integer macro with no value", name("UNREAD")],
    ["a floating macro", name("RATIO")],
    ["arithmetic over an unread macro", bin("+", name("UNREAD"), lit("1"))],
    ["a negative count", bin("-", lit("1"), name("N"))],
    ["a qualified name", name("M", "N")],
  ])("cannot count %s", (_label, expr) => {
    expect(count(expr)).toBeNull();
  });
});

describe("ElementCount.read (#1874, #1283 review)", () => {
  const { context } = testAnalysisContextFor("i32 M <- -2;", {
    cppMode: false,
    macros: {
      N: {
        kind: "integer",
        valueByIntBits: new Map([
          [16, 3],
          [32, 3],
        ]),
      },
    },
  });
  const read = (expr: TConstExpr) =>
    ElementCount.read(expr, context.program, context.sourceFile);

  it("reads a count", () => {
    expect(read(name("N"))).toEqual({ kind: "count", value: 3 });
  });

  it.each([
    ["a literal zero", lit("0"), 0n],
    ["a negative const", name("M"), -2n],
    ["a macro's value made negative", bin("-", name("N"), lit("5")), -2n],
  ])("tells %s from an unreadable size", (_label, expr, value) => {
    expect(read(expr)).toEqual({ kind: "notPositive", value });
    expect(
      ElementCount.of(expr, context.program, context.sourceFile),
    ).toBeNull();
  });

  it("reports a name it cannot see the value of as unreadable", () => {
    expect(read(name("NOT_DEFINED"))).toEqual({ kind: "unreadable" });
  });
});
