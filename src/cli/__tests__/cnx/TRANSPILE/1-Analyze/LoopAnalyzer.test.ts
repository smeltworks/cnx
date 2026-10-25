import { describe, expect, it } from "vitest";

import LoopAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/LoopAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-068's loop rules -- E0705 (`forever` in a non-void function),
 * E0707 (`for (;;)`, an always-true literal condition) -- and ADR-026's E0703
 * (`break`/`continue`), replacing four throws across three codegen files,
 * three of which reported `1:0`.
 *
 * E0715 (#1647, a `for` header assignment that lowers to more than one
 * statement) reads the target's type, so the analyzer takes the symbol view.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new LoopAnalyzer(context).analyze(syntax);
};

const inRun = (body: string): string =>
  `void run() {\n    u8 state <- 0;\n${body}\n}`;

describe("LoopAnalyzer", () => {
  describe("E0703 -- break and continue", () => {
    it("rejects both, with the word's own position", () => {
      const found = errors(
        inRun(
          "    while (state < 3) {\n        break;\n    }\n    while (state < 3) {\n        continue;\n    }",
        ),
      );
      expect(found.map((e) => [e.code, e.span.line])).toEqual([
        ["E0703", 4],
        ["E0703", 7],
      ]);
      expect(found[0].message).toContain("'break'");
      expect(found[1].message).toContain("'continue'");
      expect(found[0].span.column).toBeGreaterThan(0);
    });

    it("says nothing about a variable that merely contains the word", () => {
      expect(
        errors(inRun("    u8 breakpoint <- 1;\n    state <- breakpoint;")),
      ).toEqual([]);
    });
  });

  describe("E0705 -- forever in a non-void function", () => {
    it("rejects it in a value-returning function and a scope method", () => {
      const source = [
        "u8 a() {",
        "    forever {",
        "    }",
        "}",
        "scope S {",
        "    public u32 b() {",
        "        forever {",
        "        }",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.span.line])).toEqual([
        ["E0705", 2],
        ["E0705", 7],
      ]);
    });

    it("accepts it in a void function", () => {
      expect(errors("void a() {\n    forever {\n    }\n}")).toEqual([]);
    });
  });

  describe("E0707 -- disguised infinite loops", () => {
    it("rejects `for (;;)`", () => {
      const found = errors(inRun("    for (;;) {\n    }"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0707");
      expect(found[0].message).toContain("no controlling expression");
    });

    it("rejects an always-true literal comparison in while, do-while and for", () => {
      const found = errors(
        inRun(
          "    while (1 = 1) {\n    }\n    do {\n    } while (5 > 3);\n    for (u8 i <- 0; true = true; i +<- 1) {\n    }",
        ),
      );
      expect(found.map((e) => e.code)).toEqual(["E0707", "E0707", "E0707"]);
      // The condition as written (#1991: 1.2 owns the spelling).
      expect(found[0].message).toContain("'1 = 1' is always true");
      // The condition's own position, not the statement's.
      expect(found[1].span.line).toBe(6);
    });

    it("reads every literal spelling the rule covers", () => {
      // hex, binary, a type suffix, and `!=` on unequal literals.
      const found = errors(
        inRun(
          "    while (0x10 = 16) {\n    }\n    while (0b1 <= 1u8) {\n    }\n    while (1 != 2) {\n    }",
        ),
      );
      expect(found).toHaveLength(3);
    });

    it("leaves to #1076 what it does not decide", () => {
      // Always-false, a named constant, a compound condition, a float, and a
      // leading-zero (octal to C) integer: the literal slice stays silent.
      const source = [
        "u8 ONE <- 1;",
        "void run() {",
        "    u8 state <- 0;",
        "    while (1 = 2) {",
        "    }",
        "    while (ONE = 1) {",
        "    }",
        "    while (1 = 1 && state < 3) {",
        "    }",
        "    while (1.0 = 1.0) {",
        "    }",
        "    while (0777 = 511) {",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });

    it("accepts a loop whose condition names a variable", () => {
      expect(
        errors(inRun("    while (state < 10) {\n        state +<- 1;\n    }")),
      ).toEqual([]);
    });

    it("judges a bracketed condition by what it holds (#1195)", () => {
      // E0701 accepts a bare bracketed group, so this check has to look inside
      // it too, or `while ((1 = 1))` compiles to the infinite loop that
      // `while (1 = 1)` is rejected for.
      const found = errors(
        inRun(
          "    while ((1 = 1)) {\n    }\n    do {\n    } while (((5 > 3)));\n    for (u8 i <- 0; ((true = true)); i +<- 1) {\n    }",
        ),
      );
      expect(found.map((e) => e.code)).toEqual(["E0707", "E0707", "E0707"]);
      expect(found[0].message).toContain("'(1 = 1)' is always true");
    });

    it("unwraps only a bare group, and leaves the rest to #1076", () => {
      // `(1 = 1) && (state < 3)` is a compound condition and `(state < 3)`
      // names a variable: both stay silent bracketed, as they do unbracketed.
      expect(
        errors(
          inRun(
            "    while ((1 = 1) && (state < 3)) {\n    }\n    while ((state < 3)) {\n        state +<- 1;\n    }",
          ),
        ),
      ).toEqual([]);
    });
  });
  describe("E0715 -- a for header assignment that is more than one statement", () => {
    const codes = (source: string) =>
      errors(source).map((e) => [
        e.code,
        e.span.line,
        e.span.column,
        e.message,
      ]);

    it("reads a string copy from the type the target writes", () => {
      // #1731 review: E0715 asks the question 2.2's copy asks -- a field and
      // an element of string<N> are copies; a byte element is one store
      const source = [
        "struct Cfg { string<8> name; }",
        "void run() {",
        "    u8 n <- 0;",
        "    Cfg c;",
        "    string<8>[2] names;",
        "    u8[4] buf;",
        '    for (c.name <- "b"; n < 2; n +<- 1) { }',
        '    for (names[0] <- "b"; n < 2; n +<- 1) { }',
        "    for (buf[0] <- 1; n < 2; n +<- 1) { }",
        "}",
      ].join("\n");
      expect(codes(source)).toEqual([
        ["E0715", 7, 9, expect.stringContaining("a string copy")],
        ["E0715", 8, 9, expect.stringContaining("a string copy")],
      ]);
    });

    it("reads a string copy of this.x and global.x from the variable", () => {
      // #1731 review: with no step, the variable's own type is what is written
      const source = [
        "string<8> label;",
        "scope S {",
        "    string<8> name;",
        "    public void run() {",
        "        u8 n <- 0;",
        '        for (this.name <- "b"; n < 2; n +<- 1) { }',
        '        for (global.label <- "b"; n < 2; n +<- 1) { }',
        "    }",
        "}",
      ].join("\n");
      expect(codes(source)).toEqual([
        ["E0715", 6, 13, expect.stringContaining("a string copy")],
        ["E0715", 7, 13, expect.stringContaining("a string copy")],
      ]);
    });

    it("rejects a string copy, a slice and any write to an atomic", () => {
      const source = [
        "atomic u32 counter <- 0;",
        "void run() {",
        "    u8 n <- 0;",
        '    string<8> s <- "a";',
        "    u8[8] buf;",
        '    for (s <- "b"; n < 2; buf[0, 2] <- n) { n +<- 1; }',
        "    for (counter <- 0; n < 2; counter +<- 1) { n +<- 1; }",
        "}",
      ].join("\n");
      expect(codes(source)).toEqual([
        ["E0715", 6, 9, expect.stringContaining("a string copy")],
        ["E0715", 6, 26, expect.stringContaining("a slice write")],
        ["E0715", 7, 9, expect.stringContaining("an atomic store")],
        [
          "E0715",
          7,
          30,
          expect.stringContaining("an atomic read-modify-write"),
        ],
      ]);
    });

    it("accepts forms that lower to one expression", () => {
      const source = [
        "atomic u32 counter <- 0;",
        "void run() {",
        "    u8 n <- 0;",
        "    u32 bits <- 0;",
        "    for (n <- 0; n < 2; bits[0, 4] <- 3) { counter <- 1; }",
        "    for (bits[5] <- true; n < 4; n +<- 1) { bits[6] <- false; }",
        "}",
      ].join("\n");
      expect(codes(source)).toEqual([]);
    });
  });

  describe("on 1.2's syntax (#1991)", () => {
    it("asks only a single comparison whether it is always true", () => {
      expect(errors(inRun("    while (1 < 2 < 3) {\n    }"))).toEqual([]);
    });

    it("reports in source order across statements and expressions", () => {
      const found = errors(inRun("    continue;\n    for (;;) {\n    }"));
      expect(found.map((e) => `${e.code}@${e.span.line}`)).toEqual([
        "E0703@3",
        "E0707@4",
      ]);
    });
  });
});
