import IExecFailure from "./types/IExecFailure";
import CaughtError from "./CaughtError";

/**
 * Reads a failed `execFileSync` / `execSync` / promisified `execFile` from the
 * `unknown` its `catch` receives.
 *
 * Every caller needs the same three facts -- the captured streams and the exit
 * status -- and each used to assert them into existence with its own inline
 * cast (`error as { stderr?: string; ... }`), each in its own shape, or reach
 * them through `any`. This narrows instead of asserting: a field is read
 * only if the value has it, as text, so a non-Error throw or a Buffer stream
 * is handled rather than assumed away (#1489).
 *
 * Which stream a caller reports first stays with the caller. That is the tool's
 * policy -- flawfinder writes findings to stdout, cppcheck to stderr -- not a
 * fact about the failure.
 */
class ExecFailure {
  static of(error: unknown): IExecFailure {
    const message = CaughtError.messageOf(error);
    if (typeof error !== "object" || error === null) {
      return {
        message,
        stdout: undefined,
        stderr: undefined,
        status: undefined,
        signal: undefined,
      };
    }
    return {
      message,
      stdout: ExecFailure.text("stdout" in error ? error.stdout : undefined),
      stderr: ExecFailure.text("stderr" in error ? error.stderr : undefined),
      status: ExecFailure.exitCode(error),
      signal:
        "signal" in error && typeof error.signal === "string"
          ? error.signal
          : undefined,
    };
  }

  /**
   * `execFileSync` and `execSync` report the exit code as `status`; callback
   * and promisified `execFile` report it as `code`. Both put a string there
   * instead (`ENOENT`) when the spawn itself failed, and the sync form sets
   * `status` to null, so only a number is an exit code.
   */
  private static exitCode(error: object): number | undefined {
    if ("status" in error && typeof error.status === "number") {
      return error.status;
    }
    if ("code" in error && typeof error.code === "number") return error.code;
    return undefined;
  }

  /** A captured stream is a string, or a Buffer when no `encoding` was set. */
  private static text(stream: unknown): string | undefined {
    if (typeof stream === "string") return stream;
    return Buffer.isBuffer(stream) ? stream.toString("utf-8") : undefined;
  }
}

export default ExecFailure;
