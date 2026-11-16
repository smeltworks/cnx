/**
 * A point in a named file: where a diagnostic is reported, or where the
 * declaration it is about sits (`ITranspileError.declaredAt`).
 *
 * #1844: shared by RunTarget's pragmas and 1.1's E0507, which is reported at
 * the `.cnx` include that reached a C++ header rather than at `1:0`.
 */
interface ISourceSite {
  readonly sourcePath: string;
  /** 1-based */
  readonly line: number;
  /** 0-based, matching ANTLR's token column */
  readonly column: number;
}

export default ISourceSite;
