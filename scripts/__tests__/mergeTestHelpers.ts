/**
 * Issue #2521: what git makes of two edits to one committed document.
 *
 * Extracted from `generated-docs-merge.test.ts` (#2517) when the error-code
 * registry needed the same question answered. A second copy would be a second
 * definition of what "merges cleanly" means, free to drift from the first --
 * the duplicate path this project forbids.
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

export default class MergeTestHelpers {
  static readonly gitMerge = gitMerge;
}
