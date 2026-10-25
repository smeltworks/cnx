#!/usr/bin/env tsx
/**
 * Issue #1316: the committed manifest of fixtures that assert a diagnostic.
 *
 * A `.expected.error` is the only assertion that a diagnostic fires, and nothing
 * noticed one going away. Under `--update` the harness unlinked it and reported
 * the run green; by hand it is a deleted file, which reads as tidying. Either way
 * a lost diagnostic and an intentional fix were indistinguishable -- on the one
 * command a diagnostic migration runs repeatedly, across 287 fixtures.
 *
 * Modes are write / check, following `scripts/adr-matrix.ts`: `check`
 * regenerates in memory, diffs against what is committed, AND reports shrinkage.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import CheckOutcome from "./utils/CheckOutcome";

import DiagnosticManifest from "./diagnostics/DiagnosticManifest";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(rootDir, "docs", "diagnostic-manifest.md");

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);

  const current = DiagnosticManifest.collect(rootDir);
  const document = await GeneratedMarkdown.format(
    DiagnosticManifest.render(current),
    manifestPath,
  );
  const committed = existsSync(manifestPath)
    ? readFileSync(manifestPath, "utf-8")
    : null;

  // Both modes decide in DiagnosticManifest and only print here, so the
  // ordering between "an assertion was lost" and "the file is stale" is
  // reachable from a test rather than buried in a CLI entry point.
  const outcome =
    mode === "write"
      ? DiagnosticManifest.writeOutcome(committed, current)
      : DiagnosticManifest.checkOutcome(
          committed,
          current,
          document,
          DiagnosticManifest.orphans(rootDir),
        );

  if (mode === "write") {
    writeFileSync(manifestPath, document);
    console.log(
      chalk.green(`Wrote ${manifestPath} (${current.length} fixture(s))`),
    );
  }

  process.exitCode = CheckOutcome.report(outcome);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
