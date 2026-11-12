/**
 * Unary Expression Generator
 *
 * Generates C code for unary expressions:
 * - Prefix operators: !, -, ~, &
 * - Recursive unary (e.g., !!x, --x)
 * - Delegates to postfix for base case
 */
import IGeneratorOutput from "../IGeneratorOutput";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import CppModeHelper from "../../../../2-Plan/CppModeHelper";
import invariant from "../../../../../utils/invariant";
import type TNegativeMinimum from "../../../../2-Plan/types/TNegativeMinimum";

/**
 * The literals whose negation overflows in C: -2147483648 is -(2147483648),
 * and 2147483648 > INT32_MAX. 2.2 plans each one as a minimum macro, so 2.3
 * writing one plainly means 2.2 missed it.
 */
const OVERFLOWING_LITERALS: ReadonlySet<string> = new Set([
  "2147483648",
  "9223372036854775808",
  "9223372036854775808LL",
]);

const MINIMUM_MACRO: Readonly<Record<TNegativeMinimum, string>> = {
  int32_t: "INT32_MIN",
  int64_t: "INT64_MIN",
};

/**
 * Generate C code for a unary expression.
 *
 * Handles prefix operators (!, -, ~, &) and delegates to postfix
 * expression for the base case (no prefix operator).
 *
 * #1445 box 3: takes the operator and the operand's ALREADY-GENERATED code,
 * not the node. The node was read for three things and inspected for none of
 * them -- `postfixExpression()` and `unaryExpression()` were handed straight
 * back to the orchestrator, and `getText()` only ever had its first character
 * examined. The recursion stays with the caller, which is the tree-walker.
 */
interface IPlannedUnary {
  /**
   * The prefix operator, or null when there is none.
   *
   * Null covers BOTH shapes that return the operand unchanged: the base case
   * (the operand is a postfix expression) and the grammar-impossible fallback
   * the old code kept. They produced identical output before, so collapsing
   * them loses nothing -- stated because it looks like two cases becoming one.
   */
  readonly operator: "!" | "-" | "~" | null;

  /** The operand's generated C. */
  readonly operandCode: string;

  /** 2.2's decision: the type whose minimum macro this `-` literal is written as (MISRA 10.3) */
  readonly minimum: TNegativeMinimum | null;

  /** 2.2's decision: the unsigned C type this `~` is cast back to (MISRA 10.1) */
  readonly complementCast: string | null;
}

const generateUnaryExpr: TGeneratorFn<IPlannedUnary> = (
  unary: IPlannedUnary,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const inner = unary.operandCode;

  if (unary.operator === "!") return { code: `!${inner}`, effects: [] };
  if (unary.operator === "-") {
    // MISRA 10.3: the cast is needed because INT32_MIN has type `int`
    if (unary.minimum !== null) {
      return {
        code: `(${unary.minimum})${MINIMUM_MACRO[unary.minimum]}`,
        effects: [],
      };
    }
    invariant(
      !OVERFLOWING_LITERALS.has(inner),
      `2.2 planned every negative minimum 2.3 renders (got -${inner})`,
    );
    return { code: `-${inner}`, effects: [] };
  }
  if (unary.operator === "~") {
    const cType = unary.complementCast;
    if (cType !== null) {
      return {
        code: CppModeHelper.cast(cType, `~${inner}`, orchestrator.state),
        effects: [],
      };
    }
    return { code: `~${inner}`, effects: [] };
  }

  // No operator: the base case, and the grammar-impossible fallback.
  return { code: inner, effects: [] };
};

export default generateUnaryExpr;
