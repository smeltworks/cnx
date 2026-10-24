import type TExpression from "../types/syntax/TExpression";
import ExpressionNodes from "./ExpressionNodes";

/** Where an expression calls a function (#254, #366) */
class ExpressionCalls {
  /**
   * Whether a call is one of an expression's own operations: through its
   * operators, unary prefixes and brackets, not into a call's arguments or a
   * subscript (#254, #366). A bracketed call is still a call: `(isValid())`
   * runs exactly as `isValid()` does (#1195). E0890's side-effect check asks
   * this one function.
   */
  static callsAtTop(expr: TExpression): boolean {
    switch (expr.kind) {
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse].some((arm) =>
          ExpressionCalls.callsAtTop(arm),
        );
      case "binary":
        return expr.operands.some((operand) =>
          ExpressionCalls.callsAtTop(operand),
        );
      case "unary":
        return ExpressionCalls.callsAtTop(expr.operand);
      case "parenthesized":
        return ExpressionCalls.callsAtTop(expr.expression);
      case "postfix":
        return expr.ops.some((op) => op.kind === "call");
      default:
        return false;
    }
  }

  /**
   * Whether a call runs anywhere in `expr`, a subscript's index and a call's
   * arguments included: ADR-022's E0702 (MISRA 13.5) admits no call in a
   * controlling expression at all (owner ruling, 2026-10-24, #2332:
   * `while ((i < 3) && (arr[w({ ... })] = 1))` is a call in the condition)
   */
  static callsAnywhere(expr: TExpression): boolean {
    return ExpressionNodes.direct(expr).some(
      (node) =>
        node.kind === "postfix" && node.ops.some((op) => op.kind === "call"),
    );
  }
}

export default ExpressionCalls;
