import TYPE_MAP from "./types/TYPE_MAP";
import ClampTypes from "./ClampTypes";
import type IPlannedOverflowHelper from "../../types/IPlannedOverflowHelper";
import type IPlannedSafeDivision from "../../types/IPlannedSafeDivision";

/**
 * ADR-051: the C types a `cnx_safe_div`/`cnx_safe_mod` helper is written in,
 * decided here once and stored on the planned helper -- 2.2 plans its headers
 * from them and 2.3 writes them (#1991)
 */
class SafeDivisionTypes {
  /** The helper returns whether the divisor was zero */
  static readonly RESULT_C_TYPE = "bool";

  /**
   * The helper `name` 2.2 planned. Its divisor is ADR-044's overflow helper's
   * `b`, the wider type (#94), so a divisor past the operand's type -- a
   * header macro such as `#define BIG 300` on an `i8` -- reaches the zero test
   * and the division whole, as it does `/` (#2415). A signed one divides
   * through `inner`, which takes that divisor as it is; an unsigned one,
   * which has no `inner` (C's unsigned `/` cannot overflow), compares it
   * against the type's maximum first.
   */
  static planned(
    name: string,
    operation: "div" | "mod",
    cnxType: string,
    inner: IPlannedOverflowHelper | null,
  ): IPlannedSafeDivision {
    const operandType = TYPE_MAP[cnxType];
    const types = ClampTypes.of(cnxType);
    const divisorType = types.widerType;
    return {
      name,
      operation,
      cnxType,
      inner: inner?.name ?? null,
      operandType,
      divisorType,
      divisorLimit:
        types.isUnsigned && divisorType !== operandType ? types.maxValue : null,
    };
  }

  /** Every C type a planned helper writes */
  static cTypesOf(helper: IPlannedSafeDivision): readonly string[] {
    return [
      SafeDivisionTypes.RESULT_C_TYPE,
      helper.operandType,
      helper.divisorType,
    ];
  }
}

export default SafeDivisionTypes;
