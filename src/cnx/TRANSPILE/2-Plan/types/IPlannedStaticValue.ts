import type ISourceSite from "../../../types/ISourceSite";
import type IConstSpelling from "./IConstSpelling";
import type TPlannedNarrowing from "./TPlannedNarrowing";

/** #1735: how 2.3 writes one static-storage value as its folded value */
interface IPlannedStaticValue {
  readonly spelling: IConstSpelling;
  /** MISRA 10.3: a char literal's cast to the value's type, or null */
  readonly narrowing: TPlannedNarrowing | null;
  /**
   * Each line of an arithmetic chain in it 2.2 would have written as ADR-044
   * clamp helpers, had it not folded: where that rule fired (#1735 review 2)
   */
  readonly clamps: ReadonlyArray<{
    readonly line: number;
    readonly declaredAt: ISourceSite | undefined;
  }>;
}

export default IPlannedStaticValue;
