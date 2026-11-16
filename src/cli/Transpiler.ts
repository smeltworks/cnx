/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * A single file transpilation is just a project with one .cnx file.
 *
 * Architecture: transpile() is the single entry point. 1.1 Discover
 * (`Discover.run`) emits the run's `SourceGraph`, then it delegates to
 * _executePipeline(). There is ONE pipeline for all transpilation.
 */

import type THeaderDeclarationCache from "../cnx/PARSE/2-Parse/types/THeaderDeclarationCache";

import IFileSystem from "../cnx/types/IFileSystem";

import CodeGenWalker from "../cnx/TRANSPILE/CodeGenWalker";
import invariant from "../cnx/utils/invariant";
import FileFacts from "../cnx/utils/FileFacts";
import AdrProvenance from "../cnx/instrumentation/AdrProvenance";
import HeaderRenderer from "../cnx/TRANSPILE/3-Render/headers/HeaderRenderer";
import IHeaderEmissionFacts from "../cnx/TRANSPILE/3-Render/headers/types/IHeaderEmissionFacts";
import type IProgram from "../cnx/types/IProgram";

import IDiscoveredFile from "../cnx/PARSE/1-Discover/types/IDiscoveredFile";
import Installation from "../cnx/PARSE/1-Discover/Installation";
import EHeaderLanguage from "../cnx/PARSE/1-Discover/types/EHeaderLanguage";

import ErrorLocation from "../cnx/utils/ErrorLocation";
import ITranspilerConfig from "../cnx/types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "../cnx/types/IFileResult";
import type IRunAnchor from "../cnx/PARSE/1-Discover/types/IRunAnchor";
import IPipelineFile from "../cnx/PARSE/1-Discover/types/IPipelineFile";
import type ISourceGraph from "../cnx/PARSE/1-Discover/types/ISourceGraph";
import Discover from "../cnx/PARSE/1-Discover/Discover";
import RunAnchor from "../cnx/PARSE/1-Discover/RunAnchor";
import TTranspileInput from "../cnx/types/TTranspileInput";
import ITranspileError from "../cnx/types/ITranspileError";
import DiagnosticText from "./DiagnosticText";
import type IDeclaredSource from "../cnx/PARSE/3-Declare/types/IDeclaredSource";
import type IDeclaredSources from "../cnx/PARSE/3-Declare/types/IDeclaredSources";
import type TRunFacts from "../cnx/PARSE/2-Parse/types/TRunFacts";
import Parse from "../cnx/PARSE/2-Parse/Parse";
import Declare from "../cnx/PARSE/3-Declare/Declare";
import Analyze from "../cnx/TRANSPILE/1-Analyze/Analyze";
import AnalyzedFiles from "../cnx/TRANSPILE/1-Analyze/AnalyzedFiles";
import Resolve from "../cnx/PARSE/4-Resolve/Resolve";
import type IResolvedProgram from "../cnx/PARSE/4-Resolve/types/IResolvedProgram";
import type TFrontEndResult from "./types/TFrontEndResult";
import type IAnalysis from "../cnx/TRANSPILE/1-Analyze/types/IAnalysis";
import type IDiagnostics from "../cnx/types/IDiagnostics";
import CacheManager from "./cache/CacheManager";
import PreprocessCache from "../cnx/PARSE/2-Parse/preprocessor/PreprocessCache";
import Preprocessor from "../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import ToolchainDetector from "../cnx/PARSE/2-Parse/preprocessor/ToolchainDetector";
import HeaderCompiler from "../cnx/PARSE/2-Parse/HeaderCompiler";
import type IHeaderCompiler from "../cnx/PARSE/2-Parse/preprocessor/types/IHeaderCompiler";
import type IRecordedRequirement from "../cnx/types/IRecordedRequirement";
import type IRenderedFile from "./types/IRenderedFile";
import RequirementAggregator from "../cnx/utils/RequirementAggregator";
import type IRenderedOutput from "../cnx/TRANSPILE/3-Render/types/IRenderedOutput";
import Write from "../cnx/WRITE/1-Write/Write";
import CaughtError from "../cnx/utils/CaughtError";
import ProgramChecks from "../cnx/PARSE/4-Resolve/ProgramChecks";
import IncludeGuards from "../cnx/TRANSPILE/3-Render/headers/IncludeGuards";

/**
 * The config with every default filled in, except `cppRequired`: unset is
 * not false (#1844). Unset, 1.1 detects the run's mode from its headers. And
 * `headerOutDir`: unset is `outDir`, while `""` is the cwd (#2104).
 */
type TRunConfig = Required<
  Omit<ITranspilerConfig, "cppRequired" | "headerOutDir">
> &
  Pick<ITranspilerConfig, "cppRequired" | "headerOutDir">;

/**
 * Unified transpiler
 */
class Transpiler {
  private readonly config: TRunConfig;
  private readonly warnings: string[];
  private readonly cacheManager: CacheManager | null;
  private readonly preprocessCache: PreprocessCache | null;

  /** #1713: each compiler's run, by `_preprocessorFor`'s key */
  private readonly preprocessors = new Map<string, Preprocessor>();
  /**
   * Issue #211, #1319, #1844: does this run emit C++? 1.1 Discover's answer
   * (`ISourceGraph.cppMode`), copied here when each run's graph is built so
   * `isCppMode()` still answers between runs (serve reports it after one).
   *
   * Settled once per run, before any file is parsed, and never changed
   * mid-run. It used to be a monotone latch raised by Stage 2 reading an
   * included header, which made it settled *mid-run* -- the cause of #250,
   * #941, #1139, #1425 and #1171. #1319 made it declared-only; #1428 ruled
   * that 1.1 detects it, which is early enough that nothing reads it before
   * it settles.
   *
   * #1428: `undefined` until this run's 1.1 has settled it. It used to start
   * as `cppRequired ?? false`, which answered "C" for a run that had not
   * decided anything yet. Passes do not read this copy: they read the mode
   * from `Program`, which carries the graph's.
   */
  private cppMode: boolean | undefined;

  /**
   * Settles when this instance's previous run has (#1721). A run starts by
   * clearing the per-run fields above, so a second run must not start while
   * the first is parked on an `await` -- which `ServeCommand` otherwise does: it
   * holds one instance and dispatches each request without waiting for the
   * one before. Serialized here, once, rather than in each caller.
   */
  private previousRun: Promise<void> = Promise.resolve();

  /**
   * The services of the run's anchor (#1719): the preprocessor the project's
   * compile database picks, and the `PathResolver` (Issue #586) its output
   * paths come from. 1.1 Discover decides the anchor and returns it beside the
   * `SourceGraph`; the next run hands it back, so a run anchored where the
   * last one was keeps its compile database and toolchain probe.
   *
   * #1444: the anchor's FACTS -- project root, directory, defines -- are read
   * from the run's `SourceGraph`, never from here. The constructor anchors at
   * `config.input` only to find the cache's project root.
   */
  private anchor: IRunAnchor;

  /** File system abstraction for testability */
  private readonly fs: IFileSystem;

  constructor(config: ITranspilerConfig, fs: IFileSystem) {
    // The port the host injected; the pipeline never defaults one (#1653)
    this.fs = fs;
    // Apply defaults
    this.config = {
      input: config.input,
      includeDirs: config.includeDirs ?? [],
      outDir: config.outDir,
      headerOutDir: config.headerOutDir,
      defines: config.defines ?? {},
      cppRequired: config.cppRequired,
      parseOnly: config.parseOnly ?? false,
      debugMode: config.debugMode ?? false,
      target: config.target ?? "",
      pioEnv: config.pioEnv ?? "",
      collectGrammarCoverage: config.collectGrammarCoverage ?? false,
      noCache: config.noCache ?? false,
    };

    this.warnings = [];
    this.anchor = RunAnchor.at(this.config.input, null, this.config, this.fs);

    // Initialize cache manager if caching is enabled and a project root was
    // found. Instance-scoped, not anchored per run: a source run reads no
    // cache it did not already have, and writes none into a project it was
    // merely pointed at (#1719).
    this.cacheManager =
      !this.config.noCache && this.anchor.projectRoot
        ? new CacheManager(this.anchor.projectRoot, this.fs)
        : null;
    // #1844: and the preprocessor's runs, so a warm run starts none
    this.preprocessCache =
      !this.config.noCache && this.anchor.projectRoot
        ? new PreprocessCache(this.anchor.projectRoot, this.fs)
        : null;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Unified entry point for all transpilation.
   *
   * @param input - What to transpile:
   *   - { kind: 'files' } — discover from config.inputs, write to disk
   *   - { kind: 'source', source, ... } — transpile in-memory source
   * @returns ITranspilerResult with per-file results in .files[]
   *
   * Runs on one instance execute one at a time, in call order (#1721): a call
   * made while another run is in progress starts when that run settles.
   */
  transpile(input: TTranspileInput): Promise<ITranspilerResult> {
    const run = this.previousRun.then(() => this._run(input));
    // Settled to `undefined` either way, so a failed run does not stall the
    // queue and the last result is not kept alive while the instance idles.
    this.previousRun = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** One run, which `transpile` has made the only one in progress. */
  private async _run(input: TTranspileInput): Promise<ITranspilerResult> {
    const result = this._initResult();

    try {
      this._initializeRun();

      // Stage 1: 1.1 Discover
      const discovered = Discover.run(
        input,
        this.anchor,
        this.config,
        this.fs,
        this.warnings,
      );
      this.anchor = discovered.anchor;
      const pipelineInput = discovered.graph;
      result.includes = Transpiler._includes(pipelineInput);
      result.includesForeignHeader = new Set(
        pipelineInput.cnxFiles
          .filter((file) => file.includesForeignHeader)
          .map((file) => file.path),
      );
      if (discovered.errors.length > 0) {
        result.errors.push(...discovered.errors);
        result.success = false;
        return this._finalizeResult(result);
      }
      if (pipelineInput.cnxFiles.length === 0) {
        return this._finalizeResult(result, "No cnx source files found");
      }

      await this._executePipeline(pipelineInput, result);
      return this._finalizeResult(result);
    } catch (err) {
      return this._handleRunError(result, err);
    }
  }

  // ===========================================================================
  // Unified Pipeline
  // ===========================================================================

  /**
   * The single unified pipeline for all transpilation.
   *
   * transpile() delegates here with the `SourceGraph` 1.1 Discover emitted.
   *
   * Stages 2 to 4d: 1.2 Parse, 1.3 Declare (Stage 2 is its C/C++ headers),
   *          1.4 Resolve (Stage 3) and its whole-program checks (3b to 4c),
   *          then 2.1 Analyze over every file (4d)
   * Stage 5: 2.2 Plan and 2.3 Render each file, capturing its header input
   * Stage 5.5: Render every captured header, once, whole-program (#1323)
   * Stage 6: 3.1 Write every implementation and header, once, after the run
   *          succeeded (#1233)
   */
  private async _executePipeline(
    input: ISourceGraph,
    result: ITranspilerResult,
  ): Promise<void> {
    // Stages 2 to 4d: 1.2 Parse, 1.3 Declare, then (through `resolve`) 1.4
    // Resolve and the whole-program checks, then 2.1 Analyze -- EVERY file,
    // before ANY file is planned (#1320). Analysis used to run inside the loop
    // below, so file N was analyzed after files 1..N-1 had already been
    // emitted, and an analyzer reading state codegen fills saw the PREVIOUS
    // file's data (#1430).
    //
    // #1991: 1.2, 1.3, 1.4 and 2.1, each taking what the one before returned.
    // Every tree is a local of 1.2; what comes back is plain data.
    //
    // Parse-only mode analyzes nothing: 2.1 keeps only declaration counts
    // (`IRunSettings.parseOnly`), and `_transpileFile` returns the parse-only
    // result before 2.2.
    const front = await this._runParseThroughAnalyze(input, result);
    if (front.kind === "stopped") {
      if (front.errors.length > 0) {
        result.errors.push(...front.errors);
        result.success = false;
      }
      return;
    }
    const analysis = front.analysis;
    const headerFactsByPath = new Map<string, IHeaderEmissionFacts>();
    const diagnostics = analysis.diagnostics;

    // Stage 5: Plan and Render each cnx file
    //
    // #1233: the .c of a file that succeeded is NOT written as we go. A later
    // file can still fail the run, and Stage 6 gates headers on
    // `result.success`, so writing eagerly produced a .c that #includes a
    // header the same run refused to write -- output that cannot compile on a
    // clean tree and silently compiles against a stale header on a dirty one.
    // Deferring puts the .c under the same gate the .h already had.
    //
    // #1320: a program 2.1 rejected is NOT planned. The loop still runs, so
    // every file still gets a result recorded through the one recording path,
    // but it reports what 2.1 found instead of generating. Disk output is
    // unchanged either way -- both `pendingWrites` and Stage 6 are already
    // gated on `result.success`.
    const rejected = diagnostics.hasErrors();
    Transpiler._reportWarnings(input.cnxFiles, diagnostics, result);
    const pendingWrites: IRenderedOutput[] = [];
    for (const file of input.cnxFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }

      const fileResult = rejected
        ? this._rejectedFileResult(file, analysis)
        : this._transpileFile(file, analysis, headerFactsByPath);
      this._recordFileResult(
        file.discoveredFile,
        analysis.discovery,
        fileResult,
        result,
        input.writeOutputToDisk,
        pendingWrites,
      );
    }

    // Stage 5.5: render every file's captured header input into text, ONCE,
    // now that the loop above is done. Unconditional -- result.files[].headerCode
    // is part of the public ITranspilerResult contract for BOTH 'files' and
    // 'source' input, not only when writeOutputToDisk. See _renderHeaders.
    //
    // #1320: that promise is about a file that reached Plan/Render, not about
    // every `success: true` file. A file 2.1 found clean but that never ran
    // through `_transpileFile` -- because a SIBLING was rejected -- has no
    // captured header input to render either, same as parse-only mode.
    // `_renderHeaders` already treats a missing capture as "no header for this
    // file" rather than an error, so this is a silent no-op for it, not a bug.
    const renderedFiles = this._renderHeaders(result, headerFactsByPath);

    // One gate for both halves of the output: a .c is written only when its
    // header is (#1233)
    if (result.success && input.writeOutputToDisk) {
      const headers = Transpiler._headerOutputs(
        analysis.discovery,
        input.cnxFiles,
        renderedFiles,
      );
      // 3.1 Write takes what 2.3 rendered, and nothing else (#1991)
      Write.outputs(this.fs, [...pendingWrites, ...headers]);
      result.outputFiles.push(...headers.map((header) => header.path));
    }
  }

  /**
   * #1713: the run of `compiler` 1.2 reads headers with, one per compiler
   * and flags for the transpiler's life: constructing one asks the compiler
   * for its include paths, which an editor request should not pay for again.
   */
  private _preprocessorFor(compiler: IHeaderCompiler): Preprocessor {
    const key = HeaderCompiler.key(compiler);
    const known = this.preprocessors.get(key);
    if (known !== undefined) return known;
    const toolchain = ToolchainDetector.fromPath(compiler.driver, this.fs);
    const preprocessor = new Preprocessor(
      this.fs,
      toolchain === null ? null : { ...toolchain, flags: [...compiler.flags] },
      {
        headerFreeDirectory: Installation.headerFreeDirectory(this.fs),
        cache: this.preprocessCache,
      },
    );
    this.preprocessors.set(key, preprocessor);
    return preprocessor;
  }

  /** #1991: where 1.2 reads each header's cached declarations */
  private static _headerCacheOf(
    cache: CacheManager | null,
  ): THeaderDeclarationCache | null {
    return cache === null
      ? null
      : (path, reader) => cache.headerDeclarations(path, reader);
  }

  /**
   * Stage 2's host side (#1991): 1.3 declares the C/C++ headers; the host
   * counts, logs and caches what it declared.
   */
  private _recordDeclaredHeaders(
    declared: IDeclaredSources,
    result: ITranspilerResult,
  ): void {
    const headers = declared.headers;
    result.filesProcessed += headers.processed;
    result.symbolsCollected = declared.symbolTable.size;
    this.warnings.push(...headers.warnings);
    for (const header of headers.declared) {
      if (declared.discovery.run.debugMode) {
        console.log(
          `[DEBUG]   Parsing ${Transpiler._languageName(header.language)} header: ${header.path}`,
        );
        console.log(
          `[DEBUG]   Found ${header.record.symbols.length} symbols in ${header.path}`,
        );
      }
      this.cacheManager?.setHeaderDeclarations(
        header.path,
        header.record,
        headers.reader,
      );
    }
  }

  /**
   * Stages 2 to 4d, one pass at a time (#1991): 1.2 `Parse`, 1.3 `Declare`,
   * 1.4 Resolve with the whole-program checks, then 2.1 `Analyze`.
   */
  private async _runParseThroughAnalyze(
    input: ISourceGraph,
    result: ITranspilerResult,
  ): Promise<TFrontEndResult> {
    const parsed = await Parse.sources(input, {
      preprocessorFor: (compiler) => this._preprocessorFor(compiler),
      headerCache: Transpiler._headerCacheOf(this.cacheManager),
    });
    this.cppMode = parsed.discovery.cppMode;
    // A file that failed to parse is not declared; the others still are, so
    // one run reports both kinds of error, as it did before #1991.
    const declared = Declare.sources(parsed);
    this._recordDeclaredHeaders(declared, result);
    const errors = [...parsed.errors, ...declared.errors];
    if (errors.length > 0) {
      return { kind: "stopped", errors };
    }
    const resolved = this._passesProgramChecks(declared, result);
    if (resolved === null) {
      return { kind: "stopped", errors: [] };
    }
    return {
      kind: "analyzed",
      analysis: Analyze.run(
        resolved.program,
        resolved.sources,
        resolved.discovery,
      ),
    };
  }

  /**
   * Stages 3 to 4c: the whole-program checks every file waits on. Each records
   * its own errors; the first to fail ends the run, in this order.
   */
  private _passesProgramChecks(
    declared: IDeclaredSources,
    result: ITranspilerResult,
  ): IResolvedProgram | null {
    // Stage 3: 1.4 Resolve once over every file 1.3 `Declare` declared
    const resolved = this._resolveProgram(declared, result);
    if (resolved === null) {
      return null;
    }
    const program = resolved.program;
    const passes =
      // Stage 3b: the program's one target (ADR-049), settled by 1.4. Nothing
      // below may run for a program whose target is unknown or contested.
      this._checkRunTarget(
        program,
        resolved.sources,
        resolved.discovery.run.parseOnly,
        result,
      ) &&
      // Stage 4: symbol conflicts
      Transpiler._recordChecked(result, ProgramChecks.conflicts(program)) &&
      // Stage 4b: include guard collisions (ADR-063, issue #1133)
      this._checkIncludeGuardCollisions(resolved, result) &&
      // Stage 4c: external identifier significance (MISRA 5.1, issue #1307)
      this._checkExternalIdentifierSignificance(
        program,
        resolved.discovery.run.parseOnly,
        result,
      );
    return passes ? resolved : null;
  }

  /**
   * Stage 5.5: render every file's captured `IHeaderEmissionFacts` into
   * header text, in one batch, after the Stage 5 loop has finished.
   *
   * #1323: `HeaderRenderer.render()` never reads `CodeGenState` -- it
   * only reads the captured records -- so calling it here, once, after every
   * file's state has already moved on, is exactly the timing issue #1139's
   * fix forbade for `generateHeaderForFile`. That method no longer exists;
   * only its decision does, frozen per file in Stage 5's `headerFactsByPath`.
   *
   * Mutates `result.files[]` in place: `_recordFileResult` already pushed one
   * entry per file with `headerCode: undefined`, and this fills it in (or, on
   * a render failure, downgrades that entry to failed -- mirroring
   * `buildCatchResult`'s shape for the equivalent `.c`/`.cpp` generation
   * failure, and `_recordFileResult`'s own promotion of a file's errors onto
   * `result.errors` with `sourcePath` attached).
   *
   * A file whose `.c` generation already failed (`fileResult.success` is
   * already `false`) has no captured record to render and is skipped --
   * `HeaderEmissionCapture.capture` is only reached from inside the same try
   * block that produced that failure.
   */
  private _renderHeaders(
    result: ITranspilerResult,
    headerFactsByPath: ReadonlyMap<string, IHeaderEmissionFacts>,
  ): ReadonlyMap<string, IRenderedFile> {
    const rendered = HeaderRenderer.render(headerFactsByPath);

    // 2.3 Render's artifact, assembled here because this is the first moment a
    // file's text is complete: the implementation came from Stage 5, the header
    // from the call above. Stage 6 reads this rather than rebuilding a map from
    // `result.files[].headerCode` -- which is the same fact flattened into
    // per-file fields and then un-flattened one stage later, agreeing only
    // because nothing had yet written one of the two representations.
    const renderedFiles = new Map<string, IRenderedFile>();

    for (const fileResult of result.files) {
      if (!fileResult.success) {
        continue;
      }

      const headerCode = rendered.headersBySourcePath.get(
        fileResult.sourcePath,
      );
      if (headerCode !== undefined) {
        fileResult.headerCode = headerCode;
        renderedFiles.set(fileResult.sourcePath, {
          sourcePath: fileResult.sourcePath,
          implementation: fileResult.code,
          header: headerCode,
        });
        continue;
      }

      const errorMessage = rendered.errorsBySourcePath.get(
        fileResult.sourcePath,
      );
      if (errorMessage === undefined) {
        // No header and no failure: the file has no public interface, so 2.3
        // rendered an implementation and nothing else.
        renderedFiles.set(fileResult.sourcePath, {
          sourcePath: fileResult.sourcePath,
          implementation: fileResult.code,
          header: null,
        });
        continue;
      }

      // Mirrors buildCatchResult's shape for a .c/.cpp generation failure --
      // this is the same kind of thing (a generator exception), for the
      // header instead.
      const parsed = ErrorLocation.parse(errorMessage);
      const error: ITranspileError = {
        line: parsed.line,
        column: parsed.column,
        message: `Header generation failed: ${parsed.message}`,
        severity: "error",
      };

      fileResult.success = false;
      fileResult.errors.push(error);

      // Promote to the run-level list with sourcePath, matching
      // _recordFileResult's own promotion of a file's errors.
      result.errors.push({ ...error, sourcePath: fileResult.sourcePath });
      result.success = false;
    }

    return renderedFiles;
  }

  /**
   * Stage 3: 1.4 Resolve over every declared cnx file; `Program.build`
   * publishes each file's resolved symbols into 1.3's table.
   * @returns 1.4's artifact, or null if errors occurred
   */
  private _resolveProgram(
    declared: IDeclaredSources,
    result: ITranspilerResult,
  ): IResolvedProgram | null {
    // 1.4 Resolve. The whole program exists only once every file has been
    // declared, which is why 1.3 `Declare.sources` and 1.4 `Resolve.program`
    // are separate passes: a file's bare type reference may name a scope type
    // declared in a file 1.3 had not reached yet, and no ordering fixes that.
    //
    // Building `Program` settles every deferred type, so nothing below this
    // line can observe an unsettled one.
    try {
      const resolved = Resolve.program(declared);
      // 1.4 completed 1.3's table with every file's symbols
      result.symbolsCollected = declared.symbolTable.size;
      return result.success ? resolved : null;
    } catch (err) {
      result.errors.push(CaughtError.asTranspileError(err));
      result.success = false;
      return null;
    }
  }

  /**
   * The result for one file of a program 2.1 rejected (#1320).
   *
   * Reports what 2.1 found and generates nothing. A file 2.1 found nothing
   * wrong with is NOT marked failed -- it carries no errors and no code, which
   * is the honest statement that it was never planned. `_recordFileResult`
   * queues no write for it either way, since its `code` is empty.
   */
  private _rejectedFileResult(
    file: IPipelineFile,
    analysis: IAnalysis,
  ): IFileResult {
    const sourcePath = file.path;
    const errors = analysis.diagnostics
      .forFile(sourcePath)
      .filter((e) => e.severity === "error");
    const declarationCount = AnalyzedFiles.fileOf(
      analysis,
      sourcePath,
    ).declarationCount;

    return errors.length > 0
      ? this.buildErrorResult(sourcePath, [...errors], declarationCount)
      : this.buildParseOnlyResult(sourcePath, declarationCount);
  }

  /**
   * 2.1's warnings (E0896), printed as `Warning: file:line:col warning[CODE]:`
   * whether or not the run compiles, with the advice under each.
   */
  private static _reportWarnings(
    files: readonly IPipelineFile[],
    diagnostics: IDiagnostics,
    result: ITranspilerResult,
  ): void {
    for (const file of files) {
      for (const e of diagnostics.forFile(file.path)) {
        if (e.severity !== "warning") continue;
        result.warnings.push(DiagnosticText.of(e, file.path));
      }
    }
  }

  /**
   * Stage 5: Plan and Render a single cnx file.
   *
   * Assumes the symbol table is already populated (stages 2-3 complete) and
   * that 2.1 Analyze has already accepted the whole program -- #1320 moved
   * analysis to Stage 4d, so by here the question "is this program legal?" has
   * been answered for EVERY file, not just the ones walked so far.
   */
  private _transpileFile(
    file: IPipelineFile,
    analysis: IAnalysis,
    headerFactsByPath: Map<string, IHeaderEmissionFacts>,
  ): IFileResult {
    const sourcePath = file.path;

    // #1241: attribute ADR provenance from here, not from codegen. A rule firing
    // during header capture below would otherwise be credited to whichever file
    // was begun last -- or dropped on the first, which reads identically to
    // "this rule never fires". Stage 4d begins each file for its own analysis;
    // this re-begins the file for the emission half.
    AdrProvenance.beginFile(sourcePath);

    try {
      const declarationCount = AnalyzedFiles.fileOf(
        analysis,
        sourcePath,
      ).declarationCount;

      // Parse only mode
      if (analysis.discovery.run.parseOnly) {
        return this.buildParseOnlyResult(sourcePath, declarationCount);
      }

      // #1320: 2.1 Analyze already ran, whole-program, in Stage 4d. What is left
      // here is 2.2 Plan and 2.3 Render.

      // #1991: one walker per file, so nothing 2.2 or 2.3 set up outlives
      // the file -- the instance holds no walker between files or runs.
      const walker = new CodeGenWalker();
      const plan = walker.plan(sourcePath, analysis);
      // #1323: 2.3 returns the header's input; HeaderRenderer renders every
      // file's header in one step, after this per-file loop finishes.
      const rendered = walker.render(plan);
      if (rendered.headerFacts) {
        headerFactsByPath.set(sourcePath, rendered.headerFacts);
      }

      return this.buildSuccessResult(
        sourcePath,
        rendered.code,
        declarationCount,
        rendered.requirements,
      );
    } catch (err) {
      return this.buildCatchResult(sourcePath, err);
    }
  }

  // ===========================================================================
  // Pipeline Helper Methods
  // ===========================================================================

  /** #1402: the include graph 1.1 resolved, `.cnx` and header edges both */
  private static _includes(
    graph: ISourceGraph,
  ): ReadonlyMap<string, readonly string[]> {
    return new Map([
      ...graph.headerEdges,
      ...graph.cnxFiles.map((file): [string, readonly string[]] => [
        file.path,
        [
          ...file.cnxIncludes.map((include) => include.path),
          ...graph.headerIncludes
            .filter((include) => include.site.sourcePath === file.path)
            .map((include) => include.header),
        ],
      ]),
    ]);
  }

  /**
   * Initialize a fresh result object
   */
  private _initResult(): ITranspilerResult {
    return {
      success: true,
      files: [],
      filesProcessed: 0,
      symbolsCollected: 0,
      errors: [],
      warnings: [],
      outputFiles: [],
    };
  }

  /**
   * Initialize run state: cache, analyzers, symbol table
   */
  /**
   * Does this file produce output in this run?
   *
   * ONE decision with three consumers: stage 3 caches a parse only for files that
   * will read it back, stage 5 generates the code, stage 6 writes the header. A
   * `symbolOnly` file is discovered purely to contribute symbols, so it is declared
   * like any other but never emitted.
   *
   * #1301 review: stages 5 and 6 already asked this question with their own inline
   * `file.symbolOnly` checks, and gating the stage 3 cache write would have made it
   * a three-place decision -- CLAUDE.md's worst anti-pattern, and pre-existing here
   * rather than introduced. Changing what "produces output" means is now one edit.
   */
  private static _producesOutput(file: IPipelineFile): boolean {
    return Analyze.producesOutput(file);
  }

  private _initializeRun(): void {
    // #1428: the previous run's mode is not this run's answer
    this.cppMode = undefined;
    if (this.cacheManager) {
      this.cacheManager.initialize();
    }
    // Issue #587: Reset accumulated state for new run
    // #1662: both are run-scoped and both were initialized ONCE, in the
    // constructor, so neither was ever cleared. `warnings` is pushed to per run
    // and copied onto every result, which made three runs of one source on one
    // transpiler report 1, then 2, then 3 copies of the same missing-header
    // warning (#1844: the #985 latch that also stuck is now each run's graph).
    // `ServeCommand`
    // holds a static transpiler, so "later run" is the normal case there.
    //
    // `warnings` is `readonly`, so it is emptied rather than replaced -- the
    // result copies it with a spread, so nothing holds the array itself.
    this.warnings.length = 0;
    // Issue #634: Reset symbol table for new run
    // #1452: the callback map needed a per-RUN reset here because it was a
    // mutable static that `TranspileState.reset()` deliberately skipped.
    // `CallbackCompatibility.derive` returns it now, so there is nothing to
    // clear -- the run's answer is built fresh and handed to `Program`.
    // #1447: the previous run's Program is not this run's artifact. Nothing
    // may read one across runs, and leaving a stale one reachable is the
    // shape #1323's header-content leak had.
    // Issue #1241: the previous run's ADR provenance is not this run's evidence
    AdrProvenance.reset();
  }

  /**
   * Stage 4b: Reject two source files that would produce the same include
   * guard (ADR-063, #1133). The check is `IncludeGuards`'.
   *
   * @returns true when every guard is unique
   */
  private _checkIncludeGuardCollisions(
    resolved: IResolvedProgram,
    result: ITranspilerResult,
  ): boolean {
    return Transpiler._recordChecked(
      result,
      IncludeGuards.collisions(
        resolved.discovery.anchor,
        resolved.sources.map((source) => source.file.path),
      ),
    );
  }

  /**
   * Record a whole-program check's errors on the result.
   *
   * @returns true when the check found nothing
   */
  private static _recordChecked(
    result: ITranspilerResult,
    errors: readonly ITranspileError[],
  ): boolean {
    for (const error of errors) {
      result.errors.push(error);
      result.success = false;
    }
    return result.success;
  }

  /**
   * Stage 3b: report the run's target, or why it has none (ADR-049). The
   * check is `ProgramChecks.runTarget`.
   *
   * @returns true when the run may continue
   */
  private _checkRunTarget(
    program: IProgram,
    sources: readonly IDeclaredSource[],
    parseOnly: boolean,
    result: ITranspilerResult,
  ): boolean {
    const checked = ProgramChecks.runTarget(
      program,
      parseOnly,
      sources.at(-1)?.file.path,
    );
    if (checked.target !== null) {
      result.target = checked.target;
    }
    const recorded = Transpiler._recordChecked(result, checked.errors);
    if (checked.proceed) {
      return recorded;
    }
    result.success = false;
    return false;
  }

  /**
   * Stage 4c: Reject external identifiers that are not distinct within the
   * target's significant-character limit (MISRA C:2012 Rule 5.1, issue #1307).
   * The check is `ProgramChecks.externalIdentifiers`.
   *
   * @returns true when every external identifier is distinct within the budget
   */
  private _checkExternalIdentifierSignificance(
    program: IProgram,
    parseOnly: boolean,
    result: ITranspilerResult,
  ): boolean {
    const target = program.target();
    // ADR-049: a parse-only run needs no target, and without one there is no
    // budget to check against. Every other run reaches here with one (3b).
    if (parseOnly && target.kind !== "resolved") {
      return true;
    }
    invariant(
      target.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    return Transpiler._recordChecked(
      result,
      ProgramChecks.externalIdentifiers(
        program.symbolTable(),
        target.description,
      ),
    );
  }

  /**
   * Record file result and optionally write output to disk
   */
  private _recordFileResult(
    file: IDiscoveredFile,
    discovery: TRunFacts,
    fileResult: IFileResult,
    result: ITranspilerResult,
    writeOutputToDisk: boolean,
    pendingWrites: IRenderedOutput[],
  ): void {
    let outputPath: string | undefined;
    if (writeOutputToDisk && fileResult.success && fileResult.code) {
      outputPath = FileFacts.outputsOf(discovery, file.path).source;
      // #1233: queued, not written -- the caller flushes only if the whole run
      // succeeds, matching how Stage 6 already gates headers.
      pendingWrites.push({ path: outputPath, content: fileResult.code });
    }

    result.files.push({ ...fileResult, outputPath });
    result.filesProcessed++;

    if (!fileResult.success) {
      result.success = false;
      result.errors.push(
        ...fileResult.errors.map((e) => ({
          ...e,
          sourcePath: fileResult.sourcePath,
        })),
      );
    } else if (outputPath) {
      result.outputFiles.push(outputPath);
    }
  }

  /**
   * The headers Stage 5.5 rendered for pipeline files, at the paths 1.1 named.
   *
   * Issue #1139, historically: this stage used to call generateHeaderForFile()
   * a second time, once per file, after every file had been transpiled. That
   * function read live CodeGenState -- which is per-file -- so by then it saw
   * only the last-transpiled file's data and rebuilt every other file's
   * header from it. #1323: `HeaderEmissionCapture.capture` now resolves each
   * file's header content at its own warm moment, and `_renderHeaders`
   * (Stage 5.5) turns every record into text in one batch, reading no
   * CodeGenState at all. This only pairs that text with its path.
   */
  private static _headerOutputs(
    discovery: TRunFacts,
    cnxFiles: readonly IPipelineFile[],
    renderedFiles: ReadonlyMap<string, IRenderedFile>,
  ): IRenderedOutput[] {
    return cnxFiles.flatMap((file) => {
      const content = Transpiler._producesOutput(file)
        ? renderedFiles.get(file.path)?.header
        : undefined;
      return content
        ? [
            {
              path: FileFacts.outputsOf(discovery, file.path).header,
              content,
            },
          ]
        : [];
    });
  }

  /**
   * Finalize result: merge warnings, flush cache
   */
  private _finalizeResult(
    result: ITranspilerResult,
    warning?: string,
  ): ITranspilerResult {
    if (warning) {
      result.warnings.push(warning);
    }
    result.warnings = [...result.warnings, ...this.warnings];
    // Issue #1143: union of what each file's emitters recorded.
    result.requirements = RequirementAggregator.merge(result.files);
    // Issue #1241: every position at which an ADR's rule fired this run.
    result.adrSites = AdrProvenance.collect();

    if (this.cacheManager) {
      this.cacheManager.flush();
    }
    this.preprocessCache?.flush((path, content) =>
      Write.file(this.fs, path, content),
    );
    return result;
  }

  /**
   * Handle errors during run
   */
  private _handleRunError(
    result: ITranspilerResult,
    err: unknown,
  ): ITranspilerResult {
    result.errors.push({
      line: 1,
      column: 0,
      // Issue #1319: the message, not the Error. `${err}` stringifies to
      // "Error: <message>", so a diagnostic surfaced here read
      // "Pipeline failed: Error: E0507: ..." with a doubled prefix the sibling
      // "Code generation failed" wrapper does not have.
      message: `Pipeline failed: ${CaughtError.messageOf(err)}`,
      severity: "error",
    });
    result.success = false;
    result.warnings = [...result.warnings, ...this.warnings];
    return result;
  }

  // ===========================================================================
  // Header Symbol Collection
  // ===========================================================================

  /** How a debug log names `language` */
  private static _languageName(language: EHeaderLanguage): string {
    switch (language) {
      case EHeaderLanguage.C:
        return "C";
      case EHeaderLanguage.Cpp:
        return "C++";
      case EHeaderLanguage.Assembler:
        return "assembler";
    }
  }

  // ===========================================================================
  // Code Generation Helpers
  // ===========================================================================

  /**
   * Run pass 1.3 Declare for one file: its own symbols, from its own tree.
   *
   * This docblock used to describe deriving "which scope types are visible
   * from this file" here, first, from the per-file symbol views and
   * `this.config.includeDirs`, and seeding Declare with the result (#1358,
   * #1333). None of that happens here now. #1472 took the seed out of Declare,
   * and what a file can see is 1.4's `Program.deriveVisibleSymbols`: a closure
   * over the include graph discovery resolved (#1435). It reads no include
   * directory, because rebuilding a search path is how it came to disagree
   * with discovery.
   */
  // ===========================================================================
  // Result Builder Helpers
  // ===========================================================================

  /**
   * Build an error result for parse/analyzer failures.
   */
  private buildErrorResult(
    sourcePath: string,
    errors: IFileResult["errors"],
    declarationCount: number,
  ): IFileResult {
    return {
      sourcePath,
      code: "",
      success: false,
      errors,
      declarationCount,
    };
  }

  /**
   * Build a result for parse-only mode.
   */
  private buildParseOnlyResult(
    sourcePath: string,
    declarationCount: number,
  ): IFileResult {
    return {
      sourcePath,
      code: "",
      success: true,
      errors: [],
      declarationCount,
    };
  }

  /**
   * Build a successful transpilation result.
   *
   * #1323: `headerCode` is filled in later, by `_renderHeaders` (Stage 5.5) --
   * not here. This used to take a `headerCode` parameter, but this is its
   * only caller and it always passed `undefined`, so the parameter was dead:
   * a slot that read as someone's to fill in, which is the second-write-path
   * shape #1139 was.
   */
  private buildSuccessResult(
    sourcePath: string,
    code: string,
    declarationCount: number,
    requirements: readonly IRecordedRequirement[] = [],
  ): IFileResult {
    return {
      sourcePath,
      code,
      success: true,
      errors: [],
      declarationCount,
      requirements,
    };
  }

  /**
   * Build a catch/exception result.
   */
  private buildCatchResult(sourcePath: string, err: unknown): IFileResult {
    // #1320: formatted by `CaughtError.asTranspileError`, not re-spelled here. How a thrown
    // error becomes a diagnostic is ONE decision; it used to be written out in
    // both places, so changing the wording meant editing two.
    return {
      sourcePath,
      code: "",
      success: false,
      errors: [CaughtError.asTranspileError(err)],
      declarationCount: 0,
    };
  }

  // ===========================================================================
  // Public Accessors
  // ===========================================================================

  /**
   * Whether the last run emits C++, as its 1.1 Discover settled it (#1844).
   * `undefined` when that run stopped before 1.1 settled a mode (#1428).
   */
  isCppMode(): boolean | undefined {
    return this.cppMode;
  }
}

export default Transpiler;
