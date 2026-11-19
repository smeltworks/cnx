/**
 * #1991: 2.2 plans the type each value is written against (MISRA 7.2's `U`,
 * a bare enum member's qualification, a struct initializer's type) before 2.3
 * writes it, from 2.1's one walk of where each value stands. 2.3 checks every
 * value it writes against this plan.
 */
import { describe, it, expect } from "vitest";
import ProgramGeneration from "./ProgramGeneration";
import type TExpression from "../../../../cnx/types/syntax/TExpression";
import type IPlannedExpectedType from "../../../../cnx/TRANSPILE/2-Plan/types/IPlannedExpectedType";

/** 2.2's plan of each value's type, for a whole file */
function plannedExpectedTypes(
  source: string,
): ReadonlyMap<TExpression, IPlannedExpectedType> {
  return ProgramGeneration.planSource(source).expectedTypes;
}

/** Each literal's planned type, keyed by its text */
function plannedLiterals(source: string): Map<string, IPlannedExpectedType> {
  const literals = new Map<string, IPlannedExpectedType>();
  for (const entry of plannedExpectedTypes(source)) {
    if (entry[0].kind === "literal") literals.set(entry[0].text, entry[1]);
  }
  return literals;
}

/** Each literal's planned type name, keyed by its text */
function plannedLiteralTypes(source: string): Map<string, string | null> {
  return new Map(
    [...plannedLiterals(source)].map((entry) => [entry[0], entry[1].type]),
  );
}

describe("2.2 plans the type each value is written against", () => {
  it("takes it from the innermost site that names a type", () => {
    const types = plannedLiteralTypes(
      [
        "struct P { u8 a; }",
        "u32 f(u8[4] buf, u8 i) {",
        "  u8 x <- 5;",
        "  x <- 6;",
        "  P p <- { a: 7 };",
        "  x <- buf[2];",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
    );
    expect(types.get("5")).toBe("u8");
    expect(types.get("6")).toBe("u8");
    expect(types.get("7")).toBe("u8");
    expect(types.get("2")).toBe("size_t");
    expect(types.get("1")).toBe("u32");
  });

  it("gives a comparison operand, a target's index and a copied string none", () => {
    const types = plannedLiteralTypes(
      [
        "void f(u8[4] buf) {",
        "  bool b <- buf[0] = 9;",
        "  buf[3] <- 4;",
        '  string<8> s <- "ab";',
        "}",
        "",
      ].join("\n"),
    );
    expect(types.get("9")).toBeNull();
    expect(types.get("3")).toBeNull();
    expect(types.get('"ab"')).toBeNull();
    expect(types.get("4")).toBe("u8");
  });

  it("gives a scope's string its C type", () => {
    const types = plannedLiteralTypes(
      'scope Names {\n  public string<8> first <- "cd";\n}\n',
    );
    expect(types.get('"cd"')).toBe("char");
  });

  it("gives a function argument its parameter's type, its bare enum member unresolved", () => {
    const literals = plannedLiterals(
      [
        "u8 take(u32 v) {",
        "  return 0;",
        "}",
        "void f() {",
        "  u8 y <- take(5);",
        "}",
        "",
      ].join("\n"),
    );
    expect(literals.get("5")).toEqual({
      type: "u32",
      suppressBareEnumResolution: true,
    });
  });

  it("gives a callback field's argument the parameter of the function its type names (ADR-029)", () => {
    const types = plannedLiteralTypes(
      [
        "u32 addTwo(u8 a, u8 b) {",
        "  return 0;",
        "}",
        "struct Handler {",
        "  addTwo handler;",
        "}",
        "void f() {",
        "  Handler h;",
        "  h.handler <- addTwo;",
        "  u32 r <- h.handler(10, 20);",
        "}",
        "",
      ].join("\n"),
    );
    expect(types.get("10")).toBe("u8");
    expect(types.get("20")).toBe("u8");
  });

  it("gives safe_div's arguments the outer type (ADR-051)", () => {
    const literals = plannedLiterals(
      [
        "void f() {",
        "  u16 q <- 1;",
        "  u16 a <- 10;",
        "  u16 b <- 2;",
        "  bool ok <- safe_div(q, a, b, 7);",
        "}",
        "",
      ].join("\n"),
    );
    expect(literals.get("7")).toEqual({
      type: "bool",
      suppressBareEnumResolution: false,
    });
  });

  it("writes a by-reference lvalue argument as itself, against no type", () => {
    const planned = [
      ...plannedExpectedTypes(
        [
          "struct P { u8 a; }",
          "void set(mut u8 v) {",
          "  v <- 1;",
          "}",
          "void f() {",
          "  mut P p <- { a: 3 };",
          "  set(p.a);",
          "}",
          "",
        ].join("\n"),
      ),
    ].filter(
      (entry) =>
        entry[0].span.line === 7 &&
        entry[0].span.column === 6 &&
        entry[0].kind === "postfix",
    );
    expect(planned.map((entry) => entry[1])).toEqual([
      { type: null, suppressBareEnumResolution: false },
    ]);
  });

  it("plans a value no site types, against no type", () => {
    const planned = [
      ...plannedExpectedTypes(
        [
          "void g(u8 v) {",
          "}",
          "void f() {",
          "  u8 y <- 0;",
          "  g(y);",
          "}",
          "",
        ].join("\n"),
      ),
    ].filter(
      (entry) =>
        entry[0].span.line === 5 &&
        entry[0].span.column === 2 &&
        entry[0].kind === "postfix",
    );
    expect(planned.map((entry) => entry[1])).toEqual([
      { type: null, suppressBareEnumResolution: false },
    ]);
  });

  it("plans a register's address and offsets, against no type (ADR-004)", () => {
    const literals = plannedLiterals(
      ["register HwBlock {", "  0x04 rw u32 CTRL,", "}", "HwBlock HW(0x40000000);", ""].join(
        "\n",
      ),
    );
    expect(literals.get("0x40000000")).toEqual({
      type: null,
      suppressBareEnumResolution: false,
    });
    expect(literals.get("0x04")).toEqual({
      type: null,
      suppressBareEnumResolution: false,
    });
  });
});
