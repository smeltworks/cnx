#!/usr/bin/env tsx
/**
 * Issue #1219: the scope-context test matrix.
 *
 * Modes are write / check / console, following
 * `scripts/toolchain-requirements.ts` rather than `grammar-coverage.ts`: the
 * latter's `check` never writes and never diffs, which is why
 * GRAMMAR-COVERAGE.md drifted for seven months (#1150). `check` here
 * regenerates in memory, diffs against what is committed, AND enforces the
 * declared obligations.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ErrorCodeRegistry from "./diagnostics/ErrorCodeRegistry";
import AdrDeclarationReader from "./matrix/AdrDeclarationReader";
import FixtureOccupancy from "./matrix/FixtureOccupancy";
import MatrixRenderer from "./matrix/MatrixRenderer";
import MatrixReport from "./matrix/MatrixReport";
import MatrixRule from "./matrix/MatrixRule";
import FileScanner from "./utils/FileScanner";
import IMatrixDeclaration from "./types/IMatrixDeclaration";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const decisionsDir = join(rootDir, "docs", "decisions");
const testsDir = join(rootDir, "tests");
const reportPath = join(rootDir, "docs", "scope-context-matrix.md");
const registryPath = join(rootDir, "docs", "error-codes.md");
const searchPaths = [join(testsDir, "include")];

async function render(): Promise<{
  document: string;
  declarations: Map<string, IMatrixDeclaration>;
  occupancy: Awaited<ReturnType<typeof FixtureOccupancy.build>>;
  positionDeclarations: Map<string, IMatrixDeclaration>;
  declarationErrors: string[];
}> {
  const declarations = AdrDeclarationReader.read(
    decisionsDir,
    ErrorCodeRegistry.retired(readFileSync(registryPath, "utf-8")),
  );
  const fixtures = existsSync(testsDir)
    ? FileScanner.findTestFiles(testsDir)
    : [];
  const occupancy = await FixtureOccupancy.build(
    fixtures,
    testsDir,
    searchPaths,
  );
  const positionDeclarations = AdrDeclarationReader.readPositions(decisionsDir);
  const declarationErrors = [
    ...declarations.values(),
    ...positionDeclarations.values(),
  ].flatMap((d) => d.errors);
  const document = await GeneratedMarkdown.format(
    [
      MatrixRenderer.renderDocument(declarations, occupancy),
      MatrixRenderer.renderPositions(positionDeclarations, occupancy),
    ].join("\n"),
    reportPath,
  );
  return {
    document,
    declarations,
    occupancy,
    positionDeclarations,
    declarationErrors,
  };
}

function printViolations(
  violations: ReturnType<typeof MatrixReport.violations>,
): void {
  for (const violation of violations) {
    const label =
      violation.severity === "error"
        ? chalk.red("error")
        : chalk.yellow("warn");
    console.log(
      `  ${label}  ADR-${violation.adr}  ${violation.context} / ${violation.relationship}`,
    );
  }
}

/**
 * Explain an empty `error` cell when the ADR's fixtures cannot be placed.
 *
 * A cell is occupied from a source POSITION: a diagnostic's, or one recorded by
 * `AdrProvenance` where the rule fired (#1241). A tagged fixture that supplies
 * neither -- an ADR covering codegen behavior with no recording site -- has real
 * fixtures that still cannot satisfy a declared `error` cell. Without this the
 * gate is red with no path to green and no explanation.
 */
function printContextNotDerivableHint(
  errors: ReturnType<typeof MatrixReport.violations>,
  occupancy: Awaited<ReturnType<typeof FixtureOccupancy.build>>,
): void {
  const affected = [
    ...new Set(errors.map((violation) => violation.adr)),
  ].filter(
    (adr) => (occupancy.get(adr)?.fixturesWithoutContext.length ?? 0) > 0,
  );
  if (affected.length === 0) return;

  console.error(
    chalk.yellow(
      `\nNote: ADR-${affected.join(", ADR-")} ` +
        `${affected.length === 1 ? "has" : "have"} linked fixtures whose context could not be derived.\n` +
        `A cell is occupied from a source position: a diagnostic's, or one recorded by\n` +
        `AdrProvenance.record("NNN", line) where the rule fired. These fixtures supply neither.\n` +
        `If this ADR governs codegen shape, add a recording site at the decision -- see\n` +
        `ScopeGenerator (ADR-016) and TypeValidator (ADR-057) for the one-line pattern.`,
    ),
  );
}

/** #1618: position rows the fixtures contradict, one per line. */
function printPositionViolations(
  violations: ReturnType<typeof MatrixReport.positionViolations>,
): void {
  if (violations.length === 0) return;
  console.log(
    chalk.yellow(
      `${violations.length} position(s) declared \`warn\` or \`error\` that no fixture reaches, or \`off\` that one does:`,
    ),
  );
  for (const v of violations) {
    console.log(chalk.yellow(`  ADR-${v.id}  ${v.position} (${v.severity})`));
  }
}

function printSummary(
  violations: ReturnType<typeof MatrixReport.violations>,
): void {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.length - errors;
  console.log(`\n${errors} error, ${warnings} warn`);
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "console";

  if (!["write", "check", "console", "gaps"].includes(mode)) {
    console.error(`Unknown mode: ${mode}`);
    console.error(
      "Usage: tsx scripts/adr-matrix.ts [write|check|console|gaps]",
    );
    process.exit(1);
  }

  const {
    document,
    declarations,
    occupancy,
    positionDeclarations,
    declarationErrors,
  } = await render();
  const violations = MatrixReport.violations(declarations, occupancy);
  const positionViolations = MatrixReport.positionViolations(
    positionDeclarations,
    occupancy,
  );

  if (mode === "write") {
    writeFileSync(reportPath, document, "utf-8");
    console.log(chalk.green(`Wrote ${reportPath}`));
    return;
  }

  if (mode === "console" || mode === "gaps") {
    if (mode === "console") console.log(document);
    if (violations.length > 0) {
      console.log(chalk.bold("\nUnmet obligations:"));
      printViolations(violations);
    }
    printPositionViolations(positionViolations);
    printSummary(violations);
    return;
  }

  // check
  const failures: string[] = [];

  if (declarationErrors.length > 0) {
    failures.push("Malformed MATRIX-SEVERITY table:");
    failures.push(...declarationErrors.map((error) => `  ${error}`));
  }

  const undeclared = MatrixReport.undeclaredRules(declarations, occupancy);
  if (undeclared.length > 0) {
    failures.push(
      "Provenance recorded for a rule no ADR declares a MATRIX-SEVERITY table for:",
    );
    failures.push(...undeclared.map((id) => `  ADR-${id}`));
  }

  // #1620 review: an occupied `off` cell in a code table fails. An ADR-wide or
  // rule table's is listed below until #2303 resolves ADR-010's.
  const contradictions = MatrixReport.contradictions(declarations, occupancy);
  const codeContradictions = contradictions.filter((c) =>
    MatrixRule.isCode(c.adr),
  );
  if (codeContradictions.length > 0) {
    failures.push(
      `${codeContradictions.length} cell(s) declared or left \`off\` are occupied by a tagged fixture:`,
    );
    failures.push(
      ...codeContradictions.map(
        (c) => `  ADR-${c.adr}  ${c.context} / ${c.relationship}`,
      ),
    );
  }

  const committed = existsSync(reportPath)
    ? readFileSync(reportPath, "utf-8")
    : "";
  if (committed !== document) {
    failures.push(
      "docs/scope-context-matrix.md is stale. Run: npm run coverage:matrix",
    );
  }

  const errors = violations.filter((v) => v.severity === "error");
  if (errors.length > 0) {
    failures.push(
      `${errors.length} cell(s) declared \`error\` are unoccupied:`,
    );
  }

  // #1618: a position declared `error` that no fixture reaches, or one left
  // `off` that a fixture reaches, fails whatever context the fixtures are in.
  const positionFailures = positionViolations.filter(
    (v) => v.severity !== "warn",
  );
  if (positionFailures.length > 0) {
    failures.push(
      `${positionFailures.length} position(s) no fixture of the code reaches (\`error\`) or one reaches (\`off\`):`,
    );
    failures.push(
      ...positionFailures.map(
        (v) => `  ADR-${v.id}  ${v.position} (${v.severity})`,
      ),
    );
  }

  if (failures.length > 0) {
    console.error(chalk.red(failures.join("\n")));
    if (errors.length > 0) {
      printViolations(errors);
      printContextNotDerivableHint(errors, occupancy);
    }
    process.exit(1);
  }

  const warnings = violations.filter((v) => v.severity === "warn");
  if (warnings.length > 0) {
    console.log(
      chalk.yellow(
        `${warnings.length} cell(s) declared \`warn\` are unoccupied:`,
      ),
    );
    printViolations(warnings);
  }
  printPositionViolations(
    positionViolations.filter((v) => v.severity === "warn"),
  );
  const otherContradictions = contradictions.filter(
    (c) => !MatrixRule.isCode(c.adr),
  );
  if (otherContradictions.length > 0) {
    console.log(
      chalk.yellow(
        `${otherContradictions.length} \`off\` cell(s) of an ADR-wide or rule table occupied by a tagged fixture (#2303):`,
      ),
    );
    for (const c of otherContradictions) {
      console.log(
        chalk.yellow(`  ADR-${c.adr}  ${c.context} / ${c.relationship}`),
      );
    }
  }
  // #1620 review: listed rather than failed until #2301 gives every
  // registered code an owner or marks it as having none.
  const ungated = MatrixReport.ungatedCodes(declarations, occupancy);
  if (ungated.length > 0) {
    console.log(
      chalk.yellow(
        `${ungated.length} code(s) asserted by tagged fixtures but declared by no ADR's code table (#2301):`,
      ),
    );
    for (const id of ungated) console.log(chalk.yellow(`  ADR-${id}`));
  }
  // Say what was enforced, not just that nothing failed. An identical
  // "satisfied" line for twelve obligations and for zero is what would let a
  // silently-emptied severity table pass unremarked in a CI log.
  console.log(
    chalk.green(
      `Scope-context matrix is satisfied ` +
        `(${declarations.size} ADR(s), ${MatrixReport.obligationCount(declarations)} obligation(s), ` +
        `${MatrixReport.obligationCount(positionDeclarations)} position obligation(s))`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
