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
 *
 * #2518: the manifest is an index and one document per fixture directory
 * (`DiagnosticManifest.documents`), so both modes work on a set of documents
 * keyed by repository path. `write` removes a document whose directory asserts
 * nothing any more.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import CheckOutcome from "./utils/CheckOutcome";

import DiagnosticManifest from "./diagnostics/DiagnosticManifest";
import FileScanner from "./utils/FileScanner";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The manifest's documents as they are on disk, by repository path. */
function committedDocuments(): Map<string, string> {
  const index = join(rootDir, DiagnosticManifest.INDEX);
  const directory = join(rootDir, DiagnosticManifest.DIRECTORY);
  const files = [
    ...(existsSync(index) ? [index] : []),
    ...(existsSync(directory) ? FileScanner.findFiles(directory, ".md") : []),
  ];
  return new Map(
    files.map((file) => [
      relative(rootDir, file).split(sep).join("/"),
      readFileSync(file, "utf-8"),
    ]),
  );
}

/** The documents the generator writes, formatted as they are stored. */
async function freshDocuments(
  current: ReturnType<typeof DiagnosticManifest.collect>,
): Promise<Map<string, string>> {
  const fresh = new Map<string, string>();
  for (const [path, markdown] of DiagnosticManifest.documents(current)) {
    fresh.set(
      path,
      await GeneratedMarkdown.format(markdown, join(rootDir, path)),
    );
  }
  return fresh;
}

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);

  const current = DiagnosticManifest.collect(rootDir);
  const fresh = await freshDocuments(current);
  const committed = committedDocuments();

  // Both modes decide in DiagnosticManifest and only print here, so the
  // ordering between "an assertion was lost" and "the file is stale" is
  // reachable from a test rather than buried in a CLI entry point.
  const outcome =
    mode === "write"
      ? DiagnosticManifest.writeOutcome(committed, current)
      : DiagnosticManifest.checkOutcome(
          committed,
          current,
          fresh,
          DiagnosticManifest.orphans(rootDir),
        );

  if (mode === "write") {
    for (const path of DiagnosticManifest.stale(committed, fresh)) {
      const file = join(rootDir, path);
      const document = fresh.get(path);
      if (document === undefined) {
        rmSync(file);
      } else {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, document);
      }
    }
    console.log(
      chalk.green(
        `Wrote ${DiagnosticManifest.INDEX} and ${fresh.size - 1} document(s) under ${DiagnosticManifest.DIRECTORY}/ (${current.length} fixture(s))`,
      ),
    );
  }

  process.exitCode = CheckOutcome.report(outcome);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
