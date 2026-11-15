import type ISourceSite from "./ISourceSite";

/**
 * Represents an error or warning from the transpiler
 */
interface ITranspileError {
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** Error message */
  message: string;
  /** Severity: 'error' or 'warning' */
  severity: "error" | "warning";
  /** Source file path (optional, for multi-file compilation) */
  sourcePath?: string;
  /**
   * Suggested fix, printed under the message (#1306).
   *
   * It reaches `.expected.error` as well, because those snapshots are generated
   * from what the CLI actually prints -- there is one path, not a human one and
   * a machine one. That is the point: the snapshot diff is where a change to
   * user-facing output becomes visible for review. Rewording a hint therefore
   * updates snapshots, and should.
   */
  helpText?: string;
  /**
   * Where the declaration the diagnostic is about sits, in the file that
   * declares it. E0900 and E0879: the binding, so a tool can add its `mut`
   * (ADR-071). #1402: the matrix measures a diagnostic's relationship from it.
   * Not printed; the message names the declaration.
   */
  declaredAt?: ISourceSite;
}

export default ITranspileError;
