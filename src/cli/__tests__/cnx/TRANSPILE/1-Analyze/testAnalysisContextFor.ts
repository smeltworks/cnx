import ProgramLowering from "../../../../../cnx/PARSE/2-Parse/ProgramLowering";
import type IProgramSyntax from "../../../../../cnx/types/syntax/IProgramSyntax";
import CnxSourceParser from "../../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import type * as Parser from "../../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import CnxResolver from "../../../../../cnx/PARSE/3-Declare/cnx/index";
import CppNamespaceUtils from "../../../../../cnx/utils/CppNamespaceUtils";
import SymbolRegistry from "../../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import Program from "../../../../../cnx/PARSE/4-Resolve/Program";
import TargetCatalogFile from "../../../../TargetCatalogFile";
import RunTarget from "../../../../../cnx/PARSE/2-Parse/RunTarget";
import invariant from "../../../../../cnx/utils/invariant";
import type IAnalysisContext from "../../../../../cnx/TRANSPILE/1-Analyze/types/IAnalysisContext";
import type ILexicalFrame from "../../../../../cnx/types/ILexicalFrame";
import NodeFileSystem from "../../../../../cnx/PARSE/1-Discover/NodeFileSystem";
import type THeaderMacro from "../../../../../cnx/types/THeaderMacro";

/** Where a test's source is taken to live */
const TEST_SOURCE = "test.cnx";

/**
 * Parse, declare and resolve `source` the way the pipeline does, and return
 * 2.1's context for it (#1668, C1).
 *
 * `testAnalysisContext(state)` reads facts a test set on `TranspileState`, and
 * stands an EMPTY `Program` in for one the test never built. That was harmless
 * while every analyzer derived its own declarations from the tree. Once they
 * read them from `Program` -- the lexical frames, the bindings, the settled
 * symbols -- an empty program answers "nothing is declared", and every typing
 * test would pass by asserting silence. So this builds the real artifacts:
 *
 * - 1.2 and 1.3 on the source, 1.4 over the one file, with the file's own
 *   `#pragma target` or else `host` (ADR-049: every program has a target);
 * - the settled symbols published to a `SymbolTable`, as
 *   `Program.build` does, on top of any C/C++ symbols the
 *   test put in the table it passes;
 * - the per-file view from `program.codeGenSymbolsFor`, as
 *   `Analyze._inputsOf` reads it.
 *
 * It refuses a context whose program has no resolved target, or declares a
 * function with no lexical frame, so a test cannot run an analyzer against an
 * unfinished program.
 */
function testAnalysisContextFor(
  source: string,
  options: {
    /**
     * Other cnx files the test source includes, path to source. Each is
     * declared as its own file, ahead of the test source, which sees them all
     * -- a cross-file fact is then a real one, not a mocked view.
     */
    helpers?: Record<string, string>;
    /** C/C++ symbols the test registered, as Stage 2 would have */
    symbolTable?: SymbolTable;
    overrides?: Partial<IAnalysisContext>;
    /** The test file's header macros, as its C includes' `-dM` dump gives them */
    macros?: Record<string, THeaderMacro>;
    /**
     * #1619: the C type the header compiler gives each `<stdint.h>` name, as
     * its `__UINT32_TYPE__`-style macros give them
     */
    integerTypes?: Record<string, string>;
    /**
     * #1428: the run's mode, as 1.1 would have settled it. Required: a test
     * has no 1.1, so it states its mode, and the program carries it as in a run.
     */
    cppMode: boolean;
  },
): {
  tree: Parser.ProgramContext;
  syntax: IProgramSyntax;
  context: IAnalysisContext;
} {
  const registry = new SymbolRegistry();
  const symbolTable = options.symbolTable ?? new SymbolTable();
  const files = [
    ...Object.entries(options.helpers ?? {}),
    [TEST_SOURCE, source] as const,
  ].map(([path, text]) => {
    const parsed = CnxSourceParser.parse(text);
    return {
      path,
      parsed,
      declared: CnxResolver.resolve(
        ProgramLowering.program(parsed.tree, null),
        path,
        registry,
        // as Declare.sources does: the headers are declared before the source
        (name) => CppNamespaceUtils.isCppNamespace(name, symbolTable),
      ),
    };
  });
  const main = files.at(-1)!;

  const program = Program.build(
    files.map((file) => file.declared),
    {
      registry,
      cppMode: options.cppMode,
      visibility: {
        cnxIncludesByFile: new Map([
          [
            TEST_SOURCE,
            Object.keys(options.helpers ?? {}).map((path) => ({ path })),
          ],
        ]),
      },
      foreign: {
        c: symbolTable.getAllCSymbols(),
        cpp: symbolTable.getAllCppSymbols(),
        opaqueTypedefs: new Set(symbolTable.getAllOpaqueTypes()),
        typedefToTag: new Map(symbolTable.getAllTypedefToTag()),
        macros: new Map([
          [TEST_SOURCE, new Map(Object.entries(options.macros ?? {}))],
        ]),
        macrosUnread: new Set<string>(),
        integerTypes: new Map(Object.entries(options.integerTypes ?? {})),
        structTagsWithBodies: new Set(symbolTable.getAllStructTagsWithBodies()),
      },
      filesReachingForeignHeaders: new Set(options.macros ? [TEST_SOURCE] : []),
      headerStructFields: symbolTable.getAllStructFields(),
      symbolTable,
      target: RunTarget.resolve({
        option: "host",
        catalog: TargetCatalogFile.targets(NodeFileSystem.instance),
        files: files.map((file) => ({
          sourcePath: file.path,
          directives: file.parsed.targetDirectives,
        })),
      }),
    },
  );
  invariant(
    program.target().kind === "resolved",
    "a test's program names a known target",
  );

  // Every function the test declares has its lexical frame, so an analyzer
  // reading locals from Program cannot pass by finding none.
  const framed = new Set<string>();
  const collect = (frame: ILexicalFrame): void => {
    if (frame.functionCName !== null) {
      framed.add(frame.functionCName);
    }
    frame.children.forEach(collect);
  };
  collect(program.lexicalFrameAt(TEST_SOURCE, { line: 0, column: 0 }));
  for (const symbol of program.symbolsInFile(TEST_SOURCE)) {
    invariant(
      symbol.kind !== "function" || framed.has(symbol.fullyQualifiedCName),
      `function ${symbol.fullyQualifiedCName} has a lexical frame`,
    );
  }
  const symbols = program.codeGenSymbolsFor(TEST_SOURCE);
  invariant(symbols, "1.4 built this file's symbol view");

  return {
    tree: main.parsed.tree,
    syntax: main.parsed.program,
    context: {
      symbols,
      program,
      symbolTable,
      reachesForeignHeader: true,
      sourceFile: TEST_SOURCE,
      ...options.overrides,
    },
  };
}

export default testAnalysisContextFor;
