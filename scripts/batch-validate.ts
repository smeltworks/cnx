#!/usr/bin/env tsx
/**
 * Batch C/C++ Static Analysis
 *
 * Runs cppcheck, clang-tidy, MISRA, and flawfinder on all generated
 * test files in a single batch. This replaces per-file analysis that
 * previously ran during integration tests, amortizing tool startup
 * costs and ensuring local + CI behavior are identical.
 *
 * Usage:
 *   npm run validate:c                  # Run all available checks
 *   npx tsx scripts/batch-validate.ts   # Same thing
 *
 * Security: All external tool invocations use execFileSync (not exec)
 * to prevent shell injection. File paths come from filesystem traversal,
 * not user input.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExecFailure from "../src/cnx/utils/ExecFailure";
import InterruptMask from "../src/cnx/TRANSPILE/3-Render/codegen/helpers/InterruptMask";
import MisraBaseline from "./misra-baseline";
import MisraDump from "./misra-dump";
import MISRA_GUARDS from "./misra-guards/MISRA_GUARDS";
import MisraGuards from "./misra-guards/MisraGuards";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TESTS_DIR = join(ROOT, "tests");
const INCLUDE_DIR = join(ROOT, "tests/include");
const CMSIS_DIR = join(ROOT, "vendor/cmsis-core");

/**
 * #1668: a file generated for a Cortex-M target includes `<cmsis_gcc.h>`.
 * ARM's real header, vendored for the target matrix, declares its intrinsics
 * only for architectures that have them, and this analysis runs on the host.
 * So a Cortex file is analyzed as ARMv7E-M code against ARM's own
 * declarations, which declares every intrinsic generated code calls. It
 * replaced a test stub that declared them for every CPU, and whose presence
 * hid 34 MISRA C:2012 Rule 15.6 violations from cppcheck. Analyzing each file
 * for its own target is #1714.
 */
function cortexArgs(file: string): string[] {
  return /#include\s*<cmsis_gcc\.h>/.test(readFileSync(file, "utf-8"))
    ? ["-I", CMSIS_DIR, "-D__ARM_ARCH_7EM__=1", "-D__ARM_FEATURE_LDREX=7"]
    : [];
}

/**
 * #1713: a header can pick its types from the compiler's data-model macros
 * (`#if __SIZEOF_POINTER__ == 8`), and the transpiler reads it with the
 * target's compiler, which defines them. cppcheck defines none, so it read
 * such a header for a 32-bit model while checking the code against the
 * host's 64-bit one (`uword_t` became `uint32_t`, and `255ULL` a Rule 10.3
 * narrowing). Both passes check the host model (other models are #1714), so
 * they get the host compiler's macros for it.
 *
 * #1147: the memory orders an `__atomic` builtin takes (`__ATOMIC_RELAXED`)
 * are predefined by the compiler too, so they come from the same place.
 */
function hostDataModelArgs(): string[] {
  const macros = execFileSync("gcc", ["-dM", "-E", "-x", "c", "/dev/null"], {
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 5000,
  });
  return [
    ...macros.matchAll(
      /^#define (__SIZEOF_\w+__|__\w+_WIDTH__|__ATOMIC_\w+) (\d+)$/gm,
    ),
  ].map((match) => `-D${match[1]}=${match[2]}`);
}

const HOST_DATA_MODEL_ARGS = hostDataModelArgs();

const ARM_ARCH_ARGS: readonly string[] = ["-D__arm__=1"];

/**
 * #1147: the critical-section wrappers have an arm for the compilers that can
 * mask interrupts (ARM, AVR) and `#error` for every other one, the host
 * included. A file with them was generated for a target that can, so it is
 * analyzed on its ARM arm, the way a Cortex file is.
 */
function interruptMaskArgs(file: string): readonly string[] {
  return readFileSync(file, "utf-8").includes(InterruptMask.NO_ARM_ERROR)
    ? ARM_ARCH_ARGS
    : [];
}

const GNU_ATOMIC_BUILTINS = join(ROOT, "tools/gnu-atomic-builtins.h");

/** A file that calls the `__atomic` builtins gets the compiler's declarations. */
function atomicBuiltinArgs(file: string): readonly string[] {
  return readFileSync(file, "utf-8").includes("__atomic_")
    ? [`--include=${GNU_ATOMIC_BUILTINS}`]
    : [];
}

/** Runs one cppcheck batch per set of per-file arguments. */
function runCppcheckBatches(
  tool: string,
  label: string,
  args: readonly string[],
  files: readonly string[],
): void {
  const host: string[] = [];
  const arm: string[] = [];
  for (const file of files) {
    (interruptMaskArgs(file).length > 0 ? arm : host).push(file);
  }
  const batches: [readonly string[], readonly string[]][] = [
    [[], host],
    [ARM_ARCH_ARGS, arm],
  ];
  for (const [extra, batch] of batches) {
    if (batch.length === 0) continue;
    try {
      execFileSync("cppcheck", [...args, ...extra, ...batch], {
        encoding: "utf-8",
        timeout: 300000,
        stdio: "pipe",
      });
    } catch (error: unknown) {
      const failure = ExecFailure.of(error);
      const output = failure.stderr || failure.stdout || failure.message;
      reportFailure(tool, `${batch.length} ${label}`, output);
    }
  }
}

// ============================================================================
// CLI argument parsing
// ============================================================================

const VALID_TOOLS = ["cppcheck", "clang-tidy", "misra", "flawfinder", "all"];

function parseTool(): string {
  const args = process.argv.slice(2);
  let tool = "all";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tool" && args[i + 1]) {
      tool = args[i + 1].toLowerCase();
      if (!VALID_TOOLS.includes(tool)) {
        console.error(`Invalid tool: ${tool}`);
        console.error(`Valid options: ${VALID_TOOLS.join(", ")}`);
        process.exit(1);
      }
    }
  }

  return tool;
}

const selectedTool = parseTool();

// ============================================================================
// Tool detection
// ============================================================================

function toolAvailable(cmd: string): boolean {
  try {
    execFileSync(cmd, ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

const hasCppcheck = toolAvailable("cppcheck");
const hasClangTidy = toolAvailable("clang-tidy");
const hasFlawfinder = toolAvailable("flawfinder");

// ============================================================================
// File discovery
// ============================================================================

function findFilesRecursively(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursively(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const cFiles = findFilesRecursively(TESTS_DIR, /\.test\.c$/);
const cppFiles = findFilesRecursively(TESTS_DIR, /\.test\.cpp$/);

console.log(`Found ${cFiles.length} C files and ${cppFiles.length} C++ files`);

if (cFiles.length === 0 && cppFiles.length === 0) {
  console.log("No test files found — run integration tests first (npm test)");
  process.exit(1);
}

// ============================================================================
// C++ detection (simplified from test-utils.ts TestUtils.requiresCpp14)
//
// Intentionally simplified — these patterns only determine which cppcheck/
// clang-tidy mode to use. A false negative (C++ file analyzed as C) causes
// cppcheck to handle it gracefully, so full transpiler-level detection
// (constructor patterns, detectCppSyntax) is not needed here.
// ============================================================================

const CPP_FEATURE_PATTERNS = [
  /\b(static_cast|reinterpret_cast|const_cast|dynamic_cast)\s*</,
  /\b(?!string\b)\w+<[^;=<>]+>/,
  /\w+::\w+/,
];

const CPP_HEADER_PATTERNS = [
  /\bclass\s+\w+/,
  /\bnamespace\s+\w+/,
  /\btemplate\s*</,
  /\bpublic\s*:/,
  /\bprivate\s*:/,
  /\bprotected\s*:/,
];

function hasCppFeatures(code: string): boolean {
  for (const pattern of CPP_FEATURE_PATTERNS) {
    if (pattern.test(code)) return true;
  }
  return false;
}

function requiresCpp(cFile: string): boolean {
  try {
    const code = readFileSync(cFile, "utf-8");
    if (hasCppFeatures(code)) return true;

    const includePattern = /#include\s+"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = includePattern.exec(code)) !== null) {
      const headerPath = join(dirname(cFile), match[1]);
      if (existsSync(headerPath)) {
        const headerContent = readFileSync(headerPath, "utf-8");
        if (hasCppFeatures(headerContent)) return true;
        for (const pattern of CPP_HEADER_PATTERNS) {
          if (pattern.test(headerContent)) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// Validation runners
// ============================================================================

let failures = 0;

function reportFailure(tool: string, file: string, message: string): void {
  console.error(`FAIL [${tool}] ${file}`);
  if (message) {
    const lines = message.split("\n").slice(0, 5);
    for (const line of lines) {
      console.error(`  ${line}`);
    }
  }
  failures++;
}

// --- cppcheck (batch mode) ---
function runCppcheck() {
  if (!hasCppcheck) {
    console.log("⊘ cppcheck not available, skipping");
    return;
  }

  const baseArgs = [
    "--error-exitcode=1",
    "--enable=warning,performance",
    "--suppress=unusedFunction",
    "--suppress=missingIncludeSystem",
    "--suppress=unusedVariable",
    "--suppress=uninitMemberVar:*fixtures/*",
    // CppMessage.hpp uses #ifdef __cplusplus with class/struct variants; not a real ODR violation
    "--suppress=ctuOneDefinitionRuleViolation:*CppMessage.hpp*",
    // Generated test code patterns that cppcheck flags as redundant but are
    // intentional (e.g., `bool a = true; if (a) { ... }` in edge-case tests)
    "--suppress=identicalInnerCondition",
    "--suppress=identicalConditionAfterEarlyExit",
    // Float clamp macros use ternary guards that cppcheck can't reason through
    "--suppress=floatConversionOverflow",
    "--quiet",
    ...HOST_DATA_MODEL_ARGS,
  ];

  // Batch C files (excluding those that need C++ mode)
  // Also exclude error test files (*-error.test.c) which intentionally contain
  // invalid code to test transpiler error detection (e.g., shift beyond width)
  const pureCFiles = cFiles.filter(
    (f) => !requiresCpp(f) && !f.endsWith("-error.test.c"),
  );
  const cppDetectedFiles = cFiles.filter((f) => requiresCpp(f));

  if (pureCFiles.length > 0) {
    console.log(`Running cppcheck on ${pureCFiles.length} C files...`);
    runCppcheckBatches("cppcheck", "C files", baseArgs, pureCFiles);
  }

  // C files needing C++ mode + actual C++ files
  const allCppFiles = [...cppDetectedFiles, ...cppFiles];
  if (allCppFiles.length > 0) {
    console.log(
      `Running cppcheck (C++ mode) on ${allCppFiles.length} files...`,
    );
    // C++ mode gets an additional ODR suppression: manually-written C/C++ test headers
    // (TestConfig.h, comprehensive-cpp.hpp, etc.) define common struct names that
    // create false positive ODR violations with transpiler-generated .test.hpp files.
    // C mode (above) still catches real ODR violations between transpiler-generated .c files.
    const cppArgs = [
      ...baseArgs,
      "--suppress=ctuOneDefinitionRuleViolation",
      "--language=c++",
      "--std=c++14",
    ];
    runCppcheckBatches("cppcheck-cpp", "C++ files", cppArgs, allCppFiles);
  }
}

// --- clang-tidy (per-file, no batch mode) ---
// Enhancement over original: adds -I flags for include resolution, reducing
// false positives from missing headers (original validateClangTidy lacked these).
function runClangTidy() {
  if (!hasClangTidy) {
    console.log("⊘ clang-tidy not available, skipping");
    return;
  }

  const allFiles = [...cFiles, ...cppFiles];
  console.log(`Running clang-tidy on ${allFiles.length} files...`);

  for (const file of allFiles) {
    const useCpp = cppFiles.includes(file) || requiresCpp(file);
    const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

    try {
      execFileSync(
        "clang-tidy",
        [file, "--", stdFlag, "-I", INCLUDE_DIR, "-I", dirname(file)],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );
    } catch (error: unknown) {
      const failure = ExecFailure.of(error);
      const output = failure.stderr || failure.stdout || failure.message;
      const issues = output
        .split("\n")
        .filter((line) => line.includes("error:"))
        .slice(0, 5)
        .join("\n");
      // clang-tidy returns non-zero even for warnings; only fail on errors
      if (issues.includes("error:")) {
        reportFailure("clang-tidy", file, issues);
      }
    }
  }
}

// --- MISRA (per-file, C only) ---
/** Where a distribution's cppcheck package installs its addons */
const DISTRO_ADDON_DIRS = [
  "/usr/lib/x86_64-linux-gnu/cppcheck/addons",
  "/usr/lib/aarch64-linux-gnu/cppcheck/addons",
  "/usr/share/cppcheck/addons",
  "/usr/lib/cppcheck/addons",
];

// Files excluded from MISRA validation (contain valid exceptions or intentional violations)
const MISRA_EXCLUDED_FILES = [
  // uri-exception.test.c tests MISRA Amendment 4 URI exception (://);
  // cppcheck doesn't implement Amendment 4, so it false-positives on Rule 3.1
  "uri-exception.test.c",
];

function runMisra() {
  if (!hasCppcheck) {
    console.log("⊘ cppcheck not available (needed for MISRA addon), skipping");
    return;
  }

  // MISRA is C-only; skip files that need C++ compilation
  // Also exclude files testing valid MISRA exceptions
  // Also exclude error test files (*-error.test.c) which intentionally contain
  // invalid code to test transpiler error detection (e.g., shift beyond width)
  const misraFiles = cFiles.filter(
    (f) =>
      !requiresCpp(f) &&
      !f.endsWith("-error.test.c") &&
      !MISRA_EXCLUDED_FILES.some((exc) => f.endsWith(exc)),
  );
  console.log(`Running MISRA on ${misraFiles.length} C files...`);
  checkAddonHasGuardedRules();
  checkDumpParserReadsThisCppcheck();

  // MisraBaseline owns the cppcheck invocation and the failure decision:
  //   - buildArgs() enables `--enable=style` so the addon actually reports (#1057)
  //   - findFailures() fails only on un-baselined rules in cnx-generated code
  // cppcheck exits 1 on ANY enabled finding (including non-MISRA style noise),
  // so every match throws; we parse the captured output and decide ourselves.
  for (const file of misraFiles) {
    const output = runMisraOn(file);
    // `--dump` keeps the dump the addon read; it is read once and removed,
    // so the tree stays clean (#1285)
    const dumpFile = `${file}.dump`;
    const dump = existsSync(dumpFile) ? readFileSync(dumpFile, "utf-8") : "";
    rmSync(dumpFile, { force: true });
    if (output === null) continue;

    // An `#error` arm stops cppcheck before the addon reads the file, and its
    // exit status is the same 1, so a file it never analyzed passed (#1147).
    if (output.includes("[preprocessorErrorDirective]")) {
      reportFailure("MISRA", file, output);
      continue;
    }
    // The dump check is a named Rule 11.9 guard (MISRA_GUARDS): a file cppcheck
    // analyzed with no dump is a check that did not run, never a clean one
    if (dump === "") {
      reportFailure(
        "MISRA",
        file,
        `cppcheck wrote no ${dumpFile}, so MisraDump checked nothing`,
      );
      continue;
    }

    const misraFailures = MisraBaseline.findFailures([
      ...MisraBaseline.parseViolations(output),
      ...MisraDump.findings(dump),
    ]);
    if (misraFailures.length > 0) {
      reportFailure(
        "MISRA",
        file,
        misraFailures
          .slice(0, 5)
          .map((violation) => violation.raw)
          .join("\n"),
      );
    }
  }
}

/**
 * Where the `cppcheck` on PATH keeps its addons: beside its own install
 * prefix first, so a source build ahead of a distribution package is the one
 * inspected -- the same one `--addon=misra` loads -- then the distributions'
 */
function misraAddonDirs(): string[] {
  const dirs: string[] = [];
  try {
    const binary = realpathSync(
      execFileSync("which", ["cppcheck"], { encoding: "utf-8" }).trim(),
    );
    const prefix = dirname(dirname(binary));
    dirs.push(
      join(prefix, "share", "cppcheck", "addons"),
      join(prefix, "share", "Cppcheck", "addons"),
      join(prefix, "lib", "cppcheck", "addons"),
    );
  } catch {
    // No cppcheck on PATH: the addon is then found nowhere, which is reported
  }
  return [...dirs, ...DISTRO_ADDON_DIRS];
}

/**
 * #1610: a `cppcheck` guard in MISRA_GUARDS is only a guard if this cppcheck's
 * addon checks that rule. Which rules it implements varies by version, and
 * the guard registry check runs where cppcheck is not installed, so it is
 * checked here, against the addon this run uses.
 */
function checkAddonHasGuardedRules() {
  const dirs = misraAddonDirs();
  const addon = dirs
    .map((dir) => join(dir, "misra.py"))
    .find((path) => existsSync(path));
  if (addon === undefined) {
    reportFailure(
      "MISRA",
      "misra.py",
      `cppcheck's MISRA addon is in none of ${dirs.join(", ")}, so the rules MISRA_GUARDS relies on cannot be checked`,
    );
    return;
  }
  const source = readFileSync(addon, "utf-8");
  for (const rule of MisraGuards.addonRules(MISRA_GUARDS)) {
    if (!source.includes(`def misra_${rule.replace(".", "_")}(`)) {
      reportFailure(
        "MISRA",
        addon,
        `MISRA_GUARDS names cppcheck as the guard for Rule ${rule}, and this addon has no check for it`,
      );
    }
  }
}

/**
 * #1610: the Rule 11.9 dump guard reads attributes of cppcheck's `--dump`
 * (`isPointer`, `isArray`, the `{ 0 }` tokens). A cppcheck that names or
 * splits them differently would make `MisraDump.findings` silently find
 * nothing, so this cppcheck's dump of a known violation must yield exactly it.
 */
function checkDumpParserReadsThisCppcheck() {
  const dir = mkdtempSync(join(tmpdir(), "cnx-misra-dump-"));
  try {
    const probe = join(dir, "probe.c");
    writeFileSync(probe, "static int *p = {0};\n", "utf-8");
    if (runMisraOn(probe) === null) return;
    const dumpFile = `${probe}.dump`;
    const dump = existsSync(dumpFile) ? readFileSync(dumpFile, "utf-8") : "";
    const found = MisraDump.findings(dump).filter((violation) =>
      MisraDump.RULES.includes(violation.ruleId),
    );
    if (found.length !== 1) {
      reportFailure(
        "MISRA",
        "dump probe",
        `MisraDump found ${found.length} Rule 11.9 violations in this cppcheck's dump of \`static int *p = {0};\`, not 1, so it cannot be relied on to find any`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Run the MISRA addon on one file and return what it printed, or null when
 * cppcheck itself failed (already reported). Exit 0 is no findings at all.
 */
function runMisraOn(file: string): string | null {
  try {
    execFileSync(
      "cppcheck",
      MisraBaseline.buildArgs(file, INCLUDE_DIR, [
        ...HOST_DATA_MODEL_ARGS,
        ...cortexArgs(file),
        ...interruptMaskArgs(file),
        ...atomicBuiltinArgs(file),
      ]),
      {
        encoding: "utf-8",
        timeout: 60000,
        stdio: "pipe",
      },
    );
    return "";
  } catch (error: unknown) {
    const failure = ExecFailure.of(error);
    // Exit 1 is the expected "findings present" signal; any other status
    // means cppcheck itself failed to run, which must not pass silently.
    if (failure.status !== 1) {
      reportFailure(
        "MISRA",
        file,
        failure.stderr || failure.stdout || failure.message,
      );
      return null;
    }
    return `${failure.stdout || ""}\n${failure.stderr || ""}`;
  }
}

// --- flawfinder (batch mode) ---
function runFlawfinder() {
  if (!hasFlawfinder) {
    console.log("⊘ flawfinder not available, skipping");
    return;
  }

  const allFiles = [...cFiles, ...cppFiles];
  console.log(`Running flawfinder on ${allFiles.length} files...`);

  try {
    execFileSync(
      "flawfinder",
      ["--minlevel=3", "--error-level=3", "--dataonly", "--quiet", ...allFiles],
      { encoding: "utf-8", timeout: 120000, stdio: "pipe" },
    );
  } catch (error: unknown) {
    const failure = ExecFailure.of(error);
    const output = failure.stdout || failure.stderr || failure.message;
    const issues = output
      .split("\n")
      .filter((line) => line.includes("CWE") || line.trim().length > 0)
      .slice(0, 10)
      .join("\n");
    reportFailure("flawfinder", `${allFiles.length} files`, issues);
  }
}

// ============================================================================
// Main
// ============================================================================

function shouldRun(toolName: string): boolean {
  return selectedTool === "all" || selectedTool === toolName;
}

const availableTools: string[] = [];
if (hasCppcheck) availableTools.push("cppcheck", "misra");
if (hasClangTidy) availableTools.push("clang-tidy");
if (hasFlawfinder) availableTools.push("flawfinder");

if (availableTools.length === 0) {
  console.log(
    "No static analysis tools available — install cppcheck, clang-tidy, or flawfinder",
  );
  process.exit(0);
}

// Check if the selected tool is available
if (selectedTool !== "all" && !availableTools.includes(selectedTool)) {
  // MISRA requires cppcheck
  if (selectedTool === "misra" && !hasCppcheck) {
    console.log("⊘ cppcheck not available (needed for MISRA addon), skipping");
    process.exit(0);
  }
  console.log(`⊘ ${selectedTool} not available, skipping`);
  process.exit(0);
}

if (selectedTool === "all") {
  console.log(`Tools: ${availableTools.join(", ")}`);
} else {
  console.log(`Tool: ${selectedTool}`);
}
console.log();

if (shouldRun("cppcheck")) runCppcheck();
if (shouldRun("clang-tidy")) runClangTidy();
if (shouldRun("misra")) runMisra();
if (shouldRun("flawfinder")) runFlawfinder();

console.log();
if (failures > 0) {
  console.error(`${failures} validation failure(s)`);
  process.exit(1);
} else {
  console.log("All static analysis checks passed");
}
