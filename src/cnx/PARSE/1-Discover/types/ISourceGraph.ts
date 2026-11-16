import type ITargetCatalogFile from "./ITargetCatalogFile";
import type IDiscoveredFile from "./IDiscoveredFile";
import type IPipelineFile from "./IPipelineFile";
import type IPlatformIOProject from "../../../types/IPlatformIOProject";
import type IAnchorFacts from "./IAnchorFacts";
import type IFileIncludes from "./IFileIncludes";
import type IOutputPaths from "./IOutputPaths";
import type IRunSettings from "./IRunSettings";
import type IByOutputMode from "./IByOutputMode";
import type IHeaderInclude from "./IHeaderInclude";
import type IHeaderUnit from "./IHeaderUnit";

/**
 * `SourceGraph` — the artifact 1.1 Discover emits (#1444).
 *
 * `docs/architecture/README.md` §1 gives 1.1 sole authorship of which files
 * exist, their kind, the include graph, topological order and every resolved
 * absolute path. Before this, those facts were the pipeline's input record plus
 * five maps `Transpiler` accumulated beside it, and 1.4's `Program` carried
 * four of them for want of a 1.1 artifact (#1452).
 *
 * Plain data, frozen when discovery ends: the record, its arrays and each
 * file's records are `Object.freeze`d, and its maps are typed read-only, as
 * `Program`'s are. A class would not do: immer's `freeze(x, true)` is a silent
 * no-op on class instances (#1313).
 */
interface ISourceGraph {
  /**
   * The cnx files, in dependency order: every file after the files it
   * includes (#580). Each carries its kind, its resolved path, the text
   * discovery read it from (one read, #1835 review) and its direct `.cnx`
   * includes, which are the graph's edges (#1435).
   */
  readonly cnxFiles: readonly IPipelineFile[];

  /**
   * The C and C++ headers the files reach, transitively. 1.2 reads the ones
   * a C compile opens (#1844), with the compiler of the run's target (#1713).
   */
  readonly headerFiles: readonly IDiscoveredFile[];

  /** #1713: each header's text (by `path`), as 1.1 read it */
  readonly headerTexts: ReadonlyMap<string, string>;

  /** #1844: every `.cnx` file's header includes, in discovery order */
  readonly headerIncludes: readonly IHeaderInclude[];

  /** #1402: each header's own resolved includes, the header-to-header edges */
  readonly headerEdges: ReadonlyMap<string, readonly string[]>;

  /** Issue #985: the run's C includes as one translation unit */
  readonly headerUnit: IHeaderUnit;

  /**
   * Per header (by `path`), the search path discovery resolved it along --
   * that of the `.cnx` file that reached it (#1723). Header preprocessing and
   * the #985 translation-unit recovery take their -I list from here.
   */
  readonly headerSearchPaths: ReadonlyMap<string, readonly string[]>;

  /**
   * Every `.cnx` file's search path, merged in discovery order (#1723): the -I
   * list for preprocessing with no single includer.
   */
  readonly includeSearchPaths: readonly string[];

  /**
   * Per cnx file, by `path`, what discovery learned about its includes.
   *
   * **The ORDER is significant** and is the order discovery VISITED the
   * files, not `cnxFiles`' dependency order: a generated header takes its
   * include spellings from every file in this order, and
   * `ExternalTypeHeaderBuilder` lets the first header declaring a type win.
   *
   * #1713: spelled for each mode, since a `.cnx` include names a generated
   * header whose extension follows the mode 1.2 settles.
   */
  readonly includes: IByOutputMode<ReadonlyMap<string, IFileIncludes>>;

  /**
   * Where the run is anchored (#1719), as facts: the project root found from
   * the anchor, the directory a `.cnx` header's `#include` is measured from,
   * and the compile database's defines beneath the caller's.
   *
   * And the project root's `platformio.ini`, parsed: ADR-049's build-system
   * rung, or null when the root has none (#1444, owner ruling 3). It is
   * parsed from the text 1.1's include discovery read for `lib_extra_dirs`,
   * so the libraries the run searches and the target it builds for come from
   * one version of the file.
   */
  readonly anchor: IAnchorFacts & {
    readonly platformio: IPlatformIOProject | null;
    /**
     * #1713: the compiler the project names -- `CNX_CROSS_COMPILER`, else
     * the compile database's -- which reads the headers when it builds for
     * the target (#1542 ruling 10); null when it names none
     */
    readonly configuredCompiler: string | null;
  };

  /** Whether to write generated output to disk: a files run, not a source run. */
  readonly writeOutputToDisk: boolean;

  /**
   * #1991: each cnx file's output paths, by its path, for each mode
   * (#1713), so no later stage asks `PathResolver`.
   */
  readonly outputs: IByOutputMode<ReadonlyMap<string, IOutputPaths>>;

  /**
   * #1991: the target catalog (ADR-049), read here so that no later pass
   * reads the filesystem for it.
   */
  readonly targetCatalog: ITargetCatalogFile;

  /** #1991: the run's settings, which a later pass reads instead of the host's config */
  readonly run: IRunSettings;
}

export default ISourceGraph;
