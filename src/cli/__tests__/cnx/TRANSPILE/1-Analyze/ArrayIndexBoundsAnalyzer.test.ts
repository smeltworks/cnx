import { describe, expect, it } from "vitest";

import ArrayIndexBoundsAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ArrayIndexBoundsAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-036's constant index bounds (E0854), replacing
 * `TypeValidator.checkArrayBounds` and its three call sites, which resolved
 * the array's name three different ways and never consulted a struct
 * field's dimensions.
 *
 * Dimensions come from the lexical frames; a struct field's come from the
 * struct the source declares, through the program 1.4 built for it.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new ArrayIndexBoundsAnalyzer(context).analyze(syntax);
};

describe("ArrayIndexBoundsAnalyzer (E0854)", () => {
  it("rejects an index at the dimension, on a write and on a read, at the subscript", () => {
    const found = errors(
      "void f() {\n    u8[5] arr;\n    arr[5] <- 1;\n    u8 x <- arr[5];\n}",
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0854", 3],
      ["E0854", 4],
    ]);
    expect(found[0].message).toBe(
      "Array index out of bounds: 5 >= 5 for 'arr' dimension 1",
    );
    expect(found[0].span.column).toBeGreaterThan(4);
  });

  it("rejects a negative index", () => {
    const [found] = errors(
      "void f() {\n    u8[5] arr;\n    u8 x <- arr[-1];\n}",
    );
    expect(found.message).toBe(
      "Array index out of bounds: -1 is negative for 'arr' dimension 1",
    );
  });

  it("checks each dimension of a multi-dimensional array against its own bound", () => {
    const found = errors(
      "void f() {\n    u8[4][8] grid;\n    grid[3][7] <- 1;\n    grid[4][0] <- 1;\n    u8 x <- grid[0][8];\n}",
    );
    expect(found.map((e) => [e.span.line, e.message])).toEqual([
      [4, "Array index out of bounds: 4 >= 4 for 'grid' dimension 1"],
      [5, "Array index out of bounds: 8 >= 8 for 'grid[0]' dimension 2"],
    ]);
  });

  it("bounds a parameter and a scope member through `this.`", () => {
    const source = [
      "void f(u8[4] v) {",
      "    u8 x <- v[4];",
      "}",
      "scope M {",
      "    u8[4] table <- [1, 2, 3, 4];",
      "    public void go() {",
      "        this.table[4] <- 1;",
      "        u8 y <- table[9];",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => e.span.line)).toEqual([2, 7, 8]);
  });

  it("bounds a struct field like a variable (the closed hole)", () => {
    const source = [
      "struct Frame {",
      "    u8[4] data;",
      "    u8[2][3] grid;",
      "}",
      "void f(Frame s) {",
      "    u8 a <- s.data[3];",
      "    u8 b <- s.data[4];",
      "    s.grid[1][3] <- 1;",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found.map((e) => [e.span.line, e.message])).toEqual([
      [7, "Array index out of bounds: 4 >= 4 for 's.data' dimension 1"],
      [8, "Array index out of bounds: 3 >= 3 for 's.grid[1]' dimension 2"],
    ]);
  });

  it("stays silent on a runtime index, a bit index, a slice, and an unsized dimension", () => {
    const source = [
      "void f(u8 i, u8[] open) {",
      "    u8[4] arr;",
      "    u8 flags <- 0;",
      "    u8 a <- arr[i];",
      "    flags[9] <- true;",
      "    arr[0, 4] <- 0;",
      "    u8 b <- open[99];",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });
});

describe("ArrayIndexBoundsAnalyzer on 1.2's syntax (#1991)", () => {
  const macros = {
    N: {
      kind: "integer",
      valueByIntBits: new Map([
        [16, 3],
        [32, 3],
      ]),
    },
  } as const;
  const withMacro = (source: string) => {
    const { syntax, context } = testAnalysisContextFor(source, {
      cppMode: false,
      macros,
    });
    return new ArrayIndexBoundsAnalyzer(context).analyze(syntax);
  };

  it("bounds a header-macro dimension through a root, a field and this.", () => {
    const source = [
      "struct S {",
      "    u8[N] d;",
      "}",
      "u8[N] buf;",
      "S s;",
      "scope M {",
      "    u8[N] slots;",
      "    public void f() {",
      "        buf[5] <- 1;",
      "        s.d[5] <- 1;",
      "        this.slots[5] <- 1;",
      "    }",
      "}",
    ].join("\n");
    expect(withMacro(source).map((e) => [e.span.line, e.message])).toEqual([
      [9, "Array index out of bounds: 5 >= 3 for 'buf' dimension 1"],
      [10, "Array index out of bounds: 5 >= 3 for 's.d' dimension 1"],
      [11, "Array index out of bounds: 5 >= 3 for 'this.slots' dimension 1"],
    ]);
  });

  it("counts dimensions from the last member step", () => {
    const source =
      "struct S {\n    u8[4] d;\n}\nS[2] arr;\nvoid f() {\n    arr[0].d[9] <- 1;\n}";
    expect(errors(source).map((e) => e.message)).toEqual([
      "Array index out of bounds: 9 >= 4 for 'arr[0].d' dimension 1",
    ]);
  });
});
