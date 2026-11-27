import type IDiscoveredFile from "../../1-Discover/types/IDiscoveredFile";
import type IHeaderSource from "../../1-Discover/types/IHeaderSource";
import type ITranspileError from "../../../types/ITranspileError";
import type IHeaderMacroDump from "./IHeaderMacroDump";
import type IRecoveredDeclarations from "./IRecoveredDeclarations";
import type TCachedHeaderRead from "./TCachedHeaderRead";

/** #1713: a run's headers, as the compiler of its target reads them */
interface IReadHeaders {
  /** The headers a C compile opens (#1844), in 1.1's order */
  readonly headerFiles: readonly IDiscoveredFile[];

  /**
   * Per header a C compile opens (by `path`), the text 1.2 parses and the
   * language judged on its own lines as the compile meets them (#1844)
   */
  readonly sources: ReadonlyMap<string, IHeaderSource>;

  /** #1991: per header the symbol cache holds a valid record for, that record */
  readonly cached: ReadonlyMap<string, TCachedHeaderRead>;

  /**
   * Issue #985: the run's C includes preprocessed as one unit, split back into
   * each header's slice: when a header could not be preprocessed alone, or a
   * `<...>` include is found only on the compiler's own path (#1755)
   */
  readonly recovered: IRecoveredDeclarations | null;

  /**
   * #1844: whether the run emits C++. Detected (#1428): any C++ header makes
   * the run C++, unless `cppRequired: false`, where it is E0507.
   */
  readonly cppMode: boolean;

  /**
   * Per header (by `path`), `HeaderCompiler.readerOf` what read it and the
   * text it was read as, which a cache record is only good for
   */
  readonly readers: ReadonlyMap<string, string>;

  /** #2514: each header two files' compiles read differently, by `path` */
  readonly disputed: ReadonlySet<string>;

  /** #1688: each cnx file with a C include, to its header macro dump */
  readonly macroDumps: ReadonlyMap<string, IHeaderMacroDump>;

  /** E0516, E0517 and E0507 */
  readonly errors: readonly ITranspileError[];
}

export default IReadHeaders;
