#!/usr/bin/env tsx
/**
 * Issue #1416: a `gh` read that silently returns page one is indistinguishable
 * from one that returned everything.
 *
 * There is no exemption mechanism, for the reason `adr-independence.ts` gives:
 * a gate that can be opted out of eventually is.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import CheckOutcome from "./utils/CheckOutcome";

import GhPagination from "./gh-pagination/GhPagination";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const outcome = GhPagination.run(rootDir);

CheckOutcome.printViolations(outcome.failures);

console.log(
  `Scanned ${outcome.scanned} tracked file(s) for gh invocations. No exemption mechanism exists.`,
);

// The unit suite asserts this number is plausible; until now the CLI only
// printed it, and the CLI is what `gate.sh` and the `lint` job run. Anything
// that empties the candidate list -- `git grep` missing from a runner image,
// the `-F 'gh '` literal drifting, a changed cwd -- turned the gate GREEN.
// That is this PR's own subject one level up: a truncated read reporting as a
// complete one. A repository with no candidates is not a clean repository.
if (outcome.scanned === 0) {
  console.log(
    chalk.red(
      "\nScanned 0 files: the candidate filter found nothing, which is a broken selector reporting a clean repository.",
    ),
  );
  process.exit(1);
}

if (outcome.failures.length > 0) {
  console.log(
    chalk.red(`\nUnbounded gh reads: ${outcome.failures.length} violation(s).`),
  );
  console.log(
    "gh list commands default to 30 and REST collections page at 30; neither reports it.",
  );
  console.log(
    "Fix with --limit N (and assert the count stays below it), or --paginate driving $endCursor.",
  );
  process.exit(1);
}

console.log(chalk.green("Every gh read is bounded."));
