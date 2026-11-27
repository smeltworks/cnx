/**
 * Issue #2520: the two generated site documents have to survive a merge.
 *
 * `docs/architecture/scope-join-sites.md` ended its table with a `**total**`
 * row and the line `48 site(s) across 24 file(s).`, and
 * `docs/architecture/parse-tree-sites.md` held a table of counts by layer and
 * the line `1 module(s).`. A line that counts the rows changes in every pull
 * request that adds or removes one, so two of them conflict on it, or merge
 * to a count that matches neither (#2517 took the same lines out of the
 * manifest and the matrix).
 *
 * These tests do what git does: render a base document and two documents
 * that each add a different row, merge the three with `git merge-file`, and
 * require the merge to be clean AND equal to the document generated for both
 * additions together.
 *
 * What they do not cover: two additions in the same gap between rows, and a
 * row wider than every other, which re-pads the table. Both still conflict,
 * so every row added here sits in a gap of its own and is no wider than the
 * base's rows.
 */

import { describe, expect, it } from "vitest";

import ParseTreeSites from "../parse-tree/ParseTreeSites";
import ScopeJoinSites from "../scope-joins/ScopeJoinSites";
import GeneratedMarkdown from "../utils/GeneratedMarkdown";
import MergeTestHelpers from "./mergeTestHelpers";

const { gitMerge } = MergeTestHelpers;

const ELEMENT = "fromSourceName(x)";

/** The scope-join document as it is committed, one site in each file */
function scopeJoins(files: readonly string[]): Promise<string> {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  return GeneratedMarkdown.format(
    ScopeJoinSites.render(
      sorted.map((file) => ({ file, element: ELEMENT, count: 1 })),
      sorted.map((file) => ({
        file,
        element: ELEMENT,
        kind: "written-name" as const,
        why: "test fixture",
      })),
    ),
    "docs/architecture/scope-join-sites.md",
  );
}

/** The parse-tree document as it is committed, for modules that hold the grammar */
function parseTree(modules: readonly string[]): Promise<string> {
  return GeneratedMarkdown.format(
    ParseTreeSites.render(
      ParseTreeSites.sites(
        modules.map((from) => ({
          from,
          to: "src/cnx/PARSE/2-Parse/grammar/CnxParser.ts",
          rule: { name: ParseTreeSites.RULE },
        })),
      ),
    ),
    "docs/architecture/parse-tree-sites.md",
  );
}

// Three rows, so the two additions below each land in a gap of their own.
const BASE = ["src/cnx/a/A.ts", "src/cnx/c/C.ts", "src/cnx/e/E.ts"];
const OURS = "src/cnx/b/B.ts";
const THEIRS = "src/cnx/d/D.ts";
const THEIRS_SECOND = "src/cnx/f/F.ts";

describe("a generated site document merges (#2520)", () => {
  it("merges two branches that each add a qualified-name site", async () => {
    const merged = gitMerge(
      await scopeJoins(BASE),
      await scopeJoins([...BASE, OURS]),
      await scopeJoins([...BASE, THEIRS]),
    );
    expect(merged).toBe(await scopeJoins([...BASE, OURS, THEIRS]));
  });

  it("merges two branches that each add a module holding a parse tree", async () => {
    const merged = gitMerge(
      await parseTree(BASE),
      await parseTree([...BASE, OURS]),
      await parseTree([...BASE, THEIRS]),
    );
    expect(merged).toBe(await parseTree([...BASE, OURS, THEIRS]));
  });

  it("goes wrong once a line counts the rows, so a clean merge above is a real one", async () => {
    // The control: the same documents with a line like the one #2520 removed.
    const counted = async (files: readonly string[]): Promise<string> =>
      `${await scopeJoins(files)}\n${files.length} site(s).\n`;
    const base = await counted(BASE);
    const ours = await counted([...BASE, OURS]);

    // Different counts are the loud failure: the two edits of the line conflict.
    expect(
      gitMerge(base, ours, await counted([...BASE, THEIRS, THEIRS_SECOND])),
    ).toBeNull();

    // Equal counts are the quiet one: git merges two identical edits of the
    // line, and the document then counts four sites and lists five.
    const quiet = gitMerge(base, ours, await counted([...BASE, THEIRS]));
    expect(quiet).not.toBeNull();
    expect(quiet).toContain("\n4 site(s).\n");
    expect(quiet).not.toBe(await counted([...BASE, OURS, THEIRS]));
  });
});
