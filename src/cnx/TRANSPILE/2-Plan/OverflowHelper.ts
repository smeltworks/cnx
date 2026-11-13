import type TOverflowBehavior from "../../types/TOverflowBehavior";
import OverflowOperation from "../../utils/OverflowOperation";
import ReservedCnxName from "../../utils/ReservedCnxName";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import type IPlannedOverflowHelper from "./types/IPlannedOverflowHelper";

/**
 * ADR-044: the overflow helper an operation of an integer type calls, from
 * `OverflowOperation`'s rule, or null for plain C
 */
class OverflowHelper {
  static of(
    behavior: TOverflowBehavior,
    operator: string,
    cnxType: string,
  ): IPlannedOverflowHelper | null {
    if (!TypeCheckUtils.isInteger(cnxType)) return null;
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
