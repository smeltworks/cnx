/**
 * ADR-051: one `safe_div`/`safe_mod` helper a file defines. A signed one
 * divides through ADR-044's overflow helper, `inner`, so `MIN / -1` gives what
 * `/` gives (#1790); null divides in plain C.
 */
interface IPlannedSafeDivision {
  readonly name: string;
  readonly operation: "div" | "mod";
  readonly cnxType: string;
  readonly inner: string | null;
}

export default IPlannedSafeDivision;
