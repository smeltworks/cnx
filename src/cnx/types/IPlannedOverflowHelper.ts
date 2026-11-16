import type IClampTypeInfo from "./IClampTypeInfo";
import type TOverflowBehavior from "./TOverflowBehavior";

/**
 * ADR-044: one overflow helper 2.2 decided an integer operation calls, e.g.
 * `cnx_clamp_mul_u32` or `cnx_wrap_div_i32` (#1790)
 */
interface IPlannedOverflowHelper {
  /** The C function 2.3 calls */
  readonly name: string;
  readonly behavior: TOverflowBehavior;
  /** `add`, `sub`, `mul`, `div`, `mod` or `neg` (unary `-`, #2418) */
  readonly operation: string;
  readonly cnxType: string;
  /** The C types and limits its definition is written in, `b` the wider (#94) */
  readonly types: IClampTypeInfo;
}

export default IPlannedOverflowHelper;
