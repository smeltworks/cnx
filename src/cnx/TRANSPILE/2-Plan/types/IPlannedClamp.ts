import type ISourceSite from "../../../types/ISourceSite";

/**
 * ADR-044: the saturating helpers 2.2 decided a `clamp` integer write calls --
 * one `cnx_clamp_<operation>_<cnxType>` per operator, in order
 */
interface IPlannedClamp {
  readonly cnxType: string;
  readonly operations: readonly string[];
  /** #1402: the declaration whose `clamp` type decided the chain */
  readonly declaredAt: ISourceSite | undefined;
}

export default IPlannedClamp;
