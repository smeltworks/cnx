import { basename } from "node:path";
import ProgramLowering from "../../../../cnx/PARSE/2-Parse/ProgramLowering";
import TestSymbolTable from "../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import type * as Parser from "../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import CnxResolver from "../../../../cnx/PARSE/3-Declare/cnx/index";
import SymbolRegistry from "../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import Program from "../../../../cnx/PARSE/4-Resolve/Program";
import TargetCatalogFile from "../../../TargetCatalogFile";
import RunTarget from "../../../../cnx/PARSE/2-Parse/RunTarget";
import CodeGenWalker from "../../../../cnx/TRANSPILE/CodeGenWalker";
import CodeGenerator from "../../../../cnx/TRANSPILE/3-Render/codegen/CodeGenerator";
import CnxSourceParser from "../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import TSymbolInfoAdapter from "../../../../cnx/PARSE/3-Declare/cnx/adapters/TSymbolInfoAdapter";
import { expect } from "vitest";
import type IProgramSyntax from "../../../../cnx/types/syntax/IProgramSyntax";
import type IAnalyzedFile from "../../../../cnx/types/IAnalyzedFile";
import type IFilePlan from "../../../../cnx/TRANSPILE/2-Plan/types/IFilePlan";
import ValuePositions from "../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";
import noIncludes from "../../../../cnx/PARSE/1-Discover/__testUtils__/noIncludes";
import Diagnostics from "../../../../cnx/TRANSPILE/1-Analyze/Diagnostics";
import type IAnalysis from "../../../../cnx/TRANSPILE/1-Analyze/types/IAnalysis";
import type ICodeGenSymbols from "../../../../cnx/types/ICodeGenSymbols";
import type EFileType from "../../../../cnx/PARSE/1-Discover/types/EFileType";
import type IProgram from "../../../../cnx/types/IProgram";

/**
 * Generate with the whole-program artifact in place.
 *
 * #1511: pass-by-value eligibility is a whole-program fact -- is this parameter
 * modified anywhere down the call chain? -- so a generator with no `Program`
 * behind it answers "not eligible" for everything and emits pointers where the
 * real run emits values. Built from the real resolver output by the same
 * `Program.build` production uses, which derives those facts itself (#1825), so
 * a single-file test agrees with a real run rather than approximating one.
 *
 * #1668: the program also carries the run's ONE target (ADR-049), which the
 * operand typer reads for a C type's width, and it is the target the render is
 * handed -- one name settles both, as 1.4 does in a run. `CodeGenWalker.test`
 * and `CodeGenWalker.coverage.test` each carried a verbatim copy of this, and
 * neither gave the program a target, so the first C call the typer met threw.
 *
 * The lowered program is the one `CnxSourceParser.parse` produced, as in
 * production: 1.2 lowers once, so this helper lowers nothing itself.
 *
 * #1428: the program also carries the run's mode, which codegen reads from it
 * and from nowhere else. A test has no 1.1 to detect one, so it states it:
 * `cppMode` is required here, and nothing falls back to "C".
 */
/**
 * The facts a test states for its one file, plus the mode a run's 1.1 would
 * have settled. This helper puts each where 2.2 reads it in 2.1's artifact.
 * The target is named, as on the command line, and 1.4 settles it from the
 * catalog. It may be left out: this helper then names the build machine's.
 */
interface ITestGenerateOptions {
  readonly symbolInfo: ICodeGenSymbols;
  readonly cppMode: boolean;
  readonly targetName?: string;
  readonly sourcePath?: string;
  readonly selfInclude?: string;
  readonly includeRewrites?: ReadonlyMap<string, string>;
  readonly includeKinds?: ReadonlyMap<string, EFileType>;
  readonly debugMode?: boolean;
}

class ProgramGeneration {
  static generate(
    generator: CodeGenWalker,
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
    options: ITestGenerateOptions,
    registry: SymbolRegistry,
  ): string {
    return generator.render(
      ProgramGeneration.plan(generator, tree, program, options, registry),
    ).code;
  }

  /** 2.2's decisions for the file, as `generate` hands them to 2.3 */
  static plan(
    generator: CodeGenWalker,
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
    options: ITestGenerateOptions,
    registry: SymbolRegistry,
  ): IFilePlan {
    // ADR-049: a run always names a target before 1.4 settles it; a test
    // that does not care about one names the build machine's.
    const targetName = options.targetName ?? "host";
    const sourcePath = options.sourcePath ?? "test.cnx";
    const state = generator["planner"].transpileState;

    const declared = CnxResolver.resolve(
      ProgramLowering.program(tree, null),
      sourcePath,
      registry,
    );
    // #831/#1285: `Program.build` registers the file's symbols in the table,
    // as 1.4 does in a run. A test that passes only `symbolInfo` would
    // otherwise leave the table empty, a state the real pipeline never reaches
    // (#1283 review: every function-as-type `symbolInfo` names must resolve in
    // the table).
    state.program = Program.build([declared], {
      symbolTable: TestSymbolTable.of(state),
      registry,
      cppMode: options.cppMode,
      target: RunTarget.resolve({
        option: targetName,
        catalog: TargetCatalogFile.targets(NodeFileSystem.instance),
        files: [{ sourcePath, directives: [] }],
      }),
    });

    // #1991: 2.1's walk of the file, as `Analyze.run` hands it to 2.2
    const resolved = state.program;
    const analyzed: IAnalyzedFile = {
      program,
      declarationCount: program.declarations.length,
      valuePositions: ValuePositions.of(program, {
        symbols: options.symbolInfo,
        program: resolved,
        symbolTable: resolved.symbolTable(),
        includesForeignHeader: true,
        debugMode: options.debugMode ?? false,
        sourceFile: sourcePath,
      }),
    };
    return generator.plan(
      sourcePath,
      ProgramGeneration.analysis(resolved, sourcePath, analyzed, options),
    );
  }

  /**
   * 2.1's artifact for the test's one file. The test states the file's symbol
   * view itself, so the program answers with it for that file.
   */
  private static analysis(
    resolved: IProgram,
    sourcePath: string,
    analyzed: IAnalyzedFile,
    options: ITestGenerateOptions,
  ): IAnalysis {
    const program: IProgram = {
      ...resolved,
      codeGenSymbolsFor: (file: string) =>
        file === sourcePath
          ? options.symbolInfo
          : resolved.codeGenSymbolsFor(file),
    };
    const includes = {
      ...noIncludes(),
      includeRewrites: options.includeRewrites ?? new Map(),
      kinds: options.includeKinds ?? new Map(),
    };
    return {
      program,
      discovery: {
        cppMode: options.cppMode,
        anchor: {
          directory: "/p",
          projectRoot: undefined,
          defines: {},
          platformio: null,
          configuredCompiler: null,
        },
        includes: new Map([[sourcePath, includes]]),
        outputs: new Map([
          [
            sourcePath,
            {
              selfInclude:
                options.selfInclude ??
                basename(sourcePath).replace(
                  /\.cnx$/,
                  options.cppMode ? ".hpp" : ".h",
                ),
              source: sourcePath,
              header: sourcePath,
            },
          ],
        ]),
        headerMacroDumps: new Map(),
        run: {
          debugMode: options.debugMode ?? false,
          parseOnly: false,
          target: {},
        },
      },
      diagnostics: Diagnostics.build(new Map([[sourcePath, []]])),
      files: new Map([[sourcePath, analyzed]]),
    };
  }

  /** 2.2's plan for one whole cnx source, its symbols registered as 1.3 would */
  static planSource(source: string): IFilePlan {
    const parsed = CnxSourceParser.parse(source);
    expect(parsed.parseErrors).toEqual([]);
    const registry = new SymbolRegistry();
    const declared = CnxResolver.resolve(
      ProgramLowering.program(parsed.tree, null),
      "test.cnx",
      registry,
    );
    const symbols = [
      ...Program.build([declared], { cppMode: false, registry }).symbolsInFile(
        "test.cnx",
      ),
    ];
    const symbolTable = new SymbolTable();
    symbolTable.addTSymbols(symbols);
    const host = new CodeGenerator();
    const generator = new CodeGenWalker(host);
    TestSymbolTable.install(host.state, symbolTable);
    return ProgramGeneration.plan(
      generator,
      parsed.tree,
      parsed.program,
      {
        cppMode: false,
        symbolInfo: TSymbolInfoAdapter.convert(symbols),
        sourcePath: "test.cnx",
      },
      new SymbolRegistry(),
    );
  }
}

export default ProgramGeneration;
