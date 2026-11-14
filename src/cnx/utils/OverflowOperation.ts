import CLAMP_HELPER_FOR_OPERATOR from "../types/CLAMP_HELPER_FOR_OPERATOR";
import type TOverflowBehavior from "../types/TOverflowBehavior";

/** ADR-044 (#1790): the signed `/ %` that overflow at `MIN / -1` */
const DIVISION_HELPER_FOR_OPERATOR: Readonly<Partial<Record<string, string>>> =
  {
    "/": "div",
    "%": "mod",
  };

/**
 * ADR-044: the one rule of which integer operators go through an overflow
 * helper. A `clamp` `+ - *` saturates. A signed `/` or `%` goes through one
 * under either modifier, because C leaves `MIN / -1` and `MIN % -1` undefined:
 * the quotient is MAX for `clamp` and MIN for `wrap`, the remainder 0 (#1790).
 * Anything else is plain C. 2.1 (E0811) and 2.2 both ask it, so the two
 * decide alike.
 */
class OverflowOperation {
  /**
   * The helper's operation (`add`, `div`, ...), or undefined for plain C.
   * `divisor` is the right operand's value when it is known at compile time
   * (`ConstantFold.numberValue`), else null. A `/` or `%` overflows only at
   * `MIN / -1`, so one by a known divisor other than -1 is plain C, which
   * keeps C's multiply for a constant (#1790 review).
   */
  static of(
    operator: string,
    signed: boolean,
    behavior: TOverflowBehavior,
    divisor: number | null,
  ): string | undefined {
    const division = signed
      ? DIVISION_HELPER_FOR_OPERATOR[operator]
      : undefined;
    if (
      DIVISION_HELPER_FOR_OPERATOR[operator] !== undefined &&
      divisor !== null &&
      divisor !== -1
    ) {
      return undefined;
    }
    return (
      division ??
      (behavior === "clamp" ? CLAMP_HELPER_FOR_OPERATOR[operator] : undefined)
    );
  }
}

export default OverflowOperation;
