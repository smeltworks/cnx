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
 * Anything else is plain C.
 */
class OverflowOperation {
  /** The helper's operation (`add`, `div`, ...), or undefined for plain C */
  static of(
    operator: string,
    signed: boolean,
    behavior: TOverflowBehavior,
  ): string | undefined {
    const division = signed
      ? DIVISION_HELPER_FOR_OPERATOR[operator]
      : undefined;
    return (
      division ??
      (behavior === "clamp" ? CLAMP_HELPER_FOR_OPERATOR[operator] : undefined)
    );
  }
}

export default OverflowOperation;
