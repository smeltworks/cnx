/**
 * Unit tests for StringLengthCounter
 * Issue #644: strlen caching optimization
 *
 * #1668 (C7): the counter asks what a name is declared as where it is used,
 * so each case declares its variables in source, against a real declared and
 * resolved program, rather than registering a type the source never states.
 */

import StatementLowering from "../../../../../cnx/PARSE/2-Parse/StatementLowering";
import { describe, it, expect } from "vitest";
import StringLengthCounter from "../../../../../cnx/TRANSPILE/2-Plan/StringLengthCounter";
import TranspileState from "../../../../../cnx/TRANSPILE/TranspileState";
import SyntaxLowering from "../../../../../cnx/PARSE/2-Parse/SyntaxLowering";
import testAnalysisContextFor from "../1-Analyze/testAnalysisContextFor";
import type * as Parser from "../../../../../cnx/PARSE/2-Parse/grammar/CnxParser";

/** A state whose program is `source`'s, as 2.2 has it */
function stateFor(source: string): {
  tree: Parser.ProgramContext;
  state: TranspileState;
} {
  const { tree, context } = testAnalysisContextFor(source, { cppMode: false });
  const state = new TranspileState();
  state.program = context.program;
  state.symbols = context.symbols;
  state.sourcePath = "test.cnx";
  return { tree, state };
}

/** `test()`'s body, with `declarations` ahead of `statements` */
function blockIn(declarations: string, statements: string) {
  const { tree, state } = stateFor(
    `void test() { ${declarations} ${statements} }`,
  );
  const block = tree.declaration(0)!.functionDeclaration()!.block()!;
  return { block, state };
}

/** The expression statement `expression`, after `declarations` */
function expressionIn(declarations: string, expression: string) {
  const { block, state } = blockIn(declarations, `${expression};`);
  const statements = block.statement();
  const expr = SyntaxLowering.expression(
    statements.at(-1)!.expressionStatement()!.expression(),
  );
  return { expr, state };
}

describe("StringLengthCounter", () => {
  describe("countExpression", () => {
    it("counts single .value_char_count access on string variable", () => {
      const { expr, state } = expressionIn(
        "string<64> myStr;",
        "myStr.value_char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("myStr")).toBe(1);
    });

    it("counts multiple .value_char_count accesses on same variable", () => {
      const { expr, state } = expressionIn(
        "string<32> str;",
        "str.value_char_count + str.value_char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .value_char_count accesses on different string variables", () => {
      const { expr, state } = expressionIn(
        "string<16> a; string<32> b;",
        "a.value_char_count + b.value_char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("a")).toBe(1);
      expect(counts.get("b")).toBe(1);
    });

    it("ignores .value_char_count on non-string variables", () => {
      const { expr, state } = expressionIn(
        "u8[10] arr;",
        "arr.value_char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("arr")).toBeUndefined();
    });

    it("ignores other member accesses", () => {
      const { tree, state } = stateFor(
        "struct O { u32 value; }\nvoid test() { O obj; obj.value; }",
      );
      const block = tree.declaration(1)!.functionDeclaration()!.block()!;
      const expr = SyntaxLowering.expression(
        block.statement(1)!.expressionStatement()!.expression(),
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.size).toBe(0);
    });

    it("handles unknown variables gracefully", () => {
      const { expr, state } = expressionIn("", "unknown.value_char_count");
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.size).toBe(0);
    });

    it("counts the string a name means where it is used", () => {
      // #1668: a string global shadowed by a same-named local array -- the
      // registry's one flat key per function could not tell them apart
      const { tree, state } = stateFor(
        "string<8> s;\nvoid test() { u8 x <- s.value_char_count; { u8[4] s; u8 y <- s.value_char_count; } }",
      );
      const block = tree.declaration(1)!.functionDeclaration()!.block()!;

      const counts = new Map<string, number>();
      StringLengthCounter.countBlockInto(
        StatementLowering.block(block),
        counts,
        state,
      );

      expect(counts.get("s")).toBe(1);
    });
  });

  describe("countBlockInto", () => {
    it("counts .value_char_count in assignment statements", () => {
      const { block, state } = blockIn(
        "string<64> text;",
        `
        u32 x;
        x <- text.value_char_count;
      `,
      );
      const counts = new Map<string, number>();
      StringLengthCounter.countBlockInto(
        StatementLowering.block(block),
        counts,
        state,
      );

      expect(counts.get("text")).toBe(1);
    });

    it("adds counts to existing map", () => {
      const { block, state } = blockIn(
        "string<32> s1; string<32> s2;",
        `
        u32 a <- s1.value_char_count;
        u32 b <- s2.value_char_count;
      `,
      );

      // Pre-populate counts
      const counts = new Map<string, number>();
      counts.set("s1", 1);

      StringLengthCounter.countBlockInto(
        StatementLowering.block(block),
        counts,
        state,
      );

      expect(counts.get("s1")).toBe(2); // 1 existing + 1 new
      expect(counts.get("s2")).toBe(1);
    });
  });

  describe("dropWrittenIn (#1958)", () => {
    /** The counts `test()`'s body keeps, `prelude` declared ahead of it */
    function keptIn(prelude: string, body: string): string[] {
      const { tree, state } = stateFor(`${prelude} void test() { ${body} }`);
      const block = StatementLowering.block(
        tree.declaration().at(-1)!.functionDeclaration()!.block()!,
      );
      const last = block.statements.at(-1)!.span;
      const counts = new Map<string, number>([["label", 2]]);
      StringLengthCounter.dropWrittenIn(
        block,
        counts,
        { line: last.line, column: last.column },
        state,
      );
      return [...counts.keys()];
    }

    it("keeps a string the block does not write", () => {
      expect(
        keptIn("", "mut string<8> label; u32 n <- label.value_char_count;"),
      ).toEqual(["label"]);
    });

    it("drops a string the block assigns", () => {
      expect(keptIn("", 'mut string<8> label; label <- "abcd";')).toEqual([]);
    });

    it("drops a string assigned in a nested statement", () => {
      expect(keptIn("", 'mut string<8> label; { label[0] <- "x"; }')).toEqual(
        [],
      );
    });

    it("drops a string passed to a call", () => {
      expect(
        keptIn(
          "void fill(mut string<8> s) { }",
          "mut string<8> label; fill(label);",
        ),
      ).toEqual([]);
    });

    it("drops a global string on any call", () => {
      expect(keptIn("mut string<8> label; void grow() { }", "grow();")).toEqual(
        [],
      );
    });

    it("keeps a local string across a call that is not passed it", () => {
      expect(keptIn("void grow() { }", "mut string<8> label; grow();")).toEqual(
        ["label"],
      );
    });
  });

  describe("nested expressions", () => {
    it("counts .value_char_count in ternary expressions", () => {
      const { expr, state } = expressionIn(
        "string<64> str;",
        "(str.value_char_count > 0) ? str.value_char_count : 0",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .value_char_count in comparison expressions", () => {
      const { expr, state } = expressionIn(
        "string<50> name;",
        "name.value_char_count = 10",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("name")).toBe(1);
    });
  });
});
