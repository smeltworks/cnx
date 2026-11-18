import invariant from "./invariant";
import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";

/**
 * The expressions directly inside one expression, in source order: operands,
 * arms, call arguments, subscripts, initializer values. Every kind has an arm,
 * so a new kind does not compile until it is placed (#1991).
 */
class ExpressionChildren {
  static of(expr: TExpression): readonly TExpression[] {
    switch (expr.kind) {
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse];
      case "binary":
        return expr.operands;
      case "unary":
      case "cast":
        return [expr.operand];
      case "postfix":
        return [
          expr.primary,
          ...expr.ops.flatMap(ExpressionChildren.opChildren),
        ];
      case "parenthesized":
        return [expr.expression];
      case "structInitializer":
        return expr.fields.map((field) => field.value);
      case "arrayInitializer":
        return expr.fill === null
          ? expr.elements
          : [...expr.elements, expr.fill];
      case "identifier":
      case "sizeof":
      case "root":
      case "literal":
      case "missing":
        return [];
      default:
        return ExpressionChildren.unhandled(expr);
    }
  }

  private static opChildren(op: TPostfixOpSyntax): readonly TExpression[] {
    switch (op.kind) {
      case "subscript":
        return [op.start, op.length];
      case "call":
        return op.arguments;
      case "member":
      case "missing":
        return [];
      default:
        return ExpressionChildren.unhandled(op);
    }
  }

  /** A new expression or op kind is a compile error here until it is walked */
  private static unhandled(value: never): never {
    invariant(
      false,
      `ExpressionChildren walks every kind: ${JSON.stringify(value)}`,
    );
  }
}

export default ExpressionChildren;
