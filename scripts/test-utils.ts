/**
 * Shared Test Utilities
 *
 * Common interfaces and validation functions used by both
 * test.ts (main runner) and test-worker.ts (parallel worker).
 *
 * This module centralizes duplicated code to prevent drift
 * (e.g., validateMisra missing -I flag in one file but not the other).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ITools from "./types/ITools";
import ITestOptions from "./types/ITestOptions";
import IValidationResult from "./types/IValidationResult";
import ITestResult from "./types/ITestResult";
import type TTestMode from "./types/TTestMode";
import type IModeResult from "./types/ITestMode";
import detectCppSyntax from "../src/cnx/PARSE/2-Parse/detectCppSyntax";
import TestMarkers from "./TestMarkers";
import CnxSourceParser from "../src/cnx/PARSE/2-Parse/CnxSourceParser";
import ExecFailure from "../src/cnx/utils/ExecFailure";
import TargetResolver from "../src/cli/TargetResolver";
import type IGccToolchain from "../src/cnx/utils/types/IGccToolchain";
import TargetMatrix from "./TargetMatrix";
import RunTarget from "../src/cnx/PARSE/2-Parse/RunTarget";
import type ITargetCell from "./types/ITargetCell";
import type ITargetXfail from "./types/ITargetXfail";
import type ITranspileCell from "./types/ITranspileCell";
import NodeFileSystem from "../src/cnx/PARSE/1-Discover/NodeFileSystem";

// Project root for CLI invocation (this file is in /workspace/scripts/)
const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Use pre-built bundle when available (eliminates tsx/npx overhead per test)
const DIST_ENTRY = join(PROJECT_ROOT, "dist", "index.js");
const SRC_DIR = join(PROJECT_ROOT, "src");

/**
 * Check if dist/index.js is fresh (newer than all source files in src/).
 * Short-circuits on the first stale file found.
 */
function isDistFresh(): boolean {
  if (!existsSync(DIST_ENTRY)) return false;

  const distMtime = statSync(DIST_ENTRY).mtimeMs;

  function hasNewerSource(dir: string): boolean {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (hasNewerSource(fullPath)) return true;
      } else if (entry.name.endsWith(".ts")) {
        if (statSync(fullPath).mtimeMs > distMtime) return true;
      }
    }
    return false;
  }

  return !hasNewerSource(SRC_DIR);
}

// Auto-rebuild on module load to ensure tests always use fresh bundle.
// Only the main process should rebuild — workers (created via fork()) have
// process.send, so we skip the build check in them to avoid 24 concurrent builds.
//
// CNX_SKIP_DIST_REBUILD is the same exemption for a child that is NOT a fork
// and so has no process.send: a test that spawns this harness to observe how it
// REPORTS would otherwise make its own suite build the project as a side effect,
// and a concurrent `npm test` would have dist/index.js rewritten underneath it
// (the #1488 shape). Such a child accepts a stale bundle deliberately -- it is
// not asserting on transpiler output -- and every gate builds before it runs.
if (
  !process.send &&
  !process.env.CNX_SKIP_DIST_REBUILD &&
  existsSync(DIST_ENTRY) &&
  !isDistFresh()
) {
  console.warn("Warning: dist/index.js is stale. Rebuilding...");
  const buildResult = spawnSync("npm", ["run", "build"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    stdio: "inherit",
  });
  if (buildResult.status !== 0) {
    console.error("Build failed. Falling back to tsx for transpilation.");
    try {
      unlinkSync(DIST_ENTRY);
    } catch {
      /* ignore */
    }
  }
}
const USE_BUILT = existsSync(DIST_ENTRY);

/**
 * Result from CLI transpilation
 */
interface ICliTranspileResult {
  success: boolean;
  code: string;
  headerCode: string;
  errors: Array<{ line: number; column: number; message: string }>;
  stderr: string;
  /**
   * Implementation files the CLI reported writing, as absolute paths.
   *
   * Issue #1314: the harness used to infer the output extension from the mode it
   * ASKED for (`cppMode ? ".cpp" : ".c"`) and only reconsidered when that file was
   * absent. A `.hpp` include makes the transpiler auto-select C++
   * (`Transpiler.detectCppFromFileType`), so in C mode no `.c` is written -- but a
   * stale committed `.c` from an older transpiler satisfied the existence check,
   * so the harness read THAT and compared it to an equally stale `.expected.c`.
   * Both matched, the test passed, and the file under validation was one no
   * transpiler produced. The stale file's existence was what suppressed the
   * detection. Reading the CLI's own report removes the inference entirely.
   */
  generatedImplPaths: string[];
  /** The `Target: <name> (<source>)` line the CLI printed, if any */
  target?: { name: string; source: string };
  /**
   * Header files the CLI reported writing, as absolute paths -- everything in
   * the "Generated N output files:" block after the impl files. For a multi-file
   * pipeline run this includes every dependency's header, direct or
   * transitive, not just the ones a caller's own `.cnx` list happens to name.
   * That transitivity is what lets the harness take a fixture's dependency
   * artifacts from this report alone (#1544).
   */
  generatedHeaderPaths: string[];
  /**
   * The header path this call's own file was written to (or would have been,
   * had it emitted one) -- the same `actualHeaderPath` this function already
   * derives from the corrected impl path, exposed so a caller can pick this
   * file's own header out of another call's `generatedHeaderPaths`.
   */
  headerPath: string;
}

/**
 * How a diagnostic is written into a `.expected.error` snapshot.
 *
 * `line:col message` when the diagnostic belongs to the fixture itself, and
 * `path:line:col message` when it does not. #1582 review: a bare `line:col`
 * is resolved by every reader -- human and `FixtureOccupancy` alike -- against
 * the ENTRY file, so a diagnostic reported in an included sibling pointed at a
 * real line in the wrong file. The two halves of an order-swapped pair carried
 * byte-identical snapshots meaning different lines.
 *
 * Conditional rather than unconditional on purpose: prefixing every diagnostic
 * would rewrite every single-file snapshot in the corpus to say what the
 * filename already says.
 */
function renderDiagnostic(
  e: { line: number; column: number; message: string; file?: string },
  entryPath: string,
  root: string = PROJECT_ROOT,
): string {
  const entry = relative(root, entryPath);
  const where = e.file !== undefined && e.file !== entry ? `${e.file}:` : "";
  return `${where}${e.line}:${e.column} ${e.message}`;
}

/**
 * Transpile a cnx file using the CLI (not library imports).
 *
 * This ensures tests exercise the exact same code path as real users.
 * Previously tests imported Transpiler directly, which bypassed conflict
 * detection and other CLI-only features.
 *
 * @param cnxFile - Path to the .cnx file to transpile
 * @param cppMode - Whether to use C++ mode (--cpp flag)
 * @param cell - A cross-target transpile's target and include directory
 *   (#1668); the host transpile passes none
 */
function transpileViaCli(
  cnxFile: string,
  cppMode: boolean,
  cell?: ITranspileCell,
): ICliTranspileResult {
  // Build CLI args - use PROJECT_ROOT for CLI/includes, but cnxFile is the actual test file path
  // Note: We don't clean up stale files - the CLI overwrites them and they're tracked in git
  const cliArgs = [
    cnxFile,
    "--include",
    join(cell?.root ?? PROJECT_ROOT, "tests/include"),
  ];

  // #1668 box 15: a cross cell transpiles for its matrix target; otherwise the
  // harness's own option (a fixture's pin still decides)
  const target =
    cell?.target ?? TestUtils.harnessTarget(readFileSync(cnxFile, "utf-8"));
  if (target !== undefined) {
    cliArgs.push("--target", target);
  }

  // #1844: a C run says so. Unset, the CLI would detect C++ from a C++
  // header, and a C-mode fixture meeting one is E0507, as it always was.
  cliArgs.push(cppMode ? "--cpp" : "--no-cpp");

  // The CLI writes next to the source
  const basePath = cnxFile.replace(/\.cnx$/, "");
  const codePath = basePath + (cppMode ? ".cpp" : ".c");
  const headerPath = basePath + (cppMode ? ".hpp" : ".h");

  // Run CLI from project root (where src/cli/index.ts exists)
  // Clear VITEST env so the CLI's main() function runs
  // (src/cli/index.ts checks VITEST to skip auto-execution during unit tests)
  const cleanEnv = { ...process.env };
  delete cleanEnv.VITEST;

  // Use pre-built bundle when available (fast), fall back to npx tsx for dev
  const result = USE_BUILT
    ? spawnSync(process.execPath, [DIST_ENTRY, ...cliArgs], {
        cwd: cell?.root ?? PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 30000,
        env: cleanEnv,
      })
    : spawnSync(
        "npx",
        ["tsx", join(PROJECT_ROOT, "src/cli/index.ts"), ...cliArgs],
        {
          cwd: cell?.root ?? PROJECT_ROOT,
          encoding: "utf-8",
          timeout: 30000,
          env: cleanEnv,
        },
      );

  // Parse errors from stderr
  // CLI format: "Error: /path/file.cnx:line:column message" followed by optional indented continuation lines
  // #1582 review: the path is CAPTURED, not merely matched. A diagnostic
  // reported in an included file used to render as a bare `line:col`, which
  // resolves against the ENTRY -- so a cross-file snapshot pointed at a real
  // line in the wrong file. `11:4` meant a comment in one fixture and
  // `return 0;` in its order-swapped twin.
  const errors: Array<{
    line: number;
    column: number;
    message: string;
    file?: string;
  }> = [];
  if (result.stderr) {
    const lines = result.stderr.split("\n");
    let currentError: {
      line: number;
      column: number;
      messageParts: string[];
      file?: string;
    } | null = null;

    const flush = (): void => {
      if (currentError) {
        errors.push({
          line: currentError.line,
          column: currentError.column,
          message: currentError.messageParts.join("\n"),
          file: currentError.file,
        });
      }
    };
    for (const line of lines) {
      // Skip empty lines and "Compilation failed" message
      if (!line.trim() || line === "Compilation failed") continue;

      // Match: "Error: /path/file.cnx:line:column message"
      const fullMatch = line.match(
        /^(?:Error|Warning):\s*([^:]+):(\d+):(\d+)\s+(.+)$/,
      );
      if (fullMatch) {
        // Save previous error if any
        flush();
        currentError = {
          line: parseInt(fullMatch[2], 10),
          column: parseInt(fullMatch[3], 10),
          messageParts: [fullMatch[4]],
          file: fullMatch[1],
        };
        continue;
      }

      // Continuation line (starts with spaces)
      if (currentError && /^\s+/.test(line)) {
        currentError.messageParts.push(line);
        continue;
      }

      // Fallback: simple "line:column message", i.e. a diagnostic with no
      // source path in front of it.
      const simpleMatch = line.match(/^(?:Error:\s*)?(\d+):(\d+)\s+(.+)$/);
      if (simpleMatch) {
        flush();
        // #1319: become the current error rather than pushing immediately. This
        // branch used to push and null `currentError`, so the continuation
        // branch above could never fire for a pathless diagnostic and every
        // line after the first was dropped -- silently, since a fixture
        // regenerated under that behavior simply never recorded the guidance.
        // The path-carrying branch has always accumulated; only this one did
        // not, so the same diagnostic asserted more or less of itself depending
        // on whether it happened to know its file.
        // No path in front of it, so the diagnostic is the entry's own and
        // `file` stays undefined -- which renders exactly as it always has.
        currentError = {
          line: parseInt(simpleMatch[1], 10),
          column: parseInt(simpleMatch[2], 10),
          messageParts: [simpleMatch[3]],
        };
      }
    }

    // Don't forget the last error
    if (currentError) {
      errors.push({
        line: currentError.line,
        column: currentError.column,
        message: currentError.messageParts.join("\n"),
        file: currentError.file,
      });
    }
  }

  // Read generated files if they exist
  // Handle CLI auto-detection: if we asked for C but got C++ (due to .hpp includes), use C++ paths
  let code = "";
  let headerCode = "";
  let actualCodePath = codePath;
  let actualHeaderPath = headerPath;

  // Issue #1314: the CLI names every file it wrote. Ask it, rather than probing
  // the filesystem for a name we guessed -- a leftover file from an older
  // transpiler answers an existence check just as convincingly as a fresh one.
  const generatedImplPaths = TestUtils.parseGeneratedImplPaths(
    result.stdout || "",
  );
  const generatedHeaderPaths = TestUtils.parseGeneratedHeaderPaths(
    result.stdout || "",
  );

  if (result.status === 0) {
    // Only the CLI's answer for THIS path counts. `generatedImplPaths[0]` would be
    // a second guess and a wrong one: outputFiles is filled impl-by-impl across the
    // whole pipeline (Transpiler._recordFileResult) with headers appended afterwards
    // (_generateAllHeadersFromPipeline), so in a multi-file run [0] is a DEPENDENCY's
    // impl, not the fixture's. Verified -- an entry including dep.cnx prints
    // `dep.c, main.test.c, dep.h`. A miss stays a miss; the caller's guard reports it.
    const reportedImpl = generatedImplPaths.find((p) => p === codePath);
    if (reportedImpl) {
      actualCodePath = reportedImpl;
      actualHeaderPath = reportedImpl
        .replace(/\.cpp$/, ".hpp")
        .replace(/\.c$/, ".h");
    }

    if (existsSync(actualCodePath)) {
      code = readFileSync(actualCodePath, "utf-8");
    }
    if (existsSync(actualHeaderPath)) {
      headerCode = readFileSync(actualHeaderPath, "utf-8");
    }
  }

  return {
    success: result.status === 0,
    code,
    headerCode,
    errors,
    stderr: result.stderr || "",
    generatedImplPaths,
    generatedHeaderPaths,
    headerPath: actualHeaderPath,
    target: TestUtils.parseTarget(result.stdout || ""),
  };
}

// Shared patterns for distinguishing C++ constructors from C function prototypes
const C_KEYWORDS =
  "return|if|while|for|switch|case|else|do|break|continue|goto|sizeof|typeof|alignof";
const C_TYPES =
  "void|int|char|float|double|long|short|unsigned|signed|bool|enum|struct|union|static|extern|const|volatile|inline|u?int\\d+_t|size_t";

class TestUtils {
  /**
   * The target option every fixture-driven transpile passes (#1668).
   *
   * ADR-049: every program names a target. A fixture that pins none runs for
   * the build machine; `// test-no-target` opts out, for fixtures about where
   * the target comes from. A pin still decides -- source outranks the option.
   * One function, so the harness, the format-fidelity gate, the matrix's
   * provenance run and the C++ snapshot generator cannot disagree.
   */
  static harnessTarget(source: string): string | undefined {
    return TestMarkers.has("test-no-target", source) ? undefined : "host";
  }

  /** The `Target: <name> (<source>)` line of CLI output, if printed */
  static parseTarget(
    stdout: string,
  ): { name: string; source: string } | undefined {
    const match = /^Target: (\S+) \((\w+)\)$/m.exec(stdout);
    return match ? { name: match[1], source: match[2] } : undefined;
  }

  /**
   * Why a successful run's target is not the one the fixture asked for, or
   * null (#1668). A fixture that pins a name runs for that name; one that
   * does not runs for the harness's `--target host`. A pin in an included
   * helper decides as a pragma, which is also right. `// test-no-target`
   * fixtures are about where the target comes from, and assert it themselves.
   */
  static targetProblem(
    source: string,
    target: { name: string; source: string } | undefined,
  ): string | null {
    if (TestMarkers.has("test-no-target", source)) {
      return null;
    }
    if (!target) {
      return "the CLI printed no Target: line (ADR-049)";
    }
    const pin = CnxSourceParser.parse(source).targetDirectives.find(
      (directive) => directive.key === "target",
    )?.values[0];
    // The run reports the ENTRY's declaration by name (#1760 review), and the
    // fixture is the entry, so its pin is the name printed. This compared
    // catalog objects by identity while its comment said "as descriptions",
    // so it disagreed with E0511 for rows that share a platform.
    if (pin !== undefined && pin !== target.name) {
      return `ran for target '${target.name}' (${target.source}), but the fixture pins '${pin}'`;
    }
    if (target.source === "option" && target.name !== "host") {
      return `ran for target '${target.name}' from the option, but the harness passes host`;
    }
    return null;
  }

  // First word of a line that is NOT a C++ constructor (keywords + C types)
  static readonly NON_CONSTRUCTOR_FIRST_WORD = new RegExp(
    `^(${C_KEYWORDS}|${C_TYPES})$`,
  );
  // Type keywords appearing in function arguments indicate a prototype, not a constructor
  static readonly C_TYPE_IN_ARGS = new RegExp(`\\b(${C_TYPES})\\b`);

  /**
   * Normalize output for comparison (trim trailing whitespace, normalize line endings)
   */
  static normalize(str: string): string {
    return str
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  }

  /**
   * The first line at which two texts disagree, or null if every line
   * matches. A byte-for-byte mismatch report otherwise shows the same
   * leading lines for any divergence -- an include guard and a
   * generated-by banner are identical whatever changed thirty lines
   * further down -- which reads as "these differ" with no clue where.
   */
  static firstDifference(
    expected: string,
    actual: string,
  ): { line: number; expected: string; actual: string } | null {
    const expectedLines = expected.split("\n");
    const actualLines = actual.split("\n");
    const lineCount = Math.max(expectedLines.length, actualLines.length);
    for (let i = 0; i < lineCount; i++) {
      const expectedLine = i < expectedLines.length ? expectedLines[i] : "";
      const actualLine = i < actualLines.length ? actualLines[i] : "";
      if (expectedLine !== actualLine) {
        return { line: i + 1, expected: expectedLine, actual: actualLine };
      }
    }
    return null;
  }

  /**
   * `firstDifference`, formatted as a message suffix (empty string when the
   * texts agree). Shared by every snapshot-mismatch site so the console
   * excerpt (test.ts's five-line preview) is backed by the same "where"
   * everywhere instead of each site growing its own.
   */
  private static describeFirstDifference(
    expected: string,
    actual: string,
  ): string {
    const diff = TestUtils.firstDifference(expected, actual);
    if (!diff) return "";
    return (
      ` First difference at line ${diff.line}:\n` +
      `        expected: ${diff.expected}\n` +
      `        actual:   ${diff.actual}`
    );
  }

  /**
   * Check if source has the test-no-warnings marker
   *
   * Issue #1555: read in BLOCK form only until this fixed it, so a fixture
   * spelling it as a line comment -- the way every other marker is written --
   * asked for the warning check and silently did not get one.
   */
  static hasNoWarningsMarker(source: string): boolean {
    return TestMarkers.has("test-no-warnings", source);
  }

  /**
   * Issue #461: Check if source has test-transpile-only marker
   * Tests with this marker skip GCC compilation (e.g., C++ interop tests)
   */
  static hasTranspileOnlyMarker(source: string): boolean {
    return TestMarkers.has("test-transpile-only", source);
  }

  /**
   * Check if source has test-c-only marker
   * Tests with this marker run ONLY in C mode (e.g., MISRA-specific tests)
   */
  static hasCOnlyMarker(source: string): boolean {
    return TestMarkers.has("test-c-only", source);
  }

  /**
   * Check if source has test-cpp-only marker
   * Tests with this marker run ONLY in C++ mode (e.g., C++ template interop tests)
   */
  static hasCppOnlyMarker(source: string): boolean {
    return TestMarkers.has("test-cpp-only", source);
  }

  /**
   * Determine which test modes to run based on markers
   * Default: run both C and C++ modes
   */
  static getTestModes(source: string): TTestMode[] {
    if (TestUtils.hasCOnlyMarker(source)) return ["c"];
    if (TestUtils.hasCppOnlyMarker(source)) return ["cpp"];
    return ["c", "cpp"]; // Default: both modes
  }

  /**
   * Get expected file paths for a given mode
   */
  static getExpectedPaths(
    basePath: string,
    mode: TTestMode,
  ): { expectedImpl: string; expectedHeader: string; tempImpl: string } {
    const implExt = mode === "cpp" ? "cpp" : "c";
    const headerExt = mode === "cpp" ? "hpp" : "h";
    return {
      expectedImpl: `${basePath}.expected.${implExt}`,
      expectedHeader: `${basePath}.expected.${headerExt}`,
      tempImpl: `${basePath}.test.${implExt}`,
    };
  }

  /**
   * Which language does this corpus compile one fixture translation unit as?
   *
   * Issue #1557: this was decided in three places by three different rules --
   * the ordinary compile check took the mode as authoritative and fell back to
   * sniffing the file, the no-warnings compile sniffed and ignored the mode
   * entirely, and this function took the mode and was called by nobody. The
   * middle one is why a fixture's C++ output was compiled and never
   * warning-checked: the marker ran in C mode only, and had the gate simply been
   * removed, 11 of the 17 marker-carrying fixtures generate a `.cpp` that trips
   * none of the sniffer's patterns and would have been handed to `gcc -std=c99`.
   *
   * The mode is what the harness is actually doing, so it wins. The sniff stays
   * as the C-mode fallback because a generated `.c` can legitimately need `g++`
   * -- C++ interop headers pull in classes, namespaces and templates (#267,
   * #291, #322, #375) -- and nothing but the file's contents says so.
   *
   * @param mode - The mode the harness is compiling this fixture in
   * @param translationUnit - The .c/.cpp file, read only for the C-mode fallback
   */
  static getCompilerConfig(
    mode: TTestMode,
    translationUnit: string,
  ): {
    compiler: string;
    stdFlag: string;
  } {
    if (mode === "cpp" || TestUtils.requiresCpp14(translationUnit)) {
      return { compiler: "g++", stdFlag: "-std=c++14" };
    }
    return { compiler: "gcc", stdFlag: "-std=c99" };
  }

  /**
   * Get a unique path for a test executable in the temp directory
   */
  static getExecutablePath(cnxFile: string): string {
    const testName = basename(cnxFile, ".test.cnx");
    const uniqueId = randomBytes(4).toString("hex");
    return join(tmpdir(), `cnx-test-${testName}-${uniqueId}`);
  }

  /**
   * Check if code contains C++ features (without file I/O).
   * Extracted for testability - Issue #375.
   *
   * @param cCode - The C/C++ source code to analyze
   * @returns true if C++ features are detected
   */
  static hasCppFeatures(cCode: string): boolean {
    // Issue #267: Check for C++ casts (static_cast, reinterpret_cast)
    if (
      /\b(static_cast|reinterpret_cast|const_cast|dynamic_cast)\s*</.test(cCode)
    ) {
      return true;
    }

    // Issue #291: Check for C++ template types (Type<Args>)
    // Excludes string<N> which is cnx bounded string syntax
    if (/\b(?!string\b)\w+<[^;=<>]+>/.test(cCode)) {
      return true;
    }

    // Issue #322: Check for C++ scope resolution operator (::)
    if (/\w+::\w+/.test(cCode)) {
      return true;
    }

    // C++ reference parameters in function declarations
    // Pattern 1: const Type& paramName (const reference)
    if (/\bconst\s+\w+\s*&\s*\w+/.test(cCode)) {
      return true;
    }
    // Pattern 2: Type& paramName in function param context
    // Requires: type starts with letter, & follows, param name starts with letter, ends with , or )
    // Uses [a-zA-Z] instead of \w to exclude patterns like "0xFFU & value)" which are bitwise ops
    // NOTE: Intentionally permissive — may match in typedef/macro contexts, which is acceptable
    // since the goal is C++ compiler selection (false positives are harmless, false negatives break builds)
    if (/[a-zA-Z_]\w*\s*&\s*[a-zA-Z_]\w*\s*[,)]/.test(cCode)) {
      return true;
    }

    // Issue #375: Check for C++ constructor call syntax
    // Pattern: TypeName varName(args); at global scope
    // Matches lines like "Adafruit_MAX31856 thermocouple(pin);"
    // Excludes: keywords, C types, and function prototypes (args contain type keywords)
    // Split into two patterns to reduce regex complexity (SonarCloud S5843)
    const constructorMatch = /^\s*(\w+)\s+\w+\(([^)]*)\)\s*;/m.exec(cCode);
    if (constructorMatch) {
      const firstWord = constructorMatch[1];
      const argsContent = constructorMatch[2];
      const isKeywordOrCType =
        TestUtils.NON_CONSTRUCTOR_FIRST_WORD.test(firstWord);
      // Function prototypes have type keywords in args (e.g., "const int* x");
      // constructor calls have plain values (e.g., "pin, 42")
      const argsHaveTypes = TestUtils.C_TYPE_IN_ARGS.test(argsContent);
      if (!isKeywordOrCType && !argsHaveTypes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect if a C file requires C++ compilation (g++ instead of gcc)
   *
   * Checks for:
   * - C++ casts: static_cast, reinterpret_cast, etc. (Issue #267)
   * - C++ template types: Type<Args> (Issue #291)
   * - C++ structural syntax in headers: class, namespace, template, access specifiers, typed enums
   *
   * Note: Named "requiresCpp14" for historical reasons, but now detects
   * any C++ feature that requires g++ compilation.
   *
   * @param cFile - Path to the C file
   * @param _rootDir - Project root directory (unused, kept for API consistency)
   */
  static requiresCpp14(cFile: string, _rootDir?: string): boolean {
    try {
      const cCode = readFileSync(cFile, "utf-8");
      const cFileDir = dirname(cFile);

      // Check inline code for C++ features
      if (TestUtils.hasCppFeatures(cCode)) {
        return true;
      }

      // Find all #include "local_header.h" directives
      const includePattern = /#include\s+"([^"]+)"/g;
      let match;

      while ((match = includePattern.exec(cCode)) !== null) {
        const headerPath = join(cFileDir, match[1]);
        if (existsSync(headerPath)) {
          const headerContent = readFileSync(headerPath, "utf-8");
          // Use transpiler's robust C++ detection for headers
          if (detectCppSyntax(headerContent)) {
            return true;
          }
          // Also check for inline C++ code in headers (casts, ::, constructors)
          if (TestUtils.hasCppFeatures(headerContent)) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * How this corpus compiles one fixture translation unit: the warnings it
   * suppresses by convention, then where its headers live.
   *
   * Issue #1553: this set was spelled out at four sites and two had drifted --
   * the no-warnings compile passed only the shared corpus directory, so a
   * generated header including a sibling as <name.h> was not found. Copying
   * the missing flag into the fourth would have left the mechanism intact: the
   * next flag added re-opens the same defect in whichever copy is forgotten.
   *
   * The suppressions travel with the include path rather than beside it,
   * because they are the same decision -- "how does this corpus compile a
   * fixture?" -- and splitting them would leave three copies of half of it.
   *
   * #1544: the include path is the fixture's SOURCE ROOT -- the entry's
   * directory -- and is the same for every translation unit in the fixture,
   * which is why this takes that directory rather than the file being
   * compiled. Taking a directory is what leaves the wrong argument no way to
   * be written: the previous signature took a file whose only use was
   * `dirname()`, so passing the unit being compiled type-checked and was wrong
   * for every unit except the entry. A
   * generated file's self-include is source-root-relative by #339's decision,
   * so `lib/sensors.c` includes `"lib/sensors.h"` in order that two helpers
   * both named `config.cnx` cannot collide on `"config.h"` (#1134). Passing
   * each unit its OWN directory resolved that for the entry and for nothing
   * else: a helper in a subdirectory looked for `lib/sensors.h` inside `lib/`
   * and the compile died on a missing header. The generated code was right; it
   * was being compiled against an include path its own contract does not use.
   */
  static fixtureCompileFlags(sourceRootDir: string, rootDir: string): string[] {
    return [
      "-Wno-unused-variable",
      "-Wno-main",
      "-I",
      join(rootDir, "tests/include"),
      "-I",
      sourceRootDir,
    ];
  }

  /**
   * #1610: MISRA C:2012 Rule 11.9 in generated C++ -- a literal `0` used as a
   * null pointer fails the compile, so a generated null cannot regress to `0`
   * or `{0}`. Every C++ cell asks but AVR's: avr-g++ 7.3 misfires on code with
   * no pointer in it (the `}` closing `int main` and `x << 0`): #2327.
   */
  static nullPointerConstantFlags(
    compiler: string,
    toolchain: IGccToolchain,
  ): string[] {
    return compiler === "g++" && toolchain.driverPrefix !== "avr-"
      ? ["-Wzero-as-null-pointer-constant"]
      : [];
  }

  /**
   * Compile ONE translation unit for a target: how this corpus compiles every
   * unit, for every cell of the target matrix (#1668 box 15).
   *
   * The target's GCC and architecture flags wrap the language
   * `getCompilerConfig` decides. `-Werror` makes anything the compiler warns
   * about by default fail the cell: a shift past the width of an AVR `int`, or
   * an intrinsic called with no declaration, is a warning and not an error in
   * GCC 13, and each is a real defect. `strict` adds what
   * `// test-no-warnings` asks for, `-O3 -Wall -Wextra`; the optimizer is what
   * lets the middle-end diagnostics fire at all (#1143).
   *
   * This replaced two functions: an entry-only `-fsyntax-only` check and the
   * no-warnings compile, each spelling its own flags. A cross target needs the
   * same compile with a different driver, so the rule is stated once.
   *
   * @param tuFile - The .c/.cpp file to compile
   * @param sourceRootDir - The fixture's source root: the directory every
   *        unit's self-include is relative to, which is the ENTRY's directory
   *        and the same for every unit in the fixture (#1544)
   * @param rootDir - The tree whose `tests/include` is on the path: the
   *        project, or a cross target's mirror of it
   * @param mode - The mode the harness is compiling this fixture in (#1557)
   * @param toolchain - The target's GCC (`TargetMatrix.toolchainFor`)
   * @param strict - Whether the fixture is `// test-no-warnings`
   */
  static compileTranslationUnit(
    tuFile: string,
    sourceRootDir: string,
    rootDir: string,
    mode: TTestMode,
    toolchain: IGccToolchain,
    strict: boolean,
  ): IValidationResult {
    try {
      const compilerConfig = TestUtils.getCompilerConfig(mode, tuFile);
      // The vendored CMSIS-Core header, configured as every C++ Cortex build
      // must: CMSIS's own startup helper (`__cmsis_start`) is not valid C++
      // under GCC 13, in CMSIS 5.9.0 and 6.1.0 alike, and `__PROGRAM_START` is
      // CMSIS's documented hook for a project that supplies its own startup.
      // It removes only that helper; every intrinsic generated code calls stays.
      // What a user is told about it is #1763.
      const cmsis = toolchain.cmsisCore
        ? [
            "-I",
            TargetMatrix.cmsisIncludeDir(PROJECT_ROOT),
            "-D__PROGRAM_START",
          ]
        : [];
      execFileSync(
        toolchain.driverPrefix + compilerConfig.compiler,
        [
          ...toolchain.archFlags,
          "-c",
          "-o",
          "/dev/null",
          ...(strict ? ["-O3"] : []),
          compilerConfig.stdFlag,
          ...(strict ? ["-Wall", "-Wextra"] : []),
          ...TestUtils.nullPointerConstantFlags(
            compilerConfig.compiler,
            toolchain,
          ),
          "-Werror",
          ...cmsis,
          ...TestUtils.fixtureCompileFlags(sourceRootDir, rootDir),
          tuFile,
        ],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );
      return { valid: true };
    } catch (error: unknown) {
      const failure = ExecFailure.of(error);
      const output = failure.stderr || failure.stdout || failure.message;
      const warnings = output
        .split("\n")
        .filter(
          (line) =>
            line.includes("warning:") ||
            line.includes("error:") ||
            line.includes("sorry, unimplemented:"),
        )
        .map((line) => line.replace(tuFile + ":", ""))
        .slice(0, 5)
        .join("\n");
      return {
        valid: false,
        message: `${basename(tuFile)}: ${warnings || output.split("\n")[0]}`,
      };
    }
  }

  /**
   * Compile every translation unit a fixture's run generated, stopping at the
   * first that fails.
   *
   * Issue #1553: the entry alone is not the fixture. `-c` compiles one
   * translation unit, so a helper's implementation reached a compiler only at
   * the execution link step -- which passes neither -Wall nor -Werror -- and
   * the marker reported success over files it had never compiled. That is the
   * #1143 shape: a guard green on a check that does not run. Every unit the
   * fixture generates is compiled here, under identical flags.
   *
   * @param entryImpl - The entry's implementation file
   * @param helperImplFiles - Helper implementations the fixture also generates
   * @param rootDir - As `compileTranslationUnit`
   * @param mode - The mode the harness is compiling this fixture in (#1557)
   * @param toolchain - The target's GCC
   * @param strict - Whether the fixture is `// test-no-warnings`
   */
  static compileProgram(
    entryImpl: string,
    helperImplFiles: readonly string[],
    rootDir: string,
    mode: TTestMode,
    toolchain: IGccToolchain,
    strict: boolean,
  ): IValidationResult {
    const sourceRootDir = dirname(entryImpl);
    for (const translationUnit of [entryImpl, ...helperImplFiles]) {
      const result = TestUtils.compileTranslationUnit(
        translationUnit,
        sourceRootDir,
        rootDir,
        mode,
        toolchain,
        strict,
      );
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  /**
   * The host cell (#1668 box 15): every unit compiled with the build
   * machine's GCC, then, for a `test-execution` fixture, linked and run. What
   * the run printed is kept on `result` for the C/C++ parity check.
   */
  private static hostCell(
    cnxFile: string,
    source: string,
    mode: TTestMode,
    entryImpl: string,
    helperImplFiles: readonly string[],
    rootDir: string,
    strict: boolean,
    xfails: readonly ITargetXfail[],
    result: IModeResult,
  ): ITargetCell {
    const compiled = TestUtils.compileProgram(
      entryImpl,
      helperImplFiles,
      rootDir,
      mode,
      TargetMatrix.hostToolchain(),
      strict,
    );
    if (!compiled.valid) {
      const settled = TestUtils.settleCell(
        TargetMatrix.HOST,
        mode,
        `${mode.toUpperCase()} compilation failed: ${compiled.message}`,
        "compiled",
        xfails,
      );
      if (
        settled.outcome !== "xfail" ||
        !TestMarkers.has("test-execution", source)
      ) {
        return settled;
      }
      // #1760 second review: the marker waives the -Werror compile, not the
      // execution. The program still links and runs -- without -Werror, as
      // `executeOnHost` builds it -- and must pass, unless the marker covers
      // that failure too: a host with no implementation cannot build it at
      // all (#1147), where a warning's marker cannot (#1062's quotes one).
      const failure = TestUtils.executeOnHost(
        cnxFile,
        source,
        entryImpl,
        helperImplFiles,
        rootDir,
        mode,
        result,
      );
      if (failure === null) {
        return { ...settled, executed: true };
      }
      const execution = TestUtils.settleCell(
        TargetMatrix.HOST,
        mode,
        failure,
        "executed",
        xfails,
      );
      return execution.outcome === "xfail" ? settled : execution;
    }
    if (!TestMarkers.has("test-execution", source)) {
      return TestUtils.settleCell(
        TargetMatrix.HOST,
        mode,
        null,
        "compiled",
        xfails,
      );
    }
    const failure = TestUtils.executeOnHost(
      cnxFile,
      source,
      entryImpl,
      helperImplFiles,
      rootDir,
      mode,
      result,
    );
    return TestUtils.settleCell(
      TargetMatrix.HOST,
      mode,
      failure,
      "executed",
      xfails,
    );
  }

  /**
   * Link a fixture's units with the host GCC and run the program. Returns why
   * it failed, or null; what it printed is kept on `result`.
   */
  private static executeOnHost(
    cnxFile: string,
    source: string,
    entryImpl: string,
    helperImplFiles: readonly string[],
    rootDir: string,
    mode: TTestMode,
    result: IModeResult,
  ): string | null {
    const compilerConfig = TestUtils.getCompilerConfig(mode, entryImpl);
    const execPath = TestUtils.getExecutablePath(cnxFile);
    const sourceFiles: string[] = [
      entryImpl,
      ...helperImplFiles,
      ...TestUtils.findLinkedSourceFiles(cnxFile, source),
    ];
    try {
      execFileSync(
        compilerConfig.compiler,
        [
          compilerConfig.stdFlag,
          ...TestUtils.fixtureCompileFlags(dirname(entryImpl), rootDir),
          "-o",
          execPath,
          ...sourceFiles,
        ],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );
    } catch (compileError: unknown) {
      const failure = ExecFailure.of(compileError);
      return `${mode.toUpperCase()} compile for execution failed: ${failure.stderr || failure.message}`;
    }
    try {
      result.stdout = execFileSync(execPath, [], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });
      return null;
    } catch (execError: unknown) {
      const failure = ExecFailure.of(execError);
      result.stdout = failure.stdout;
      return `${mode.toUpperCase()} execution failed with exit code ${failure.status || 1}`;
    } finally {
      try {
        if (existsSync(execPath)) unlinkSync(execPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * A compile-only cell: the fixture's units, as generated for `target`,
   * compiled with that target's GCC. Used for a program that names its own
   * target, which is compiled for it in place.
   */
  private static compileCell(
    target: string,
    mode: TTestMode,
    entryImpl: string,
    helperImplFiles: readonly string[],
    rootDir: string,
    strict: boolean,
    xfails: readonly ITargetXfail[],
    toolchain: IGccToolchain | string,
  ): ITargetCell {
    // #1760 second review: a cell nothing compiles is a failure. It passed
    // as "not compiled", so a fixture could run with no compiler at all; a
    // fixture that must not be compiled says so with `test-transpile-only`.
    if (typeof toolchain === "string") {
      const marked = xfails.some(
        (xfail) => xfail.target === TestUtils.catalogName(target),
      );
      return {
        target,
        mode,
        outcome: "failed",
        detail: marked
          ? `\`// test-target-xfail\` marks ${target}, which nothing compiles for (${toolchain}); remove the marker`
          : `nothing compiles for ${target} (${toolchain}); mark the fixture \`// test-transpile-only\` if it is not to be compiled`,
      };
    }
    const compiled = TestUtils.compileProgram(
      entryImpl,
      helperImplFiles,
      rootDir,
      mode,
      toolchain,
      strict,
    );
    return TestUtils.settleCell(
      target,
      mode,
      compiled.valid
        ? null
        : `${target} ${mode.toUpperCase()} compile failed: ${compiled.message}`,
      "compiled",
      xfails,
    );
  }

  /**
   * A cross target's cell (#1668 box 15): the fixture transpiled for the
   * target in that target's mirror of \`tests/\`, and every unit it generated
   * compiled with the target's GCC against its real library.
   */
  private static crossCell(
    cnxFile: string,
    mode: TTestMode,
    target: string,
    rootDir: string,
    mirrors: Record<string, string> | undefined,
    strict: boolean,
    xfails: readonly ITargetXfail[],
  ): ITargetCell {
    const mirror = mirrors?.[target];
    if (mirror === undefined) {
      return {
        target,
        mode,
        outcome: "failed",
        detail: `no mirror of tests/ for ${target}: the runner creates one per cross target before any fixture runs`,
      };
    }
    const mirrored = join(mirror, relative(join(rootDir, "tests"), cnxFile));
    // The mirror's own root, as `targetDependentDiagnostics` renders against
    // (#1760 second review: the project root printed `../../tmp/cnx-matrix-…`)
    const root = dirname(mirror);
    const transpile = transpileViaCli(mirrored, mode === "cpp", {
      target,
      root,
    });
    if (!transpile.success) {
      const errors = transpile.errors
        .map((e) => renderDiagnostic(e, mirrored, root))
        .join("\n");
      return TestUtils.settleCell(
        target,
        mode,
        `transpile for ${target} failed: ${errors || transpile.stderr}`,
        "compiled",
        xfails,
      );
    }
    const dependent = TestUtils.targetDependentOutput(
      target,
      [...transpile.generatedImplPaths, ...transpile.generatedHeaderPaths],
      mirror,
      rootDir,
    );
    if (dependent !== null) {
      return { target, mode, outcome: "failed", detail: dependent };
    }
    const entryImpl = mirrored.replace(
      /\.cnx$/,
      mode === "cpp" ? ".cpp" : ".c",
    );
    return TestUtils.compileCell(
      target,
      mode,
      entryImpl,
      transpile.generatedImplPaths.filter((path) => path !== entryImpl),
      dirname(mirror),
      strict,
      xfails,
      TargetMatrix.toolchainFor(target),
    );
  }

  /**
   * #1668 (addendum A6.6): a program that names no target generates the same
   * C for every target, so one snapshot set holds for all of them. A file the
   * cross transpile wrote that differs from the host's means the output
   * depends on the target, and the fixture must pin one with
   * \`#pragma target\`. No marker excuses it: a dependence on the target is
   * not an expected bug.
   */
  private static targetDependentOutput(
    target: string,
    generated: readonly string[],
    mirror: string,
    rootDir: string,
  ): string | null {
    for (const path of generated) {
      const relativePath = relative(mirror, path);
      const hostPath = join(rootDir, "tests", relativePath);
      const same =
        existsSync(hostPath) &&
        readFileSync(hostPath, "utf-8") === readFileSync(path, "utf-8");
      if (!same) {
        return `target-dependent output: tests/${relativePath} differs for ${target} -- pin the fixture with \`#pragma target\`, or make its output target-independent`;
      }
    }
    return null;
  }

  /**
   * The same for a \`test-error\` fixture's diagnostics: each cross target
   * transpiles it in its mirror and must report exactly what the host did.
   * A pinned fixture passes trivially, because its pin decides both runs; a
   * \`// test-no-target\` fixture is about where the target comes from, so it
   * is not run for a named one.
   */
  private static targetDependentDiagnostics(
    cnxFile: string,
    source: string,
    cppMode: boolean,
    hostDiagnostics: string,
    rootDir: string,
    mirrors: Record<string, string> | undefined,
  ): string | null {
    if (mirrors === undefined || TestMarkers.has("test-no-target", source)) {
      return null;
    }
    for (const target of TargetMatrix.CROSS) {
      const mirror = mirrors[target];
      if (mirror === undefined) {
        return `no mirror of tests/ for ${target}: the runner creates one per cross target before any fixture runs`;
      }
      const mirrored = join(mirror, relative(join(rootDir, "tests"), cnxFile));
      const root = dirname(mirror);
      const result = transpileViaCli(mirrored, cppMode, { target, root });
      const diagnostics = result.success
        ? "(no errors)"
        : result.errors
            .map((e) => renderDiagnostic(e, mirrored, root))
            .join("\n");
      if (
        TestUtils.normalize(diagnostics) !==
        TestUtils.normalize(hostDiagnostics)
      ) {
        return `target-dependent diagnostics: ${target} reports\n${diagnostics}\n-- pin the fixture with \`#pragma target\`, or make its diagnostics target-independent`;
      }
    }
    return null;
  }

  /**
   * A cell's outcome once its \`// test-target-xfail\` marker, if any, is
   * applied: a marked cell must fail (#1668 box 12, "it must still fail"), and
   * an unmarked one must not.
   */
  static settleCell(
    target: string,
    mode: TTestMode,
    failure: string | null,
    passed: "executed" | "compiled",
    xfails: readonly ITargetXfail[],
  ): ITargetCell {
    const xfail = xfails.find(
      (candidate) =>
        candidate.target === TestUtils.catalogName(target) &&
        (candidate.mode === undefined || candidate.mode === mode),
    );
    if (xfail === undefined) {
      return failure === null
        ? { target, mode, outcome: passed }
        : { target, mode, outcome: "failed", detail: failure };
    }
    if (failure === null) {
      return {
        target,
        mode,
        outcome: "failed",
        detail: `\`// test-target-xfail: ${xfail.target} #${xfail.issue}\` expects ${target} to fail, and it passed: remove the marker and update #${xfail.issue}`,
      };
    }
    if (xfail.expect !== undefined && !failure.includes(xfail.expect)) {
      return {
        target,
        mode,
        outcome: "failed",
        detail: `\`// test-target-xfail\` expects ${target} to fail with "${xfail.expect}" (#${xfail.issue}), and it failed otherwise: ${failure}`,
      };
    }
    return {
      target,
      mode,
      outcome: "xfail",
      detail: `#${xfail.issue}: ${failure}`,
    };
  }

  /** The catalog row a target name resolves to, aliases included */
  private static catalogName(target: string): string {
    return (
      TargetResolver.byName(target, NodeFileSystem.instance)?.name ?? target
    );
  }

  /**
   * The fixture's \`// test-target-xfail\` markers, or why one is malformed.
   *
   * \`// test-target-xfail: <target>... [c|cpp] #<issue> ["<text>"]\`: each
   * named target's cells must fail until the issue is fixed -- in the named
   * mode only, when one is given, and with a failure containing the quoted
   * text, when one is given. A marker must name an issue, so an expected
   * failure always says what fixes it.
   */
  static targetXfails(source: string): ITargetXfail[] | string {
    const xfails: ITargetXfail[] = [];
    for (const match of source.matchAll(
      TestMarkers.globalSpellingOf("test-target-xfail"),
    )) {
      const argument = match[1].trim();
      const usage = `\`// test-target-xfail: ${argument}\` must name targets, an optional mode, an issue and an optional quoted failure text, e.g. \`// test-target-xfail: avr cpp #1234 "shift count"\``;
      const quoted = /^(.*?)[ \t]+"([^"]+)"$/.exec(argument);
      const words = (quoted?.[1] ?? argument).split(/[ \t]+/);
      const issue = /^#(\d+)$/.exec(words.at(-1) ?? "");
      if (issue === null || words.length < 2) {
        return usage;
      }
      const modes = words.filter(
        (word): word is TTestMode => word === "c" || word === "cpp",
      );
      if (modes.length > 1) {
        return usage;
      }
      const targets = words
        .slice(0, -1)
        .filter((word) => word !== "c" && word !== "cpp");
      if (targets.length === 0) {
        return usage;
      }
      for (const target of targets) {
        const description = TargetResolver.byName(
          target,
          NodeFileSystem.instance,
        );
        if (description === undefined) {
          return `\`// test-target-xfail: ${argument}\` names '${target}', which is not a catalog target`;
        }
        xfails.push({
          target: description.name,
          mode: modes.at(0),
          issue: Number(issue[1]),
          ...(quoted === null ? {} : { expect: quoted[2] }),
        });
      }
    }
    return xfails;
  }

  /**
   * Find helper .cnx files that are included by a test file
   * Parses the source for #include <file.cnx> or #include "file.cnx" directives
   * Only returns files in the same directory as the test (for cross-file execution)
   */
  static findHelperCnxFiles(testFile: string, source?: string): string[] {
    const testDir = dirname(testFile);
    const helperFiles: string[] = [];

    // If source is provided, parse it for .cnx includes
    if (source) {
      // Match #include <file.cnx> or #include "file.cnx"
      const includeRegex = /#include\s*[<"]([^>"]+\.cnx)[>"]/g;
      let match;
      while ((match = includeRegex.exec(source)) !== null) {
        const includedFile = match[1];
        // Check if the file exists in the test directory
        const fullPath = join(testDir, includedFile);
        if (existsSync(fullPath) && !includedFile.endsWith(".test.cnx")) {
          helperFiles.push(fullPath);
        }
      }
    }

    return helperFiles;
  }

  /**
   * Issue #1219: ADRs a fixture declares it exercises.
   *
   * Marker form: `// test-adr: 051, 057` -- consistent with the
   * `test-execution` / `test-link:` family, and deliberately NOT the prose
   * `// ADR-051: ...` convention 414 fixtures already use. Prose mentions
   * include references that are not coverage claims
   * (`// NOTE (ADR-063 / #1117): these calls used to be written ...`), so
   * treating them as a contract would over-claim.
   *
   * Intent is the one fact in the matrix that is NOT derivable: a fixture's
   * structure shows that it CONTAINS a division, never that its purpose is
   * proving the division check fires. The cell it occupies stays derived.
   *
   * @returns zero-padded three-digit ADR numbers, deduplicated, in source order
   */
  static findAdrReferences(source: string): string[] {
    // The spelling is the vocabulary's; only the argument parsing is this
    // function's. A global copy is built here because a shared /g regex
    // carries lastIndex between calls (#1555).
    const adrRegex: RegExp = TestMarkers.globalSpellingOf("test-adr");
    const found: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = adrRegex.exec(source)) !== null) {
      const ids: string[] = match[1]
        .split(",")
        .map((id: string) => id.trim())
        .filter(Boolean);
      for (const id of ids) {
        const digits: RegExpExecArray | null = /^(?:ADR-)?(\d{1,3})$/i.exec(id);
        if (digits === null) continue;
        const normalized: string = digits[1].padStart(3, "0");
        if (!found.includes(normalized)) found.push(normalized);
      }
    }

    return found;
  }

  static findLinkedSourceFiles(testFile: string, source: string): string[] {
    const testDir: string = dirname(testFile);
    const linkedFiles: string[] = [];
    const linkRegex: RegExp = TestMarkers.globalSpellingOf("test-link");
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(source)) !== null) {
      const files: string[] = match[1].split(/\s+/).filter(Boolean);
      for (const file of files) {
        linkedFiles.push(join(testDir, file));
      }
    }

    return linkedFiles;
  }

  /**
   * Issue #1488: every `.cnx` this fixture's run will read or rewrite --
   * its helpers, and their helpers, transitively.
   *
   * A fixture's entry run writes its dependencies' generated files in place, so
   * two fixtures sharing any of these write the same generated `.h` at once.
   * The snapshot comparison and the compile then read a file mid-rewrite -- the
   * same commit failing on CI and passing on re-run, with the blame landing on
   * whichever pull request happened to be running.
   *
   * #1544 removed the standalone helper re-transpile this used to name as the
   * second writer. That halved the writers per file and did not remove the
   * race: a shared helper is still written by every fixture that includes it,
   * once per mode, and the lock is still what orders them.
   *
   * The scheduler treats this set as a lock: a fixture starts only when no
   * in-flight fixture holds a file in it. Answering too narrowly lets the race
   * back in; answering too broadly costs parallelism, which is why this is the
   * fixture's actual include closure rather than its directory. Locking by
   * directory instead was measured at 40.5s -> 51.3s on 1156 fixtures, because
   * one helper used by one fixture then locked all 30 in `tests/switch`.
   *
   * The closure is transitive because the entry's pipeline writes headers for
   * transitive dependencies too, and any of those may be some OTHER fixture's
   * direct helper -- comparing direct helpers alone would miss exactly that
   * pairing.
   *
   * Built on findHelperCnxFiles so the scheduler and the guard cannot disagree
   * about what a helper is.
   */
  static helperClosure(testFile: string): string[] {
    const seen = new Set<string>();
    const visit = (file: string): void => {
      let source: string;
      try {
        source = readFileSync(file, "utf-8");
      } catch {
        return;
      }
      for (const helper of TestUtils.findHelperCnxFiles(file, source)) {
        if (seen.has(helper)) {
          continue;
        }
        seen.add(helper);
        visit(helper);
      }
    };
    visit(testFile);
    return [...seen];
  }

  /**
   * A dependency's generated file paired with the snapshot beside it.
   *
   * #1521: 60 `.expected.*` files were compared by nothing, and 48 of them had
   * gone stale. The harness walks `*.test.cnx`, so a HELPER -- a plain `.cnx`
   * pulled in by an entry -- has no fixture of its own to drive a comparison.
   * Its `.expected.h` sat beside it looking exactly like a snapshot and
   * asserting nothing: `chain-types-base.expected.h` still said
   * `typedef struct Coordinate` long after the generator began emitting
   * `ChainTypesBase__Coordinate`, with the suite green.
   *
   * CLAUDE.md records the reason those files exist -- "Helper files: Create
   * `.expected.h` to prevent test framework cleanup" -- which makes them
   * cleanup MARKERS. A marker named `.expected.*` in a repository where every
   * other `.expected.*` is an assertion is a trap, so they become assertions
   * rather than being renamed: a compared file is not a cleanup candidate
   * either, so the reason they were created still holds.
   *
   * Only paths that already HAVE a snapshot are returned. A dependency without
   * one is not made to grow one -- that is the author's call, and #1149's
   * orphans show what unasked-for snapshots become.
   */
  static helperSnapshotPairs(
    generatedPaths: readonly string[],
  ): { generated: string; snapshot: string }[] {
    const pairs: { generated: string; snapshot: string }[] = [];
    for (const generated of generatedPaths) {
      const snapshot = generated.replace(/\.(c|cpp|h|hpp)$/, ".expected.$1");
      if (snapshot !== generated && existsSync(snapshot)) {
        pairs.push({ generated, snapshot });
      }
    }
    return pairs;
  }

  /**
   * `absolute path -> sha256` for each path that exists (#1544).
   *
   * A path that was reported but is absent is simply omitted rather than
   * recorded as empty: "this run wrote nothing here" and "this run wrote an
   * empty file" are different claims, and only the second is a disagreement
   * worth failing on.
   */
  static digestFiles(paths: readonly string[]): Record<string, string> {
    const digests: Record<string, string> = {};
    for (const path of paths) {
      if (!existsSync(path)) continue;
      digests[path] = createHash("sha256")
        .update(readFileSync(path))
        .digest("hex");
    }
    return digests;
  }

  /**
   * The first dependency two fixtures disagree about (#1544).
   *
   * `seen` maps a dependency's path to the fixture that wrote it and what it
   * wrote. A helper shared by two entries must generate identical bytes for
   * both, because only one file survives on disk: whichever ran last is what
   * gets committed, and the other fixture is then validated against output its
   * own program did not produce.
   *
   * Both fixtures are named. Reporting only the second is the #1488 shape --
   * the failure lands on whichever the scheduler happened to run later, which
   * is the one piece of information that does not identify the defect.
   */
  static findDependencyDisagreement(
    fixture: string,
    digests: Record<string, string>,
    seen: Map<string, { fixture: string; digest: string }>,
  ): string | null {
    for (const [path, digest] of Object.entries(digests)) {
      const previous = seen.get(path);
      if (!previous) {
        seen.set(path, { fixture, digest });
        continue;
      }
      if (previous.digest === digest) continue;
      return (
        `Dependency disagreement: ${basename(path)} is generated differently ` +
        `by two fixtures that share it -- ${basename(previous.fixture)} and ` +
        `${basename(fixture)}. Only one file survives on disk, so whichever ` +
        `runs last is what gets committed. A helper whose output depends on ` +
        `its includer needs one owning fixture, not two.`
      );
    }
    return null;
  }

  /**
   * The first dependency whose snapshot disagrees with what was generated.
   *
   * Reported like any other snapshot mismatch, because that is what it is --
   * the only thing that made it different was that nothing looked.
   */
  static findHelperSnapshotMismatch(
    generatedPaths: readonly string[],
  ): { error: string; expected: string; actual: string } | null {
    for (const { generated, snapshot } of TestUtils.helperSnapshotPairs(
      generatedPaths,
    )) {
      if (!existsSync(generated)) continue;
      const actual = readFileSync(generated, "utf-8");
      const expected = readFileSync(snapshot, "utf-8");
      if (TestUtils.normalize(actual) === TestUtils.normalize(expected)) {
        continue;
      }
      return {
        error:
          `Dependency snapshot mismatch: ${basename(snapshot)}` +
          TestUtils.describeFirstDifference(
            TestUtils.normalize(expected),
            TestUtils.normalize(actual),
          ),
        expected,
        actual,
      };
    }
    return null;
  }

  /**
   * Run a test in a single mode (C or C++)
   *
   * This handles transpilation, snapshot comparison, header validation,
   * compilation, and execution for ONE specific mode.
   *
   * @param cnxFile - Path to the .test.cnx file
   * @param source - Source code content
   * @param mode - The test mode ('c' or 'cpp')
   * @param updateMode - Whether to update snapshots
   * @param tools - Available validation tools
   * @param rootDir - Project root directory
   * @param options - Test execution options (transpileOnly)
   */
  static async runTestMode(
    cnxFile: string,
    source: string,
    mode: TTestMode,
    updateMode: boolean,
    tools: ITools,
    rootDir: string,
    options: ITestOptions = {},
  ): Promise<IModeResult> {
    const basePath = cnxFile.replace(/\.test\.cnx$/, "");
    const paths = TestUtils.getExpectedPaths(basePath, mode);

    // Initialize result
    const result: IModeResult = {
      mode,
      transpileSuccess: false,
      snapshotMatch: false,
      headerMatch: false,
      compileSuccess: false,
      execSuccess: false,
    };

    // Expected file paths
    const expectedImplPath = paths.expectedImpl;
    const expectedHeaderPath = paths.expectedHeader;

    // Always transpile via CLI: every test is re-transpiled in the same pass
    // that compiles and executes it, so a stale .cnx can never be silently
    // validated against pre-existing generated files (Issue #1018).
    const transpileResult = transpileViaCli(cnxFile, mode === "cpp");

    if (!transpileResult.success) {
      const errors = transpileResult.errors
        .map((e) => renderDiagnostic(e, cnxFile))
        .join("\n");
      result.error = `Transpilation failed: ${errors || transpileResult.stderr}`;
      return result;
    }

    const targetProblem = TestUtils.targetProblem(
      readFileSync(cnxFile, "utf-8"),
      transpileResult.target,
    );
    if (targetProblem) {
      result.error = targetProblem;
      return result;
    }

    result.transpileSuccess = true;

    // Issue #1314: a fixture that includes a `.hpp` makes the transpiler
    // auto-select C++, so a C-mode run writes no `.c` at all. Without this the
    // run silently validates whatever `.c` happens to be lying in the directory
    // -- which is how seven dead snapshots stayed green for months. The fixture
    // is a C++ interop test and must say so.
    // A block that cannot be parsed is a harness fault and must be loud. Skipping the check
    // here would restore exactly #1314: the path falls back to the GUESSED `.c`, the
    // run reads whatever `.c` is on disk, and it goes silently green again. The CLI
    // prints this block unconditionally on the success path (Runner.ts:65 ->
    // ResultPrinter.print), so an empty parse means its format moved, not that it
    // was asked to be quiet -- there is no --quiet flag.
    if (transpileResult.generatedImplPaths.length === 0) {
      result.error =
        "CLI reported no generated output files -- could not parse the " +
        "`Generated N output files:` block. Update " +
        "TestUtils.parseGeneratedImplPaths to match the CLI's output format.";
      return result;
    }

    if (mode === "c") {
      const wroteC = transpileResult.generatedImplPaths.some((implPath) =>
        implPath.endsWith(".c"),
      );
      if (!wroteC) {
        result.error =
          "C mode produced no .c file: the transpiler auto-detected C++ " +
          "(a .hpp include). Mark this fixture `// test-cpp-only` and remove " +
          "its C-side snapshots (.test.c/.test.h/.expected.c/.expected.h).";
        return result;
      }
    }

    // Every header this run wrote for something OTHER than the entry. The
    // entry's own is excluded because the code below already compares it.
    const dependencyHeaderPaths = transpileResult.generatedHeaderPaths.filter(
      (path) => path !== transpileResult.headerPath,
    );

    // #1544: the entry's run is the ONLY writer of a dependency's generated
    // files, and the impl paths below are what it reported writing.
    //
    // This harness used to re-transpile every helper `.cnx` standalone,
    // afterwards and to the same paths. Both runs emit correct output -- but
    // for DIFFERENT programs, and a generated signature can legitimately
    // depend on which program its file belongs to. A function wired to a C
    // callback typedef in another file keeps the typedef's parameter shape;
    // compiled alone, nothing wires it, so #268 auto-const applies and the
    // shape differs. Both headers are right. Only one path holds them.
    //
    // The standalone run went second, so the fixture compiled the entry's `.c`
    // from the multi-file program against the helper's `.h` from the
    // single-file one -- a pair no single transpile ever produced, failing on
    // an incompatible pointer type that neither program has. #1470 saw the two
    // runs disagree and reported it as a transpiler defect; the disagreement
    // was real and expected, and the defect was pairing them. Its comparison
    // goes with the second run, having nothing left to compare.
    //
    // Dropping that pass loses no coverage -- the entry's run already writes
    // every dependency's `.c` and `.h`, which is what these paths are. What it
    // does mean is that a helper's generated files belong to the program that
    // included them, so a helper shared by two fixtures whose programs
    // disagree would flip on disk between runs and fail `working tree clean`
    // depending on which ran last. The scheduler already serializes fixtures
    // sharing a helper closure (#1488), so such a flip would be ordered rather
    // than torn -- ordered and still wrong.
    //
    // 29 helpers are shared by two or more entries today and none of them
    // diverges -- measured by transpiling each includer into a clean copy and
    // comparing the helper's generated bytes, with committed artifacts purged
    // first so an aborted `test-error` transpile could not be hashed instead.
    // That is a property of today's corpus, not of the design, so it is
    // asserted rather than remembered: `dependencyDigests` records what this
    // run wrote for each dependency, and the parent fails the suite if two
    // fixtures disagree about one. A helper whose output depends on its
    // includer needs one owning fixture, not two.
    const helperImplFiles = transpileResult.generatedImplPaths.filter(
      (path) => path !== expectedImplPath && path !== paths.tempImpl,
    );

    // #1521: every file this run generated for something OTHER than the entry.
    // The entry's own two are excluded because the code below already compares
    // them -- including them here would give one file two comparisons and two
    // ways to report the same failure.
    const dependencySnapshotPaths = [
      ...dependencyHeaderPaths,
      ...helperImplFiles,
    ];

    // #1544: read back what this run wrote for each dependency. Hashed here,
    // where the paths are already known and the bytes are this fixture's --
    // the scheduler holds the closure lock for the whole run, so nothing else
    // can have rewritten them in between.
    result.dependencyDigests = TestUtils.digestFiles(dependencySnapshotPaths);

    // Update mode: create/update snapshots, then validate them like any other run.
    //
    // Issue #1485: this branch used to set `compileSuccess`/`execSuccess` to true
    // and return, which recorded two successes nothing was ever asked about. The
    // compiler was not invoked and no `test-execution` binary was run, so
    // `--update` reported `Passed` for generated C that gcc rejects -- on the one
    // command an author runs immediately after changing codegen, which is exactly
    // when output that does not compile is most likely. A guard that cannot fail on the
    // case it exists to catch is the `/* test-no-warnings */` shape (#1143).
    //
    // Falling through costs nothing: compilation below already runs against
    // `expectedImplPath`, which is the file just written here. The two snapshot
    // comparisons in between are no-ops in this mode -- they read back the bytes
    // this branch wrote -- so they need no special case, and the snapshot is on
    // disk for inspection even when compilation then fails, the same principle as
    // the #1316 branch for `test-error` fixtures.
    if (updateMode) {
      writeFileSync(paths.expectedImpl, transpileResult.code);
      if (transpileResult.headerCode) {
        writeFileSync(paths.expectedHeader, transpileResult.headerCode);
      }
      // #1521: a dependency's snapshot is refreshed by the same command that
      // refreshes the entry's. It was not, which is how 48 of them drifted
      // years out of date while `npm run test:update` reported everything
      // updated.
      for (const { generated, snapshot } of TestUtils.helperSnapshotPairs(
        dependencySnapshotPaths,
      )) {
        if (existsSync(generated)) {
          writeFileSync(snapshot, readFileSync(generated, "utf-8"));
        }
      }
    }

    // Computed AFTER the update write, so a fixture whose snapshot this run just
    // created is not reported missing by the check below.
    const hasExpectedImpl = existsSync(expectedImplPath);
    const hasExpectedHeader = existsSync(expectedHeaderPath);

    // No expected file - skip this mode
    if (!hasExpectedImpl) {
      result.error = `No expected file: ${paths.expectedImpl}`;
      return result;
    }

    // Compare implementation snapshot
    const expectedImpl = readFileSync(expectedImplPath, "utf-8");
    if (
      TestUtils.normalize(transpileResult.code) !==
      TestUtils.normalize(expectedImpl)
    ) {
      result.error =
        `${mode.toUpperCase()} output mismatch` +
        TestUtils.describeFirstDifference(
          TestUtils.normalize(expectedImpl),
          TestUtils.normalize(transpileResult.code),
        );
      result.expected = expectedImpl;
      result.actual = transpileResult.code;
      return result;
    }
    result.snapshotMatch = true;

    // Compare header snapshot (if headers were generated)
    if (transpileResult.headerCode) {
      if (!hasExpectedHeader) {
        result.error = `Missing ${expectedHeaderPath} - headers were generated but no snapshot exists`;
        return result;
      }
      const expectedHeader = readFileSync(expectedHeaderPath, "utf-8");
      if (
        TestUtils.normalize(transpileResult.headerCode) !==
        TestUtils.normalize(expectedHeader)
      ) {
        result.error =
          `${mode.toUpperCase()} header mismatch` +
          TestUtils.describeFirstDifference(
            TestUtils.normalize(expectedHeader),
            TestUtils.normalize(transpileResult.headerCode),
          );
        result.expected = expectedHeader;
        result.actual = transpileResult.headerCode;
        return result;
      }
    }
    result.headerMatch = true;

    // #1521: the dependencies' snapshots, checked exactly like the entry's.
    // Nothing about them was ever different except that nothing looked.
    const dependencyMismatch = TestUtils.findHelperSnapshotMismatch(
      dependencySnapshotPaths,
    );
    if (dependencyMismatch) {
      result.error = dependencyMismatch.error;
      result.expected = dependencyMismatch.expected;
      result.actual = dependencyMismatch.actual;
      return result;
    }

    // transpileOnly mode: Skip compilation and execution
    if (options.transpileOnly) {
      result.compileSuccess = true;
      result.execSuccess = true;
      result.skippedExec = true;
      result.skipReason = "transpile-only";
      return result;
    }

    // Skip compilation for transpile-only tests (per-file marker)
    const isTranspileOnly = TestUtils.hasTranspileOnlyMarker(source);
    if (isTranspileOnly) {
      result.compileSuccess = true;
      result.execSuccess = true;
      result.skippedExec = true;
      result.skipReason = "transpile-only";
      // No cleanup needed for helper files
      return result;
    }

    // #1668 box 15: which targets this mode runs under is the program's own
    // answer, as the transpiler reported it. A program that names a target --
    // a pragma, a helper's pragma, an inline description, `platformio.ini` --
    // runs for that target alone. One that names none ran for the host (the
    // harness's option decided), and also runs for every cross target.
    const reported = transpileResult.target;
    if (reported === undefined) {
      result.error =
        "CLI reported no target -- could not parse its `Target: <name> " +
        "(<source>)` line. Update TestUtils.parseTarget to match.";
      return result;
    }
    const xfails = TestUtils.targetXfails(source);
    if (typeof xfails === "string") {
      result.error = xfails;
      return result;
    }
    const strict = TestUtils.hasNoWarningsMarker(source);
    const execution = TestMarkers.has("test-execution", source);

    // No compiler, nothing to compile or run: the runner refuses to start
    // without gcc unless it was asked to transpile only, so this is a caller
    // that compares snapshots and nothing else
    if (!tools.gcc) {
      result.compileSuccess = true;
      result.execSuccess = true;
      return result;
    }

    const cells: ITargetCell[] = [];
    if (reported.name === TargetMatrix.HOST) {
      cells.push(
        TestUtils.hostCell(
          cnxFile,
          source,
          mode,
          expectedImplPath,
          helperImplFiles,
          rootDir,
          strict,
          xfails,
          result,
        ),
      );
      if (reported.source === "option") {
        for (const target of TargetMatrix.CROSS) {
          cells.push(
            TestUtils.crossCell(
              cnxFile,
              mode,
              target,
              rootDir,
              options.targetMirrors,
              strict,
              xfails,
            ),
          );
        }
      }
    } else {
      // Compiled for its own target, in place, and not run: this machine is
      // not that target
      cells.push(
        TestUtils.compileCell(
          reported.name,
          mode,
          expectedImplPath,
          helperImplFiles,
          rootDir,
          strict,
          xfails,
          reported.name === RunTarget.INLINE_NAME
            ? TargetMatrix.toolchainForInline([
                ...TestUtils.findHelperCnxFiles(cnxFile, source).map(
                  (helper) => ({
                    sourcePath: helper,
                    source: readFileSync(helper, "utf-8"),
                  }),
                ),
                { sourcePath: cnxFile, source },
              ])
            : TargetMatrix.toolchainFor(reported.name),
        ),
      );
      if (execution) {
        result.skippedExec = true;
        result.skipReason = "target";
      }
    }
    result.cells = cells;

    const host = cells.find((cell) => cell.target === TargetMatrix.HOST);
    if (execution && host?.outcome === "xfail" && host.executed !== true) {
      result.skippedExec = true;
      result.skipReason = "xfail";
    }

    const failed = cells.find((cell) => cell.outcome === "failed");
    if (failed !== undefined) {
      result.error = failed.detail;
      return result;
    }
    result.compileSuccess = true;
    result.execSuccess = true;
    // No cleanup needed for helper files
    return result;
  }

  /**
   * Run a single test file in dual-mode (C and C++)
   *
   * This is the core test runner logic, shared between test.ts (sequential mode)
   * and test-worker.ts (parallel mode).
   *
   * Default behavior: Run BOTH C and C++ modes
   * - `// test-c-only`: Skip C++ mode (MISRA-specific tests)
   * - `// test-cpp-only`: Skip C mode (C++ interop tests)
   *
   * @param cnxFile - Path to the .test.cnx file
   * @param updateMode - Whether to update snapshots
   * @param tools - Available validation tools
   * @param rootDir - Project root directory
   * @param options - Test execution options (transpileOnly)
   */
  static async runTest(
    cnxFile: string,
    updateMode: boolean,
    tools: ITools,
    rootDir: string,
    options: ITestOptions = {},
  ): Promise<ITestResult> {
    const source = readFileSync(cnxFile, "utf-8");

    // Issue #322, generalized by #1555: a marker written in a spelling the
    // harness does not read. #322 guarded exactly one marker in exactly one
    // wrong spelling; the vocabulary knows every marker, so the check is now
    // "is this line trying to be a marker, and is it spelled like one".
    const misspelled = TestMarkers.findUnrecognizedSpellings(source);
    if (misspelled.length > 0) {
      const first = misspelled[0];
      return {
        passed: false,
        message:
          `Unrecognized spelling of "${first.marker}" at line ${first.line}: ` +
          `${first.text} -- markers are line comments, e.g. "// ${first.marker}"`,
      };
    }

    const basePath = cnxFile.replace(/\.test\.cnx$/, "");
    const expectedErrorFile = basePath + ".expected.error";

    // Determine which modes to run (default: BOTH C and C++)
    const modes = TestUtils.getTestModes(source);
    // #1508 needed the TRANSITIVE closure here, not the entry's direct
    // includes: a fixture calling a function two hops away emitted correct C
    // and still died at `undefined reference`, because the file defining the
    // symbol was never handed to the compiler. #1544 removed the walk rather
    // than the requirement -- the compiler now receives what the entry's own
    // run reported writing, which is transitive by construction because the
    // pipeline compiled those files. One fact, reported by the pass that knows
    // it, instead of a second walk that had to be kept in step.
    //
    // `helperClosure` itself remains: the #1488 scheduler lock in test.ts is
    // its caller, and locking still needs the closure as a SET of paths rather
    // than as generated output.

    // Error tests: single-mode, but NOT mode-independent any more. #1319 made
    // "does this run emit C++?" a declared fact with its own diagnostic
    // (E0507), so a fixture whose error needs a C++ context must be run in C++
    // mode or it reports E0507 instead of the error it asserts. The mode marker
    // is what says which, so it is honoured here rather than assumed to be C.
    // #1379: the marker is READ, not decoration. The runner used to decide
    // "is this an error fixture?" from the `.expected.error` file alone, so a
    // fixture declaring `// test-error` whose diagnostic did not fire was
    // snapshotted as an ordinary passing fixture -- `.expected.c` written, run
    // reported green. That is the documented TDD order for a diagnostic (write
    // the fixture, watch it fail, implement), and step two silently succeeded.
    //
    // #1316 fixed the TRANSITION -- an existing `.expected.error` unlinked and
    // rewritten as a `.expected.c`. It cannot fire here, because there was
    // never an `.expected.error` to transition away from.
    //
    // The marker and the file are two assertions of ONE fact, so they must
    // agree and disagreement is loud in both directions. Failing open in
    // either is a fixture that asserts nothing while looking like it does.
    const declaresError = TestMarkers.has("test-error", source);
    const hasErrorAssertion = existsSync(expectedErrorFile);

    if (!declaresError && hasErrorAssertion) {
      return {
        passed: false,
        message:
          "has a .expected.error but does not declare `// test-error` -- the " +
          "marker is what says the fixture is an error case; add it",
        expected: "// test-error",
        actual: "(marker absent)",
      };
    }

    if (declaresError || hasErrorAssertion) {
      // Guard: test-error cases must not have committed .test.* artifacts
      const staleArtifactCheck =
        TestUtils.checkForStaleErrorTestArtifacts(basePath);
      if (staleArtifactCheck) {
        return staleArtifactCheck;
      }

      return TestUtils.runErrorTest(
        cnxFile,
        source,
        options,
        basePath,
        expectedErrorFile,
        updateMode,
        rootDir,
        (modes as TTestMode[]).includes("cpp") &&
          !(modes as TTestMode[]).includes("c"),
      );
    }

    // Run each enabled mode (default: both C and C++)
    const modeResults: IModeResult[] = [];
    for (const mode of modes as TTestMode[]) {
      const modeResult = await TestUtils.runTestMode(
        cnxFile,
        source,
        mode,
        updateMode,
        tools,
        rootDir,
        options,
      );
      modeResults.push(modeResult);
    }

    // Aggregate results
    const aggregated = TestUtils.aggregateModeResults(
      modeResults,
      modes as TTestMode[],
      updateMode,
    );
    return TestUtils.withStrayXfailCheck(aggregated, source);
  }

  /**
   * A \`// test-target-xfail\` marker that matched no cell -- a target or mode
   * the fixture never runs -- could never fail, so it would outlive its bug
   * unseen. Checked across every mode at once: a per-mode check cannot see a
   * marker for a mode that never runs.
   */
  private static withStrayXfailCheck(
    result: ITestResult,
    source: string,
  ): ITestResult {
    const cells = result.cells ?? [];
    const xfails = TestUtils.targetXfails(source);
    if (!result.passed || cells.length === 0 || typeof xfails === "string") {
      return result;
    }
    const stray = xfails.find(
      (xfail) =>
        !cells.some(
          (cell) =>
            TestUtils.catalogName(cell.target) === xfail.target &&
            (xfail.mode === undefined || cell.mode === xfail.mode),
        ),
    );
    if (stray === undefined) {
      return result;
    }
    const mode = stray.mode === undefined ? "" : ` ${stray.mode}`;
    return {
      ...result,
      passed: false,
      message: `\`// test-target-xfail: ${stray.target}${mode} #${stray.issue}\` names a cell this fixture does not run; remove the marker`,
    };
  }

  /**
   * What a test-error fixture's generated output consists of.
   *
   * Read by the stale-artifact guard and by the `--update` cleanup below, so
   * "which files does a test-error fixture produce?" is answered in one place.
   */
  /**
   * What a *run* of an error fixture writes to disk, and therefore what the
   * #1316 update path removes after keeping the `.expected.error`.
   *
   * Deliberately NOT the snapshots. The #1316 branch writes a `.expected.c`
   * for inspection, so cleaning `expected.*` here would delete the file that
   * branch exists to produce.
   */
  private static readonly ERROR_TEST_RUN_OUTPUT_EXTENSIONS = [
    "test.c",
    "test.cpp",
    "test.h",
    "test.hpp",
  ];

  /**
   * What may not be COMMITTED beside an error fixture (#1379).
   *
   * The run outputs, plus the snapshots -- the same argument covers both and
   * the list used to make it about half. An error fixture stops at the
   * diagnostic and emits no generated output, so a `.expected.cpp` beside one
   * is compared against nothing and regenerated by nothing: it preserves
   * whatever codegen produced the day it was written, which is #1149's shape
   * where `snapshot-modes.test.ts` cannot see it -- that guard reasons about a
   * fixture's MODE and an error fixture has no mode to contradict.
   *
   * `expected.c` and `expected.h` are deliberately NOT here, and the asymmetry
   * is the whole point. `runErrorTest` deletes both at the start of every run,
   * so neither can survive as an orphan -- and #1316 writes the `.expected.c`
   * on purpose, for an author removing a diagnostic to inspect. Forbidding it
   * would fire on the very next run and report that file as stale, masking
   * #1316's message with an unrelated one on the re-run an author reaches for
   * immediately.
   *
   * The C++ pair had neither protection: nothing cleaned them and nothing
   * forbade them, which is why exactly one fixture in the corpus carried a
   * `.expected.cpp` and `.expected.hpp` that nothing regenerated or compared.
   * Both halves are fixed -- the cleanup covers them now, and this list catches
   * one already committed.
   *
   * Built from the run outputs rather than relisting them, so the two cannot
   * drift apart on the four they share.
   */
  private static readonly ERROR_TEST_FORBIDDEN_EXTENSIONS = [
    ...TestUtils.ERROR_TEST_RUN_OUTPUT_EXTENSIONS,
    "expected.cpp",
    "expected.hpp",
  ];

  /**
   * Check if a test-error case has stale .test.* artifacts committed
   *
   * A test-error case stops at the expected compile error and emits no generated
   * output, so any committed .test.c/.test.cpp/.test.h/.test.hpp is stale by
   * definition and actively misleading (shows successful compile of failing code).
   *
   * @returns ITestResult with failure if stale artifacts found, null otherwise
   */
  static checkForStaleErrorTestArtifacts(basePath: string): ITestResult | null {
    const staleFiles: string[] = [];

    for (const ext of TestUtils.ERROR_TEST_FORBIDDEN_EXTENSIONS) {
      const artifactPath = `${basePath}.${ext}`;
      if (existsSync(artifactPath)) {
        staleFiles.push(artifactPath);
      }
    }

    if (staleFiles.length > 0) {
      const fileList = staleFiles.map((f) => basename(f)).join(", ");
      return {
        passed: false,
        message: `test-error case has stale generated artifacts: ${fileList}`,
        expected: "(no .test.c/.test.cpp/.test.h/.test.hpp files)",
        actual: `Found: ${fileList}\nRun: git rm ${staleFiles.join(" ")}`,
      };
    }

    return null;
  }

  // Marks the start of the CLI's "Generated N output files:" block. The one
  // fact parseGeneratedImplPaths and parseGeneratedHeaderPaths must agree on;
  // everything after it, each treats differently -- see both doc comments.
  private static readonly OUTPUT_BLOCK_START = /^Generated \d+ output files?:/;

  /**
   * The paths of the CLI's "Generated N output files:" block, up to the first
   * line that is not one whose extension `kinds` names
   */
  private static outputBlock(stdout: string, kinds: RegExp): string[] {
    const paths: string[] = [];
    let inBlock = false;
    for (const line of stdout.split("\n")) {
      if (TestUtils.OUTPUT_BLOCK_START.test(line)) {
        inBlock = true;
        continue;
      }
      if (!inBlock) continue;
      const path = /^\s+(\S.*)$/.exec(line)?.[1];
      if (path === undefined || !kinds.test(path)) break;
      paths.push(path);
    }
    return paths;
  }

  /**
   * Implementation files (`.c` / `.cpp`) named in the CLI's "Generated N output
   * files:" block.
   *
   * Issue #1314: the harness used to infer the output extension from the mode it
   * ASKED for and only reconsidered when that file was absent, so a stale
   * committed `.c` satisfied the check and the run validated a file no
   * transpiler had written. Reading the CLI's own report removes the inference.
   *
   * Headers are excluded deliberately -- callers derive the header path from the
   * implementation path so the two cannot disagree. The block therefore ends at the
   * first non-implementation line: the CLI emits every impl before any header
   * (impl-by-impl in the transpile loop, headers appended afterwards), so an
   * interleaved `a.c, a.h, b.c` cannot occur and tolerating it would be a branch
   * defended only by input the CLI cannot produce.
   */
  static parseGeneratedImplPaths(stdout: string): string[] {
    return TestUtils.outputBlock(stdout, /\.(?:c|cpp)$/);
  }

  /**
   * Header files (`.h` / `.hpp`) named in the CLI's "Generated N output files:"
   * block -- every header the run actually wrote, direct dependency or
   * transitive, in the run's own words rather than a path guessed from a
   * `.cnx` list the caller happens to have -- which is what lets a fixture's
   * dependency headers be read from one run instead of re-derived (#1544).
   *
   * Unlike parseGeneratedImplPaths, this does not stop at the first impl
   * line: impl files lead the block and headers trail it, so a scan looking
   * for headers has to tolerate the impl files in front of them. It still stops at
   * the true end of the block (the first line that is neither), which is
   * what keeps a trailing, unrelated line like "Toolchain requirements:"
   * from being read as a path.
   */
  static parseGeneratedHeaderPaths(stdout: string): string[] {
    return TestUtils.outputBlock(stdout, /\.(?:c|cpp|h|hpp)$/).filter((path) =>
      /\.(?:h|hpp)$/.test(path),
    );
  }

  /**
   * Run an error test (transpilation should fail)
   * Error tests are mode-independent since transpilation errors happen before code generation
   */
  private static async runErrorTest(
    cnxFile: string,
    source: string,
    options: ITestOptions,
    basePath: string,
    expectedErrorFile: string,
    updateMode: boolean,
    rootDir: string,
    cppMode: boolean,
  ): Promise<ITestResult> {
    const expectedCFile = basePath + ".expected.c";
    const expectedHFile = basePath + ".expected.h";

    // #1379: absent when the fixture declares `// test-error` and its
    // assertion has not been created yet -- the ordinary TDD order. Read as
    // empty rather than throwing, so the branches below can bootstrap it under
    // --update or say what is missing without it.
    const hasAssertion = existsSync(expectedErrorFile);
    const expectedErrors = hasAssertion
      ? readFileSync(expectedErrorFile, "utf-8").trim()
      : "";

    // Clean up stale success test artifacts
    // These two ONLY, and the reason is an invariant rather than a preference:
    // `checkForStaleErrorTestArtifacts` runs first in `runTest` and returns on
    // anything in ERROR_TEST_FORBIDDEN_EXTENSIONS, so every other output kind
    // has already been reported by the time control reaches here. `.expected.c`
    // and `.expected.h` are exactly the kinds that list deliberately omits, so
    // they are exactly the kinds that can still arrive.
    //
    // This list previously also named `.test.h` (unreachable -- forbidden), and
    // #1555 hand-extended it with the C++ pair believing that closed the orphan
    // gap. It did not: those are forbidden too, so the additions were dead the
    // moment they were written, and the forbidden list is what actually caught
    // the one orphaned fixture. Deleting them rather than leaving code that
    // reads like a second safety net and is not one.
    for (const staleFile of [expectedCFile, expectedHFile]) {
      if (existsSync(staleFile)) {
        try {
          unlinkSync(staleFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Transpile via CLI to check for errors. #1319: in the fixture's declared
    // mode -- a `// test-cpp-only` error fixture asserts an error that only
    // exists in C++, and running it as C now reports E0507 instead.
    const result = transpileViaCli(cnxFile, cppMode);

    if (result.success) {
      // Issue #1316: --update must not resolve "a diagnostic was dropped" in
      // favour of "this fixture was always meant to succeed". Unlinking the
      // .expected.error erased the only assertion that the diagnostic fires and
      // reported the run green, so a regression and an intentional fix were
      // indistinguishable -- across 287 error fixtures, on the one command a
      // diagnostic migration runs repeatedly. The snapshot is still written so
      // an author who meant to remove the diagnostic can see the new output;
      // removing the assertion stays their explicit act, made by deleting the
      // .expected.error and its docs/diagnostic-manifest.md row in the same commit.
      // #1379: only for the #1316 case, where an assertion EXISTS and stopped
      // matching -- there the author may be removing a diagnostic on purpose
      // and wants to see the new output. With no assertion there is nothing to
      // have changed, and writing one would leave a `.expected.c` beside a
      // `// test-error` fixture for the forbidden-artifact guard to flag next
      // run, reporting a file this run just wrote.
      if (updateMode) {
        // The inspection snapshot is #1316's, and only for the case it names.
        if (hasAssertion) writeFileSync(expectedCFile, result.code);
        // Keeping the .expected.error means transpileViaCli's own output stays
        // on disk, so the stale-artifact guard would fire first on the next run
        // and report "git rm" for files this run just wrote -- masking the
        // message above with an unrelated one, on the re-run an author reaches
        // for immediately. These are this run's output, not committed artifacts.
        for (const ext of TestUtils.ERROR_TEST_RUN_OUTPUT_EXTENSIONS) {
          const artifactPath = `${basePath}.${ext}`;
          if (existsSync(artifactPath)) {
            try {
              unlinkSync(artifactPath);
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      }
      return {
        passed: false,
        message: !hasAssertion
          ? // #1379: the fixture declares `// test-error` and produced no
            // diagnostic. This used to be snapshotted green, which is how a
            // fixture could be committed asserting nothing -- green whether or
            // not the diagnostic was ever implemented.
            "declares `// test-error` but produced no diagnostic -- nothing was asserted. Implement the diagnostic, or remove the marker if this fixture is not an error case."
          : updateMode
            ? `test-error fixture no longer errors: .expected.error kept, wrote ${basename(expectedCFile)} for inspection. If intentional, delete the .expected.error and its docs/diagnostic-manifest.md row in the same commit.`
            : "Expected errors but transpilation succeeded",
        expected: expectedErrors,
        actual: "(no errors)",
      };
    }

    const actualErrors = result.errors
      .map(
        (e: { line: number; column: number; message: string; file?: string }) =>
          renderDiagnostic(e, cnxFile),
      )
      .join("\n");

    const dependent = TestUtils.targetDependentDiagnostics(
      cnxFile,
      source,
      cppMode,
      actualErrors,
      rootDir,
      options.targetMirrors,
    );
    if (dependent !== null) {
      return { passed: false, message: dependent };
    }

    if (updateMode) {
      writeFileSync(expectedErrorFile, actualErrors + "\n");
      return {
        passed: true,
        message: "Updated error snapshot",
        updated: true,
      };
    }

    if (
      TestUtils.normalize(actualErrors) === TestUtils.normalize(expectedErrors)
    ) {
      return { passed: true };
    }

    if (!hasAssertion) {
      // #1379: the diagnostic fires and the assertion has not been written.
      // The TDD bootstrap -- `--update` above creates it from this output.
      return {
        passed: false,
        message: `declares \`// test-error\` and has no ${basename(expectedErrorFile)} -- re-run with --update to create it from the diagnostic below`,
        expected: `(no ${basename(expectedErrorFile)})`,
        actual: actualErrors,
      };
    }

    return {
      passed: false,
      message: "Error output mismatch",
      expected: expectedErrors,
      actual: actualErrors,
    };
  }

  /**
   * Aggregate results from multiple mode runs into a single ITestResult
   */
  private static aggregateModeResults(
    results: IModeResult[],
    requestedModes: TTestMode[],
    updateMode: boolean,
  ): ITestResult {
    const cResult = results.find((r) => r.mode === "c");
    const cppResult = results.find((r) => r.mode === "cpp");

    // Check if all modes passed
    const allPassed = results.every(
      (r) =>
        r.transpileSuccess &&
        r.snapshotMatch &&
        r.headerMatch &&
        r.compileSuccess &&
        r.execSuccess,
    );

    // Find first failure for error message
    const firstFailure = results.find(
      (r) =>
        !r.transpileSuccess ||
        !r.snapshotMatch ||
        !r.headerMatch ||
        !r.compileSuccess ||
        !r.execSuccess,
    );

    // Check for skipped execution, and why (Issue #1397): the printed cause
    // used to be hard-coded to ARM, which is one of three reasons.
    const anySkippedExec = results.some((r) => r.skippedExec);
    const skipReason = results.find((r) => r.skippedExec)?.skipReason;

    // Check for missing snapshots (no expected file)
    const noSnapshot = results.every((r) =>
      r.error?.includes("No expected file"),
    );

    const testResult: ITestResult = {
      passed: allPassed,
      cResult,
      cppResult,
      cSkipped: !requestedModes.includes("c"),
      cppSkipped: !requestedModes.includes("cpp"),
      skippedExec: anySkippedExec,
      skipReason,
      noSnapshot,
      cells: results.flatMap((r) => r.cells ?? []),
    };

    if (!allPassed && firstFailure) {
      testResult.message = firstFailure.error;
      testResult.expected = firstFailure.expected;
      testResult.actual = firstFailure.actual;
    }

    // In update mode, mark as updated if we created snapshots
    if (updateMode && allPassed && results.length > 0) {
      const modes = results.map((r) => r.mode.toUpperCase()).join("+");
      testResult.updated = true;
      testResult.message = `Updated ${modes} snapshot(s)`;
    }

    // Parity check: compare stdout between C and C++ modes (Issue #922)
    // Only check if both modes ran, both executed (not skipped), and both passed
    if (
      cResult &&
      cppResult &&
      cResult.execSuccess &&
      cppResult.execSuccess &&
      !cResult.skippedExec &&
      !cppResult.skippedExec
    ) {
      testResult.parityChecked = true;

      // Normalize stdout for comparison (handle undefined as empty string)
      const cStdout = TestUtils.normalize(cResult.stdout || "");
      const cppStdout = TestUtils.normalize(cppResult.stdout || "");

      if (cStdout === cppStdout) {
        testResult.parityPassed = true;
      } else {
        // Parity mismatch - hard failure
        testResult.parityPassed = false;
        testResult.passed = false;
        testResult.parityError = TestUtils.formatParityError(
          cStdout,
          cppStdout,
        );
        testResult.message = "Parity mismatch: C and C++ outputs differ";
      }
    }

    // #1544: both modes' dependency digests, merged. The two modes write
    // different extensions (`.c`/`.h` against `.cpp`/`.hpp`), so their key sets
    // are disjoint and neither can overwrite the other.
    const dependencyDigests: Record<string, string> = {};
    for (const modeResult of results) {
      Object.assign(dependencyDigests, modeResult.dependencyDigests ?? {});
    }
    if (Object.keys(dependencyDigests).length > 0) {
      testResult.dependencyDigests = dependencyDigests;
    }

    return testResult;
  }

  /**
   * Format a parity error message showing the differences between C and C++ output
   */
  private static formatParityError(cStdout: string, cppStdout: string): string {
    const cLines = cStdout.split("\n");
    const cppLines = cppStdout.split("\n");
    const maxLines = Math.max(cLines.length, cppLines.length);

    const differences: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const cLine = cLines[i] ?? "(no line)";
      const cppLine = cppLines[i] ?? "(no line)";
      if (cLine !== cppLine) {
        differences.push(`Line ${i + 1}:`);
        differences.push(`  C:   ${cLine}`);
        differences.push(`  C++: ${cppLine}`);
      }
    }

    return (
      differences.slice(0, 15).join("\n") +
      (differences.length > 15
        ? `\n... and ${differences.length - 15} more differences`
        : "")
    );
  }
}

export default TestUtils;
