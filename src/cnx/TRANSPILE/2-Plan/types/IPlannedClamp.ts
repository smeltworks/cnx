import type IPlannedOverflowHelper from "./IPlannedOverflowHelper";

/**
 * ADR-044: the overflow helper 2.2 decided each operator of an integer chain
 * calls, in order. An operator with none stays plain C where it stands, so
 * `a * b / c` is `cnx_clamp_mul_u32(a, b) / c` (#1790).
 */
interface IPlannedClamp {
  readonly operations: readonly (IPlannedOverflowHelper | null)[];
}

export default IPlannedClamp;
