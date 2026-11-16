import type IPlannedOverflowHelper from "../../../types/IPlannedOverflowHelper";
import type ISourceSite from "../../../types/ISourceSite";

/**
 * ADR-044: the overflow helper 2.2 decided each operator of an integer chain
 * calls, in order. An operator with none stays plain C where it stands, so
 * `a * b / c` is `cnx_clamp_mul_u32(a, b) / c` (#1790).
 */
interface IPlannedOverflowChain {
  readonly operations: readonly (IPlannedOverflowHelper | null)[];
  /** #1402: the declaration whose overflow type decided the chain */
  readonly declaredAt: ISourceSite | undefined;
}

export default IPlannedOverflowChain;
