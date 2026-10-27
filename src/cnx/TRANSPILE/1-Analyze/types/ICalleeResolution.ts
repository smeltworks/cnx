/**
 * Outcome of walking a postfix expression toward a function call.
 */
interface ICalleeResolution {
  /** The callee's qualified name as resolved so far. */
  resolvedName: string;

  /** The callee as the author wrote it (`this.go`, `LED.off`), for diagnostics. */
  writtenName: string;

  /** Whether a call operation was actually reached. */
  foundCall: boolean;

  /** Whether this resolved as a `global.`-qualified free function. */
  isGlobalCall: boolean;
}

export default ICalleeResolution;
