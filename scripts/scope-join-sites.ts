#!/usr/bin/env tsx
/**
 * Issues #1357 and #2116: gate every site that builds a qualified C name.
 *
 * `write` regenerates `docs/architecture/scope-join-sites.md`; `check`
 * regenerates in memory and fails when a file gained sites, or when the
 * committed document is stale because sites were removed. Following
 * `scripts/diagnostic-manifest.ts` and `scripts/adr-matrix.ts`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import chalk from "chalk";
import CheckOutcome from "./utils/CheckOutcome";

import ScopeJoinSites from "./scope-joins/ScopeJoinSites";
import FileScanner from "./utils/FileScanner";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";
import SourceModule from "./utils/SourceModule";

const docPath = join(
  SourceModule.rootDir,
  "docs",
  "architecture",
  "scope-join-sites.md",
);
const srcDir = join(SourceModule.rootDir, "src");

function collectSources(): Map<string, string> {
  const sources = new Map<string, string>();
  for (const full of FileScanner.findFiles(srcDir, ".ts")) {
    if (!SourceModule.isModule(full)) {
      continue;
    }
    sources.set(SourceModule.relativePath(full), readFileSync(full, "utf-8"));
  }
  return sources;
}

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);

  const sites = ScopeJoinSites.sites(collectSources());
  const document = await GeneratedMarkdown.format(
    ScopeJoinSites.render(sites),
    docPath,
  );

  if (mode === "write") {
    writeFileSync(docPath, document);
    const total = sites.reduce((sum, row) => sum + row.count, 0);
    console.log(chalk.green(`Wrote ${docPath} (${total} site(s))`));
    return;
  }

  // Every decision -- the missing document, the population diffs, the
  // adjudication checks, staleness, and the ordering between them -- is made in
  // `ScopeJoinSites.checkOutcome`. This function prints and sets the exit code,
  // which is the shape `diagnostic-manifest.ts` settled on.
  const outcome = ScopeJoinSites.checkOutcome(
    existsSync(docPath) ? readFileSync(docPath, "utf-8") : null,
    sites,
    document,
  );

  process.exitCode = CheckOutcome.report(outcome);
}

void main();
