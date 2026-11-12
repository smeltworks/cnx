import EssentialCategory from "./EssentialCategory";
import StringOperand from "./StringOperand";
import type ITypingContext from "../types/ITypingContext";
import type TBinaryExpression from "../types/syntax/TBinaryExpression";

/**
 * A flattened comparison level past its first pair (#1373): `a = b = c` is
 * `(a = b) = c`, so operand `i > 1` is compared with the bool of the operands
 * before it. E0807, E0810 and E0929 describe that mistake, and suggest its
 * likely intent, from here, so the three cannot drift apart.
 */
class ComparisonChain {
  /**
   * `'a = b = c' compares the bool 'a = b' with 'c'`, for operand `i`; `what`
   * names that operand's kind, e.g. "the string "
   */
  static message(level: TBinaryExpression, i: number, what = ""): string {
    const chain = ComparisonChain.written(level, 0, i + 1);
    const bool = ComparisonChain.written(level, 0, i);
    return `'${chain}' compares the bool '${bool}' with ${what}'${level.operands[i].written}'`;
  }

  /**
   * Each adjacent pair as written, joined with &&: `a = b != c` as
   * `(a = b) && (b != c)`. Null where a pair would itself be rejected -- a
   * chain that is not all strings, or not all of one category.
   */
  static pairs(level: TBinaryExpression, ctx: ITypingContext): string | null {
    if (!ComparisonChain.splitsIntoPairs(level, ctx)) return null;
    return level.operators
      .map(
        (operator, i) =>
          `(${level.operands[i].written} ${operator} ${level.operands[i + 1].written})`,
      )
      .join(" && ");
  }

  /** Operands `start` up to `end` and the operators between, as written */
  static written(level: TBinaryExpression, start: number, end: number): string {
    let text = level.operands[start].written;
    for (let i = start + 1; i < end; i += 1) {
      text += ` ${level.operators[i - 1]} ${level.operands[i].written}`;
    }
    return text;
  }

  private static splitsIntoPairs(
    level: TBinaryExpression,
    ctx: ITypingContext,
  ): boolean {
    const strings = level.operands.filter((o) => StringOperand.is(o, ctx));
    if (strings.length > 0) return strings.length === level.operands.length;
    const categories = new Set(
      level.operands.map((operand) => EssentialCategory.of(operand, ctx)),
    );
    categories.delete(null);
    return categories.size === 1;
  }
}

export default ComparisonChain;
