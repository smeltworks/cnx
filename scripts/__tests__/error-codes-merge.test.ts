/**
 * Issue #2521: registering an error code has to survive a merge.
 *
 * `docs/error-codes.md` is edited by every pull request that adds a
 * diagnostic. Its range table counted the codes of each range and totalled
 * them, and `error-codes:check` failed unless the counts matched the rows. So
 * a registration was three edits, and two of them were to lines that every
 * other registration rewrites too. Two pull requests that registered codes in
 * different tables conflicted on the counts, or merged to a total that counted
 * one of them.
 *
 * These tests register codes in the committed registry the way an author does
 * and merge the results the way git does. A registration must be inserted
 * lines and nothing else, and two of them in different places must merge to a
 * registry the check accepts.
 *
 * What they do not cover: two registrations in one place. Two pull requests
 * that each take "the next available code" take the same code, and two new
 * checks both go after the highest one. Those still conflict (#2522), so every
 * pair registered here is in two places.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import ErrorCodeRegistry from "../diagnostics/ErrorCodeRegistry";
import GeneratedMarkdown from "../utils/GeneratedMarkdown";
import SourceModule from "../utils/SourceModule";
import MergeTestHelpers from "./mergeTestHelpers";

const { gitMerge } = MergeTestHelpers;

const REGISTRY_PATH = join("docs", "error-codes.md");

/** The registry as it is committed. */
const committed = readFileSync(
  join(SourceModule.rootDir, REGISTRY_PATH),
  "utf8",
);

/** Where a new check's own section goes: after the highest code. */
const AFTER_EVERY_CODE = "## Adding New Error Codes";

/** Every code holds a row, so the check has only the registry's shape to judge. */
const errors = (markdown: string): string[] =>
  ErrorCodeRegistry.check(
    markdown,
    new Set(ErrorCodeRegistry.rows(markdown).map((row) => row.code)),
  );

/** The highest code a range holds: `E0603` for `E06`. */
function highest(markdown: string, range: string): string {
  const codes = ErrorCodeRegistry.rows(markdown)
    .map((row) => row.code)
    .filter((code) => code.startsWith(range));
  return codes[codes.length - 1];
}

/** "The next available code" of a range, as an author reads it off the registry. */
function next(markdown: string, range: string): string {
  const number = Number.parseInt(highest(markdown, range).slice(1), 10) + 1;
  return `E${String(number).padStart(4, "0")}`;
}

/**
 * Register `code` as its range's next row: under the highest one, in its table.
 *
 * The row is padded to the table's columns here, as the pre-commit hook would
 * store it. Calling the formatter instead costs seconds a registration: it
 * reformats every table of the registry to pad one row.
 */
function registerRow(markdown: string, code: string): string {
  const lines = markdown.split("\n");
  const above = lines.findIndex((line) =>
    line.startsWith(`| ${highest(markdown, code.slice(0, 3))} `),
  );
  let header = above;
  while (!lines[header].startsWith("| Code ")) header -= 1;
  const widths = lines[header]
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.length);
  const middle = new Array<string>(widths.length - 2).fill("x");
  const row = [code, ...middle, "`a.ts`"].map((cell, column) =>
    ` ${cell}`.padEnd(widths[column]),
  );
  lines.splice(above + 1, 0, `|${row.join("|")}|`);
  return lines.join("\n");
}

/** Register `code` as a new check: its own heading and table, after every code. */
function registerSection(markdown: string, code: string): string {
  const section = [
    `## ${code} — A New Check`,
    "",
    "| Code  | Message | Help | Source |",
    "| ----- | ------- | ---- | ------ |",
    `| ${code} | x       | x    | \`a.ts\` |`,
    "",
    "",
  ].join("\n");
  return markdown.replace(AFTER_EVERY_CODE, section + AFTER_EVERY_CODE);
}

/**
 * The lines `after` holds beyond `before`'s, or null when a line of `before`
 * is changed or gone.
 */
function inserted(before: string, after: string): string[] | null {
  const kept = before.split("\n");
  const added: string[] = [];
  let at = 0;
  for (const line of after.split("\n")) {
    if (at < kept.length && line === kept[at]) at += 1;
    else added.push(line);
  }
  return at === kept.length ? added : null;
}

describe("registering an error code merges (#2521)", () => {
  it("registers a table's next code by inserting one row", () => {
    const code = next(committed, "E06");
    const registered = registerRow(committed, code);

    const added = inserted(committed, registered);
    expect(added).toHaveLength(1);
    expect(added?.[0].startsWith(`| ${code} `)).toBe(true);
    // The row is the whole registration: a count of the range, or a total,
    // would be a second edit the check waits for.
    expect(errors(registered)).toEqual([]);
  });

  it("registers a new check by inserting its section", () => {
    const registered = registerSection(committed, next(committed, "E09"));

    expect(inserted(committed, registered)).toHaveLength(6);
    expect(errors(registered)).toEqual([]);
  });

  it("merges two branches that each register a code in a different range", () => {
    const ours = registerRow(committed, next(committed, "E06"));
    const theirs = registerRow(committed, next(committed, "E07"));

    const merged = gitMerge(committed, ours, theirs);
    expect(merged).toBe(registerRow(ours, next(committed, "E07")));
    expect(errors(merged ?? "")).toEqual([]);
  });

  it("merges a branch that registers a row with a branch that registers a new check", () => {
    const ours = registerRow(committed, next(committed, "E07"));
    const theirs = registerSection(committed, next(committed, "E09"));

    const merged = gitMerge(committed, ours, theirs);
    expect(merged).toBe(registerSection(ours, next(committed, "E09")));
    expect(errors(merged ?? "")).toEqual([]);
  });

  it("registers them as the formatter stores them", async () => {
    // The control for the two helpers above: a registration nobody would
    // commit in this shape would say nothing about one somebody does.
    const registered = registerSection(
      registerRow(committed, next(committed, "E06")),
      next(committed, "E09"),
    );
    expect(await GeneratedMarkdown.format(registered, REGISTRY_PATH)).toBe(
      registered,
    );
  }, 30_000);
});
