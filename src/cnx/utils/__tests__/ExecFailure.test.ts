import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

import ExecFailure from "../ExecFailure";

/** Run a real child that fails, and return what its `catch` receives. */
function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error: unknown) {
    return error;
  }
  throw new Error("expected the child process to fail");
}

/** The async form of `caught`, for promisified `execFile`. */
async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error: unknown) {
    return error;
  }
  throw new Error("expected the child process to fail");
}

describe("ExecFailure.of", () => {
  it("reads the streams and status of a real failed execFileSync", () => {
    const error = caught(() =>
      execFileSync(
        process.execPath,
        [
          "-e",
          "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
        ],
        { encoding: "utf-8", stdio: "pipe" },
      ),
    );

    const failure = ExecFailure.of(error);

    expect(failure.stdout).toBe("out");
    expect(failure.stderr).toBe("err");
    expect(failure.status).toBe(3);
    expect(failure.message).toContain("Command failed");
  });

  it("decodes Buffer streams, which a call without `encoding` captures", () => {
    const error = caught(() =>
      execFileSync(
        process.execPath,
        ["-e", "process.stderr.write('raw'); process.exit(1)"],
        {
          stdio: "pipe",
        },
      ),
    );

    expect(ExecFailure.of(error).stderr).toBe("raw");
  });

  it("reads the exit code of a promisified execFile, which Node reports as `code`", async () => {
    const error = await rejected(() =>
      promisify(execFile)(process.execPath, [
        "-e",
        "process.stderr.write('async'); process.exit(3)",
      ]),
    );

    const failure = ExecFailure.of(error);

    expect(failure.status).toBe(3);
    expect(failure.stderr).toBe("async");
  });

  it("gives a spawn that never started no exit code, sync or async", async () => {
    // Both APIs put the errno string on `code` (`ENOENT`) when the binary is
    // missing, and the sync one sets `status` to null: neither is an exit code.
    const sync = caught(() =>
      execFileSync("/no/such/binary-1489", [], { stdio: "pipe" }),
    );
    const async = await rejected(() =>
      promisify(execFile)("/no/such/binary-1489", []),
    );

    expect(ExecFailure.of(sync).status).toBeUndefined();
    expect(ExecFailure.of(async).status).toBeUndefined();
  });

  it("leaves absent streams undefined, so `??` and `||` callers fall through", () => {
    const failure = ExecFailure.of(new Error("spawn failed"));

    expect(failure.stdout).toBeUndefined();
    expect(failure.stderr).toBeUndefined();
    expect(failure.status).toBeUndefined();
    expect(failure.message).toBe("spawn failed");
  });

  it("reads a thrown non-Error as its message, without assuming a shape", () => {
    expect(ExecFailure.of("plain string")).toEqual({
      message: "plain string",
      stdout: undefined,
      stderr: undefined,
      status: undefined,
      signal: undefined,
    });
  });

  it("reads the signal that killed a child, which has no exit code", () => {
    const error = caught(() =>
      execFileSync(
        process.execPath,
        ["-e", "process.kill(process.pid, 'SIGTERM')"],
        { encoding: "utf-8", stdio: "pipe" },
      ),
    );

    const failure = ExecFailure.of(error);

    expect(failure.signal).toBe("SIGTERM");
    expect(failure.status).toBeUndefined();
  });

  it("ignores stream fields that are not text", () => {
    const failure = ExecFailure.of(
      Object.assign(new Error("odd"), {
        stdout: 42,
        stderr: null,
        status: "1",
      }),
    );

    expect(failure.stdout).toBeUndefined();
    expect(failure.stderr).toBeUndefined();
    expect(failure.status).toBeUndefined();
  });
});
