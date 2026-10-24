#!/usr/bin/env tsx
/**
 * Issue #1317: gate the population of modules holding an ANTLR parse tree.
 *
 * `write` regenerates `docs/architecture/parse-tree-sites.md`; `check`
 * regenerates in memory and fails when a module joined the population, or when
 * the committed document is stale because one left. Following
 * `scripts/scope-join-sites.ts` and `scripts/diagnostic-manifest.ts`.
 *
 * The population comes from dependency-cruiser, invoked by `Depcruise` through
 * the SAME binary and config `npm run depcruise` uses, so this check and the
 * architecture rule cannot drift apart -- there is one definition of "holds a
 * parse tree" and it lives in `.dependency-cruiser.cjs`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import CheckOutcome from "./utils/CheckOutcome";

import ParseTreeSites from "./parse-tree/ParseTreeSites";
import Depcruise from "./utils/Depcruise";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(rootDir, "docs", "architecture", "parse-tree-sites.md");

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);

  const sites = ParseTreeSites.sites(Depcruise.violations(rootDir));
  const document = await GeneratedMarkdown.format(
    ParseTreeSites.render(sites),
    docPath,
  );

  if (mode === "write") {
    // `write` still refuses to run on an empty population: regenerating a doc
    // to zero rows is how a rule that stopped matching gets its baseline
    // rewritten to agree with it, which would license deleting the gate.
    const empty = ParseTreeSites.emptinessError(sites);
    if (empty !== null) {
      console.error(chalk.red(empty));
      process.exit(1);
    }
    writeFileSync(docPath, document);
    console.log(chalk.green(`Wrote ${docPath} (${sites.length} module(s))`));
    return;
  }

  // Every decision -- emptiness, missing file, population drift, staleness and
  // the ordering between them -- is made in `ParseTreeSites.checkOutcome` so a
  // test can reach it. This function only prints and sets the exit code, which
  // is the shape `diagnostic-manifest.ts` settled on and the one #1317 should
  // have copied.
  const outcome = ParseTreeSites.checkOutcome(
    existsSync(docPath) ? readFileSync(docPath, "utf-8") : null,
    sites,
    document,
  );

  CheckOutcome.report(outcome);
}

void main();
