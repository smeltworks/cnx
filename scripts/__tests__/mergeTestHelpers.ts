/**
 * Issue #2521: what git makes of two edits to one committed document.
 *
 * Extracted from `generated-docs-merge.test.ts` (#2517) when the error-code
 * registry needed the same question answered. A second copy would be a second
 * definition of what "merges cleanly" means, free to drift from the first --
 * the duplicate path this project forbids.
 *
 * #2518 added the same question for a set of documents (`gitMergeTree`), once
 * the manifest became one document per fixture directory.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * What `git merge` makes of two edits to `base`: the merged text, or null when
 * the edits conflict. `git merge-file` exits with the number of conflicts.
 */
function gitMerge(base: string, ours: string, theirs: string): string | null {
  const dir = mkdtempSync(join(tmpdir(), "cnx-document-merge-"));
  try {
    writeFileSync(join(dir, "base"), base);
    writeFileSync(join(dir, "ours"), ours);
    writeFileSync(join(dir, "theirs"), theirs);
    try {
      return execFileSync(
        "git",
        ["merge-file", "-p", "ours", "base", "theirs"],
        { cwd: dir, encoding: "utf8" },
      );
    } catch (error) {
      const status = (error as { status?: number | null }).status;
      if (typeof status === "number" && status > 0) return null;
      throw error;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * What `git merge` makes of two edits to a set of documents, each keyed by its
 * path: the merged set, or null when any path conflicts.
 *
 * A path only one branch adds, changes or deletes is that branch's. A path
 * both add is a conflict unless they add the same text, and so is a path one
 * deletes and the other changes.
 */
function gitMergeTree(
  base: ReadonlyMap<string, string>,
  ours: ReadonlyMap<string, string>,
  theirs: ReadonlyMap<string, string>,
): Map<string, string> | null {
  const merged = new Map<string, string>();
  for (const path of new Set([
    ...base.keys(),
    ...ours.keys(),
    ...theirs.keys(),
  ])) {
    const [before, mine, yours] = [base, ours, theirs].map((tree) =>
      tree.get(path),
    );
    let text: string | null | undefined;
    if (mine === yours) text = mine;
    else if (mine === before) text = yours;
    else if (yours === before) text = mine;
    else if (before === undefined || mine === undefined || yours === undefined)
      return null;
    else text = gitMerge(before, mine, yours);
    if (text === null) return null;
    if (text !== undefined) merged.set(path, text);
  }
  return merged;
}

/**
 * The lines `after` holds beyond `before`'s, or null when a line of `before`
 * is changed or gone: whether an edit was insertions and nothing else.
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

export default class MergeTestHelpers {
  static readonly gitMerge = gitMerge;
  static readonly gitMergeTree = gitMergeTree;
  static readonly inserted = inserted;
}
