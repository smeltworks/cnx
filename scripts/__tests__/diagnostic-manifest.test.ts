/**
 * Tests for the diagnostic manifest (issue #1316).
 *
 * The manifest is the committed record that a fixture asserts a diagnostic. Its
 * whole purpose is to fail when that record shrinks, so these tests are written
 * against shrinkage specifically -- a manifest that only ever grows is the green
 * suite the issue describes.
 */

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";

describe("DiagnosticManifest.parseCodes", () => {
  it("extracts an E-code from a coded diagnostic", () => {
    expect(
      DiagnosticManifest.parseCodes(
        // Any coded diagnostic will do; this one is verbatim from
        // tests/static-allocation/calloc-error.expected.error so it stays a real
        // sample rather than drifting into a shape the corpus never produces.
        "6:4 error[E0902]: Importing dynamic memory function 'calloc' from C/C++ is forbidden\n",
      ),
    ).toEqual(["E0902"]);
  });

  it("extracts a MISRA rule code", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "5:20 error[MISRA-3.1]: Nested comment marker found inside comment\n",
      ),
    ).toEqual(["MISRA-3.1"]);
  });

  it("extracts a bare code after a codegen throw", () => {
    // `Code generation failed: E0504: ...` -- 3 fixtures, invisible to the
    // bracket-only pattern, so `code-removed` could never fire for them.
    expect(
      DiagnosticManifest.parseCodes(
        '1:0 Code generation failed: E0504: Found #include "helper.hpp"\n',
      ),
    ).toEqual(["E0504"]);
  });

  it("extracts a capitalized bracketed code after a codegen throw", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: Error[E0602]: sizeof() operand must not\n",
      ),
    ).toEqual(["E0602"]);
  });

  it("extracts a capitalized unbracketed code after a codegen throw", () => {
    // The largest missed group: E0701(10) E0702(9) E0707(6) E0705(1).
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: Error E0702: Function call in condition\n",
      ),
    ).toEqual(["E0702"]);
  });

  it("does not invent a code from a bare four-digit number", () => {
    // Control against over-matching: only E#### and MISRA-x.y are codes. A
    // message quoting a width, an address or a year must stay uncoded.
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: value 1234 exceeds 0xE0900 at line 8080\n",
      ),
    ).toEqual([]);
  });

  it("returns no codes for an uncoded codegen throw", () => {
    // 116 of 287 fixtures look like this today -- the throws #1313 relocates.
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: cannot assign to const variable 'COUNTER'\n",
      ),
    ).toEqual([]);
  });

  it("deduplicates and sorts multiple codes", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "9:1 error[E0805]: second\n2:0 error[E0424]: first\n7:3 error[E0805]: repeat\n",
      ),
    ).toEqual(["E0424", "E0805"]);
  });
});

describe("DiagnosticManifest.diff", () => {
  it("reports a fixture whose .expected.error disappeared", () => {
    const failures = DiagnosticManifest.diff(
      [{ fixture: "tests/a.test.cnx", codes: ["E0422"] }],
      [],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].fixture).toBe("tests/a.test.cnx");
    expect(failures[0].reason).toBe("assertion-removed");
  });

  it("reports a fixture that stopped asserting a code", () => {
    const failures = DiagnosticManifest.diff(
      [{ fixture: "tests/a.test.cnx", codes: ["E0422", "E0424"] }],
      [{ fixture: "tests/a.test.cnx", codes: ["E0422"] }],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe("code-removed");
    expect(failures[0].detail).toContain("E0424");
  });

  it("reports a coded fixture that regressed to uncoded", () => {
    // The #1313 failure shape: a coded diagnostic downgraded to a generic
    // codegen throw. The fixture still errors, so the suite stays green.
    const failures = DiagnosticManifest.diff(
      [{ fixture: "tests/a.test.cnx", codes: ["E0381"] }],
      [{ fixture: "tests/a.test.cnx", codes: [] }],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe("code-removed");
  });

  it("accepts a fixture that gained a code", () => {
    // Control: the gate guards against loss, not against change. A migration
    // that ADDS codes must not be blocked by its own guard.
    expect(
      DiagnosticManifest.diff(
        [{ fixture: "tests/a.test.cnx", codes: [] }],
        [{ fixture: "tests/a.test.cnx", codes: ["E0381"] }],
      ),
    ).toEqual([]);
  });

  it("accepts a brand new fixture", () => {
    // Control: adding an error fixture is the behavior we want to encourage.
    expect(
      DiagnosticManifest.diff(
        [],
        [{ fixture: "tests/new.test.cnx", codes: ["E0900"] }],
      ),
    ).toEqual([]);
  });

  it("accepts an unchanged manifest", () => {
    const entries = [{ fixture: "tests/a.test.cnx", codes: ["E0422"] }];
    expect(DiagnosticManifest.diff(entries, entries)).toEqual([]);
  });
});

describe("DiagnosticManifest.collect", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-manifest-"));
    mkdirSync(join(tempDir, "tests", "nested"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds error fixtures at any depth, with their codes", () => {
    writeFileSync(
      join(tempDir, "tests", "top.expected.error"),
      "3:1 error[E0422]: called before definition\n",
    );
    writeFileSync(
      join(tempDir, "tests", "nested", "deep.expected.error"),
      "1:0 Code generation failed: no code here\n",
    );

    expect(DiagnosticManifest.collect(tempDir)).toEqual([
      { fixture: "tests/nested/deep.test.cnx", codes: [] },
      { fixture: "tests/top.test.cnx", codes: ["E0422"] },
    ]);
  });

  it("ignores files that are not .expected.error", () => {
    writeFileSync(join(tempDir, "tests", "snap.expected.c"), "int x;\n");
    expect(DiagnosticManifest.collect(tempDir)).toEqual([]);
  });
});

describe("DiagnosticManifest.orphans", () => {
  // #1361: `tests/string-array-init/string-array-init-error-mismatch.expected.error`
  // had no `.test.cnx` beside it, so it could never run -- while still holding a
  // manifest row and appearing, in #1321's audit, to cover two `Array size
  // mismatch` throws. Coverage that cannot execute is worse than none: the row
  // reads as green, and the count it contributes to is the number this card's
  // definition of done is measured against.
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-orphan-"));
    mkdirSync(join(tempDir, "tests"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("names an .expected.error with no fixture beside it", () => {
    writeFileSync(join(tempDir, "tests", "lonely.expected.error"), "1:0 x\n");
    expect(DiagnosticManifest.orphans(tempDir)).toEqual([
      "tests/lonely.expected.error",
    ]);
  });

  it("accepts one whose .test.cnx exists", () => {
    writeFileSync(join(tempDir, "tests", "paired.expected.error"), "1:0 x\n");
    writeFileSync(join(tempDir, "tests", "paired.test.cnx"), "// test-error\n");
    expect(DiagnosticManifest.orphans(tempDir)).toEqual([]);
  });

  it("returns nothing when there is no tests directory", () => {
    rmSync(join(tempDir, "tests"), { recursive: true });
    expect(DiagnosticManifest.orphans(tempDir)).toEqual([]);
  });
});

/** Every document's text, end to end: what `parse` is given for the whole manifest. */
const text = (documents: ReadonlyMap<string, string>): string =>
  [...documents.values()].join("\n");

describe("DiagnosticManifest documents/parse roundtrip", () => {
  it("reads back exactly what it rendered", () => {
    // The gate compares a parsed committed manifest against a fresh collect, so
    // a lossy roundtrip would report phantom shrinkage on every run.
    const entries = [
      { fixture: "tests/a/one.test.cnx", codes: ["E0422", "MISRA-3.1"] },
      { fixture: "tests/a/two.test.cnx", codes: [] },
      { fixture: "tests/b/deep/three.test.cnx", codes: ["E0900"] },
    ];
    expect(
      DiagnosticManifest.parse(text(DiagnosticManifest.documents(entries))),
    ).toEqual(entries);
  });

  it("renders no timestamp", () => {
    // A timestamp churns every run and makes the staleness diff useless (#1150).
    const rendered = DiagnosticManifest.documents([
      { fixture: "tests/a/one.test.cnx", codes: ["E0422"] },
    ]);
    expect(text(rendered)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("gives each fixture directory a document of its own, and the index (#2518)", () => {
    // A new directory is a new document: two branches that each add one
    // change no path in common, wherever the two directories sort.
    const rendered = DiagnosticManifest.documents([
      { fixture: "tests/a/one.test.cnx", codes: ["E0422"] },
      { fixture: "tests/a/two.test.cnx", codes: [] },
      { fixture: "tests/b/deep/three.test.cnx", codes: ["E0900"] },
    ]);
    expect([...rendered.keys()]).toEqual([
      "docs/diagnostic-manifest.md",
      "docs/diagnostic-manifest/tests/a.md",
      "docs/diagnostic-manifest/tests/b/deep.md",
    ]);
    expect(rendered.get("docs/diagnostic-manifest/tests/a.md")).toContain(
      "- `tests/a/one.test.cnx`: E0422\n- `tests/a/two.test.cnx`: (uncoded)\n",
    );
    // The index holds no row: every fixture's line is in one document only.
    expect(
      DiagnosticManifest.parse(
        rendered.get("docs/diagnostic-manifest.md") ?? "",
      ),
    ).toEqual([]);
  });

  it("names every document it writes as one of the manifest's, and nothing else", () => {
    const rendered = DiagnosticManifest.documents([
      { fixture: "tests/a/one.test.cnx", codes: ["E0422"] },
    ]);
    expect([...rendered.keys()].every(DiagnosticManifest.isDocument)).toBe(
      true,
    );
    expect(DiagnosticManifest.isDocument("docs/diagnostic-manifest.md")).toBe(
      true,
    );
    expect(
      DiagnosticManifest.isDocument("docs/diagnostic-manifest-notes.md"),
    ).toBe(false);
    expect(
      DiagnosticManifest.isDocument("docs/diagnostic-manifest/tests/a.txt"),
    ).toBe(false);
    expect(DiagnosticManifest.isDocument("docs/error-codes.md")).toBe(false);
  });

  it("reads the one table the manifest was before #2518", () => {
    // `diagnostics:manifest:compare` reads the manifest at a base ref, and a
    // base older than #2518 holds this shape. Unread, every code it lists
    // would count as never asserted, and the comparison would pass on nothing.
    const table = [
      "| Fixture                 | Codes        |",
      "| ----------------------- | ------------ |",
      "| tests/a/one.test.cnx    | E0422, E0900 |",
      "| tests/a/two.test.cnx    | (uncoded)    |",
    ].join("\n");
    expect(DiagnosticManifest.parse(table)).toEqual([
      { fixture: "tests/a/one.test.cnx", codes: ["E0422", "E0900"] },
      { fixture: "tests/a/two.test.cnx", codes: [] },
    ]);
  });
});

describe("DiagnosticManifest.checkOutcome", () => {
  const entry = { fixture: "tests/a.test.cnx", codes: ["E0422"] };
  const rendered = DiagnosticManifest.documents([entry]);

  it("fails when the manifest has never been written", () => {
    const outcome = DiagnosticManifest.checkOutcome(
      new Map(),
      [entry],
      rendered,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("npm run diagnostics:manifest");
  });

  it("offers regeneration before row deletion when a fixture is lost", () => {
    // A rename is the loss this gate most often sees, and it presents as
    // `assertion-removed`. Advising row deletion first turns a rename into a
    // real loss of coverage: the row is dropped while the fixture still asserts.
    const outcome = DiagnosticManifest.checkOutcome(rendered, [], rendered);
    const text = outcome.errors.join("\n");
    expect(outcome.ok).toBe(false);
    expect(text).toContain("tests/a.test.cnx");
    expect(text).toContain("renamed");
    expect(text.indexOf("npm run diagnostics:manifest")).toBeLessThan(
      text.indexOf("delete its row"),
    );
  });

  it("fails as stale when a committed document is behind", () => {
    const grown = [entry, { fixture: "tests/b.test.cnx", codes: ["E0900"] }];
    const outcome = DiagnosticManifest.checkOutcome(
      rendered,
      grown,
      DiagnosticManifest.documents(grown),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("stale");
    expect(outcome.errors.join("\n")).toContain(
      "docs/diagnostic-manifest/tests.md",
    );
  });

  it("fails as stale on a new directory whose document was never written (#2518)", () => {
    const grown = [
      entry,
      { fixture: "tests/new/b.test.cnx", codes: ["E0900"] },
    ];
    const outcome = DiagnosticManifest.checkOutcome(
      rendered,
      grown,
      DiagnosticManifest.documents(grown),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain(
      "docs/diagnostic-manifest/tests/new.md",
    );
  });

  it("fails as stale on a document left behind by a directory that asserts nothing now (#2518)", () => {
    // Its rows are gone from the corpus on purpose -- the fixtures moved, and
    // their rows moved with them -- so nothing shrank. A document nobody
    // regenerates away would still be read as rows at the next base comparison.
    const moved = [{ fixture: "tests/there/a.test.cnx", codes: ["E0422"] }];
    const committed = new Map([
      ...DiagnosticManifest.documents(moved),
      ["docs/diagnostic-manifest/tests/here.md", "<!-- left behind -->\n"],
    ]);
    const outcome = DiagnosticManifest.checkOutcome(
      committed,
      moved,
      DiagnosticManifest.documents(moved),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain(
      "docs/diagnostic-manifest/tests/here.md",
    );
  });

  it("names ten stale documents and counts the rest", () => {
    // The first write after #2518 is stale in every document at once. A wall
    // of 190 paths hides the one line that says what to run.
    const many = Array.from({ length: 13 }, (_, index) => ({
      fixture: `tests/d${String(index).padStart(2, "0")}/a.test.cnx`,
      codes: ["E0422"],
    }));
    const outcome = DiagnosticManifest.checkOutcome(
      new Map([["docs/diagnostic-manifest.md", ""]]),
      many,
      DiagnosticManifest.documents(many),
    );
    const lines = outcome.errors;
    expect(lines[0]).toContain("stale in 14 document(s)");
    expect(lines.filter((line) => line.startsWith("  docs/"))).toHaveLength(10);
    expect(lines).toContain("  and 4 more");
    expect(lines[lines.length - 1]).toContain("npm run diagnostics:manifest");
  });

  it("passes and states what was enforced", () => {
    const outcome = DiagnosticManifest.checkOutcome(
      rendered,
      [entry],
      rendered,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.errors).toEqual([]);
    expect(outcome.info.join("\n")).toContain("1 fixture(s)");
  });

  it("fails on an orphaned .expected.error even when nothing shrank (#1361)", () => {
    // The manifest is otherwise perfectly in sync -- this is the case that
    // passed for as long as the orphan existed. It has to fail on its own,
    // because a fixture that cannot run never shrinks and never grows.
    const outcome = DiagnosticManifest.checkOutcome(
      rendered,
      [entry],
      rendered,
      [
        "tests/string-array-init/string-array-init-error-mismatch.expected.error",
      ],
    );
    expect(outcome.ok).toBe(false);
    const text = outcome.errors.join("\n");
    expect(text).toContain("string-array-init-error-mismatch");
    expect(text).toContain("cannot run");
  });

  it("reports an orphan alongside a real shrinkage rather than hiding one behind the other", () => {
    const outcome = DiagnosticManifest.checkOutcome(rendered, [], rendered, [
      "tests/lonely.expected.error",
    ]);
    expect(outcome.ok).toBe(false);
    const text = outcome.errors.join("\n");
    expect(text).toContain("tests/a.test.cnx");
    expect(text).toContain("tests/lonely.expected.error");
  });
});

describe("DiagnosticManifest.compareToBase", () => {
  // #1322 runs `--update` more than any change in this project's history: 136
  // fixtures change position and 145 change message. `diagnostics:manifest:check`
  // compares against HEAD only, so a commit that deletes a row AND its fixture
  // passes -- correct per-commit, and useless as a guarantee across a migration.
  //
  // The comparison is deliberately over the SET OF CODES rather than over
  // fixtures, because this card also moves fixtures into `tests/adr-NNN/`. A
  // fixture-keyed check would report every one of those as a loss and would then
  // be routinely overridden, which is worse than not having it.
  const coded = (fixture: string, ...codes: string[]) => ({ fixture, codes });

  it("passes when every code asserted at base is still asserted somewhere", () => {
    const base = [coded("tests/a.test.cnx", "E0422", "E0500")];
    const tip = [
      coded("tests/adr-016/a.test.cnx", "E0422"),
      coded("tests/b.test.cnx", "E0500"),
    ];
    expect(DiagnosticManifest.compareToBase(base, tip).lostCodes).toEqual([]);
  });

  it("names a code that no fixture asserts any more", () => {
    const base = [coded("tests/a.test.cnx", "E0422", "E0500")];
    const tip = [coded("tests/a.test.cnx", "E0422")];
    expect(DiagnosticManifest.compareToBase(base, tip).lostCodes).toEqual([
      "E0500",
    ]);
  });

  it("is not fooled by a rename, which is the whole reason it is code-keyed", () => {
    const base = [coded("tests/a.test.cnx", "E0422")];
    const tip = [coded("tests/adr-057/a.test.cnx", "E0422")];
    const result = DiagnosticManifest.compareToBase(base, tip);
    expect(result.lostCodes).toEqual([]);
    expect(result.movedFixtures).toEqual(["tests/a.test.cnx"]);
  });

  it("reports a fixture that vanished without its codes being re-asserted", () => {
    const base = [coded("tests/a.test.cnx", "E0422")];
    const result = DiagnosticManifest.compareToBase(base, []);
    expect(result.lostCodes).toEqual(["E0422"]);
    expect(result.movedFixtures).toEqual(["tests/a.test.cnx"]);
  });

  it("says nothing about growth", () => {
    const base = [coded("tests/a.test.cnx", "E0422")];
    const tip = [
      coded("tests/a.test.cnx", "E0422"),
      coded("tests/b.test.cnx", "E0999"),
    ];
    const result = DiagnosticManifest.compareToBase(base, tip);
    expect(result.lostCodes).toEqual([]);
    expect(result.movedFixtures).toEqual([]);
  });

  it("ignores an uncoded fixture, which asserts no code to lose", () => {
    // An uncoded fixture still asserts a diagnostic, but this check is about
    // codes; its disappearance is `assertion-removed`'s job, per commit.
    const base = [coded("tests/a.test.cnx")];
    expect(DiagnosticManifest.compareToBase(base, []).lostCodes).toEqual([]);
  });
});

describe("DiagnosticManifest.writeOutcome", () => {
  const entry = { fixture: "tests/a.test.cnx", codes: ["E0422"] };
  const rendered = DiagnosticManifest.documents([entry]);

  it("names what regenerating is about to erase", () => {
    // `write` is the command that performs the deletion and the check message
    // is what sends people to it. An identical "Wrote ..." line for a clean
    // regeneration and for one that drops an assertion is the same failure this
    // manifest exists to prevent, on the destructive command.
    const outcome = DiagnosticManifest.writeOutcome(rendered, []);
    expect(outcome.ok).toBe(true);
    expect(outcome.warnings.join("\n")).toContain("tests/a.test.cnx");
  });

  it("warns about nothing when regeneration loses nothing", () => {
    // Control: regenerating after adding a fixture must stay quiet, or the
    // warning becomes noise people learn to scroll past.
    const grown = [entry, { fixture: "tests/b.test.cnx", codes: ["E0900"] }];
    expect(DiagnosticManifest.writeOutcome(rendered, grown).warnings).toEqual(
      [],
    );
  });

  it("warns about nothing on a first-ever write", () => {
    expect(
      DiagnosticManifest.writeOutcome(new Map(), [entry]).warnings,
    ).toEqual([]);
  });
});
