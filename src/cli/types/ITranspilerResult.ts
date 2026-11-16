import ITranspileError from "../../cnx/types/ITranspileError";
import IGrammarCoverageReport from "../../cnx/types/IGrammarCoverageReport";
import IFileResult from "../../cnx/types/IFileResult";
import type IRecordedRequirement from "../../cnx/types/IRecordedRequirement";
import type IRecordedAdrSite from "../../cnx/types/IRecordedAdrSite";

/**
 * Result of running the unified transpiler
 */
interface ITranspilerResult {
  /** Overall success - true only if all files transpiled without errors */
  success: boolean;

  /** Per-file transpilation results */
  files: IFileResult[];

  /** Total files processed */
  filesProcessed: number;

  /** Total symbols collected from C/C++ headers */
  symbolsCollected: number;

  /** Aggregate errors across all files */
  errors: ITranspileError[];

  /** Warnings (non-fatal issues) */
  warnings: string[];

  /** ADR-049: the run's one target, and where it came from */
  target?: { readonly name: string; readonly source: string };

  /** Output files generated */
  outputFiles: string[];

  /** Grammar coverage (if collectGrammarCoverage was enabled) */
  grammarCoverage?: IGrammarCoverageReport;

  /**
   * Issue #1143: Union of every file's toolchain requirements, with the source
   * sites that incurred each. Printed by ResultPrinter and used to answer
   * "what does *my* project need?" rather than "what might cnx need?".
   */
  requirements?: readonly IRecordedRequirement[];

  /**
   * Issue #1241: every position at which an ADR's rule fired while generating
   * this run's output. Consumed by the scope-context matrix so a fixture that
   * asserts generated C -- rather than a diagnostic -- can occupy a cell.
   */
  adrSites?: readonly IRecordedAdrSite[];

  /**
   * #1402: each file's direct includes, by the paths 1.1 Discover resolved: a
   * `.cnx` file's `.cnx` and C/C++ header includes, and a header's own
   * includes (`ISourceGraph.headerEdges`). The matrix measures how far a
   * declaration is from a fixture over this graph instead of resolving the
   * includes a second time.
   */
  includes?: ReadonlyMap<string, readonly string[]>;

  /**
   * #1523: the `.cnx` files whose own `#include` lines name a C/C++ header,
   * resolved or not (`IPipelineFile.includesForeignHeader`). An unresolved
   * `<system.h>` is in no include graph, but its names still exist, so a run
   * with no includes in `includes` may still use a declaration from one.
   */
  includesForeignHeader?: ReadonlySet<string>;
}

export default ITranspilerResult;
