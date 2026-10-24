/**
 * Unit tests for ExpressionCalls.callsAtTop: the one answer to "is a call one
 * of this expression's own operations" (E0890, MISRA 13.5).
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../PARSE/2-Parse/grammar/CnxLexer";
import {
  CnxParser,
  ExpressionContext,
} from "../../PARSE/2-Parse/grammar/CnxParser";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import ExpressionCalls from "../ExpressionCalls";

/**
 * Helper to parse cnx code and extract the expression from a variable declaration.
 * Parses: "void main() { u32 x <- <expression>; }"
 */
function extractExpression(exprText: string): ExpressionContext | null {
  const code = `void main() { u32 x <- ${exprText}; }`;
  const charStream = CharStream.fromString(code);
  const lexer = new CnxLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CnxParser(tokenStream);
  const tree = parser.program();

  const funcDecl = tree.declaration(0)?.functionDeclaration();
  if (!funcDecl) return null;

  const block = funcDecl.block();
  if (!block) return null;

  const stmt = block.statement(0);
  if (!stmt) return null;

  const varDecl = stmt.variableDeclaration();
  if (!varDecl) return null;

  return varDecl.expression() ?? null;
}

describe("ExpressionCalls.callsAnywhere (E0702)", () => {
  it.each([
    ["finds a call in a subscript's index", "arr[idx(1)]", true],
    ["finds a call in a call's argument", "f(g(1))", true],
    ["finds a call at the top too", "getValue() + 1", true],
    ["finds no call in a member read", "point.x + arr[i]", false],
  ])("%s", (_name, text, expected) => {
    const expr = extractExpression(text);
    expect(expr).not.toBeNull();
    expect(
      ExpressionCalls.callsAnywhere(SyntaxLowering.expression(expr!)),
    ).toBe(expected);
  });

  it("differs from callsAtTop exactly at a subscript", () => {
    const expr = SyntaxLowering.expression(extractExpression("arr[idx(1)]")!);
    expect(ExpressionCalls.callsAtTop(expr)).toBe(false);
  });
});

describe("ExpressionCalls.callsAtTop", () => {
  it.each([
    ["should detect simple function call", "getValue()", true],
    ["should detect function call with arguments", "foo(1, 2, 3)", true],
    ["should detect function call in addition", "a + getValue()", true],
    ["should detect function call in subtraction", "getValue() - b", true],
    ["should detect function call in multiplication", "a * compute()", true],
    ["should detect function call in logical AND", "flag && isReady()", true],
    ["should detect function call in logical OR", "check() || backup", true],
    ["should detect function call in comparison", "getCount() < 10", true],
    [
      "should detect function call in equality check",
      "status = getStatus()",
      true,
    ],
    ["should detect function call in bitwise OR", "flags | getFlags()", true],
    ["should detect function call in bitwise XOR", "mask ^ getMask()", true],
    ["should detect function call in bitwise AND", "value & getMask()", true],
    ["should detect function call in shift expression", "getBase() << 4", true],
    ["should return false for simple literal", "42", false],
    ["should return false for simple identifier", "myVar", false],
    [
      "should return false for arithmetic without function calls",
      "a + b * c",
      false,
    ],
    [
      "should return false for comparison without function calls",
      "a < b",
      false,
    ],
    [
      "should return false for logical expression without function calls",
      "flag && ready",
      false,
    ],
    ["should return false for array access", "arr[0]", false],
    ["should return false for member access", "obj.field", false],
    // #1195: a bracketed call runs exactly as the bare call does.
    ["should look inside parentheses", "(getValue())", true],
    ["should look inside nested parentheses", "((getValue()))", true],
    ["should see a bracketed call as an operand", "(getValue()) = 1", true],
    ["should return false for parentheses with no call", "(a + b)", false],
    ["should not look inside a subscript", "arr[getIndex()]", false],
    ["should detect the call around call arguments", "foo(bar())", true],
    [
      "should detect a call under nested unary operators (#366)",
      "!!isReady()",
      true,
    ],
    ["should detect a call under negation (#366)", "-getValue()", true],
    ["should detect a call in a ternary arm", "(flag) ? getValue() : 0", true],
  ])("%s", (_label, source, expected) => {
    const expr = extractExpression(source);
    expect(expr).not.toBeNull();

    expect(ExpressionCalls.callsAtTop(SyntaxLowering.expression(expr!))).toBe(
      expected,
    );
  });
});
