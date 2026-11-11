import ExpressionShape from "./ExpressionShape";
import OperandTyper from "./OperandTyper";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";

/**
 * ADR-045: whether an operand is a string -- a string literal, or a value of
 * a string type. 2.2 writes an `=` / `!=` comparison as `strcmp` from this
 * answer, and 2.1's E0929 rejects one where it holds for one side only
 * (#2017), so the two read one fact.
 */
class StringOperand {
  static is(expr: TExpression, ctx: ITypingContext): boolean {
    return (
      ExpressionShape.isStringLiteral(expr) ||
      OperandTyper.isString(OperandTyper.typeOf(expr, ctx))
    );
  }
}

export default StringOperand;
