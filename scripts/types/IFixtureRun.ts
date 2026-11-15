import type IRecordedAdrSite from "../../src/cnx/types/IRecordedAdrSite";
import type ITranspileError from "../../src/cnx/types/ITranspileError";

/**
 * #1402: what one transpile of a fixture, and every file it includes, tells
 * the matrix.
 */
interface IFixtureRun {
  /** Where each ADR's rule fired, in whichever file of the chain it fired */
  readonly sites: readonly IRecordedAdrSite[];

  /** The run's diagnostics, each with the file it is reported in */
  readonly errors: readonly ITranspileError[];

  /** Each file's include hops from the fixture (`IncludeHops`) */
  readonly hops: ReadonlyMap<string, number>;
}

export default IFixtureRun;
