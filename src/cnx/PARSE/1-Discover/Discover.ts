import { basename, dirname, join, resolve } from "node:path";

import Installation from "./Installation";
import type ITargetCatalogFile from "./types/ITargetCatalogFile";
import CppEntryPointScanner from "./CppEntryPointScanner";
import DependencyGraph from "./DependencyGraph";
import FileDiscovery from "./FileDiscovery";
import IncludeDiscovery from "./IncludeDiscovery";
import IncludeResolver from "./IncludeResolver";
import InputExpansion from "./InputExpansion";
import PlatformIOIni from "./PlatformIOIni";
import EFileType from "./types/EFileType";
import EHeaderLanguage from "./types/EHeaderLanguage";
import type IHeaderSource from "./types/IHeaderSource";
import type IDiscoveredFile from "./types/IDiscoveredFile";
import type ISourceSite from "../../types/ISourceSite";
import CodedErrorText from "../../utils/CodedErrorText";
import type IHeaderInclude from "./types/IHeaderInclude";
import type IHeaderUnit from "./types/IHeaderUnit";
import type IHeaderRoot from "./types/IHeaderRoot";
import type IFileSystem from "../../types/IFileSystem";
import type ITranspileError from "../../types/ITranspileError";
import type IInMemorySource from "./types/IInMemorySource";
import type IPipelineFile from "./types/IPipelineFile";
import type IRunAnchor from "./types/IRunAnchor";
import type ITranspilerConfig from "../../types/ITranspilerConfig";
import type THeaderExtension from "../../types/THeaderExtension";
import type TTranspileInput from "../../types/TTranspileInput";
import invariant from "../../utils/invariant";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";
import OutputExtensions from "../../utils/OutputExtensions";
import type IOutputPaths from "./types/IOutputPaths";
import ReadOnceFileSystem from "./ReadOnceFileSystem";
import RunAnchor from "./RunAnchor";
import type IFileIncludes from "./types/IFileIncludes";
import type ISourceGraph from "./types/ISourceGraph";
import CnxSourcePath from "../../utils/CnxSourcePath";
import IncludePath from "../../utils/IncludePath";
import CrossCompilerVariable from "./CrossCompilerVariable";

/** The configuration a run's discovery reads. */
type TDiscoverySettings = Pick<
  Required<ITranspilerConfig>,
  "input" | "includeDirs" | "defines" | "outDir" | "debugMode"
> &
  // #2104: unset is outDir; "" is the cwd.
  Pick<ITranspilerConfig, "headerOutDir"> &
  // #1844: unset is not false. Unset, C++ in a header makes the run C++;
  // `false` asked for C, and C++ met there is E0507.
  Pick<ITranspilerConfig, "cppRequired"> &
  // #1991: carried onto `SourceGraph.run`. Unset means off, with no target rung.
  Pick<ITranspilerConfig, "parseOnly" | "target" | "pioEnv">;

/** The graph before it is frozen, without the facts gathered beside it. */
type TDiscoveredFiles = Omit<
  ISourceGraph,
  | "includes"
  | "anchor"
  | "run"
  | "outputs"
  | "targetCatalog"
  | "headerTexts"
  | "headerUnit"
> & {
  /** #1844: per header, the headers the walk found it includes */
  readonly headerEdges: ReadonlyMap<string, readonly string[]>;
};

/** A `.cnx` file's includes, resolved but not yet spelled (#1844). */
interface IResolvedFileIncludes {
  readonly resolved: ReturnType<IncludeResolver["resolve"]>;
  readonly quotedIncludeDirectory: string;
}

/**
 * 1.1 Discover: which files exist, their kind, the include graph, topological
 * order and every resolved absolute path (`docs/architecture/README.md` §1),
 * emitted as one frozen `SourceGraph` (#1444).
 *
 * This was Stage 1 of `Transpiler`: about a dozen private methods that wrote
 * five maps onto the orchestrator beside the pipeline input they returned.
 * Those maps were read two stages later, which is why 1.4's `Program` carried
 * four of them (#1452). They are the graph's `includes` now, built by the
 * same code, and nothing after 1.1 resolves an include or reads a file to
 * learn one.
 *
 * One instance per run. Its maps are its own, so two runs cannot share them,
 * which #1721 had to serialize runs to guarantee.
 */
class Discover {
  /**
   * The run's discovery errors: E0509, each at its header's marker (#1542),
   * and E0518 for an input whose cnx extension is not lowercase (#1833).
   */
  private readonly errors: ITranspileError[] = [];

  /**
   * `discoverIncludePaths` answers, per directory, for this run. It reads only
   * the directory of the path it is given, the filesystem and $HOME, none of
   * which change within one run, so the files of one directory share one
   * answer -- and a source run makes this run on every editor request.
   */
  private readonly tiersByDirectory = new Map<string, readonly string[]>();

  /**
   * #1844: each file's includes as resolved, in visiting order. They are
   * spelled for each mode (#1713), because a `.cnx` include names a generated
   * header, whose extension follows the mode 1.2 settles.
   */
  private readonly resolvedIncludes = new Map<string, IResolvedFileIncludes>();

  private constructor(
    private readonly anchor: IRunAnchor,
    private readonly settings: TDiscoverySettings,
    private readonly fs: IFileSystem,
    private readonly warnings: string[],
  ) {}

  /**
   * 1.1's artifact for one cnx text with no run around it: the editor's
   * symbol list (`lib/parseWithSymbols`). No include is looked up and nothing
   * is read, as before: that request stopped paying for a whole discovery per
   * keystroke when the global registry went (#1378, #1452). The text still
   * enters the pipeline here, so 1.2 takes it from 1.1 like every other text.
   */
  static inMemoryFile(source: string, path: string): IPipelineFile {
    return {
      path,
      source,
      discoveredFile: { path, type: EFileType.Cnx },
      cnxIncludes: [],
      includesForeignHeader: false,
    };
  }

  /**
   * 1.1's artifact for one header text the caller says is C
   * (`lib/parseCHeader`), so 1.2 parses it with the C parser.
   */
  static inMemoryCHeader(text: string): IHeaderSource {
    return { text, language: EHeaderLanguage.C };
  }

  /**
   * Discover a run's files, and anchor it.
   *
   * Branches on input kind:
   * - 'files': filesystem scan, dependency graph, topological sort
   * - 'source': the same discovery, rooted at an in-memory string
   *
   * @param previousAnchor - The last run's anchor, which a run anchored at the
   *   same place reuses (see `RunAnchor.at`)
   * @param warnings - Where discovery's warnings go
   * @returns the frozen graph, the anchor the run's services come from, and
   *   the errors that reject the run. A run with errors goes no further.
   */
  static run(
    input: TTranspileInput,
    previousAnchor: IRunAnchor,
    settings: TDiscoverySettings,
    fs: IFileSystem,
    warnings: string[],
  ): {
    readonly graph: ISourceGraph;
    readonly anchor: IRunAnchor;
    readonly errors: readonly ITranspileError[];
  } {
    const root = input.kind === "source" ? Discover._inMemoryRoot(input) : null;
    // #1719: a source run is anchored where its text lives -- its project
    // root, compile database, and the base its `#include`s and guards are
    // measured from -- never at `config.input`, which the editor leaves empty,
    // so its preview was anchored at the parent of the process's cwd.
    const anchor = RunAnchor.at(
      root === null
        ? settings.input
        : join(root.directory, basename(root.path)),
      previousAnchor,
      settings,
      fs,
    );
    // Owner ruling 3: every read 1.1 makes goes through one view, so each
    // file's text is read once. The anchor keeps the host port: it, and its
    // `PathResolver`, outlive this run.
    const discovery = new Discover(
      anchor,
      settings,
      new ReadOnceFileSystem(fs),
      warnings,
    );
    const files =
      input.kind === "source" && root !== null
        ? discovery._fromSource(root, input.includeDirs ?? [])
        : discovery._fromFiles();
    return {
      graph: discovery._freeze(
        files,
        discovery._translationUnit(files.cnxFiles),
      ),
      anchor,
      errors: discovery.errors,
    };
  }

  /**
   * Issue #985: every C header the `.cnx` files include, as a translation
   * unit includes it, deduped in first-seen source order.
   */
  private _translationUnit(
    cnxFiles: readonly { readonly path: string }[],
  ): IHeaderUnit {
    const sites = new Map<string, ISourceSite[]>();
    const unresolvedSystem: string[] = [];
    for (const file of cnxFiles) {
      const includes = this.resolvedIncludes.get(file.path);
      invariant(
        includes !== undefined,
        `discovery resolves the includes of every file it reaches (missing ${file.path})`,
      );
      // #1830 review: the directives 1.1 read, so a commented-out header adds
      // nothing to the unit.
      for (const spec of includes.resolved.cHeaderSpecs) {
        const written = sites.get(spec) ?? [];
        if (written.some((site) => site.sourcePath === file.path)) continue;
        const position = includes.resolved.positions.get(
          IncludeDirectiveText.ofSpec(spec),
        );
        invariant(
          position !== undefined,
          `the resolver records where every directive sits (missing ${spec} in ${file.path})`,
        );
        sites.set(spec, [...written, { sourcePath: file.path, ...position }]);
        if (
          written.length === 0 &&
          spec.startsWith("<") &&
          includes.resolved.resolutions.get(
            IncludeDirectiveText.ofSpec(spec),
          ) === null
        ) {
          unresolvedSystem.push(spec);
        }
      }
    }
    return { directives: [...sites.keys()], sites, unresolvedSystem };
  }

  /**
   * #1844: each file's include spellings, for a run whose generated headers
   * take `headerExtension`, in the order discovery visited the files.
   */
  private _spelledIncludes(
    headerExtension: THeaderExtension,
    outputs: ReadonlyMap<string, IOutputPaths>,
    headerEdges: ReadonlyMap<string, readonly string[]>,
  ): ReadonlyMap<string, IFileIncludes> {
    const spelled = new Map<string, IFileIncludes>();
    const paths = this.anchor.pathResolver;
    const headerIncludePathFor = (cnxPath: string): string | null =>
      paths.getHeaderIncludePath(cnxPath, headerExtension);
    const writtenIn = (directory: string) => ({
      directory,
      headerPathFor: (cnxPath: string) =>
        paths.headerPathFor(cnxPath, headerExtension),
    });
    for (const [path, { resolved, quotedIncludeDirectory }] of this
      .resolvedIncludes) {
      const output = outputs.get(path);
      // Issue #1467: PathResolver's answer to "where is this .cnx's header
      // reachable from?", so the include text and the header's location are
      // the same derivation rather than two that happen to agree. #2272/#1473:
      // a quoted include is spelled from where each generated file is written,
      // so the .h and the .c each get their own spelling of it.
      const spelling = IncludeResolver.spell(
        resolved,
        headerExtension,
        headerIncludePathFor,
        output === undefined ? null : writtenIn(dirname(output.header)),
      );
      const sourceSpelling =
        output === undefined
          ? spelling
          : IncludeResolver.spell(
              resolved,
              headerExtension,
              headerIncludePathFor,
              writtenIn(dirname(output.source)),
            );
      spelled.set(
        path,
        Object.freeze({
          // Issue #1467: one resolution, read later by the .c
          includeRewrites: sourceSpelling.includeRewrites,
          // #1672: what each directive resolved to, which 2.1's ADR-010 rules read
          resolutions: resolved.resolutions,
          cnxAlternatives: resolved.cnxAlternatives,
          // #1444, owner ruling 1: what each directive's spelling names, which
          // 2.1 and render read rather than classify
          kinds: resolved.kinds,
          // #1435: the directory its quoted includes resolve from, which a
          // generated header spells them relative to (#1725)
          quotedIncludeDirectory,
          // #2272: where its generated header is written, which every quoted
          // include that header carries is spelled relative to
          generatedHeaderDirectory:
            output === undefined
              ? quotedIncludeDirectory
              : dirname(output.header),
          // Issues #497/#854: how this file spells each header and .cnx it
          // includes, which is what its own generated header must say (#1435)
          headerIncludeDirectives: spelling.headerIncludeDirectives,
          writerRelativeIncludes: spelling.writerRelativeIncludes,
          // #1444: what its own generated header includes, from the tokens
          // read here rather than from 1.2's tree in Stage 5
          userIncludes: Object.freeze(spelling.userIncludes),
          cHeaderIncludes: Object.freeze(spelling.cHeaderIncludes),
          cHeaderSpecs: Object.freeze(resolved.cHeaderSpecs),
          cHeaderPaths: Discover._headerClosure(
            resolved.cHeaderPaths,
            headerEdges,
          ),
        }),
      );
    }
    return spelled;
  }

  /**
   * #1881: `roots` and every header the walk found them include, as resolved
   * paths -- what a file's own C includes bring in, as C inlines them.
   */
  private static _headerClosure(
    roots: ReadonlySet<string>,
    headerEdges: ReadonlyMap<string, readonly string[]>,
  ): ReadonlySet<string> {
    const included = new Map<string, readonly string[]>();
    for (const [header, nested] of headerEdges) {
      included.set(resolve(header), nested);
    }
    const reached = new Set<string>();
    const pending = [...roots];
    for (
      let header = pending.pop();
      header !== undefined;
      header = pending.pop()
    ) {
      if (reached.has(header)) continue;
      reached.add(header);
      for (const nested of included.get(header) ?? []) {
        pending.push(resolve(nested));
      }
    }
    return reached;
  }

  /**
   * A source run's root: its text, the path it lives at, and the directory
   * its quoted includes resolve from.
   *
   * #1435: ADR-010 resolves a quoted include from the file it appears in.
   * Text given a path lives at that path, resolved exactly as the root's
   * identity is (against the process's working directory), so where the
   * root IS and where it resolves FROM cannot come apart. `workingDir` is
   * where text with no path is resolved from. One directory, decided here,
   * for discovery and for the 2.1 rules that ask where a quoted include is.
   * An empty path is no path, and is decided so once for both fields.
   */
  private static _inMemoryRoot(
    input: Extract<TTranspileInput, { kind: "source" }>,
  ): IInMemorySource {
    const sourcePath = input.sourcePath === "" ? undefined : input.sourcePath;
    return {
      path: sourcePath ?? "<string>",
      source: input.source,
      directory: sourcePath
        ? dirname(resolve(sourcePath))
        : (input.workingDir ?? process.cwd()),
    };
  }

  /**
   * The artifact, frozen all the way down: the record, its arrays, each file's
   * record and everything under it, and the anchor's facts. Maps are typed
   * read-only, as `Program`'s are, and left as they are: freezing a `Map`
   * stops nothing, since `set` writes no property.
   *
   * #1444 review: this froze two levels. `discoveredFile`, `cnxIncludes`,
   * each header and `anchor.defines` still took writes, and two of those reached
   * past the record written: `anchor.defines` is the `RunAnchor`'s own object,
   * which the next run at that anchor reuses, and a file's `cnxIncludes`
   * entry is the included file's own `discoveredFile`.
   */
  private _freeze(files: TDiscoveredFiles, unit: IHeaderUnit): ISourceGraph {
    const outputs = {
      c: this._outputs(files, false),
      cpp: this._outputs(files, true),
    };
    // #2272: a source run writes nothing, so its headers are spelled from the
    // directory each `.cnx` is in, where they would be generated beside it
    const written = (paths: ReadonlyMap<string, IOutputPaths>) =>
      files.writeOutputToDisk ? paths : new Map<string, IOutputPaths>();
    return Discover._frozen({
      cnxFiles: files.cnxFiles,
      headerFiles: files.headerFiles,
      // #1713: the text the walk read, which 1.2 hands the target's compiler
      headerTexts: new Map(
        files.headerFiles.map((file) => [
          file.path,
          this.fs.readFile(file.path),
        ]),
      ),
      headerIncludes: files.headerIncludes,
      headerUnit: unit,
      headerSearchPaths: files.headerSearchPaths,
      includeSearchPaths: files.includeSearchPaths,
      includes: {
        c: this._spelledIncludes(
          OutputExtensions.forCppMode(false).header,
          written(outputs.c),
          files.headerEdges,
        ),
        cpp: this._spelledIncludes(
          OutputExtensions.forCppMode(true).header,
          written(outputs.cpp),
          files.headerEdges,
        ),
      },
      anchor: {
        directory: this.anchor.directory,
        projectRoot: this.anchor.projectRoot,
        defines: this.anchor.defines,
        // ADR-049's build-system rung, from the text discovery read. The
        // build machine's environment too: PlatformIO appends its
        // PLATFORMIO_DEFAULT_ENVS to default_envs (#1794)
        platformio: this.anchor.projectRoot
          ? PlatformIOIni.read(this.anchor.projectRoot, this.fs, process.env)
          : null,
        configuredCompiler:
          CrossCompilerVariable.compiler(process.env) ?? this.anchor.compiler,
      },
      writeOutputToDisk: files.writeOutputToDisk,
      outputs,
      targetCatalog: this._targetCatalog(),
      run: {
        debugMode: this.settings.debugMode,
        parseOnly: this.settings.parseOnly ?? false,
        ...(this.settings.cppRequired === undefined
          ? {}
          : { cppRequired: this.settings.cppRequired }),
        // Serve and the host pass "" for "no target" or "no environment";
        // it names nothing, so 1.4 is handed only a name or nothing.
        target: {
          option: this.settings.target || undefined,
          pioEnv: this.settings.pioEnv || undefined,
        },
      },
    });
  }

  /** ADR-049: the catalog this compiler ships, found by `Installation` */
  private _targetCatalog(): ITargetCatalogFile {
    const path = Installation.catalog(this.fs);
    return { path, text: this.fs.readFile(path) };
  }

  /**
   * #1991: where each file's output goes in a run of one mode (#1713). A
   * source run's file is named by its basename, as a files run names a file
   * outside every input directory.
   */
  private _outputs(
    files: TDiscoveredFiles,
    cppMode: boolean,
  ): ReadonlyMap<string, IOutputPaths> {
    const extensions = OutputExtensions.forCppMode(cppMode);
    const paths = this.anchor.pathResolver;
    return new Map(
      files.cnxFiles.map((file): [string, IOutputPaths] => {
        const source = paths.getOutputPath(
          file.discoveredFile,
          extensions.source,
        );
        const header = paths.getHeaderOutputPath(
          file.discoveredFile,
          extensions.header,
        );
        return [
          file.path,
          {
            // #2272/#1473: relative to the .c, so it does not depend on which
            // entry pulled the file in
            selfInclude: files.writeOutputToDisk
              ? IncludePath.relative(dirname(source), header)
              : CnxSourcePath.withExtension(
                  basename(file.path),
                  extensions.header,
                ),
            source,
            header,
          },
        ];
      }),
    );
  }

  /**
   * Freeze plain objects and arrays all the way down, and leave each `Map` as
   * it is. The graph holds no cycle: an include edge names the included
   * file's `IDiscoveredFile`, which refers to nothing.
   */

  private static _frozen<T>(value: T): T {
    if (typeof value !== "object" || value === null || value instanceof Map) {
      return value;
    }
    for (const child of Object.values(value)) {
      Discover._frozen(child);
    }
    return Object.freeze(value);
  }

  /**
   * Stage 1 for a `{ kind: "files" }` run: the entry point, then every file
   * its includes reach.
   */
  private _fromFiles(): TDiscoveredFiles {
    const entryPath = resolve(this.settings.input);

    // Check if this is a C/C++ entry point
    if (InputExpansion.isCppEntryPoint(entryPath)) {
      return this._fromCppEntryPoint(entryPath);
    }

    // Step 1: Discover entry point file (original .cnx entry point logic)
    const cnxFiles: IDiscoveredFile[] = [];
    const fileByPath = new Map<string, IDiscoveredFile>();

    const entryFile = FileDiscovery.discoverFile(entryPath, this.fs);
    if (entryFile?.type === EFileType.RejectedCnx) {
      return this._rejectedInput(entryPath);
    }
    if (entryFile?.type !== EFileType.Cnx) {
      return Discover._noCnxFiles();
    }
    cnxFiles.push(entryFile);
    fileByPath.set(resolve(entryFile.path), entryFile);

    // Step 2: Build dependency graph, resolve headers, and return pipeline input
    return this._buildFiles(cnxFiles, fileByPath);
  }

  /**
   * Discover cnx files from a C/C++ entry point.
   *
   * Scans the include tree for headers with cnx generation markers,
   * extracts the source .cnx paths, and returns them for transpilation.
   */
  private _fromCppEntryPoint(entryPath: string): TDiscoveredFiles {
    // #1706: the entry point's search path and each discovered .cnx file's
    // are the ones .cnx discovery computes, discovered tiers included.
    const searchPaths = this._searchPathsFor(entryPath, []);

    const scanner = new CppEntryPointScanner(searchPaths, this.fs, (cnxPath) =>
      this._searchPathsFor(cnxPath, []),
    );
    const scanResult = scanner.scan(entryPath);

    // #1541: these are ERRORS, and they now behave like it. They were pushed
    // onto `this.warnings`, which exited 0 with zero output files while the
    // same fault reached through a quoted include is E0506 and exits 1.
    //
    // #1542: and they are reported, not thrown. A throw reached the user at
    // `1:0` behind `Pipeline failed:`; each error now carries its header's
    // marker as its position, as every other diagnostic carries its own.
    //
    // The warnings are kept beside them: the scan collects `#include "x.h" not
    // found (from ...)` and `Could not read <path>`, and a missing cnx source
    // is very often downstream of exactly those. A marker found with no source
    // also sets `noCnxFound`, so the errors are checked first: the run is
    // rejected, not told "No cnx source files found".
    this.warnings.push(...scanResult.warnings);

    if (scanResult.errors.length > 0) {
      this.errors.push(...scanResult.errors);
      return Discover._noCnxFiles();
    }

    if (scanResult.noCnxFound) {
      return Discover._noCnxFiles();
    }

    // Convert discovered .cnx paths to IDiscoveredFile array
    const cnxFiles: IDiscoveredFile[] = scanResult.cnxSources.map((path) => ({
      path,
      type: EFileType.Cnx,
    }));

    // Build fileByPath map for dependency resolution
    const fileByPath = new Map<string, IDiscoveredFile>();
    for (const cnxFile of cnxFiles) {
      fileByPath.set(resolve(cnxFile.path), cnxFile);
    }

    // Scanner discovers .cnx files via header markers in the C/C++ include tree.
    // _buildFiles then resolves direct .cnx-to-.cnx includes (e.g.,
    // #include "utils.cnx") which the scanner visits but doesn't add to sources.
    return this._buildFiles(cnxFiles, fileByPath);
  }

  /**
   * #1833: E0518 for the run's input, files or source. No
   * directive names the input, so it is placed at `1:0`, as every diagnostic
   * about the run is (E0510, E0511, E0515); #1847 decides that form for all
   * of them.
   */
  private _rejectedInput(path: string): TDiscoveredFiles {
    const rejection = CnxSourcePath.rejection(
      basename(path),
      "rename the file.",
    );
    invariant(rejection !== null, `${path} is a rejected cnx path`);
    this.errors.push({
      sourcePath: path,
      line: 1,
      column: 0,
      message: CodedErrorText.of(rejection.code, rejection.message),
      helpText: rejection.helpText,
      severity: "error",
    });
    return Discover._noCnxFiles();
  }

  /** Discovery's answer when it finds no cnx file to transpile. */
  private static _noCnxFiles(): TDiscoveredFiles {
    return {
      cnxFiles: [],
      headerFiles: [],
      headerSearchPaths: new Map(),
      headerIncludes: [],
      headerEdges: new Map(),
      includeSearchPaths: [],
      writeOutputToDisk: true,
    };
  }

  /**
   * Stage 1 for a `{ kind: "source" }` run: the same discovery as files mode,
   * rooted at text that is supplied rather than read.
   *
   * #1435: this resolved only the root itself and walked the rest with a
   * second walker. That walker rebuilt each include's search path without the
   * PlatformIO and Arduino tiers, read files around the injected filesystem,
   * collected no header an include pulled in, and did not know the root was
   * already in the run -- so a cyclic include enqueued the root a second time
   * and declared it twice (E0203). Discovery is one loop now, and the root is
   * in its graph from the start, so a back edge to it is an edge.
   *
   * @param callerIncludeDirs - The input's own include directories. They are
   *   the run's, as `config.includeDirs` are: every file the root reaches
   *   searches them, not the root alone.
   */
  private _fromSource(
    entry: IInMemorySource,
    callerIncludeDirs: readonly string[],
  ): TDiscoveredFiles {
    if (CnxSourcePath.isRejected(entry.path)) {
      return this._rejectedInput(entry.path);
    }
    const root: IDiscoveredFile = {
      path: entry.path,
      type: EFileType.Cnx,
    };
    const discovered = this._buildFiles(
      [root],
      new Map([[resolve(entry.path), root]]),
      entry,
      callerIncludeDirs,
    );

    // The root is the one file this run generates; everything it reaches only
    // contributes symbols. Source mode uses the basename for a self-include, to
    // match files mode.
    return {
      ...discovered,
      cnxFiles: discovered.cnxFiles.map((file) =>
        file.path === entry.path
          ? { ...file, source: entry.source }
          : { ...file, symbolOnly: true },
      ),
      writeOutputToDisk: false,
    };
  }

  /**
   * Build the graph from the cnx files discovered so far.
   *
   * Processes includes, builds dependency graph, resolves headers transitively,
   * and converts to pipeline files. Used by both .cnx and C/C++ entry point paths.
   *
   * @param callerIncludeDirs - A source run's own include directories, which
   *   every file of the run searches (see `_fromSource`).
   */
  private _buildFiles(
    cnxFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
    inMemory?: IInMemorySource,
    callerIncludeDirs: readonly string[] = [],
  ): TDiscoveredFiles {
    const headerRoots = new Map<string, IHeaderRoot>();
    const headerIncludes: IHeaderInclude[] = [];
    const depGraph = new DependencyGraph();

    const directForeignHeaderFiles = new Set<string>();
    // #1435: the include graph, kept. It is resolved here once, with the full
    // search path, and 1.4 takes every file's visibility closure over it.
    const includesByPath = new Map<string, IDiscoveredFile[]>();
    // #1835 review: the text discovery read, which 1.2 parses -- one read, so
    // a save between the passes cannot give them different directives.
    const sourcesByPath = new Map<string, string>();
    // #1723: every file's search path, merged in discovery order.
    const includeSearchPaths = new Set<string>();
    // `cnxFiles` grows as includes are found, so this visits the closure.
    for (const cnxFile of cnxFiles) {
      const cnxPath = resolve(cnxFile.path);
      depGraph.addFile(cnxPath);
      const discovered = this._resolveCnxIncludes(
        cnxFile,
        callerIncludeDirs,
        inMemory?.path === cnxFile.path ? inMemory : undefined,
      );
      const resolved = discovered.resolved;
      sourcesByPath.set(cnxPath, discovered.content);
      for (const searchPath of discovered.searchPaths) {
        includeSearchPaths.add(searchPath);
      }
      if (resolved.hasForeignInclude) {
        directForeignHeaderFiles.add(cnxPath);
      }
      Discover._collectHeaders(
        resolved,
        cnxFile.path,
        discovered.searchPaths,
        headerRoots,
        headerIncludes,
      );
      includesByPath.set(
        cnxPath,
        Discover._processCnxIncludes(
          resolved,
          cnxPath,
          depGraph,
          cnxFiles,
          fileByPath,
        ),
      );
    }

    // Issue #580: Sort files topologically for correct cross-file const inference
    const sortedCnxFiles = this._sortFilesByDependency(depGraph, fileByPath);

    // Resolve headers transitively, each along its includer's search path
    const allHeaders = this._resolveHeadersTransitively([
      ...headerRoots.values(),
    ]);

    // Convert IDiscoveredFile[] to IPipelineFile[] (disk-based, all get code gen)
    const pipelineFiles: IPipelineFile[] = sortedCnxFiles.map((f) => {
      const cnxIncludes = includesByPath.get(resolve(f.path));
      invariant(
        cnxIncludes !== undefined,
        `discovery resolves the includes of every file it sorts (missing ${f.path})`,
      );
      const source = sourcesByPath.get(resolve(f.path));
      invariant(
        source !== undefined,
        `discovery reads the text of every file it sorts (missing ${f.path})`,
      );
      return {
        path: f.path,
        source,
        discoveredFile: f,
        cnxIncludes,
        includesForeignHeader: directForeignHeaderFiles.has(resolve(f.path)),
      };
    });

    return {
      cnxFiles: pipelineFiles,
      headerFiles: allHeaders.headers,
      headerSearchPaths: allHeaders.searchPaths,
      headerIncludes,
      headerEdges: allHeaders.edges,
      includeSearchPaths: [...includeSearchPaths],
      writeOutputToDisk: true,
    };
  }

  /**
   * Resolve one `.cnx` file's includes -- the one place discovery decides such
   * a file's text, its directory and its search path. What each directive
   * resolved to is recorded, so 2.1's ADR-010 rules read that answer rather
   * than resolve the include again (#1672), and the text read here is the
   * text 1.2 parses, so the two cannot see different directives (#1835
   * review). The search path is `_searchPathsFor`'s, which a C/C++ entry
   * point's marker scan uses too (#1706).
   *
   * #1435: every file in a run comes through here, including the root of a
   * source run, whose text is `inMemory.source` and whose directory is
   * `inMemory.directory`. The search path is the same computation for every
   * file: the directory, then the caller's include directories (a source
   * run's own, which every file it reaches searches), then everything
   * `discoverIncludePaths` finds from the file's directory (the project tiers,
   * PlatformIO libdeps and Arduino libraries), then the configured ones. An
   * in-memory root used to get a path without the PlatformIO and Arduino
   * tiers, so the editor preview could not see a library the CLI compiled.
   *
   * @returns the resolution, the search path it was made along -- which
   *   the C headers this file reaches are searched along too (#1723) -- and
   *   the text it was read from
   */
  private _resolveCnxIncludes(
    cnxFile: IDiscoveredFile,
    callerIncludeDirs: readonly string[],
    inMemory?: IInMemorySource,
  ): {
    readonly resolved: ReturnType<IncludeResolver["resolve"]>;
    readonly searchPaths: readonly string[];
    readonly content: string;
  } {
    const content = inMemory?.source ?? this.fs.readFile(cnxFile.path);
    const sourceDir = inMemory?.directory ?? dirname(cnxFile.path);
    const searchPaths = this._searchPathsFor(
      join(sourceDir, basename(cnxFile.path)),
      callerIncludeDirs,
    );

    const resolver = new IncludeResolver(searchPaths, this.fs, sourceDir);
    const resolved = resolver.resolve(content, cnxFile.path);
    this.resolvedIncludes.set(cnxFile.path, {
      resolved,
      quotedIncludeDirectory: sourceDir,
    });
    this.warnings.push(...resolved.warnings);
    return { resolved, searchPaths, content };
  }

  /**
   * The search path a file's includes resolve along: its directory, then the
   * caller's include directories, then everything `discoverIncludePaths`
   * finds from that directory (the project tiers, PlatformIO libdeps and
   * Arduino libraries), then the configured ones. The one computation for a
   * `.cnx` file (#1435) and for a C/C++ entry point (#1706), which built a
   * list of its own without the tiers.
   *
   * @param file - The file, or where an in-memory file lives
   */
  private _searchPathsFor(
    file: string,
    callerIncludeDirs: readonly string[],
  ): string[] {
    return IncludeResolver.buildSearchPaths(
      dirname(file),
      this.anchor.includeDirs,
      [...callerIncludeDirs, ...this._tiersFor(file)],
    );
  }

  /**
   * What `discoverIncludePaths` finds from `file`'s directory, walked once
   * per directory per run.
   */
  private _tiersFor(file: string): readonly string[] {
    const directory = dirname(resolve(file));
    const cached = this.tiersByDirectory.get(directory);
    if (cached !== undefined) {
      return cached;
    }
    const tiers = IncludeDiscovery.discoverIncludePaths(file, this.fs);
    this.tiersByDirectory.set(directory, tiers);
    return tiers;
  }

  /**
   * Sort files topologically and convert paths to IDiscoveredFile array.
   */
  private _sortFilesByDependency(
    depGraph: DependencyGraph,
    fileByPath: Map<string, IDiscoveredFile>,
  ): IDiscoveredFile[] {
    const sortedPaths = depGraph.getSortedFiles();
    this.warnings.push(...depGraph.getWarnings());

    const sortedFiles: IDiscoveredFile[] = [];
    for (const path of sortedPaths) {
      const file = fileByPath.get(path);
      if (file) {
        sortedFiles.push(file);
      }
    }
    return sortedFiles;
  }

  /**
   * Process cnx includes from resolved includes.
   * Issue #461: Collect included .cnx files for symbol resolution
   * Issue #580: Track dependencies for topological sorting
   *
   * @returns this file's direct includes, each as the run's own entry for that
   *   file (#1435), so 1.4's visibility closure keys on the same paths the
   *   files were declared under.
   */
  private static _processCnxIncludes(
    resolved: { cnxIncludes: IDiscoveredFile[] },
    cnxPath: string,
    depGraph: DependencyGraph,
    cnxFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
  ): IDiscoveredFile[] {
    const direct: IDiscoveredFile[] = [];
    for (const cnxInclude of resolved.cnxIncludes) {
      const includePath = resolve(cnxInclude.path);

      depGraph.addDependency(cnxPath, includePath);

      // Don't add if already in the list.
      //
      // Issue #1134: identity here is the RESOLVED PATH, never the basename.
      // Keying on the basename made can/config.cnx and uart/config.cnx the same
      // file, so the second was dropped from the compilation entirely — the
      // transpiler exited 0 and emitted cnx source syntax into the C output.
      // `fileByPath` indexes `cnxFiles` by exactly that path, on every route.
      const existing = fileByPath.get(includePath);
      if (!existing) {
        cnxFiles.push(cnxInclude);
        fileByPath.set(includePath, cnxInclude);
      }
      direct.push(existing ?? cnxInclude);
    }
    return direct;
  }

  /**
   * Record each header a `.cnx` file includes as a root of the header walk.
   *
   * #1435: this skipped any header whose BASENAME matched a cnx file of the
   * run, a guess from when discovery scanned whole directories and every `.h`
   * beside a `.cnx` was "likely generated output" (77d2a9903). A basename is
   * not an identity -- the #1134 shape -- so `uart.cnx` wrapping ESP-IDF's
   * `<driver/uart.h>` lost the vendor header and failed with E0422. A header
   * the transpiler generated is identified by the marker it carries, and
   * `IncludeResolver.resolveHeadersTransitively` already skips it on that.
   *
   * #1723: each header keeps the search path of the first file that reached
   * it, and its own includes are searched along that path.
   */
  private static _collectHeaders(
    resolved: ReturnType<IncludeResolver["resolve"]>,
    sourcePath: string,
    searchPaths: readonly string[],
    headerRoots: Map<string, IHeaderRoot>,
    headerIncludes: IHeaderInclude[],
  ): void {
    const seen = new Set<string>();
    for (const header of resolved.headers) {
      if (seen.has(header.path)) continue;
      seen.add(header.path);
      // #1844: and where this file includes it, for E0507
      const include = resolved.included.find(
        (entry) => entry.absolutePath === resolve(header.path),
      );
      const position =
        include &&
        resolved.positions.get(IncludeDirectiveText.join(include.includeInfo));
      invariant(
        position !== undefined,
        `the resolver records the directive of every header it resolves (missing ${header.path})`,
      );
      headerIncludes.push({
        header: header.path,
        site: { sourcePath, ...position },
      });
      if (!headerRoots.has(header.path)) {
        headerRoots.set(header.path, { file: header, searchPaths });
      }
    }
  }

  /**
   * Every header the run reaches, each resolved along its includer's search
   * path.
   *
   * #1444: this handed the walk the orchestrator's `processedHeaders` as the
   * walk's starting `visited` set. Only Stage 2 wrote that set, after
   * discovery, and every run cleared it before discovery began, so the walk
   * always started from an empty one. The walk's own `visited` set is the cycle
   * guard, and it is unchanged.
   */
  private _resolveHeadersTransitively(roots: ReadonlyArray<IHeaderRoot>): {
    headers: IDiscoveredFile[];
    searchPaths: ReadonlyMap<string, readonly string[]>;
    edges: ReadonlyMap<string, readonly string[]>;
  } {
    const resolved = IncludeResolver.resolveHeadersTransitively(roots, {
      onDebug: this.settings.debugMode
        ? (msg) => console.log(`[DEBUG] ${msg}`)
        : undefined,
      fs: this.fs,
    });
    this.warnings.push(...resolved.warnings);
    return resolved;
  }
}

export default Discover;
