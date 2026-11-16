/**
 * #1668: 2.2's readings of the one operand typer's facts -- the policy rows
 * for the plan's typing sites, which the design (§5) keeps in one 2-Plan
 * module because several sites share them. The typer reports facts; each row
 * here decides what one site does with them, and nowhere else does.
 */
import type IOperandType from "../../types/IOperandType";
import type ITypingContext from "../../types/ITypingContext";
import type TExpression from "../../types/syntax/TExpression";
import ConstantFold from "../../utils/ConstantFold";

class PlanTyping {
  /** An operand's value where it is written, when it is known at compile time */
  static constantValue(
    expr: TExpression,
    typing: ITypingContext,
  ): number | null {
    return ConstantFold.expressionValue(
      typing.program,
      typing.sourceFile,
      expr,
    );
  }

  /**
   * The type a cast converts FROM, for ADR-024's saturation decision: the
   * typer's type, so a call, a callback, a struct field, an element and a C
   * or C++ header's value are typed like a variable, and a float among them
   * saturates. A Boolean -- `!k`, a comparison -- is the typer's `bool`,
   * whatever its operand was: `(u32)!k` converts 0 or 1, nothing to saturate.
   */
  static castSourceType(t: IOperandType | null): string | null {
    return t?.typeName ?? null;
  }
}

export default PlanTyping;
