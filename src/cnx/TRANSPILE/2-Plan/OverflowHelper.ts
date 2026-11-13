import type TOverflowBehavior from "../../types/TOverflowBehavior";
import OverflowBehaviorUtils from "../../utils/OverflowBehaviorUtils";
import OverflowOperation from "../../utils/OverflowOperation";
import ReservedCnxName from "../../utils/ReservedCnxName";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import type IPlannedOverflowHelper from "./types/IPlannedOverflowHelper";

const DIVISION_OPERATORS: ReadonlySet<string> = new Set(["/", "%"]);

/**
 * ADR-044: the overflow helper an operation of an integer type calls, from
 * `OverflowOperation`'s rule, or null for plain C
 */
class OverflowHelper {
  /**
   * `divisor` is the right operand's value when it is known at compile time,
   * else null. A `/` or `%` overflows only at `MIN / -1`, so a known divisor
   * other than -1 is plain C, which keeps C's own promotion of a divisor past
   * the type and its multiply for a constant (#1790 review). Under
   * `debugMode` every operation panics on overflow, `wrap` included (#2408).
   */
  static of(
    declared: TOverflowBehavior,
    operator: string,
    cnxType: string,
    divisor: number | null,
    debugMode: boolean,
  ): IPlannedOverflowHelper | null {
    const behavior = OverflowBehaviorUtils.underDebug(declared, debugMode);
    if (!TypeCheckUtils.isInteger(cnxType)) return null;
    if (
      DIVISION_OPERATORS.has(operator) &&
      divisor !== null &&
      divisor !== -1
    ) {
      return null;
    }
    const operation = OverflowOperation.of(
      operator,
      TypeCheckUtils.isSigned(cnxType),
      behavior,
    );
    if (operation === undefined) return null;
    return {
      name: ReservedCnxName.overflowHelper(behavior, operation, cnxType),
      behavior,
      operation,
      cnxType,
    };
  }
}

export default OverflowHelper;
