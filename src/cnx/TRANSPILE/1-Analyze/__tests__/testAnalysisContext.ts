import TranspileState from "../../TranspileState";
import TestSymbolTable from "../../__tests__/TestSymbolTable";
import Program from "../../../PARSE/4-Resolve/Program";
import type IAnalysisContext from "../types/IAnalysisContext";
import createMockSymbols from "../../../types/__testUtils__/codeGenSymbolsHelpers";

/**
 * An `IAnalysisContext` built from whatever the test already put on
 * `TranspileState`.
 *
 * #1456 made the analyzers take their inputs instead of reaching for them.
 * Production builds this in `Analyze._inputsOf`, from the artifacts it
 * is holding. The unit tests set the same facts up on `TranspileState` and have
 * done since before the boundary existed, so this reads them back rather than
 * rewriting several hundred assertions to construct symbol views by hand.
 *
 * That is deliberate and it is not a fallback: nothing in `src/` outside
 * `__tests__` calls this, so the production path cannot reach `TranspileState`
 * through it. A test that wants a specific view passes its own object.
 *
 * `program` is non-nullable on the context because 1.4 Resolve has always
 * finished before 2.1 begins, so an empty `Program` stands in for a test that
 * never set one -- which is what those tests were getting from the `?? []`
 * fallbacks this replaced, only now it is stated rather than implied.
 */
const testAnalysisContext = (
  state: TranspileState,
  overrides: Partial<IAnalysisContext> = {},
): IAnalysisContext => ({
  symbols: state.symbols ?? createMockSymbols(),
  // #1428: the mode the test put on the state, as `generate()` puts it there
  program: state.program ?? Program.build([], { cppMode: state.cppMode }),
  symbolTable: TestSymbolTable.of(state),
  // #1456 owns this fact; #1452 deleted the write-only copy that used to
  // sit on the state, so the DEFAULT is stated here. `true` is the declining
  // direction -- a false positive stops valid interop code compiling, a false
  // negative is the status quo -- and a test that needs `false` passes it
  // through `overrides`, which is where the fact travels in production too.
  includesForeignHeader: true,
  sourceFile: "test.cnx",
  ...overrides,
});

export default testAnalysisContext;
