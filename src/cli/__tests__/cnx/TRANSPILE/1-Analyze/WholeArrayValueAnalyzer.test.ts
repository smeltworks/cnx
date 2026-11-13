import { describe, expect, it } from "vitest";

import WholeArrayValueAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/WholeArrayValueAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * ADR-014: an array's whole value is ADR-035's list (E0866) wherever a whole
 * array is taken. A declaration's is 1.2's and ArrayDeclarationAnalyzer's;
 * a field, an assignment target and a parameter are this analyzer's (#1782),
 * and so is another array copied into one of the same shape (#1209).
 */
const types = [
  "struct S { u32 a; }",
  "struct D { S[2] items; u32 n; }",
  "struct B { u8[4] data; }",
  "void take(u8[4] buf) {\n}",
  "u8 third(u8[4] buf) {\n    return buf[2];\n}",
  "u8[4] src <- [1, 2, 3, 4];",
].join("\n");

const errors = (body: string) => {
  const built = testAnalysisContextFor(`${types}\nvoid f() {\n${body}\n}`, {
    cppMode: false,
  });
  return new WholeArrayValueAnalyzer(built.context).analyze(
    ValuePositions.of(built.syntax, built.context),
  );
};
const messages = (body: string) => errors(body).map((e) => e.message);

describe("WholeArrayValueAnalyzer (E0866)", () => {
  it.each([
    [
      "a struct initializer as a field of structs",
      "    D d <- { items: { a: 1 }, n: 1 };",
      "{ a: 1 }",
    ],
    [
      "a struct initializer as a field of scalars",
      "    B b <- { data: { a: 1 } };",
      "{ a: 1 }",
    ],
    [
      "a struct initializer at an assignment target",
      "    mut S[2] sa;\n    sa <- { a: 3 };",
      "{ a: 3 }",
    ],
    [
      "a struct initializer for an array parameter",
      "    take({ a: 1 });",
      "{ a: 1 }",
    ],
    ["a scalar at an assignment target", "    mut u8[4] a;\n    a <- 5;", "5"],
    [
      "another array as a struct initializer's field",
      "    B b <- { data: src };",
      "src",
    ],
    [
      "a string literal for an array that is not u8",
      '    mut u32[4] w;\n    w <- "abc";',
      '"abc"',
    ],
  ])("rejects %s", (_label, body, written) => {
    expect(messages(body)).toEqual([
      `An array must be given a list, not '${written}'`,
    ]);
  });

  it.each([
    [
      "an assignment target's list",
      "    mut u8[4] a;\n    a <- [1, 2, 3];",
      "declared [4] but the initializer has 3 element(s)",
    ],
    [
      "a field's list",
      "    B b <- { data: [1, 2] };",
      "declared [4] but the initializer has 2 element(s)",
    ],
    [
      "an inner level",
      "    mut u8[2][2] g;\n    g <- [[1, 2, 3], [4, 5]];",
      "declared [2] but the initializer has 3 element(s) at nesting level 2",
    ],
  ])("counts %s", (_label, body, detail) => {
    expect(messages(body)).toEqual([`Array size mismatch: ${detail}`]);
  });

  it.each([
    ["a scalar literal", "    take(5);", "5"],
    ["a scalar variable", "    u8 one <- 1;\n    take(one);", "one"],
  ])("rejects %s for an array parameter (#2157)", (_label, body, written) => {
    expect(messages(body)).toEqual([
      `An array must be given a list, not '${written}'`,
    ]);
  });

  it.each([
    ["an assignment target", "    mut u8[2] a;\n    a <- src;", "target"],
    ["a declaration", "    u8[2] a <- src;", "declaration"],
  ])("rejects another array's shape at %s (#1209)", (_label, body, noun) => {
    expect(messages(body)).toEqual([
      `An array of shape [4] is copied into a ${noun} of shape [2]`,
    ]);
  });

  it("counts a list for an array parameter (#2157)", () => {
    expect(messages("    take([1, 2]);")).toEqual([
      "Array size mismatch: declared [4] but the initializer has 2 element(s)",
    ]);
  });

  it("reports a value once, not again for its operands", () => {
    expect(errors("    mut u8[4] a;\n    a <- (5);")).toHaveLength(1);
  });

  it("asks a call's argument inside a whole-array value at its parameter", () => {
    expect(
      messages("    mut u8[4] a;\n    a <- [third([1, 2, 3]), 0, 0, 0];"),
    ).toEqual([
      "Array size mismatch: declared [4] but the initializer has 3 element(s)",
    ]);
    expect(messages("    mut u8[4] a;\n    a <- [third(5), 0, 0, 0];")).toEqual(
      ["An array must be given a list, not '5'"],
    );
  });

  it.each([
    ["a list", "    mut u8[4] a;\n    a <- [1, 2, 3, 4];"],
    ["a fill-all", "    mut u8[4] a;\n    a <- [0*];"],
    ["a u8 array's string literal", '    mut u8[6] t;\n    t <- "Hello";'],
    ["a row's list", "    mut u8[2][2] g;\n    g[1] <- [1, 2];"],
    ["an element write", "    mut u8[4] a;\n    a[0] <- src[1];"],
    ["a field's list", "    D d <- { items: [{ a: 1 }, { a: 2 }], n: 1 };"],
    ["an array passed by reference", "    take(src);"],
    [
      "another array at an assignment target (#1209)",
      "    mut u8[4] a;\n    a <- src;",
    ],
    ["another array at a declaration (#1209)", "    u8[4] a <- src;"],
    [
      "a declaration, which ADR-035's own rule checks",
      "    S[2] sa <- { a: 1 };",
    ],
  ])("accepts %s", (_label, body) => {
    expect(errors(body)).toEqual([]);
  });
});
