/**
 * MISRA baseline + parsing helpers for batch-validate.ts.
 *
 * Background (#1057): the MISRA portion of `validate:c` was a silent no-op
 * because runMisra() invoked cppcheck WITHOUT `--enable=style`. cppcheck emits
 * every MISRA finding at `style` severity, so without that flag the addon
 * reports nothing and exits 0 — the check "passed" by never checking.
 *
 * This module owns the cppcheck invocation and the failure decision so both the
 * runner and its unit tests share one source of truth:
 *   - buildArgs()      — cppcheck argv (always enables style).
 *   - parseViolations()— extract MISRA findings from cppcheck output.
 *   - isGenerated()    — is a file cnx-generated output?
 *   - findFailures()   — violations that should fail the build.
 *
 * Failure policy (per-rule allowlist baseline):
 *   A violation fails the build only when it is in cnx-GENERATED code
 *   (`*.test.c` / generated `*.test.h`) AND its rule is NOT in BASELINE.
 *   - Generated-only: cppcheck also flags transitively-included third-party
 *     libs (cJSON) and hand-written fixtures (widget.h, c-interop headers);
 *     those are not cnx output and must never gate the build.
 *   - Per-rule baseline: every rule that currently has generated violations is
 *     listed below, mapped to its tracking issue. This keeps the check green
 *     today while failing on any NEW rule class (or any baselined rule once its
 *     issue is fixed and the entry is removed). Remove a rule from BASELINE as
 *     part of resolving its issue to start enforcing it.
 */

import { dirname } from "node:path";

import IMisraViolation from "./types/IMisraViolation";

// rule id -> tracking issue. Generated from the suite via:
//   cppcheck --addon=misra --enable=style --inline-suppr ... | grep misra-c2012
// (see scripts/__tests__/misra-baseline.test.ts for the integrity guards).
const BASELINE = new Map<string, string>([
  // --- rules with pre-existing tracking issues (#841–#869) ---
  ["misra-c2012-2.2", "#849"],
  ["misra-c2012-2.3", "#869"],
  ["misra-c2012-2.5", "#863"],
  ["misra-c2012-2.7", "#862"],
  ["misra-c2012-7.4", "#844"],
  // Rule 8.4 is deliberately absent: #1205 gave every ADR-029 generated
  // init function a declaration in its header, taking the rule to zero
  // generated violations. It is enforced, not baselined -- a new
  // undeclared definition with external linkage fails the build.
  ["misra-c2012-8.7", "#864"],
  ["misra-c2012-8.9", "#866"],
  ["misra-c2012-10.4", "#858"],
  ["misra-c2012-10.6", "#860"],
  ["misra-c2012-10.8", "#846"],
  ["misra-c2012-11.4", "#867"],
  ["misra-c2012-12.1", "#865"],
  ["misra-c2012-15.5", "#861"],
  ["misra-c2012-18.4", "#859"],
  // Rule 17.7 is deliberately absent: string lowering calls the void helper
  // cnx_string_copy (#2207, #1902), and #847 / ADR-070 makes author-written
  // discards a compile error (E0708), so the rule is enforced, not baselined.
  // --- rules surfaced by #1057, newly tracked (#1059–#1072) ---
  // 8.6 (#1059) and 8.5 (#1064) are deliberately absent: each measured 0
  // generated violations and closed (#2091), so they are enforced, and
  // docs/misra-compliance.md names cppcheck as their guard (#1610).
  // 5.8 closed at 0 too (#1063), but the clamp helpers' `a`/`b` parameters
  // now reuse a global's name, so it is baselined again on #2325.
  // 9.2 (#1072) measured 0 too and is enforced (#1610 review).
  ["misra-c2012-5.8", "#2325"],
  ["misra-c2012-5.9", "#1060"],
  ["misra-c2012-5.6", "#1061"],
  ["misra-c2012-7.2", "#1062"],
  ["misra-c2012-12.2", "#1065"],
  ["misra-c2012-20.1", "#1066"],
  ["misra-c2012-19.2", "#1067"],
  ["misra-c2012-5.7", "#1068"],
  ["misra-c2012-21.7", "#1069"],
  ["misra-c2012-10.1", "#1070"],
  ["misra-c2012-14.1", "#1071"],
]);

// Matches a cppcheck finding line and captures the file path and MISRA rule id:
//   path/to/file.test.c:12:8: style: misra violation ... [misra-c2012-14.4]
// Paths in this suite are POSIX (the runner globs tests/), so the non-greedy
// `(.+?)` up to the first `:` captures the whole path unambiguously. A Windows
// drive-letter path (`C:\...`) would need a more specific anchor.
const MISRA_LINE = /^(.+?):\d+:\d+:.*\[(misra-c2012-\d+\.\d+)\]/;

class MisraBaseline {
  /** @public test seam: misra-baseline.test.ts reads the baseline the script enforces */
  static BASELINE = BASELINE;

  /**
   * cppcheck argv for a single C file. Always enables style (the #1057 fix).
   * @param file - the translation unit to analyze
   * @param includeDir - the corpus's shared include directory
   * @param extraArgs - more cppcheck flags for this file, such as a Cortex-M
   *   file's CMSIS-Core include and architecture macros
   */
  static buildArgs(
    file: string,
    includeDir: string,
    extraArgs: readonly string[] = [],
  ): string[] {
    return [
      "--addon=misra",
      // REQUIRED: cppcheck emits MISRA findings only at `style` severity.
      // Without this the MISRA addon is a silent no-op (#1057).
      "--enable=style",
      "--inline-suppr",
      // Keep the dump the addon reads: `MisraDump` checks what the addon
      // cannot see in it (#1610, Rule 11.9's `{0}` pointer initializer).
      "--dump",
      "--error-exitcode=1",
      "--suppress=missingIncludeSystem",
      "--suppress=unusedFunction",
      // Float clamp ternary guards that cppcheck can't reason through.
      "--suppress=floatConversionOverflow",
      "--quiet",
      "-I",
      includeDir,
      "-I",
      dirname(file),
      ...extraArgs,
      file,
    ];
  }

  /** Parse MISRA violations from cppcheck output (ignores non-MISRA findings). */
  static parseViolations(output: string): IMisraViolation[] {
    const violations: IMisraViolation[] = [];
    for (const line of output.split("\n")) {
      const match = MISRA_LINE.exec(line);
      if (match !== null) {
        violations.push({ file: match[1], ruleId: match[2], raw: line });
      }
    }
    return violations;
  }

  /** True for cnx-generated output (*.test.c / *.test.h), false for fixtures. */
  static isGenerated(file: string): boolean {
    return /\.test\.(c|h)$/.test(file);
  }

  /** Violations that should fail the build: generated code, un-baselined rule. */
  static findFailures(
    violations: readonly IMisraViolation[],
  ): IMisraViolation[] {
    return violations.filter(
      (violation) =>
        MisraBaseline.isGenerated(violation.file) &&
        !BASELINE.has(violation.ruleId),
    );
  }
}

export default MisraBaseline;
