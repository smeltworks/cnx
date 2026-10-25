/**
 * Unit tests for ExpressionShape: shape questions over a lowered expression.
 */
import { describe, it, expect } from "vitest";
import ExpressionShape from "../ExpressionShape";
import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import * as Parser from "../../PARSE/2-Parse/grammar/CnxParser";

function parseExpression(exprSource: string): Parser.ExpressionContext {
  // Wrap in a variable declaration in main() to get a complete program
  const source = `void main() { u32 x <- ${exprSource}; }`;
  const { tree, parseErrors: errors } = CnxSourceParser.parse(source);

  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  // Navigate to the expression in the AST
  // Find main function
  for (const decl of tree.declaration()) {
    if (decl.functionDeclaration()) {
      const funcDecl = decl.functionDeclaration()!;
      if (funcDecl.IDENTIFIER().getText() === "main") {
        const block = funcDecl.block();
        if (block && block.statement().length > 0) {
          const stmt = block.statement()[0];
          const varDecl = stmt.variableDeclaration();
          if (varDecl?.expression()) {
            return varDecl.expression()!;
          }
        }
      }
    }
  }

  throw new Error("Could not find expression in parsed tree");
}

const lowered = (source: string) =>
  SyntaxLowering.expression(parseExpression(source));

describe("ExpressionShape", () => {
  describe("simpleIdentifier", () => {
    it("should return identifier name for simple variable", () => {
      expect(ExpressionShape.simpleIdentifier(lowered("myVar"))).toBe("myVar");
    });

    it.each([
      ["should return null for member access", "obj.field"],
      ["should return null for array indexing", "arr[0]"],
      ["should return null for numeric literal", "42"],
      ["should return null for binary expression", "a + b"],
      // #1445: carried over from CodegenParserUtils' duplicate of this
      // function when that copy was deleted.
      ["should return null for function call", "foo()"],
      ["should return null for a parenthesized name", "(myVar)"],
      ["should return null for a negated name", "-myVar"],
      ["should return null for a this-rooted member", "this.myVar"],
    ])("%s", (_label, source) => {
      expect(ExpressionShape.simpleIdentifier(lowered(source))).toBeNull();
    });
  });

  // #1203 review: only the bracketed node itself is seen through; a chain
  // keeps its own nodes, so 2.2's plans keyed by them still find them
  describe("unparenthesized", () => {
    it.each([
      ["(myVar)", "identifier"],
      ["((cfg.total))", "postfix"],
      ["(arr[0])", "postfix"],
      ["(a + b)", "binary"],
      ["myVar", "identifier"],
      ["((1))", "literal"],
      ["(a) + b", "binary"],
    ])("%s holds a %s", (source, kind) => {
      expect(ExpressionShape.unparenthesized(lowered(source)).kind).toBe(kind);
    });

    it("leaves a bracketed chain to postfixView as its own primary", () => {
      const view = ExpressionShape.postfixView(lowered("(cfg.total)"));
      expect(view?.primary.kind).toBe("parenthesized");
      expect(view?.ops).toEqual([]);
    });
  });

  describe("rootName", () => {
    it.each([
      ["myVar", "myVar"],
      ["obj.field", "obj"],
      ["grid[1][2]", "grid"],
      ["getStr()[0]", "getStr"],
      ["this.myVar", null],
      ["(a).b", null],
      ["a + b", null],
    ])("%s -> %s", (source, expected) => {
      expect(ExpressionShape.rootName(lowered(source))).toBe(expected);
    });
  });
  describe("isStringLiteral", () => {
    it.each([
      ['"a"', true],
      ['"a" < "b"', false],
      ['("a")', false],
      ["s", false],
    ])("%s -> %s", (source, expected) => {
      expect(ExpressionShape.isStringLiteral(lowered(source))).toBe(expected);
    });
  });

  describe("writtenThrough", () => {
    it.each([
      ["p.header[4][3]", 0, "p"],
      ["p.header[4][3]", 1, "p.header"],
      ["packets[1].header[4]", 2, "packets[1].header"],
      ["this.flags[4]", 1, "this.flags"],
      ["a[i + 1].b", 2, "a[i + 1].b"],
    ])("%s through %i op(s) is %s", (source, count, written) => {
      const chain = lowered(source);
      if (chain.kind !== "postfix") throw new Error("not a postfix chain");

      expect(ExpressionShape.writtenThrough(chain, count)).toBe(written);
    });
  });

  describe("headOf", () => {
    it.each([
      ["myVar", null, "myVar", 0],
      ["x[1].y", null, "x", 0],
      ["this.x.y", "this", "x", 1],
      ["global.x", "global", "x", 1],
      ["(a).b", null, null, 0],
      ["a + b", null, null, 0],
    ])("%s", (source, root, name, opsConsumed) => {
      const head = ExpressionShape.headOf(lowered(source));

      expect(head.root).toBe(root);
      expect(head.identifier?.name ?? null).toBe(name);
      expect(head.opsConsumed).toBe(opsConsumed);
    });

    it.each(["this[0]", "global[0]"])(
      "names nothing when %s subscripts its root",
      (source) => {
        const head = ExpressionShape.headOf(lowered(source));

        expect(head.identifier).toBeNull();
        expect(head.opsConsumed).toBe(1);
      },
    );

    it("puts a rooted chain's call after the consumed name", () => {
      const head = ExpressionShape.headOf(lowered("this.read()"));

      expect(head.ops[head.opsConsumed]?.kind).toBe("call");
    });

    it("places a rooted name at its own token, not at the dot", () => {
      // `void main() { u32 x <- ` is 23 columns; `this.` takes 5 more
      const head = ExpressionShape.headOf(lowered("this.myVar"));

      expect(head.identifier?.span).toMatchObject({ line: 1, column: 28 });
    });
  });
});
