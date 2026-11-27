#!/usr/bin/env tsx
/**
 * Issue #1322: has this BRANCH lost a diagnostic?
 *
 * `npm run diagnostics:manifest:check` compares the committed manifest against
 * the working tree. That is right per commit and says nothing across a branch:
 * a commit that deletes a row AND its fixture is internally consistent and
 * passes, and so does the next one, and the loss is only visible by comparing
 * the two ends.
 *
 * #1322's definition of done is the across-the-branch claim -- 145 diagnostics
 * relocate, 23 are deleted, and none may vanish unremarked -- so the comparison
 * it needs did not exist. This is it:
 *
 *     npm run diagnostics:manifest:compare -- origin/main
 *
 * It reads the base manifest with `git show`, every document of it that the
 * ref holds: the index and one document per fixture directory since #2518,
 * the one table before. It compares CODE SETS, not fixture paths, because this
 * card also moves fixtures into `tests/adr-NNN/`. See
 * `DiagnosticManifest.compareToBase`.
 *
 * Not in `gate.sh`: it needs a base ref, and the right one is a property of the
 * branch rather than of the tree.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import DiagnosticManifest from "./diagnostics/DiagnosticManifest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** One git command's output, as text. */
function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function baseManifest(ref: string): string {
  try {
    const documents = git([
      "ls-tree",
      "-r",
      "--name-only",
      ref,
      "--",
      DiagnosticManifest.INDEX,
      DiagnosticManifest.DIRECTORY,
    ])
      .split("\n")
      .filter((path) => DiagnosticManifest.isDocument(path));
    if (documents.length === 0) {
      throw new Error(`no manifest at ${ref}`);
    }
    return git(["show", ...documents.map((path) => `${ref}:${path}`)]);
  } catch {
    // Reported rather than absorbed: an unreadable base makes every comparison
    // below vacuously true, which is the shape of a guard that cannot fail.
    console.error(
      chalk.red(
        `Could not read the diagnostic manifest at '${ref}'.\n` +
          `Give a ref that exists, e.g. the merge base:\n` +
          `  npm run diagnostics:manifest:compare -- $(git merge-base origin/main HEAD)`,
      ),
    );
    process.exit(1);
  }
}

function main(): void {
  const ref = process.argv[2];
  if (ref === undefined || ref.startsWith("-")) {
    console.error(
      chalk.red(
        "Usage: npm run diagnostics:manifest:compare -- <base-ref>\n" +
          "  e.g. -- $(git merge-base origin/main HEAD)",
      ),
    );
    process.exit(1);
  }

  const base = DiagnosticManifest.parse(baseManifest(ref));
  const current = DiagnosticManifest.collect(rootDir);
  const { lostCodes, movedFixtures } = DiagnosticManifest.compareToBase(
    base,
    current,
  );

  if (movedFixtures.length > 0) {
    console.log(
      chalk.yellow(
        `${movedFixtures.length} fixture(s) present at ${ref} are gone by name.\n` +
          `Each should pair with a new path; confirm the pairing:\n` +
          movedFixtures.map((fixture) => `  ${fixture}`).join("\n"),
      ),
    );
  }

  if (lostCodes.length > 0) {
    console.error(
      chalk.red(
        `\n${lostCodes.length} diagnostic code(s) asserted at ${ref} are asserted by no fixture now:\n` +
          lostCodes.map((code) => `  ${code}`).join("\n") +
          `\n\nA relocated diagnostic keeps its code. A code that disappears is either` +
          `\na regression, or a removal that must be stated -- not a silent diff.`,
      ),
    );
    process.exit(1);
  }

  console.log(
    chalk.green(
      `No diagnostic code lost since ${ref} (${base.length} base fixture(s), ${current.length} now).`,
    ),
  );
}

main();
