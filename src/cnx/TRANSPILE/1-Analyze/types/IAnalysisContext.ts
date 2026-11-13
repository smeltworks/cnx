import type ICodeGenSymbols from "../../../types/ICodeGenSymbols";
import type IProgram from "../../../types/IProgram";
import type IResolvedSymbols from "../../../types/IResolvedSymbols";

/**
 * What 2.1 Analyze is allowed to know about the program it is judging.
 *
 * #1456. These four facts were reached through the render state (then
 * `CodeGenState`, now `TranspileState`), which is the
 * render pass's state container and is reachable from every pass at once. That
 * is the shape `docs/architecture/README.md` forbids -- *"a container that
 * outlives a pass is how facts come to be stashed instead of carried"* -- and
 * the cost is not theoretical: #1430 and #1432 are both an analyzer reading a
 * field a LATER pass fills, getting the previous file's answer or the previous
 * run's.
 *
 * Carrying them makes the boundary checkable. An analyzer can only read what
 * is on this object, and what is on this object is settled before 2.1 begins.
 *
 * ## Why `program` is not nullable here
 *
 * `CodeGenState.program` was `IProgram | null`, so all thirteen analyzer reads
 * spelled `CodeGenState.program?.x() ?? fallback`. Every one of those was a
 * guard that could not fire and a wrong answer if it ever did: `Analyze.run`
 * takes the program from 1.4's artifact, where it is never null, so by 2.1 it
 * always exists -- and a `?? []` for "what consts does this scope have"
 * is a REAL answer meaning "none", not a missing one.
 */
interface IAnalysisContext {
  /**
   * What THIS file can see: its own declarations plus its `.cnx` includes.
   *
   * Non-null, like `program`. There is one producer --
   * `Analyze._inputsOf` -- and it returns `ICodeGenSymbols` or
   * throws, so 2.1 never runs without a view.
   *
   * Six analyzers used to guard on `if (!symbols)` with "no evidence is not
   * evidence of absence". That reads as intentional behavior and was not: the
   * state they guarded against is one production cannot enter, and the only
   * caller that could construct it was a unit test. A guard for an
   * unrepresentable state is dead code that a test keeps alive (#1418), so the
   * type forbids the state instead and the guards are gone.
   */
  readonly symbols: ICodeGenSymbols;

  /** 1.4 Resolve's artifact -- every cross-file fact, settled before 2.1. */
  readonly program: IProgram;

  /** What the program declares, C and C++ headers included. */
  readonly symbolTable: IResolvedSymbols;

  /**
   * Whether this file includes a C/C++ header itself, which is what decides
   * if an unresolved name is a defect or a type the compiler will supply. A
   * header reached only through a `.cnx` include supplies this file nothing
   * (#1881).
   *
   * 1.1 Discover decides it once per file (`IPipelineFile.includesForeignHeader`,
   * required since the #1863 review, when 1.4 began reading it too and the
   * orchestrator had come to default it at two sites). #1430 had forced it into
   * a single site; discovery is that site, and this copies its answer. It travels on the context rather than on
   * the state for the same reason as the rest: 2.1 reads it, and 2.3 happens to
   * be where it was parked.
   */
  readonly includesForeignHeader: boolean;

  /**
   * The run's `--debug` (1.1's `IRunSettings.debugMode`): under it every
   * overflow panics, `wrap` included (#2408), so 2.1 decides E0811 from the
   * helper 2.2 plans under it
   */
  readonly debugMode: boolean;

  /**
   * #1668: the file being analyzed. With it this context is the one
   * operand typer's `ITypingContext`, so 2.1 types an operand from exactly
   * the facts 2.2 does.
   */
  readonly sourceFile: string;
}

export default IAnalysisContext;
