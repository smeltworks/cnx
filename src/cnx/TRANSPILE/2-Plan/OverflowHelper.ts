import type TOverflowBehavior from "../../types/TOverflowBehavior";
import OverflowBehaviorUtils from "../../utils/OverflowBehaviorUtils";
import OverflowOperation from "../../utils/OverflowOperation";
import ReservedCnxName from "../../utils/ReservedCnxName";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import type IPlannedOverflowHelper from "../../types/IPlannedOverflowHelper";

/**
 * ADR-044: the overflow helper an operation of an integer type calls, from
 * `OverflowOperation`'s rule, or null for plain C
 */
class OverflowHelper {
  /**
   * `divisor` is the right operand's value when it is known at compile time,
   * else null (`OverflowOperation.of`). Under `debugMode` every operation
   * panics on overflow, `wrap` included (#2408).
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
    const operation = OverflowOperation.of(
      operator,
      TypeCheckUtils.isSigned(cnxType),
      behavior,
      divisor,
    );
    return OverflowHelper.planned(behavior, operation, cnxType);
  }

  /**
   * A unary `-`'s helper (#2418). `operand` is its value when known at
   * compile time, else null (`OverflowOperation.ofNegation`).
   */
  static ofNegation(
    declared: TOverflowBehavior,
    cnxType: string,
    bitWidth: number,
    operand: number | null,
    debugMode: boolean,
  ): IPlannedOverflowHelper | null {
    const behavior = OverflowBehaviorUtils.underDebug(declared, debugMode);
    if (!TypeCheckUtils.isInteger(cnxType)) return null;
    const operation = OverflowOperation.ofNegation(
      TypeCheckUtils.isSigned(cnxType),
      operand,
      -(2 ** (bitWidth - 1)),
    );
    return OverflowHelper.planned(behavior, operation, cnxType);
  }

  private static planned(
    behavior: TOverflowBehavior,
    operation: string | undefined,
    cnxType: string,
  ): IPlannedOverflowHelper | null {
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
