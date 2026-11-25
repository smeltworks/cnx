import { resolve } from "node:path";
import HeaderCompiler from "./HeaderCompiler";
import HeaderMacroDumps from "./HeaderMacroDumps";
import HeaderSources from "./HeaderSources";
import type IHeaderServices from "./types/IHeaderServices";
import type IReadHeaders from "./types/IReadHeaders";
import type IRecoveredDeclarations from "./types/IRecoveredDeclarations";
import type TCachedHeaderRead from "./types/TCachedHeaderRead";
import type THeaderDeclarationCache from "./types/THeaderDeclarationCache";
import EFileType from "../1-Discover/types/EFileType";
import CROSS_COMPILER_VARIABLE from "../../types/CROSS_COMPILER_VARIABLE";
import EHeaderLanguage from "../1-Discover/types/EHeaderLanguage";
import type IDiscoveredFile from "../1-Discover/types/IDiscoveredFile";
import type IFileIncludes from "../1-Discover/types/IFileIncludes";
import type IHeaderInclude from "../1-Discover/types/IHeaderInclude";
import type IHeaderSource from "../1-Discover/types/IHeaderSource";
import type ISourceGraph from "../1-Discover/types/ISourceGraph";
import type ISourceSite from "../../types/ISourceSite";
import type ITranspileError from "../../types/ITranspileError";
import type TRunTarget from "../../types/TRunTarget";
import CodedErrorText from "../../utils/CodedErrorText";
import DeclarationSite from "../../utils/DeclarationSite";
import FileKinds from "../../utils/FileKinds";
import invariant from "../../utils/invariant";
import SourceOrder from "../../utils/SourceOrder";

/** What 1.2 reads a run's headers from: 1.1's walk of them */
type THeaderGraph = Pick<
  ISourceGraph,
  | "cnxFiles"
  | "headerFiles"
  | "headerTexts"
  | "headerIncludes"
  | "headerUnit"
  | "headerSearchPaths"
  | "includeSearchPaths"
  | "includes"
  | "anchor"
  | "run"
>;

/** What settling the headers found: none, when the run reads none */
type TSettled = Awaited<ReturnType<typeof HeaderSources.settle>>;

const NOTHING_SETTLED: TSettled = {
  sources: new Map(),
  recovered: null,
  unsettled: new Map(),
  opened: new Map(),
  cppBuild: false,
};

/**
 * #1713, owner ruling 2026-10-16: 1.1 discovers the source files and reads
 * them; running a compiler over the headers they include is a separate
 * concern, done once 1.2 has chosen the target, with that target's compiler.
 * #1844's judgement of each header, once, on the text a C compile meets, is
 * made here now, on that compiler's text: its own predefined macros, and its
 * own system headers (#1755).
 *
 * One instance per run, holding the run's header errors.
 */
class HeaderReading {
  private readonly errors: ITranspileError[] = [];

  private constructor() {}

  static async read(
    graph: THeaderGraph,
    target: TRunTarget,
    services: IHeaderServices,
  ): Promise<IReadHeaders> {
    const reading = new HeaderReading();
    const unit = graph.headerUnit;
    const needed =
      graph.headerFiles.length > 0 || unit.unresolvedSystem.length > 0;
    // ADR-049: a run without a target has no compiler to read its headers
    // with, and 1.4 reports why it has none
    const compiler =
      target.kind === "resolved"
        ? HeaderCompiler.of(target.description, graph.anchor.configuredCompiler)
        : null;
    const offered =
      compiler === null || typeof compiler === "string"
        ? null
        : services.preprocessorFor(compiler);
    const preprocessor = offered?.isAvailable() ? offered : null;
    if (
      needed &&
      target.kind === "resolved" &&
      compiler !== null &&
      preprocessor === null
    ) {
      reading._noPreprocessor(graph, target, compiler);
      // E0516 ends the run before any macro is read
      return reading._result(
        [],
        NOTHING_SETTLED,
        { cppMode: false, readers: new Map() },
        new Map(),
        new Map(),
      );
    }
    const configured = graph.anchor.configuredCompiler;
    if (
      needed &&
      target.kind === "resolved" &&
      preprocessor !== null &&
      configured !== null
    ) {
      const disagreement = await HeaderCompiler.disagreement(
        preprocessor,
        target.description,
      );
      if (disagreement !== null) {
        reading._disagrees(graph, target, configured, disagreement);
        // E0517 ends the run before any header is read for the wrong target
        return reading._result(
          [],
          NOTHING_SETTLED,
          { cppMode: false, readers: new Map() },
          new Map(),
          new Map(),
        );
      }
    }
    const macros = await HeaderMacroDumps.read(
      graph.cnxFiles,
      graph.includes.c,
      preprocessor,
      {
        includeSearchPaths: graph.includeSearchPaths,
        defines: graph.anchor.defines,
      },
    );
    const settled =
      needed && preprocessor !== null
        ? await HeaderSources.settle(
            graph.headerFiles,
            graph.headerSearchPaths,
            {
              texts: graph.headerTexts,
              preprocessor,
              defines: graph.anchor.defines,
            },
            {
              directives: unit.directives,
              includePaths: graph.includeSearchPaths,
              headers: new Set(
                graph.headerIncludes.map((include) => include.header),
              ),
              searchesSystemPath: unit.unresolvedSystem.length > 0,
              files: HeaderReading._fileUnits(
                graph,
                graph.includes.c,
                macros.slices,
              ),
              cppFiles: HeaderReading._fileUnits(graph, graph.includes.cpp),
              cppRequired: graph.run.cppRequired,
            },
          )
        : NOTHING_SETTLED;
    reading._unsettled(graph.headerIncludes, settled.unsettled, settled.opened);
    const cppMode = reading._cppMode(
      graph.headerIncludes,
      settled.sources,
      settled.opened,
      settled.recovered,
      unit.sites,
      graph.run.cppRequired,
      settled.cppBuild,
    );
    // Only the headers a C compile opens are read (#1844)
    const headerFiles = graph.headerFiles.filter((file) =>
      settled.sources.has(file.path),
    );
    const reader = HeaderCompiler.identity(
      preprocessor === null || typeof compiler === "string" ? null : compiler,
      {
        compilerPath: preprocessor?.compilerPath() ?? null,
        defines: graph.anchor.defines,
        includeSearchPaths: graph.includeSearchPaths,
        headerSearchPaths: graph.headerSearchPaths,
      },
    );
    const readers = new Map(
      headerFiles.map((file) => {
        const source = settled.sources.get(file.path);
        invariant(source !== undefined, "1.2 reads only settled headers");
        return [file.path, HeaderCompiler.readerOf(reader, source)];
      }),
    );
    return reading._result(
      headerFiles,
      settled,
      { cppMode, readers },
      HeaderReading._cachedHeaders(headerFiles, services.headerCache, readers),
      macros.dumps,
    );
  }

  /**
   * Each `.cnx` file's own C includes, searched from its own directory
   * first, as C searches a quoted include (#1688), with (#1916) the expanded
   * slices the macro dump's run of those same includes gave, when it ran
   */
  private static _fileUnits(
    graph: THeaderGraph,
    includes: ReadonlyMap<string, IFileIncludes>,
    expanded?: ReadonlyMap<string, ReadonlyMap<string, string> | null>,
  ): {
    directives: readonly string[];
    includePaths: readonly string[];
    expanded?: ReadonlyMap<string, string> | null;
  }[] {
    return graph.cnxFiles.flatMap((file) => {
      const own = includes.get(file.path);
      return own === undefined || own.cHeaderSpecs.length === 0
        ? []
        : [
            {
              directives: own.cHeaderSpecs,
              includePaths: [
                own.quotedIncludeDirectory,
                ...graph.includeSearchPaths,
              ],
              ...(expanded?.has(file.path) === true
                ? { expanded: expanded.get(file.path) }
                : {}),
            },
          ];
    });
  }

  private _result(
    headerFiles: readonly IDiscoveredFile[],
    settled: TSettled,
    read: Pick<IReadHeaders, "cppMode" | "readers">,
    cached: ReadonlyMap<string, TCachedHeaderRead>,
    macroDumps: IReadHeaders["macroDumps"],
  ): IReadHeaders {
    return {
      headerFiles,
      sources: settled.sources,
      cached,
      recovered: settled.recovered,
      cppMode: read.cppMode,
      readers: read.readers,
      macroDumps,
      errors: this.errors,
    };
  }

  /**
   * #1844, owner ruling 5 of 2026-10-03 (#1542): a run that includes headers
   * needs a preprocessor, since each header's language is judged on its
   * preprocessed text: since #1713, its target's compiler. Reported at the
   * run's first header include.
   */
  private _noPreprocessor(
    graph: THeaderGraph,
    target: TRunTarget & { readonly kind: "resolved" },
    compiler: Exclude<ReturnType<typeof HeaderCompiler.of>, string> | string,
  ): void {
    this.errors.push({
      ...HeaderReading._firstSite(graph),
      message: CodedErrorText.of(
        "E0516",
        "this run includes C headers, and no C preprocessor was found to read them",
      ),
      helpText:
        typeof compiler === "string"
          ? `${compiler}. Set ${CROSS_COMPILER_VARIABLE} to the compiler for the ` +
            "target's headers."
          : `Target '${target.name}' reads its headers with ` +
            `'${compiler.driver}', which is not installed. Install it.`,
      severity: "error",
    });
  }

  /**
   * E0517, #1542 ruling 10: the compiler the project names builds for another
   * platform than the run's target. Reported at the run's first header include.
   */
  private _disagrees(
    graph: THeaderGraph,
    target: TRunTarget & { readonly kind: "resolved" },
    configured: string,
    disagreement: string,
  ): void {
    this.errors.push({
      ...HeaderReading._firstSite(graph),
      message: CodedErrorText.of(
        "E0517",
        `this run names the compiler '${configured}', which builds for a ` +
          `different platform than target '${target.name}'`,
      ),
      helpText:
        `${disagreement}. Set ${CROSS_COMPILER_VARIABLE} (or compile_commands.json) ` +
        `to a compiler for '${target.name}', or remove it to use the target's own.`,
      severity: "error",
    });
  }

  /** The run's first `.cnx` include that reached a header, in source order */
  private static _firstSite(graph: THeaderGraph): ISourceSite {
    const unit = graph.headerUnit;
    const first = HeaderReading._inSourceOrder([
      ...graph.headerIncludes,
      ...unit.unresolvedSystem.flatMap((spec) =>
        (unit.sites.get(spec) ?? []).map((site) => ({ site })),
      ),
    ])[0];
    invariant(
      first !== undefined,
      "a run with headers has a `.cnx` include that reached them",
    );
    return first.site;
  }

  /**
   * The run's C/C++ mode (#1428, owner ruling): detected, not declared. Any
   * C++ header makes the whole run C++, unless the config says
   * `cppRequired: false` -- a run that asked for C, where C++ is E0507
   * (#1844), at every `.cnx` include through which the run meets it.
   * `cppRequired: true` (or `--cpp`) is C++ with only C headers.
   */
  private _cppMode(
    includes: readonly IHeaderInclude[],
    sources: ReadonlyMap<string, IHeaderSource>,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
    recovered: IRecoveredDeclarations | null,
    unitSites: ReadonlyMap<string, readonly ISourceSite[]>,
    cppRequired: boolean | undefined,
    judgedCpp: boolean,
  ): boolean {
    const met = HeaderReading._cppMet(
      includes,
      sources,
      opened,
      recovered,
      unitSites,
    );
    if (cppRequired === false) {
      for (const cpp of HeaderReading._inSourceOrder([...met.values()])) {
        this._cppInCRun(cpp);
      }
      return false;
    }
    // 1.1 judged the mode once, on everything this run's compile meets
    invariant(
      cppRequired !== undefined || judgedCpp || met.size === 0,
      "1.1's C++ judgement covers every C++ file the compile meets",
    );
    return cppRequired ?? judgedCpp;
  }

  /** Each `.cnx` include through which the run meets C++, and the C++ it meets */
  private static _cppMet(
    includes: readonly IHeaderInclude[],
    sources: ReadonlyMap<string, IHeaderSource>,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
    recovered: IRecoveredDeclarations | null,
    unitSites: ReadonlyMap<string, readonly ISourceSite[]>,
  ): ReadonlyMap<string, { path: string; site: ISourceSite }> {
    const languages = new Map(
      [...sources].map(([path, { language }]) => [resolve(path), language]),
    );
    const isCpp = (path: string): boolean =>
      languages.get(path) === EHeaderLanguage.Cpp;
    const met = new Map<string, { path: string; site: ISourceSite }>();
    for (const { header, site } of includes) {
      const cpp = HeaderReading._opensFrom(header, opened).find(isCpp);
      if (cpp !== undefined)
        met.set(HeaderReading._siteKey(site), { path: cpp, site });
    }
    // #985: a slice the toolchain found on its own path is met by the compile
    // as much as a header the walk reached, through every include of the
    // directive that entered it.
    for (const [path, { language, directive }] of recovered?.slices ?? []) {
      if (language !== EHeaderLanguage.Cpp) continue;
      const sites = directive === null ? undefined : unitSites.get(directive);
      invariant(
        sites !== undefined,
        `the unit's preprocessor entered every C++ slice through one of its includes (missing ${path})`,
      );
      for (const site of sites) {
        const key = HeaderReading._siteKey(site);
        if (!met.has(key)) met.set(key, { path, site });
      }
    }
    return met;
  }

  /** E0507: a run that asked for C meets C++ through this include */
  private _cppInCRun(cpp: { path: string; site: ISourceSite }): void {
    const reason =
      FileKinds.of(cpp.path) === EFileType.CppHeader
        ? "C++ header"
        : "C++ syntax";
    this.errors.push({
      ...cpp.site,
      message: CodedErrorText.of(
        "E0507",
        `${reason} in '${DeclarationSite.displayPath(cpp.path)}', reached ` +
          `through this include, but this run asks for C`,
      ),
      helpText:
        "'cppRequired: false' (or --no-cpp) asks for C. Remove it so the " +
        "mode is detected from the headers, or pass --cpp to compile as C++.",
      severity: "error",
    });
  }

  /**
   * #1844, owner ruling 6 of 2026-10-03 (#1542): a header that cannot be
   * preprocessed, alone, after its predecessors' macros, or in the unit, is
   * not read as written. It is an error at every `.cnx` include that reached
   * it, with the preprocessor's own message as help.
   */
  private _unsettled(
    includes: readonly IHeaderInclude[],
    unsettled: ReadonlyMap<string, string>,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
  ): void {
    if (unsettled.size === 0) return;
    const messages = new Map(
      [...unsettled].map(([path, message]) => [resolve(path), message]),
    );
    for (const { header, site } of HeaderReading._inSourceOrder(includes)) {
      for (const path of HeaderReading._opensFrom(header, opened)) {
        const message = messages.get(path);
        if (message === undefined) continue;
        this.errors.push({
          ...site,
          message: CodedErrorText.of(
            "E0517",
            `'${DeclarationSite.displayPath(path)}', reached through this ` +
              `include, cannot be preprocessed`,
          ),
          helpText: message,
          severity: "error",
        });
      }
    }
  }

  /**
   * `header`, then each file a C compile of it opened, by resolved path. The
   * walk's edges ignore `#if`, so they are not the compile's (#1844).
   */
  private static _opensFrom(
    header: string,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
  ): string[] {
    const path = resolve(header);
    return [path, ...(opened.get(path) ?? [])];
  }

  private static _siteKey(site: ISourceSite): string {
    return `${site.sourcePath}:${site.line}:${site.column}`;
  }

  /** By file, then line, then column: one order whatever the walk's */
  private static _inSourceOrder<T extends { readonly site: ISourceSite }>(
    entries: readonly T[],
  ): T[] {
    return [...entries].sort(
      (a, b) =>
        // By code unit, not locale: one order on every machine
        (a.site.sourcePath < b.site.sourcePath
          ? -1
          : Number(a.site.sourcePath > b.site.sourcePath)) ||
        SourceOrder.compare(a.site, b.site),
    );
  }

  /**
   * #1991: each settled header's cache record, every one read before 1.3
   * declares any header (#1817)
   */
  private static _cachedHeaders(
    headers: readonly IDiscoveredFile[],
    cache: THeaderDeclarationCache | null,
    readers: ReadonlyMap<string, string>,
  ): ReadonlyMap<string, TCachedHeaderRead> {
    const reads = new Map<string, TCachedHeaderRead>();
    if (cache === null) return reads;
    for (const file of headers) {
      const reader = readers.get(file.path);
      invariant(reader !== undefined, "1.2 names what read each header");
      try {
        const record = cache(file.path, reader);
        if (record !== null) reads.set(file.path, { kind: "cached", record });
      } catch (error) {
        // 1.3 decides, in header order, whether it is a diagnostic (#1319)
        reads.set(file.path, { kind: "failed", error });
      }
    }
    return reads;
  }
}

export default HeaderReading;
