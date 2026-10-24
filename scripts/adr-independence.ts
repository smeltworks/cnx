#!/usr/bin/env tsx
/**
 * Issue #1403: ADRs must survive a rewrite of the transpiler in another stack.
 *
 * The baseline this landed with is gone: it reached zero on 2026-08-31 and was
 * deleted with the branch that read it, so there is no longer any way to exempt an
 * ADR from the check. A gate that can be opted out of eventually is.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import CheckOutcome from "./utils/CheckOutcome";

import AdrIndependence from "./adr-independence/AdrIndependence";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const outcome = AdrIndependence.run(rootDir);

CheckOutcome.printViolations(outcome.failures);

console.log(
  `Scanned ${outcome.scanned} ADR(s). No exemption mechanism exists: every ADR is checked.`,
);

if (outcome.failures.length > 0) {
  console.log(
    chalk.red(
      `\nRewrite test failed: ${outcome.failures.length} violation(s).`,
    ),
  );
  console.log("What an ADR may contain: docs/decisions/README.md");
  process.exit(1);
}

console.log(chalk.green("Rewrite test passed for every ADR."));
