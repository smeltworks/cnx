/**
 * #1668: PlanTyping's rows over the one operand typer's facts, each asserted
 * on a real declared and resolved program.
 */
import SyntaxLowering from "../../../../../cnx/PARSE/2-Parse/SyntaxLowering";
import { describe, expect, it } from "vitest";
import { ParseTreeWalker } from "antlr4ng";
import { CnxListener } from "../../../../../cnx/PARSE/2-Parse/grammar/CnxListener";
import * as Parser from "../../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import OperandTyper from "../../../../../cnx/utils/OperandTyper";
import PlanTyping from "../../../../../cnx/TRANSPILE/2-Plan/PlanTyping";
import OverflowBehaviorUtils from "../../../../../cnx/utils/OverflowBehaviorUtils";
import testAnalysisContextFor from "../1-Analyze/testAnalysisContextFor";

/** The initializer of `r`, and the context that types it */
function initializerOf(source: string) {
  const { tree, context } = testAnalysisContextFor(source, { cppMode: false });
  let found: Parser.ExpressionContext | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CnxListener {
      override enterVariableDeclaration = (
        ctx: Parser.VariableDeclarationContext,
      ): void => {
        if (ctx.IDENTIFIER().getText() === "r") found = ctx.expression();
      };
    })(),
    tree,
  );
  expect(found).not.toBeNull();
  return { expression: found!, context };
}

/** ADR-044's behavior for the initializer of `r` */
function overflowOf(source: string): string | null {
  const { expression, context } = initializerOf(source);
  return OverflowBehaviorUtils.ofLeaves(
    OperandTyper.valueLeaves(
      SyntaxLowering.expressionNode(expression),
      context,
    ),
  );
}

describe("PlanTyping.castSourceType (ADR-024)", () => {
  /** The type the cast in `r`'s initializer converts from, as 2.2 reads it */
  const castSourceOf = (body: string): string | null => {
    const { tree, context } = testAnalysisContextFor(
      `f32 k <- 1.0;\nvoid main() {\n${body}\n}`,
      { cppMode: false },
    );
    let operand: Parser.UnaryExpressionContext | null = null;
    ParseTreeWalker.DEFAULT.walk(
      new (class extends CnxListener {
        override enterCastExpression = (
          ctx: Parser.CastExpressionContext,
        ): void => {
          operand = ctx.unaryExpression();
        };
      })(),
      tree,
    );
    expect(operand).not.toBeNull();
    return PlanTyping.castSourceType(
      OperandTyper.typeOf(SyntaxLowering.expressionNode(operand!), context),
    );
  };

  // A Boolean converts 0 or 1, so it is never saturated as its operand's
  // float. Asserted here rather than in an execution fixture: any Boolean
  // cast to an integer is a MISRA C:2012 Rule 10.5 violation in the C.
  it("a Boolean is bool, whatever it negates", () => {
    expect(castSourceOf("u32 r <- (u32)!k;")).toBe("bool");
  });

  it("CONTROL: the float it negates is still a float", () => {
    expect(castSourceOf("u8 r <- (u8)k;")).toBe("f32");
  });
});

describe("OperandTyper.directTypeName", () => {
  const globals = "u16 a <- 1;\nu16 b <- 2;\nu8 half() {\nreturn 1;\n}\n";
  const directTypeOf = (body: string): string | null => {
    const { expression, context } = initializerOf(
      `${globals}void main() {\n${body}\n}`,
    );
    return OperandTyper.directTypeName(
      OperandTyper.typeOf(SyntaxLowering.expressionNode(expression), context),
    );
  };

  it.each([
    ["a composite has no one type", "u16 r <- a + b;", null],
    ["nor a parenthesized one", "u16 r <- (a + b);", null],
    ["nor a ternary", "u16 r <- (a > b) ? a : b;", null],
    ["a comparison is bool", "bool r <- a < b;", "bool"],
    ["an unsuffixed literal is int", "u16 r <- 5;", "int"],
    ["a variable is its declared type", "u16 r <- a;", "u16"],
    // #1668 S21: ETR could not type a call, so a slice treated one as a
    // composite and bound it to a temp, and a C++ enum field of a call's
    // result lost the #304 cast its variable spelling had
    ["a call is its return type", "u8 r <- half();", "u8"],
  ])("%s", (_why, body, expected) => {
    expect(directTypeOf(body)).toBe(expected);
  });
});

describe("OverflowBehaviorUtils.ofLeaves (ADR-044)", () => {
  const globals = "wrap u32 w <- 1;\nclamp u32 c <- 1;\nu32[2] arr;\n";

  it.each([
    ["clamp wins a mix", "u32 r <- w + c;", "clamp"],
    ["every counted leaf wraps", "u32 r <- w + w;", "wrap"],
    [
      "a declaration with no modifier clamps",
      "u32 x <- 1;\nu32 r <- x + 1;",
      "clamp",
    ],
    ["an element counts by its array (#1887)", "u32 r <- arr[0] + 1;", "clamp"],
    ["a literal is not counted", "u32 r <- 1 + 2;", null],
  ])("%s", (_why, body, expected) => {
    expect(overflowOf(`${globals}void main() {\n${body}\n}`)).toBe(expected);
  });

  it("counts a parameter by its declaration, which clamps (#1681)", () => {
    expect(
      overflowOf("void f(u32 p) {\nu32 r <- p + 1;\n}\nvoid main() {\n}"),
    ).toBe("clamp");
  });

  it("counts a `for` variable by its declaration (#1667)", () => {
    expect(
      overflowOf(
        "void main() {\nfor (mut u32 i <- 0; i < 3; i +<- 1) {\nu32 r <- i + 1;\n}\n}",
      ),
    ).toBe("clamp");
  });
});
