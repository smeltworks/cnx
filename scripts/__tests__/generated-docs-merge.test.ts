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
 * #2518: taking the count out was not enough for the manifest. It was one
 * sorted table, and git cannot order two insertions at one place: the rows of
 * two new `tests/bugs/issue-NNNN-*` directories sort next to each other, so
 * two pull requests that each added one conflicted. It was also padded, so a
 * fixture path longer than every other rewrote every row. The manifest is now
 * one document per fixture directory, each a list, and the tests below merge
 * the whole set of documents.
 *
 * What they do not cover: two additions at one place in a list of the matrix,
 * or in one directory's document. Those still conflict (#2532).
 */

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";
import MatrixRenderer from "../matrix/MatrixRenderer";
import GeneratedMarkdown from "../utils/GeneratedMarkdown";
import IManifestEntry from "../types/IManifestEntry";
import MatrixTestHelpers from "./matrixTestHelpers";
import MergeTestHelpers from "./mergeTestHelpers";

const { gitMerge, gitMergeTree, inserted } = MergeTestHelpers;

/** The manifest as it is committed: every document by its path, formatted. */
async function manifest(
  entries: readonly IManifestEntry[],
): Promise<Map<string, string>> {
  const documents = DiagnosticManifest.documents(
    [...entries].sort((a, b) => a.fixture.localeCompare(b.fixture)),
  );
  const formatted = new Map<string, string>();
  for (const [path, markdown] of documents) {
    formatted.set(path, await GeneratedMarkdown.format(markdown, path));
  }
  return formatted;
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
  describe("the diagnostic manifest", () => {
    it("merges two branches that each add one fixture into the documents for both", async () => {
      const base = BASE_FIXTURES.map(entry);
      const merged = gitMergeTree(
        await manifest(base),
        await manifest([...base, entry(OURS)]),
        await manifest([...base, entry(THEIRS)]),
      );
      // Equal counts are the quiet failure: git merges two identical edits of
      // a total without a conflict, and the total then counts one branch.
      expect(merged).toEqual(
        await manifest([...base, entry(OURS), entry(THEIRS)]),
      );
    });

    it("merges a branch that adds one fixture with a branch that adds two", async () => {
      const base = BASE_FIXTURES.map(entry);
      const merged = gitMergeTree(
        await manifest(base),
        await manifest([...base, entry(OURS)]),
        await manifest([...base, entry(THEIRS), entry(THEIRS_SECOND)]),
      );
      // Different counts are the loud failure: a total would conflict here.
      expect(merged).toEqual(
        await manifest([
          ...base,
          entry(OURS),
          entry(THEIRS),
          entry(THEIRS_SECOND),
        ]),
      );
    });

    it("merges two branches that each add a directory, where the two sort together (#2518)", async () => {
      // Two issues, two pull requests, two new directories: in one sorted
      // list their rows go into the same gap, after the last existing issue.
      const base = [
        ...BASE_FIXTURES,
        "tests/bugs/issue-9000-zero/zero.test.cnx",
      ].map(entry);
      const first = entry("tests/bugs/issue-9001-first/first-error.test.cnx");
      const second = entry(
        "tests/bugs/issue-9002-second/second-error.test.cnx",
      );
      const merged = gitMergeTree(
        await manifest(base),
        await manifest([...base, first]),
        await manifest([...base, second]),
      );
      expect(merged).toEqual(await manifest([...base, first, second]));
    });

    it("merges two branches that add fixtures to one directory, apart from each other", async () => {
      // One directory is still one sorted list. Its rows merge as long as the
      // two additions do not sit at one place in it.
      const directory = ["a", "c", "e"].map((name) =>
        entry(`tests/adr-005/${name}-error.test.cnx`),
      );
      const early = entry("tests/adr-005/b-error.test.cnx");
      const late = entry("tests/adr-005/d-error.test.cnx");
      const merged = gitMergeTree(
        await manifest(directory),
        await manifest([...directory, early]),
        await manifest([...directory, late]),
      );
      expect(merged).toEqual(await manifest([...directory, early, late]));
    });

    it("adds a path longer than every other by inserting its own line (#2518)", async () => {
      // In a padded table the longest cell sets every row's width, so one
      // long path rewrote each of them: 1072 lines for one new fixture.
      const base = BASE_FIXTURES.map(entry);
      const long = entry(
        `tests/adr-005/${"a-name-longer-than-any-other-".repeat(4)}error.test.cnx`,
      );
      const before = await manifest(base);
      const after = await manifest([...base, long]);

      expect([...after.keys()]).toEqual([...before.keys()]);
      const added = [...before].flatMap(
        ([path, markdown]) =>
          inserted(markdown, after.get(path) ?? "") ?? [null],
      );
      expect(added).toEqual([expect.stringContaining(long.fixture)]);
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

  it("reports a conflicting path as null, so a clean merge of documents above is a real one", () => {
    // The control for `gitMergeTree`: the same path added twice with different
    // text, a path changed and deleted, and the cases that are no conflict.
    const tree = (files: Record<string, string>): Map<string, string> =>
      new Map(Object.entries(files));
    expect(
      gitMergeTree(tree({}), tree({ a: "1\n" }), tree({ a: "2\n" })),
    ).toBeNull();
    expect(
      gitMergeTree(tree({ a: "1\n" }), tree({ a: "2\n" }), tree({})),
    ).toBeNull();
    expect(
      gitMergeTree(
        tree({ a: "1\n", b: "x\n" }),
        tree({ a: "1\n", c: "y\n" }),
        tree({ a: "1\n", b: "x\n", d: "z\n" }),
      ),
    ).toEqual(tree({ a: "1\n", c: "y\n", d: "z\n" }));
  });

  it("reports a conflict as null, so a clean merge above is a real one", () => {
    // The control for `gitMerge` itself: two different edits of one line.
    expect(gitMerge("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n")).toBeNull();
    expect(gitMerge("a\nb\nc\n", "a\nb\nc\nd\n", "0\na\nb\nc\n")).toBe(
      "0\na\nb\nc\nd\n",
    );
  });
});
