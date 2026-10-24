#!/usr/bin/env tsx
/**
 * cnx CLI Integration Tests
 *
 * Tests the cnx CLI binary for correct behavior:
 * - Flag parsing (--version, --help, etc.)
 * - Exit codes (0 for success, 1 for errors)
 * - Default output path behavior
 * - Various compilation modes
 *
 * Usage:
 *   npm run test:cli
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdtempSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import chalk from "chalk";

import ExecFailure from "../src/cnx/utils/ExecFailure";
import FormerName from "./utils/FormerName";
import packageJson from "../package.json" with { type: "json" };

/** One CLI run, as runCliInDir reports it. */
interface ICliResult {
  success: boolean;
  output: string;
  /** Empty on success: a successful run's stderr is not captured. */
  stderr: string;
  exitCode: number;
}

/** A temp directory and the paths a CLI test writes into it. */
interface ITempTestEnv {
  tempDir: string;
  cnxFile: string;
  cFile: string;
  configFile: string;
}

/** Issue #1467: one include-path layout, and the header path it must name. */
interface IIncludePathCase {
  name: string;
  includeSpec: string;
  utilsAt: string;
  includeArg: string;
  useStruct: boolean;
  projectDir?: string;
  expected: string;
}

/** Issue #1467: what one include-path layout produced. */
interface IIncludePathOutcome {
  transpileSucceeded: boolean;
  transpileOutput: string;
  cIncludes: string[];
  hIncludes: string[];
  headerWrittenAt: string;
  gccExitCode: number;
  gccOutput: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const cliPath = join(rootDir, "bin", "cnx.js");

let passed = 0;
let failed = 0;

/**
 * Run a CLI command in a specific directory and return result
 */
function runCliInDir(
  cwd: string,
  args: string[] = [],
  expectError = false,
): ICliResult {
  try {
    const output = execFileSync("node", [cliPath, ...args], {
      encoding: "utf-8",
      cwd,
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    if (expectError) {
      const failure = ExecFailure.of(error);
      return {
        success: false,
        output: failure.stdout || "",
        stderr: failure.stderr || "",
        exitCode: failure.status || 1,
      };
    }
    throw error;
  }
}

/**
 * Run a CLI command in the root directory
 */
function runCli(args: string[] = [], expectError = false): ICliResult {
  return runCliInDir(rootDir, args, expectError);
}

/**
 * Run a test case
 */
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`${chalk.green("PASS")}    ${name}`);
    passed++;
  } catch (error: unknown) {
    console.log(`${chalk.red("FAIL")}    ${name}`);
    console.log(`        ${chalk.dim(ExecFailure.of(error).message)}`);
    failed++;
  }
}

/**
 * Assert helper
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Clean up generated test files
 */
function cleanup(files: readonly string[]): void {
  for (const file of files) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
}

// ============================================================================
// Test Cases
// ============================================================================

console.log(chalk.cyan("cnx CLI Integration Tests"));
console.log(chalk.dim(`CLI path: ${cliPath}`));
console.log();

// --version flag
test("--version returns version string and exits 0", () => {
  const result = runCli(["--version"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.startsWith("cnx v"),
    `Output should contain version: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

test("-v returns version string and exits 0", () => {
  const result = runCli(["-v"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.startsWith("cnx v"),
    `Output should contain version: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

// --help flag
test("--help shows help text and exits 0", () => {
  const result = runCli(["--help"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("Usage:"),
    `Output should contain usage: ${result.output}`,
  );
  assert(
    result.output.includes("Options:"),
    `Output should contain options: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

test("-h shows help text and exits 0", () => {
  const result = runCli(["-h"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("Usage:"),
    `Output should contain usage: ${result.output}`,
  );
  assert(result.exitCode === 0, "Exit code should be 0");
});

// Issue #2164: the command is `cnx`, and the help names nothing by the
// language's former name, as a command or a file (#2163).
test("--help names the command cnx, never the former name", () => {
  const result = runCli(["--help"]);
  assert(result.success, "Command should succeed");
  assert(
    result.output.includes("cnx <file.cnx>"),
    `Usage should name cnx: ${result.output}`,
  );
  assert(
    !FormerName.isIn(result.output),
    `Help should not spell the former name: ${result.output}`,
  );
});

// No arguments shows help (user-friendly behavior)
test("no arguments shows help and exits 0", () => {
  const result = runCli([]);
  assert(result.success, "Command should succeed (showing help)");
  assert(result.exitCode === 0, "Exit code should be 0");
  assert(result.output.includes("Usage:"), "Should show usage help");
});

// Default output path (alongside input)
// Note: The CLI writes to input dir then renames to -o path.
// Using a copy of the input file in /tmp/ avoids affecting tracked files.
test("single file transpiles to .c alongside input", () => {
  const tempInputDir = mkdtempSync(join(tmpdir(), "cnx-test-"));
  const tempInputFile = join(tempInputDir, "test.cnx");
  const tempOutputFile = join(tempInputDir, "test.c");

  try {
    // Copy the test file to a temp location
    writeFileSync(
      tempInputFile,
      readFileSync("tests/basics/hello-world.test.cnx", "utf-8"),
    );

    const result = runCliInDir(tempInputDir, [
      tempInputFile,
      "--target",
      "host",
    ]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(
      existsSync(tempOutputFile),
      `Output file should exist: ${tempOutputFile}`,
    );
  } finally {
    cleanupTempDir(tempInputDir);
  }
});

// Explicit -o flag
// Note: Using temp copy of input to avoid renaming tracked files
test("-o flag overrides output path", () => {
  const tempInputDir = mkdtempSync(join(tmpdir(), "cnx-test-"));
  const tempInputFile = join(tempInputDir, "test.cnx");
  const customOutput = join(tempInputDir, "custom-output.c");

  try {
    writeFileSync(
      tempInputFile,
      readFileSync("tests/basics/hello-world.test.cnx", "utf-8"),
    );

    const result = runCliInDir(tempInputDir, [
      tempInputFile,
      "-o",
      customOutput,
      "--target",
      "host",
    ]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(
      existsSync(customOutput),
      `Output file should exist: ${customOutput}`,
    );
  } finally {
    cleanupTempDir(tempInputDir);
  }
});

// --cpp flag
// Note: Using temp copy of input to avoid renaming tracked files
test("--cpp flag outputs .cpp extension", () => {
  const tempInputDir = mkdtempSync(join(tmpdir(), "cnx-test-"));
  const tempInputFile = join(tempInputDir, "test.cnx");
  const tempOutputFile = join(tempInputDir, "test.cpp");

  try {
    writeFileSync(
      tempInputFile,
      readFileSync("tests/basics/hello-world.test.cnx", "utf-8"),
    );

    const result = runCliInDir(tempInputDir, [
      tempInputFile,
      "--cpp",
      "--target",
      "host",
    ]);
    assert(result.success, `Command should succeed: ${result.output}`);
    assert(
      existsSync(tempOutputFile),
      `Output file should exist: ${tempOutputFile}`,
    );
  } finally {
    cleanupTempDir(tempInputDir);
  }
});

// Invalid file path
test("nonexistent file exits 1 with error", () => {
  const result = runCli(["nonexistent-file.cnx"], true);
  assert(!result.success, "Command should fail");
  assert(result.exitCode === 1, "Exit code should be 1");
});

// --parse mode
test("--parse mode validates without creating output file", () => {
  const inputFile = "tests/basics/hello-world.test.cnx";
  const wouldBeOutput = "tests/basics/hello-world.c";

  cleanup([join(rootDir, wouldBeOutput)]);

  const result = runCli([inputFile, "--parse"]);
  assert(result.success, `Command should succeed: ${result.output}`);
  assert(
    !existsSync(join(rootDir, wouldBeOutput)),
    "Output file should NOT be created in parse mode",
  );
});

// Syntax error handling
test("syntax error in file exits 1", () => {
  // Create a temp file with invalid syntax
  const tempFile = "/tmp/cnx-test-invalid.cnx";
  writeFileSync(tempFile, "this is not valid cnx syntax @@@");

  const result = runCli([tempFile], true);
  assert(!result.success, "Command should fail");
  assert(result.exitCode === 1, "Exit code should be 1");

  cleanup([tempFile]);
});

// ============================================================================
// PlatformIO Integration Tests (Issue #405)
// ============================================================================

/**
 * Create a temporary PlatformIO project directory
 * @param {string} pioIniContent - Content for platformio.ini
 * @returns {string} Path to temp directory
 */
function createTempPioProject(pioIniContent: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-pio-test-"));
  writeFileSync(join(tempDir, "platformio.ini"), pioIniContent, "utf-8");
  return tempDir;
}

/**
 * Assert file contains substring
 */
function assertFileContains(
  filePath: string,
  substring: string,
  message?: string,
): void {
  assert(existsSync(filePath), `File should exist: ${filePath}`);
  const content = readFileSync(filePath, "utf-8");
  assert(
    content.includes(substring),
    message || `File ${filePath} should contain "${substring}"`,
  );
}

/**
 * Assert file does not exist
 */
function assertFileNotExists(filePath: string, message?: string): void {
  assert(
    !existsSync(filePath),
    message || `File should not exist: ${filePath}`,
  );
}

/**
 * Clean up a temp directory
 */
function cleanupTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create temp test environment with .cnx and .c file paths
 * Returns object with tempDir, cnxFile, cFile, and optional configFile
 */
function createTempTestEnv(prefix = "cnx-test-"): ITempTestEnv {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  return {
    tempDir,
    cnxFile: join(tempDir, "test.cnx"),
    cFile: join(tempDir, "test.c"),
    configFile: join(tempDir, "cnx.config.json"),
  };
}

/**
 * Run a test with temp directory setup and automatic cleanup
 */
function withTempTest(
  prefix: string,
  testFn: (env: ITempTestEnv) => void,
): void {
  const env = createTempTestEnv(prefix);
  try {
    testFn(env);
  } finally {
    cleanupTempDir(env.tempDir);
  }
}

// Minimal platformio.ini for tests
const minimalPioIni = `[env:teensy41]
platform = teensy
board = teensy41
framework = arduino
`;

// Multi-environment platformio.ini
const multiEnvPioIni = `[env:teensy41]
platform = teensy
board = teensy41
framework = arduino

[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino

[env:uno]
platform = atmelavr
board = uno
framework = arduino
`;

// platformio.ini with existing extra_scripts
const pioIniWithExtraScripts = `[env:teensy41]
platform = teensy
board = teensy41
framework = arduino
extra_scripts = pre:custom_script.py
`;

// Simple atomic .cnx file for target tests
const atomicCnx = `atomic u32 counter <- 0;

void increment() {
    counter +<- 1;
}
`;

// ----------------------------------------------------------------------------
// Category 1: --pio-install tests
// ----------------------------------------------------------------------------

test("--pio-install creates cnx_build.py and modifies platformio.ini", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    const result = runCliInDir(tempDir, ["--pio-install"]);
    assert(result.success, `Command should succeed: ${result.output}`);

    // Verify cnx_build.py was created
    assertFileContains(
      join(tempDir, "cnx_build.py"),
      "def transpile_cnx",
      "cnx_build.py should contain transpile function",
    );
    // ADR-049: the environment being built names the target (#1668)
    assertFileContains(
      join(tempDir, "cnx_build.py"),
      '"--pio-env", env["PIOENV"]',
      "cnx_build.py should pass the environment being built",
    );

    // Verify platformio.ini was modified
    assertFileContains(
      join(tempDir, "platformio.ini"),
      "extra_scripts",
      "platformio.ini should have extra_scripts",
    );
    assertFileContains(
      join(tempDir, "platformio.ini"),
      "cnx_build.py",
      "platformio.ini should reference cnx_build.py",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-install is idempotent (safe to run twice)", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    // First install
    runCliInDir(tempDir, ["--pio-install"]);

    // Second install should succeed without duplicating entries
    const result = runCliInDir(tempDir, ["--pio-install"]);
    assert(result.success, "Second install should succeed");
    assert(
      result.output.includes("already configured"),
      "Should indicate already configured",
    );

    // Verify no duplicate entries
    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    const matches = pioIni.match(/cnx_build\.py/g) || [];
    assert(matches.length === 1, "Should have exactly one cnx_build.py entry");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-install fails without platformio.ini", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-pio-test-"));
  try {
    const result = runCliInDir(tempDir, ["--pio-install"], true);
    assert(!result.success, "Should fail without platformio.ini");
    assert(result.exitCode === 1, "Exit code should be 1");
    assert(
      result.stderr.includes("platformio.ini not found") ||
        result.output.includes("platformio.ini not found"),
      "Should mention missing platformio.ini",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-install preserves existing extra_scripts", () => {
  const tempDir = createTempPioProject(pioIniWithExtraScripts);
  try {
    runCliInDir(tempDir, ["--pio-install"]);

    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    assert(
      pioIni.includes("custom_script.py"),
      "Should preserve existing custom_script.py",
    );
    assert(pioIni.includes("cnx_build.py"), "Should add cnx_build.py");
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ----------------------------------------------------------------------------
// Category 2: --pio-uninstall tests
// ----------------------------------------------------------------------------

test("--pio-uninstall removes integration cleanly", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    // First install
    runCliInDir(tempDir, ["--pio-install"]);
    assert(
      existsSync(join(tempDir, "cnx_build.py")),
      "Script should exist after install",
    );

    // Then uninstall
    const result = runCliInDir(tempDir, ["--pio-uninstall"]);
    assert(result.success, `Uninstall should succeed: ${result.output}`);

    // Verify cnx_build.py was removed
    assertFileNotExists(
      join(tempDir, "cnx_build.py"),
      "cnx_build.py should be removed",
    );

    // Verify platformio.ini was cleaned
    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    assert(
      !pioIni.includes("cnx_build.py"),
      "platformio.ini should not reference cnx_build.py",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-uninstall is idempotent (safe on clean project)", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    // Uninstall on project that was never installed
    const result = runCliInDir(tempDir, ["--pio-uninstall"]);
    assert(result.success, "Uninstall should succeed on clean project");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-uninstall fails without platformio.ini", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-pio-test-"));
  try {
    const result = runCliInDir(tempDir, ["--pio-uninstall"], true);
    assert(!result.success, "Should fail without platformio.ini");
    assert(result.exitCode === 1, "Exit code should be 1");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-uninstall preserves other extra_scripts", () => {
  const tempDir = createTempPioProject(pioIniWithExtraScripts);
  try {
    // Install then uninstall
    runCliInDir(tempDir, ["--pio-install"]);
    runCliInDir(tempDir, ["--pio-uninstall"]);

    const pioIni = readFileSync(join(tempDir, "platformio.ini"), "utf-8");
    assert(
      pioIni.includes("custom_script.py"),
      "Should preserve custom_script.py after uninstall",
    );
    assert(!pioIni.includes("cnx_build.py"), "Should remove cnx_build.py");
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ----------------------------------------------------------------------------
// Category 2b: the generated cnx_build.py, run as PlatformIO runs it (#2174)
// ----------------------------------------------------------------------------

/**
 * Stands in for PlatformIO's SCons: an `Import` that does nothing and an
 * `env` naming the environment being built, then the hook run as a script.
 */
const PLATFORMIO_STUB = `import builtins, sys
builtins.Import = lambda *names: None
builtins.env = {"PIOENV": sys.argv[2]}
with open(sys.argv[1]) as hook:
    exec(compile(hook.read(), sys.argv[1], "exec"), {"__name__": "__main__"})
`;

/** `name`'s absolute path on this run's PATH, so no child resolves it by PATH. */
function onPath(name: string): string {
  const dirs = (process.env.PATH ?? "").split(delimiter);
  const dir = dirs.find((d) => d !== "" && existsSync(join(d, name)));
  assert(dir !== undefined, `${name} should be on PATH`);
  return join(dir as string, name);
}

/** Run `tempDir`'s cnx_build.py for teensy41 with only `pathDirs` on PATH. */
function runHook(tempDir: string, pathDirs: string[]): ICliResult {
  const python = onPath("python3");
  try {
    const output = execFileSync(
      python,
      ["-c", PLATFORMIO_STUB, "cnx_build.py", "teensy41"],
      {
        encoding: "utf-8",
        cwd: tempDir,
        env: { PATH: pathDirs.join(delimiter) },
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return { success: true, output, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const failure = ExecFailure.of(error);
    // No status: killed (the timeout), so no exit code a test could expect
    return {
      success: false,
      output: failure.stdout || "",
      stderr: failure.stderr || failure.message,
      exitCode: failure.status ?? -1,
    };
  }
}

/** A project with the hook installed and `src/main.cnx` holding `source`. */
function withHookProject(source: string, testFn: (tempDir: string) => void) {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    const install = runCliInDir(tempDir, ["--pio-install"]);
    assert(install.success, `--pio-install should succeed: ${install.output}`);
    mkdirSync(join(tempDir, "src"));
    writeFileSync(join(tempDir, "src", "main.cnx"), source, "utf-8");
    testFn(tempDir);
  } finally {
    cleanupTempDir(tempDir);
  }
}

test("cnx_build.py names a missing cnx instead of a traceback", () => {
  withHookProject(atomicCnx, (tempDir) => {
    const emptyBin = join(tempDir, "empty-bin");
    mkdirSync(emptyBin);
    const result = runHook(tempDir, [emptyBin]);
    assert(result.exitCode === 1, `Exit code should be 1: ${result.output}`);
    assert(
      result.output.includes(
        `✗ cnx not found on PATH: npm i -g ${packageJson.name}`,
      ),
      `Should say cnx is missing: ${result.output}`,
    );
    assert(
      !result.stderr.includes("Traceback"),
      `Should not raise: ${result.stderr}`,
    );
  });
});

test("cnx_build.py runs cnx for the environment being built", () => {
  withHookProject(atomicCnx, (tempDir) => {
    const bin = join(tempDir, "bin");
    mkdirSync(bin);
    symlinkSync(cliPath, join(bin, "cnx"));
    const result = runHook(tempDir, [bin, dirname(process.execPath)]);
    assert(result.success, `Hook should succeed: ${result.stderr}`);
    assert(
      result.output.includes("Target: teensy41 (platformio)"),
      `Should build for the environment named: ${result.output}`,
    );
    assert(
      result.output.includes("✓ Transpilation complete"),
      `Should finish: ${result.output}`,
    );
    assert(
      existsSync(join(tempDir, "src", "main.c")),
      "Should write src/main.c",
    );
  });
});

// ----------------------------------------------------------------------------
// Category 3: --target flag tests
// ----------------------------------------------------------------------------

test("--target teensy41 generates LDREX/STREX code", () => {
  withTempTest("cnx-target-test-", ({ tempDir, cnxFile, cFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "teensy41", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    assertFileContains(cFile, "__LDREXW", "Should use LDREX for teensy41");
  });
});

// ARMv6-M (Cortex-M0 and M0+) has no LDREX/STREX: the exclusive monitor is
// an ARMv7-M addition. #1668: cortex-m0+ used to claim it.
for (const target of ["cortex-m0", "cortex-m0+"]) {
  test(`--target ${target} generates PRIMASK fallback code`, () => {
    withTempTest("cnx-target-test-", ({ tempDir, cnxFile, cFile }) => {
      writeFileSync(cnxFile, atomicCnx, "utf-8");
      const result = runCliInDir(tempDir, ["--target", target, cnxFile]);
      assert(result.success, `Compile should succeed: ${result.output}`);

      assertFileContains(
        cFile,
        "__cnx_get_PRIMASK();",
        `Should use PRIMASK for ${target}`,
      );
      const content = readFileSync(cFile, "utf-8");
      assert(
        !content.includes("__LDREX"),
        `Should NOT use LDREX for ${target}`,
      );
    });
  });
}

test("--target avr generates PRIMASK fallback code", () => {
  withTempTest("cnx-target-test-", ({ tempDir, cnxFile, cFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "avr", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // AVR has no LDREX: the RMW is a masked region
    assertFileContains(
      cFile,
      "__cnx_get_PRIMASK();",
      "Should use PRIMASK for avr",
    );
  });
});

// ADR-049: every name given must be a known target. An unknown --target used
// to warn and fall back, so a misspelling compiled for the wrong platform.
test("--target with an unknown target is E0510", () => {
  withTempTest("cnx-target-test-", ({ tempDir, cnxFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(
      tempDir,
      ["--target", "unknown-board", cnxFile],
      true,
    );
    assert(!result.success, "An unknown target must fail the run");
    assert(
      result.stderr.includes(
        "error[E0510]: the target option names 'unknown-board'",
      ),
      `Should report E0510: ${result.stderr}`,
    );
  });
});

// ADR-049: a program with no pragma, no option, no config target and no
// PlatformIO board names no target, and has no defined meaning.
test("a program that names no target is E0515", () => {
  withTempTest("cnx-target-test-", ({ tempDir, cnxFile }) => {
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, [cnxFile], true);
    assert(!result.success, "A program with no target must fail the run");
    assert(
      result.stderr.includes("error[E0515]: the program names no target"),
      `Should report E0515: ${result.stderr}`,
    );
  });
});

// ADR-049: source first -- a file's #pragma target decides over --target.
test("#pragma target decides over --target", () => {
  withTempTest("cnx-target-test-", ({ tempDir, cnxFile, cFile }) => {
    writeFileSync(cnxFile, `#pragma target teensy41\n${atomicCnx}`, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "cortex-m0", cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);
    assertFileContains(cFile, "__LDREXW", "The pragma's teensy41 decides");
    assert(
      result.output.includes("Target: teensy41 (pragma)"),
      `Should report the target and its source: ${result.output}`,
    );
  });
});

// ...but the option must still be a known name, even when the pragma decides.
test("an unknown --target is E0510 even when a pragma decides", () => {
  withTempTest("cnx-target-test-", ({ tempDir, cnxFile }) => {
    writeFileSync(cnxFile, `#pragma target teensy41\n${atomicCnx}`, "utf-8");
    const result = runCliInDir(tempDir, ["--target", "bogus", cnxFile], true);
    assert(!result.success, "An unknown option must fail the run");
    assert(
      result.stderr.includes("error[E0510]"),
      `Should report E0510: ${result.stderr}`,
    );
  });
});

// ADR-049's build-system rung: the board of the environment being built.
test("platformio.ini's board names the target", () => {
  const tempDir = createTempPioProject(minimalPioIni);
  try {
    const cnxFile = join(tempDir, "main.cnx");
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const result = runCliInDir(tempDir, [cnxFile]);
    assert(result.success, `Compile should succeed: ${result.output}`);
    assert(
      result.output.includes("Target: teensy41 (platformio)"),
      `Should report the PlatformIO target: ${result.output}`,
    );
    assertFileContains(
      join(tempDir, "main.c"),
      "__LDREXW",
      "teensy41 from platformio.ini should use LDREX",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("--pio-env picks the environment whose board names the target", () => {
  const tempDir = createTempPioProject(multiEnvPioIni);
  try {
    const cnxFile = join(tempDir, "main.cnx");
    writeFileSync(cnxFile, atomicCnx, "utf-8");
    const both = runCliInDir(tempDir, [cnxFile], true);
    assert(
      !both.success && both.stderr.includes("error[E0511]"),
      `Two environments with different targets are E0511: ${both.stderr}`,
    );
    const uno = runCliInDir(tempDir, ["--pio-env", "uno", cnxFile]);
    assert(
      uno.output.includes("Target: avr (platformio)"),
      `--pio-env uno should build avr: ${uno.output}`,
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ----------------------------------------------------------------------------
// Category 4: Config file target tests
// ----------------------------------------------------------------------------

test("cnx.config.json target is respected", () => {
  withTempTest(
    "cnx-config-test-",
    ({ tempDir, cnxFile, cFile, configFile }) => {
      writeFileSync(cnxFile, atomicCnx, "utf-8");
      // teensy41 has LDREX; the fallback does not, so the output shows
      // whether the config was read.
      writeFileSync(
        configFile,
        JSON.stringify({ target: "teensy41" }, null, 2),
        "utf-8",
      );

      const result = runCliInDir(tempDir, [cnxFile]);
      assert(result.success, `Compile should succeed: ${result.output}`);

      assertFileContains(cFile, "__LDREXW", "Config target should be used");
      assert(
        result.output.includes("Target: teensy41 (option)"),
        `The config's target is the option's default: ${result.output}`,
      );
    },
  );
});

/**
 * Issue #2261: where one run put its settings and its root. `headerOut` names
 * the directory the config was read from; `.cnx/`, the cache, names the root.
 */
function settingsAndRoot(
  cwd: string,
  cnxFile: string,
): { header: string | null; cacheRoot: string | null } {
  const result = runCliInDir(cwd, [cnxFile, "--target", "host"]);
  assert(result.success, `Compile should succeed: ${result.output}`);
  const header = [
    join(dirname(cnxFile), "x.h"),
    join(cwd, "include", "x.h"),
    join(cwd, "headers", "x.h"),
  ].find((path) => existsSync(path));
  const cacheRoot = [dirname(cnxFile), cwd].find((dir) =>
    existsSync(join(dir, ".cnx")),
  );
  return { header: header ?? null, cacheRoot: cacheRoot ?? null };
}

// Issue #2261, reproduction 1: proj's config sits above tools/package.json,
// which is the root. Control: without it, proj is both.
test("a config above a package.json does not apply below it", () => {
  for (const marked of [false, true]) {
    withTempTest("cnx-config-root-test-", ({ tempDir }) => {
      mkdirSync(join(tempDir, ".git"));
      writeFileSync(
        join(tempDir, "cnx.config.json"),
        '{"headerOut":"include"}',
      );
      const tools = join(tempDir, "tools");
      mkdirSync(tools);
      if (marked) {
        writeFileSync(join(tools, "package.json"), '{"name":"tools"}');
      }
      const cnxFile = join(tools, "x.cnx");
      writeFileSync(cnxFile, "u32 value <- 7;\n", "utf-8");

      const run = settingsAndRoot(tempDir, cnxFile);

      const root = marked ? tools : tempDir;
      const header = marked
        ? join(tools, "x.h")
        : join(tempDir, "include", "x.h");
      assert(
        run.cacheRoot === root && run.header === header,
        `package.json ${marked ? "present" : "absent"}: expected the root ${root} and the header ${header}, got ${JSON.stringify(run)}`,
      );
    });
  }
});

// Issue #2261, reproduction 2: a .cnxrc in the home directory, above a
// project's .git. Control: without the .git, the home directory is the root.
test("a home .cnxrc does not apply to a project below a .git", () => {
  for (const marked of [false, true]) {
    withTempTest("cnx-config-root-test-", ({ tempDir }) => {
      writeFileSync(join(tempDir, ".cnxrc"), '{"headerOut":"headers"}');
      const project = join(tempDir, "work", "p");
      mkdirSync(project, { recursive: true });
      if (marked) {
        mkdirSync(join(project, ".git"));
      }
      const cnxFile = join(project, "x.cnx");
      writeFileSync(cnxFile, "u32 value <- 7;\n", "utf-8");

      const run = settingsAndRoot(tempDir, cnxFile);

      const root = marked ? project : tempDir;
      const header = marked
        ? join(project, "x.h")
        : join(tempDir, "headers", "x.h");
      assert(
        run.cacheRoot === root && run.header === header,
        `.git ${marked ? "present" : "absent"}: expected the root ${root} and the header ${header}, got ${JSON.stringify(run)}`,
      );
    });
  }
});

test("CLI --target overrides config file target", () => {
  withTempTest(
    "cnx-config-test-",
    ({ tempDir, cnxFile, cFile, configFile }) => {
      writeFileSync(cnxFile, atomicCnx, "utf-8");
      // Config says cortex-m0 (PRIMASK)
      writeFileSync(
        configFile,
        JSON.stringify({ target: "cortex-m0" }, null, 2),
        "utf-8",
      );

      // CLI says teensy41 (LDREX) - should override
      const result = runCliInDir(tempDir, ["--target", "teensy41", cnxFile]);
      assert(result.success, `Compile should succeed: ${result.output}`);

      assertFileContains(
        cFile,
        "__LDREXW",
        "CLI --target should override config",
      );
    },
  );
});

// ============================================================================
// Category 5: Multi-file const inference tests (Issue #565)
// ============================================================================

// Multi-file const inference test files
const multiFileConstConfig = `struct Config {
    i32 value;
}
`;

const multiFileConstStorage = `#include "Config.cnx"

scope Storage {
    public void loadDefaults(mut Config config) {
        config.value <- 42;
    }
}
`;

const multiFileConstHandler = `#include "Config.cnx"
#include "Storage.cnx"

scope Handler {
    public u8 reset(mut Config cfg) {
        global.Storage.loadDefaults(cfg);
        return 0;
    }
}
`;

const multiFileConstSerial = `#include "Config.cnx"
#include "Handler.cnx"

scope Serial {
    void handleReset(mut Config config) {
        (void) global.Handler.reset(config);
    }

    public void process(mut Config config) {
        this.handleReset(config);
    }
}
`;

/**
 * Issue #565: write Config and the given Storage, Handler and Serial, then
 * transpile Serial.cnx with --cpp (const inference only applies in C++ mode).
 * Returns a reader for each generated file.
 */
function transpileConstChain(
  tempDir: string,
  storage: string,
  handler: string,
  serial: string,
): (file: string) => string {
  writeFileSync(join(tempDir, "Config.cnx"), multiFileConstConfig, "utf-8");
  writeFileSync(join(tempDir, "Storage.cnx"), storage, "utf-8");
  writeFileSync(join(tempDir, "Handler.cnx"), handler, "utf-8");
  writeFileSync(join(tempDir, "Serial.cnx"), serial, "utf-8");
  const result = runCliInDir(tempDir, [
    "Serial.cnx",
    "--cpp",
    "--target",
    "host",
  ]);
  assert(result.success, `Compile should succeed: ${result.output}`);
  return (file) => readFileSync(join(tempDir, file), "utf-8");
}

test("Issue #565: multi-file transitive const inference propagates correctly", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-multifile-const-"));

  try {
    const read = transpileConstChain(
      tempDir,
      multiFileConstStorage,
      multiFileConstHandler,
      multiFileConstSerial,
    );
    const serialCpp = read("Serial.cpp");

    // Key assertion: Serial__handleReset should have NON-const Config&
    // because it calls Handler.reset which calls Storage.loadDefaults which modifies config
    assert(
      serialCpp.includes("Serial__handleReset(Config& config)"),
      "Serial__handleReset should have non-const Config& (transitive modification)",
    );
    assert(
      !serialCpp.includes("Serial__handleReset(const Config& config)"),
      "Serial__handleReset should NOT have const (it transitively modifies)",
    );

    // Also verify the intermediate functions are correct
    const handlerCpp = read("Handler.cpp");
    assert(
      handlerCpp.includes("Handler__reset(Config& cfg)"),
      "Handler__reset should have non-const Config&",
    );

    const storageCpp = read("Storage.cpp");
    assert(
      storageCpp.includes("Storage__loadDefaults(Config& config)"),
      "Storage__loadDefaults should have non-const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("Issue #565: read-only multi-file calls preserve const", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-multifile-const-"));

  // Test that read-only calls still get const correctly
  const readOnlyStorage = `#include "Config.cnx"

scope Storage {
    public i32 getValue(Config config) {
        return config.value;
    }
}
`;

  const readOnlyHandler = `#include "Config.cnx"
#include "Storage.cnx"

scope Handler {
    public i32 read(Config cfg) {
        return global.Storage.getValue(cfg);
    }
}
`;

  const readOnlySerial = `#include "Config.cnx"
#include "Handler.cnx"

scope Serial {
    public i32 readValue(Config config) {
        return global.Handler.read(config);
    }
}
`;

  try {
    const read = transpileConstChain(
      tempDir,
      readOnlyStorage,
      readOnlyHandler,
      readOnlySerial,
    );

    // All functions should have const since none modify
    const serialCpp = read("Serial.cpp");
    assert(
      serialCpp.includes("Serial__readValue(const Config& config)"),
      "Serial__readValue should have const Config& (read-only chain)",
    );

    const handlerCpp = read("Handler.cpp");
    assert(
      handlerCpp.includes("Handler__read(const Config& cfg)"),
      "Handler__read should have const Config&",
    );

    const storageCpp = read("Storage.cpp");
    assert(
      storageCpp.includes("Storage__getValue(const Config& config)"),
      "Storage__getValue should have const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ============================================================================
// Category 6: Issue #580 - C++ detection from headers tests
// ============================================================================

// C++ header that triggers C++ mode detection (has C++ class)
const cppHeaderContent = `// C++ header with class to trigger C++ mode detection
#ifndef CPP_SERIAL_H
#define CPP_SERIAL_H

class SerialClass {
public:
    void println(int value);
};

extern SerialClass Serial;

#endif
`;

const issue580Config = `struct Config {
    i32 value;
}
`;

const issue580Modifier = `#include "Config.cnx"

scope Modifier {
    public void reset(mut Config c) {
        c.value <- 42;
    }
}
`;

// Handler that includes C++ header (triggers detection) and calls modifier
const issue580Handler = `#include "CppSerial.h"
#include "Config.cnx"
#include "Modifier.cnx"

scope Handler {
    // This function ONLY passes config through to reset()
    // Issue #580: was incorrectly marked const when C++ detected from headers
    public void passThrough(mut Config config) {
        global.Modifier.reset(config);
    }
}
`;

test("Issue #580: C++ mode gives correct transitive const inference", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-issue580-"));

  try {
    // Create the test files
    writeFileSync(join(tempDir, "CppSerial.h"), cppHeaderContent, "utf-8");
    writeFileSync(join(tempDir, "Config.cnx"), issue580Config, "utf-8");
    writeFileSync(join(tempDir, "Modifier.cnx"), issue580Modifier, "utf-8");
    writeFileSync(join(tempDir, "Handler.cnx"), issue580Handler, "utf-8");

    // #1319: declare C++. This test is about transitive const inference, not
    // about how the mode is arrived at -- it used to omit --cpp and rely on the
    // header being sniffed, which now reports E0507 instead.
    const result = runCliInDir(tempDir, [
      "Handler.cnx",
      "--cpp",
      "--target",
      "host",
    ]);
    assert(result.success, `Compile should succeed: ${result.output}`);

    // Should generate .cpp file (C++ mode detected from header)
    assert(
      existsSync(join(tempDir, "Handler.cpp")),
      "Should generate .cpp in declared C++ mode",
    );

    // Key assertion: Handler__passThrough should have NON-const Config&
    // because it calls Modifier.reset which modifies config
    const handlerCpp = read("Handler.cpp");
    assert(
      handlerCpp.includes("Handler__passThrough(Config& config)"),
      "Handler__passThrough should have non-const Config& (calls mutating function)",
    );
    assert(
      !handlerCpp.includes("Handler__passThrough(const Config& config)"),
      "Handler__passThrough should NOT have const (it transitively modifies)",
    );

    // Also verify Modifier was processed correctly
    assert(
      existsSync(join(tempDir, "Modifier.cpp")),
      "Should generate Modifier.cpp",
    );
    const modifierCpp = readFileSync(join(tempDir, "Modifier.cpp"), "utf-8");
    assert(
      modifierCpp.includes("Modifier__reset(Config& c)"),
      "Modifier__reset should have non-const Config&",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ============================================================================
// Issue #1467: one owner answers "which header does this include name?"
// ============================================================================

const includePathUtils = `struct Point {
    u8 x;
    u8 y;
}

scope Utils {
    public u8 add(u8 v) {
        return v + 1;
    }
}
`;

/**
 * Issue #1467: `useStruct` decides whether the included type crosses into the
 * generated HEADER. It must, for at least one case: a header that names an
 * external type gets its include from ExternalTypeHeaderBuilder, which is a
 * THIRD derivation of this path, and a fixture that only calls a function
 * never reaches it.
 */
const includePathMain = (
  includeSpec: string,
  useStruct: boolean,
): string => `#include <${includeSpec}>

${
  useStruct
    ? `scope App {
    public u8 useIt(Point p) {
        return global.Utils.add(p.x);
    }
}`
    : `mut u8 result;`
}

i32 main() {
${useStruct ? "    return 0;" : "    result <- global.Utils.add(5);\n    return 0;"}
}
`;

/**
 * Issue #1467: the include naming `utils`, as each generated file spells it.
 * Narrowed to that one header so the run's own `main.h`/`stdint.h` lines
 * cannot mask a disagreement.
 */
function utilsIncludesIn(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => /^#include\s*[<"].*utils\.h/.test(line))
    .map((line) => line.trim());
}

/**
 * Issue #1467: build a project, transpile it with a separate `-o` and
 * `--header-out`, and report what each output emitted alongside where the
 * header was actually written.
 *
 * `utilsAt` is relative to the temp dir, so a case can put the included file
 * under the entry's tree (header nests) or outside it (header goes flat).
 */
function runIncludePathCase(
  {
    includeSpec,
    utilsAt,
    includeArg,
    useStruct,
    projectDir = ".",
  }: IIncludePathCase,
  tempDir: string,
): IIncludePathOutcome {
  // `utilsAt` is relative to tempDir; the project (and the cwd the CLI runs in)
  // is `projectDir` under it. A case that puts the included file OUTSIDE the
  // project exercises the flat-header path -- see PathResolver's #489 branch.
  const projectRoot = join(tempDir, projectDir);
  mkdirSync(join(tempDir, dirname(utilsAt)), { recursive: true });
  mkdirSync(join(projectRoot, "src"), { recursive: true });
  writeFileSync(join(tempDir, utilsAt), includePathUtils, "utf-8");
  writeFileSync(
    join(projectRoot, "src", "main.cnx"),
    includePathMain(includeSpec, useStruct),
    "utf-8",
  );

  // Issue #1467 review: `expectError: true` makes a non-zero exit DATA. Without
  // it runCliInDir rethrows, so `transpileSucceeded` below could only ever be
  // true -- an assertion that cannot fail, in a PR about assertions that cannot
  // fail (#1143).
  const result = runCliInDir(
    projectRoot,
    [
      "src/main.cnx",
      "-o",
      "build",
      "--header-out",
      "include",
      "--include",
      includeArg,
      "--target",
      "host",
    ],
    true,
  );

  if (!result.success) {
    return {
      transpileSucceeded: false,
      transpileOutput: `${result.output}${result.stderr}`,
      cIncludes: [],
      hIncludes: [],
      headerWrittenAt: "<not written>",
      gccExitCode: 1,
      gccOutput: "",
    };
  }

  let gccExitCode = 0;
  let gccOutput = "";
  try {
    execFileSync(
      "gcc",
      ["-c", "build/main.c", "-I", "include", "-o", "/dev/null"],
      { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (error: unknown) {
    const failure = ExecFailure.of(error);
    gccExitCode = failure.status ?? 1;
    gccOutput = failure.stderr || failure.stdout || "";
  }

  // Where the header actually landed, relative to --header-out.
  const headerRoot = join(projectRoot, "include");
  const candidates = ["Display/utils.h", "shared/utils.h", "utils.h"];
  const headerWrittenAt =
    candidates.find((c) => existsSync(join(headerRoot, c))) ?? "<not written>";

  return {
    transpileSucceeded: result.success,
    transpileOutput: "",
    cIncludes: utilsIncludesIn(
      readFileSync(join(projectRoot, "build", "main.c"), "utf-8"),
    ),
    hIncludes: utilsIncludesIn(
      readFileSync(join(projectRoot, "include", "main.h"), "utf-8"),
    ),
    headerWrittenAt,
    gccExitCode,
    gccOutput,
  };
}

/**
 * Issue #1467: the whole assertion, in one place, for every case below.
 *
 * `expected` is the single right answer -- where the header was actually
 * written, relative to `--header-out`. Every generated file must name exactly
 * that, which is the property that makes `-I <header-out>` sufficient.
 */
function assertIncludeAgreesWithHeader(
  label: string,
  actual: IIncludePathOutcome,
  expected: string,
): void {
  assert(
    actual.transpileSucceeded,
    `${label}: transpiler should exit 0\n${actual.transpileOutput}`,
  );
  assert(
    actual.headerWrittenAt === expected,
    `${label}: header should be at ${expected}, was ${actual.headerWrittenAt}`,
  );
  for (const [where, lines] of [
    ["main.c", actual.cIncludes],
    ["main.h", actual.hIncludes],
  ] as const) {
    assert(
      lines.length === 1 && lines[0] === `#include <${expected}>`,
      `${label}: ${where} should include <${expected}>, had ${JSON.stringify(lines)}`,
    );
  }
  assert(
    actual.gccExitCode === 0,
    `${label}: generated C should compile with -I include alone, gcc exited ` +
      `${actual.gccExitCode}\n${actual.gccOutput}`,
  );
}

// The contract: `-I <header-out>` alone is sufficient, so every emitted include
// names its header relative to that root. Cases 2-4 hold on the unfixed tree and
// are the negative controls -- a fix that prepends unconditionally breaks them.
const includePathCases: IIncludePathCase[] = [
  {
    name: "Issue #1467: a bare angle include of a nested .cnx names the header's real path",
    includeSpec: "utils.cnx",
    utilsAt: "src/Display/utils.cnx",
    includeArg: "src/Display",
    useStruct: false,
    expected: "Display/utils.h",
  },
  {
    name: "Issue #1467 control: an already-qualified angle include stays correct",
    includeSpec: "Display/utils.cnx",
    utilsAt: "src/Display/utils.cnx",
    includeArg: "src/Display",
    useStruct: false,
    expected: "Display/utils.h",
  },
  {
    name: "Issue #1467 control: an include dir outside the project stays flat",
    includeSpec: "utils.cnx",
    utilsAt: "shared/utils.cnx",
    includeArg: "../shared",
    projectDir: "proj",
    useStruct: false,
    expected: "utils.h",
  },
  {
    // Found while building the control above: when the shared tree is INSIDE
    // the cwd, PathResolver's #489 branch nests the header instead, and the
    // emitted include is bare either way. Same defect, third layout.
    name: "Issue #1467: a shared tree inside the cwd nests the header, and the include must follow",
    includeSpec: "utils.cnx",
    utilsAt: "shared/utils.cnx",
    includeArg: "shared",
    useStruct: false,
    expected: "shared/utils.h",
  },
  {
    // Also a guard for ExternalTypeHeaderBuilder since #1435: its directive is
    // deduplicated against the file's own include by the whole included path,
    // not the basename stem, so a directive that loses the directory
    // (<utils.h> beside "Display/utils.h") reaches the output and fails here.
    // The producer is also pinned in IncludeResolver's unit tests. This case
    // covers the layout where a type crosses the boundary, which reaches more
    // header-generation code than a bare call does.
    name: "Issue #1467: a type crossing into the header gets the same path",
    includeSpec: "utils.cnx",
    utilsAt: "src/Display/utils.cnx",
    includeArg: "src/Display",
    useStruct: true,
    expected: "Display/utils.h",
  },
];

for (const includeCase of includePathCases) {
  test(includeCase.name, () => {
    // Issue #1467 review: the temp dir is created HERE so `finally` always has
    // the path. Creating it inside the helper meant any throw -- a failing
    // transpile, or reading a build/main.c that was never written -- escaped
    // before cleanup and leaked a directory per run.
    const tempDir = mkdtempSync(join(tmpdir(), "cnx-1467-"));
    try {
      assertIncludeAgreesWithHeader(
        includeCase.name,
        runIncludePathCase(includeCase, tempDir),
        includeCase.expected,
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });
}

// #1991 review: cpp reading a string runs from another directory, so a
// relative --include must reach it as an absolute path, for a header that
// includes another header too
test("a header declaration error recovery damages drops only that declaration", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-header-recovery-"));
  try {
    writeFileSync(
      join(tempDir, "dev.h"),
      "void good(int a);\n#ifdef OTHER_COMPILER\nint a, 8[2];\n#endif\n",
    );
    writeFileSync(
      join(tempDir, "main.cnx"),
      '#include "dev.h"\n\nvoid main() {\n    good(1);\n}\n',
    );
    const result = runCliInDir(tempDir, ["main.cnx", "--target", "host"], true);
    assert(
      result.success,
      `expected exit 0, got ${result.exitCode}: ${result.stderr}${result.output}`,
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("a relative --include reaches headers that include each other", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cnx-rel-include-"));
  try {
    mkdirSync(join(tempDir, "include"));
    mkdirSync(join(tempDir, "deps"));
    writeFileSync(
      join(tempDir, "include", "lib.h"),
      "#ifndef LIB_H\n#define LIB_H\n#include <dep.h>\nvoid lib_set(dep_t v);\n#endif\n",
    );
    writeFileSync(
      join(tempDir, "deps", "dep.h"),
      "#ifndef DEP_H\n#define DEP_H\ntypedef unsigned char dep_t;\n#endif\n",
    );
    writeFileSync(
      join(tempDir, "main.cnx"),
      "#include <lib.h>\n\nvoid main() {\n    lib_set(5);\n}\n",
    );
    const result = runCliInDir(
      tempDir,
      [
        "main.cnx",
        "--target",
        "host",
        "--include",
        "include",
        "--include",
        "deps",
      ],
      true,
    );
    assert(
      result.success,
      `expected exit 0, got ${result.exitCode}: ${result.stderr}${result.output}`,
    );
    assert(
      readFileSync(join(tempDir, "main.c"), "utf-8").includes("lib_set(5"),
      "expected main.c to call lib_set",
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log();
console.log(chalk.cyan("Results:"));
console.log(`  ${chalk.green("Passed:")}  ${passed}`);
if (failed > 0) {
  console.log(`  ${chalk.red("Failed:")}  ${failed}`);
}

process.exit(failed > 0 ? 1 : 0);
