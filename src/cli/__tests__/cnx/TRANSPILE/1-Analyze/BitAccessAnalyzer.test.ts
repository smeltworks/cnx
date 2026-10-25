import { describe, expect, it } from "vitest";

import BitAccessAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/BitAccessAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-007's bit access: E0856 (deeper than the base's shape allows) and
 * E0888 (a float bit range read at file scope).
 *
 * Both read the lexical frames, run against the program 1.4 built for the
 * source.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new BitAccessAnalyzer(context).analyze(syntax);
};

describe("BitAccessAnalyzer (E0856)", () => {
  it("rejects a second subscript on a scalar, as a read AND as a write", () => {
    // A target is an `assignmentTarget`, not a postfix expression -- a
    // different node type. Reading only expressions caught neither fixture.
    const found = errors(
      [
        "u8 flags <- 0;",
        "void f() {",
        "    flags[4][3] <- 5;",
        "    u8 v <- flags[4][3];",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0856", 3],
      ["E0856", 4],
    ]);
    expect(found[0].message).toContain("a scalar 'u8'");
  });

  it("allows one subscript per dimension plus one bit index", () => {
    expect(
      errors(
        [
          "void f() {",
          "    u8 flags <- 0;",
          "    u8[4] arr;",
          "    u8[2][3] grid;",
          "    bool a <- flags[4];",
          "    bool b <- arr[1][4];",
          "    bool c <- grid[1][2][4];",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("says nothing about a base whose type is not bit-indexable", () => {
    // A string is a char array with its own rules and a bitmap is E0883's.
    expect(
      errors('void f() {\n    string<8> s <- "hi";\n    u8 c <- s[0][1];\n}'),
    ).toEqual([]);
  });
});

describe("BitAccessAnalyzer (E0888)", () => {
  it("rejects a float bit RANGE at file scope", () => {
    const [found] = errors("f32 value <- 1.5;\nu32 bits <- value[0, 8];");
    expect(found.code).toBe("E0888");
    expect(found.message).toContain("value[0, 8]");
  });

  it("accepts the same range inside a function, and a single bit anywhere", () => {
    // A single bit index needs no union, so it is not restricted by scope.
    expect(
      errors(
        [
          "f32 value <- 1.5;",
          "bool topBit <- value[31];",
          "void f() {",
          "    f32 local <- 1.5;",
          "    u32 bits <- local[0, 8];",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

describe("BitAccessAnalyzer (E0890)", () => {
  const e0890 = (body: string[]) =>
    errors(
      [
        "bitmap8 Mode {",
        "    fast,",
        "    slow,",
        "    level[6]",
        "}",
        "register GPIO @ 0x40000000 {",
        "    DR: u32 rw @ 0x00,",
        "    DR_SET: u32 wo @ 0x04,",
        "}",
        "u8[4] arr <- [0*];",
        "Mode[4] modes;",
        "volatile u8 volatileIndex <- 0;",
        "u32 word <- 0;",
        "u8 idx() {",
        "    return 1;",
        "}",
        "void f() {",
        "    u8 i <- 2;",
        ...body,
        "}",
      ].join("\n"),
    ).filter((e) => e.code === "E0890");

  it("rejects a side effect in a read-modify-write target", () => {
    const found = e0890([
      "    arr[idx()][3] <- true;",
      "    word[idx()] <- true;",
      "    arr[volatileIndex][2, 4] <- 5;",
      "    modes[idx()].fast <- true;",
      "    GPIO.DR[idx()] <- true;",
    ]);
    expect(found.map((e) => e.span.line)).toEqual([19, 20, 21, 22, 23]);
    expect(found[0].message).toBe(
      "'idx()' would be evaluated twice: 'arr[idx()][3]' is read and then written back",
    );
  });

  it("accepts a write that evaluates its target once", () => {
    expect(
      e0890([
        "    arr[idx()] <- 7;",
        "    GPIO.DR_SET[idx()] <- true;",
        "    arr[i][3] <- true;",
        "    modes[i].slow <- true;",
        "    arr[idx()] +<- 1;",
      ]),
    ).toEqual([]);
  });

  // #1991: a compound write is E0857's, so this rule does not report it too
  it("leaves a compound write to E0857", () => {
    expect(e0890(["    word[idx()] +<- 1;"])).toEqual([]);
  });

  it("reports every subscript with a side effect", () => {
    const found = e0890(["    arr[idx()][volatileIndex] <- true;"]);
    expect(found.map((e) => e.span.column)).toEqual([8, 15]);
  });
});

// #1991: read off 1.2's syntax, so a chain rooted at `this.` and a property
// after the subscripts are asserted directly.
describe("BitAccessAnalyzer -- rooted chains and leading subscripts (E0856)", () => {
  const e0856 = (source: string) =>
    errors(source)
      .filter((e) => e.code === "E0856")
      .map((e) => [e.span.line, e.span.column]);

  it("counts the subscripts after `this.x`, not the member", () => {
    expect(
      e0856(
        [
          "scope S {",
          "    u8 x;",
          "    public void f() {",
          "        bool b <- this.x[1][2];",
          "    }",
          "}",
        ].join("\n"),
      ),
    ).toEqual([[4, 18]]);
  });

  it("stops counting at the first operation that is not a subscript", () => {
    expect(
      e0856(
        ["u8[4] a;", "void f() {", "    u32 n <- a[0][1].length;", "}"].join(
          "\n",
        ),
      ),
    ).toEqual([]);
  });
});
