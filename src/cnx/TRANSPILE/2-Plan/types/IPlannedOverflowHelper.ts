import type TOverflowBehavior from "../../../types/TOverflowBehavior";

/**
 * ADR-044: one overflow helper 2.2 decided an integer operation calls, e.g.
 * `cnx_clamp_mul_u32` or `cnx_wrap_div_i32` (#1790)
 */
interface IPlannedOverflowHelper {
  /** The C function 2.3 calls */
  readonly name: string;
  readonly behavior: TOverflowBehavior;
  /** `add`, `sub`, `mul`, `div` or `mod` */
  readonly operation: string;
  readonly cnxType: string;
}

export default IPlannedOverflowHelper;
