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
  /** The C type of the output, numerator and default */
  readonly operandType: string;
  /** The divisor's: ADR-044's overflow helper's `b`, the wider type (#94, #2415) */
  readonly divisorType: string;
  /**
   * The type's maximum when a wider divisor must be compared against it
   * before an unsigned division in the type's own width (#2415), else null
   */
  readonly divisorLimit: string | null;
}

export default IPlannedSafeDivision;
