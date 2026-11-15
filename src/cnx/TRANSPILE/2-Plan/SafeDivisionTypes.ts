import TYPE_MAP from "./types/TYPE_MAP";
import ClampTypes from "./ClampTypes";

/**
 * ADR-051: the C types a `cnx_safe_div`/`cnx_safe_mod` helper is written in
 * -- 2.2 plans its headers from them and 2.3 writes them (#1991)
 */
class SafeDivisionTypes {
  /** The helper returns whether the divisor was zero */
  static readonly RESULT_C_TYPE = "bool";

  /** The C type of the helper's output, numerator and default */
  static operandOf(cnxType: string): string {
    return TYPE_MAP[cnxType];
  }

  /**
   * The C type of the helper's divisor: ADR-044's overflow helper's `b`, the
   * wider type (#94), so a divisor past the operand's type -- a header macro
   * such as `#define BIG 300` on an `i8` -- reaches the zero test and the
   * division whole, as it does `/` (#2415)
   */
  static divisorOf(cnxType: string): string {
    return ClampTypes.resolve(cnxType)?.widerType ?? TYPE_MAP[cnxType];
  }

  /** Every C type the helper for `cnxType` writes */
  static cTypesOf(cnxType: string): readonly string[] {
    return [
      SafeDivisionTypes.RESULT_C_TYPE,
      SafeDivisionTypes.operandOf(cnxType),
      SafeDivisionTypes.divisorOf(cnxType),
    ];
  }
}

export default SafeDivisionTypes;
