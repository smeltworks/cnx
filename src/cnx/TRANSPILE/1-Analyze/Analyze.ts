/**
 * 2.1 Analyze over 1.4's artifact (#1991): the files 1.3 declared, which 1.4
 * carried on, against the program 1.4 resolved. The program goes on to 2.2.
 * Every file is analyzed before 2.2 plans any of them (#1320).
 */
import type TRunFacts from "../../PARSE/2-Parse/types/TRunFacts";
import type IPipelineFile from "../../PARSE/1-Discover/types/IPipelineFile";
import type IDeclaredSource from "../../PARSE/3-Declare/types/IDeclaredSource";
import type IAnalyzedFile from "../../types/IAnalyzedFile";
import type IProgram from "../../types/IProgram";
import type ISourceSyntax from "../../types/ISourceSyntax";
import type ITranspileError from "../../types/ITranspileError";
import AdrProvenance from "../../instrumentation/AdrProvenance";
import CaughtError from "../../utils/CaughtError";
import FileFacts from "../../utils/FileFacts";
import Diagnostics from "./Diagnostics";
import runAnalyzers from "./runAnalyzers";
import type IAnalysis from "./types/IAnalysis";
import type IAnalyzerOptions from "./types/IAnalyzerOptions";
import type IFileAnalysis from "./types/IFileAnalysis";

class Analyze {
  /**
   * Each file that produces output, analyzed. A parse-only run (1.1's
   * `run.parseOnly`) analyzes nothing.
   */
  static run(
    // 1.4's artifact, `IResolvedProgram`, by its three fields: a pass after 1.4
    // may name `IProgram` and nothing in `4-Resolve/` (#1447)
    program: IProgram,
    sources: readonly IDeclaredSource[],
    discovery: TRunFacts,
  ): IAnalysis {
    const byFile = new Map<string, readonly ITranspileError[]>();
    const files = new Map<string, IAnalyzedFile>();
    // A symbol-only file is still parsed, declared and resolved -- that is
    // why it was discovered -- but nothing reads its syntax after 1.4.
    for (const entry of sources.filter((d) => Analyze.producesOutput(d.file))) {
      const analysis = discovery.run.parseOnly
        ? null
        : Analyze._analyze(entry.syntax, () =>
            Analyze._inputsOf(entry.file, program, discovery),
          );
      if (analysis) byFile.set(entry.file.path, analysis.errors);
      files.set(entry.file.path, {
        program: entry.syntax.program,
        declarationCount: entry.syntax.declarationCount,
        valuePositions: analysis?.valuePositions ?? null,
      });
    }
    return {
      program,
      discovery,
      diagnostics: Diagnostics.build(byFile),
      files,
    };
  }

  /** True for a file the run analyzes, plans and writes, not only declares */
  static producesOutput(file: IPipelineFile): boolean {
    return !file.symbolOnly;
  }

  /** One file's analyzer inputs, from 1.4's program and 1.1's facts */
  private static _inputsOf(
    file: IPipelineFile,
    program: IProgram,
    discovery: TRunFacts,
  ): IAnalyzerOptions {
    const sourcePath = file.path;
    // #1241: attribute ADR provenance to the file being analyzed. A rule
    // firing in `runAnalyzers` would otherwise be credited to whichever file
    // was begun last -- or dropped on the first.
    AdrProvenance.beginFile(sourcePath);
    const symbols = FileFacts.symbolsFor(program, sourcePath);
    const includes = FileFacts.includesOf(discovery, sourcePath);
    return {
      context: {
        symbols,
        program,
        symbolTable: program.symbolTable(),
        includesForeignHeader: file.includesForeignHeader,
        sourceFile: sourcePath,
      },
      includes: {
        resolutions: includes.resolutions,
        cnxAlternatives: includes.cnxAlternatives,
        kinds: includes.kinds,
      },
    };
  }

  private static _analyze(
    syntax: ISourceSyntax,
    inputs: () => IAnalyzerOptions,
  ): IFileAnalysis {
    try {
      return runAnalyzers(syntax, inputs());
    } catch (err) {
      return {
        errors: [CaughtError.asTranspileError(err)],
        valuePositions: null,
      };
    }
  }
}

export default Analyze;
