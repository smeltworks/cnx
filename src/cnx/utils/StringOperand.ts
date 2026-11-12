import ExpressionShape from "./ExpressionShape";
import OperandTyper from "./OperandTyper";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";

/**
 * ADR-045: whether an operand is a string -- a string literal, a value of a
 * string type, or a C string (a `char` array or a `cstring`), which cnx
 * treats as one. 2.1's E0929 rejects a comparison where this holds for one
 * side only (#2017), and 2.2 writes an `=` / `!=` comparison as `strcmp` from
 * the same answer (#1373 review), so the two read one fact.
 */
class StringOperand {
  static is(expr: TExpression, ctx: ITypingContext): boolean {
    return StringOperand.isCnx(expr, ctx) || StringOperand.isC(expr, ctx);
  }

  /**
   * Whether `=` / `!=` compares these operands' contents. Two C strings are
   * compared by content as a cnx string is; a C string beside anything else
   * is a pointer, so `c_line != NULL` stays a null check (ADR-046).
   */
  static comparesContents(
    left: TExpression,
    right: TExpression,
    ctx: ITypingContext,
  ): boolean {
    if (StringOperand.isCnx(left, ctx) || StringOperand.isCnx(right, ctx)) {
      return true;
    }
    return StringOperand.isC(left, ctx) && StringOperand.isC(right, ctx);
  }

  private static isCnx(expr: TExpression, ctx: ITypingContext): boolean {
    return (
      ExpressionShape.isStringLiteral(expr) ||
      OperandTyper.isString(OperandTyper.typeOf(expr, ctx))
    );
  }

  private static isC(expr: TExpression, ctx: ITypingContext): boolean {
    const type = OperandTyper.typeOf(expr, ctx);
    if (type === null) return false;
    if (type.typeName === "char") return type.dimensions.length === 1;
    return type.typeName === "cstring";
  }
}

export default StringOperand;
