/**
 * Issue #2517: a generated document that is committed has to survive a merge.
 *
 * Two pull requests that each add a fixture both change the document, and git
 * merges the two edits line by line. A line that counts the rows below it
 * changes in every one of those pull requests, so any two of them either
 * conflict (the counts differ) or merge to a count neither generator would
 * write (the counts are equal). `docs/diagnostic-manifest.md` carried one such
 * line and `docs/scope-context-matrix.md` one per ADR section; #2501 was sent
 * back to merge main and regenerate three times in ten hours for them.
 *
 * So these tests do what git does: render a base document and two documents
 * that each add different rows to it, merge the three with `git merge-file`,
 * and require the merge to be clean AND equal to the document generated for
 * both additions together.
 *
 * What they do not cover: two additions that land in the same gap between
 * existing rows, and a row wider than every existing one, which re-pads the
 * whole table. Both still conflict (#2518), so every row added here sits in a
 * gap of its own and is no wider than the base's rows.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";
import MatrixRenderer from "../matrix/MatrixRenderer";
import GeneratedMarkdown from "../utils/GeneratedMarkdown";
import IManifestEntry from "../types/IManifestEntry";
import MatrixTestHelpers from "./matrixTestHelpers";

/**
 * What `git merge` makes of two edits to `base`: the merged text, or null when
 * the edits conflict. `git merge-file` exits with the number of conflicts.
 */
function gitMerge(base: string, ours: string, theirs: string): string | null {
  const dir = mkdtempSync(join(tmpdir(), "cnx-generated-merge-"));
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

/** The manifest as it is committed: rendered, then formatted. */
function manifest(entries: readonly IManifestEntry[]): Promise<string> {
  return GeneratedMarkdown.format(
    DiagnosticManifest.render(
      [...entries].sort((a, b) => a.fixture.localeCompare(b.fixture)),
    ),
    "docs/diagnostic-manifest.md",
  );
}

/** The matrix as it is committed, for one ADR whose fixtures have no context. */
function matrix(fixturesWithoutContext: readonly string[]): Promise<string> {
  return GeneratedMarkdown.format(
    MatrixRenderer.renderDocument(
      new Map([["051", MatrixTestHelpers.declare("051", [])]]),
      new Map([
        [
          "051",
          {
            adr: "051",
            cells: new Map(),
            fixturesWithoutContext: [...fixturesWithoutContext],
            positions: new Map(),
          },
        ],
      ]),
    ),
    "docs/scope-context-matrix.md",
  );
}

const entry = (fixture: string): IManifestEntry => ({
  fixture,
  codes: ["E0001"],
});

// Three rows, so the two additions below each land in a gap of their own.
const BASE_FIXTURES = [
  "tests/adr-001/first-error.test.cnx",
  "tests/adr-005/fifth-error.test.cnx",
  "tests/adr-009/ninth-error.test.cnx",
];
const OURS = "tests/adr-003/third-error.test.cnx";
const THEIRS = "tests/adr-007/seven-error.test.cnx";
const THEIRS_SECOND = "tests/adr-008/eight-error.test.cnx";

describe("a generated document merges (#2517)", () => {
  describe("docs/diagnostic-manifest.md", () => {
    it("merges two branches that each add one fixture into the document for both", async () => {
      const base = BASE_FIXTURES.map(entry);
      const merged = gitMerge(
        await manifest(base),
        await manifest([...base, entry(OURS)]),
        await manifest([...base, entry(THEIRS)]),
      );
      // Equal counts are the quiet failure: git merges two identical edits of
      // a total without a conflict, and the total then counts one branch.
      expect(merged).toBe(
        await manifest([...base, entry(OURS), entry(THEIRS)]),
      );
    });

    it("merges a branch that adds one fixture with a branch that adds two", async () => {
      const base = BASE_FIXTURES.map(entry);
      const merged = gitMerge(
        await manifest(base),
        await manifest([...base, entry(OURS)]),
        await manifest([...base, entry(THEIRS), entry(THEIRS_SECOND)]),
      );
      // Different counts are the loud failure: a total would conflict here.
      expect(merged).toBe(
        await manifest([
          ...base,
          entry(OURS),
          entry(THEIRS),
          entry(THEIRS_SECOND),
        ]),
      );
    });
  });

  describe("docs/scope-context-matrix.md", () => {
    it("merges two branches that each add one fixture with no derivable context", async () => {
      const merged = gitMerge(
        await matrix(BASE_FIXTURES),
        await matrix([...BASE_FIXTURES, OURS]),
        await matrix([...BASE_FIXTURES, THEIRS]),
      );
      expect(merged).toBe(await matrix([...BASE_FIXTURES, OURS, THEIRS]));
    });

    it("merges a branch that adds one such fixture with a branch that adds two", async () => {
      const merged = gitMerge(
        await matrix(BASE_FIXTURES),
        await matrix([...BASE_FIXTURES, OURS]),
        await matrix([...BASE_FIXTURES, THEIRS, THEIRS_SECOND]),
      );
      expect(merged).toBe(
        await matrix([...BASE_FIXTURES, OURS, THEIRS, THEIRS_SECOND]),
      );
    });
  });

  it("reports a conflict as null, so a clean merge above is a real one", () => {
    // The control for `gitMerge` itself: two different edits of one line.
    expect(gitMerge("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n")).toBeNull();
    expect(gitMerge("a\nb\nc\n", "a\nb\nc\nd\n", "0\na\nb\nc\n")).toBe(
      "0\na\nb\nc\nd\n",
    );
  });
});
