import { existsSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

import FileScanner from "../utils/FileScanner";
import IManifestEntry from "../types/IManifestEntry";
import IManifestFailure from "../types/IManifestFailure";
import IManifestOutcome from "../types/IManifestOutcome";

/**
 * The committed record of which fixtures assert which diagnostics (issue #1316).
 *
 * A `.expected.error` is the only assertion that a diagnostic fires. Nothing
 * previously noticed one going away: `--update` unlinked it and reported the run
 * green, and even by hand a deletion is a removed file, which reads as tidying.
 * The manifest turns both into a diff a reviewer has to approve.
 */
class DiagnosticManifest {
  /** The shape of a diagnostic code itself, wherever it is written. */
  private static readonly CODE_SOURCE = "E[0-9]{4}|MISRA-[0-9.]+";

  /**
   * Matches every code-carrying shape the corpus emits, not just one of them.
   *
   * Four forms exist, and a bracket-only pattern saw a single one -- leaving 39
   * of the 155 fixtures it recorded as `(uncoded)` actually asserting a code, so
   * `code-removed` could never fire for any of them:
   *
   *     error[E0902]:                          matched before
   *     error[MISRA-3.1]:                      matched before
   *     Code generation failed: Error[E0602]:   missed
   *     Code generation failed: Error E0702:    missed
   *     Code generation failed: E0504:          missed
   *
   * The trailing `:` is what keeps this from over-matching a message body: every
   * code-carrying line in the corpus writes its code as a tag ending in `:`, and
   * stripping each file's own tag leaves zero stray `E####` anywhere in `tests/`.
   */
  private static readonly CODE_PATTERN_SOURCE =
    "(?:(?:error|Error) ?\\[?)?\\b(" +
    DiagnosticManifest.CODE_SOURCE +
    ")\\b\\]?:";

  private static readonly CODE_EXACT = new RegExp(
    `^(?:${DiagnosticManifest.CODE_SOURCE})$`,
  );

  /** Shown in place of a code list for a fixture whose diagnostic carries none. */
  private static readonly UNCODED = "(uncoded)";

  /** How many stale documents `check` names before it counts the rest. */
  private static readonly STALE_SHOWN = 10;

  /** A row as `documents` writes it: `- \`tests/a/b.test.cnx\`: E0422, E0900`. */
  private static readonly ROW = /^- `([^`]+)`: (.+)$/;

  /** The page that says what the manifest is, where its rows are, and why. */
  static readonly INDEX = "docs/diagnostic-manifest.md";

  /** Where the rows are: one document per fixture directory (#2518). */
  static readonly DIRECTORY = "docs/diagnostic-manifest";

  private static readonly GENERATED = [
    "<!-- GENERATED FILE - DO NOT EDIT.",
    "     Source: every .expected.error under tests/.",
    "     Regenerate: npm run diagnostics:manifest -->",
  ];

  private static readonly INDEX_TEXT = [
    ...DiagnosticManifest.GENERATED,
    "",
    "# Diagnostic Manifest",
    "",
    "Every fixture that asserts a diagnostic, and the codes it asserts. The",
    "manifest exists so that losing an assertion is a reviewable diff rather than",
    "a silent deletion -- `npm run diagnostics:manifest:check` fails when a listed",
    "fixture loses its `.expected.error`, or stops asserting a code listed for it.",
    "",
    "The rows are in `docs/diagnostic-manifest/`, one document per fixture",
    "directory: the fixtures of `tests/adr-034/` are listed in",
    "`docs/diagnostic-manifest/tests/adr-034.md`.",
    "",
    "Removing a diagnostic on purpose means deleting its row in the same commit.",
    "Adding one, or promoting `(uncoded)` to a real code, is never a loss: regenerate",
    "to record it.",
    "",
    "One document per directory, because git cannot order two insertions at one",
    "place. In a single list the rows of two new `tests/bugs/issue-NNNN-*`",
    "directories sort next to each other, so two pull requests that each added one",
    "conflicted (#2518). A new directory is now a new document. For the same reason",
    "no line counts the rows (#2517): the check prints the totals each time it",
    "passes.",
    "",
  ].join("\n");

  /** Whether `text` is exactly one diagnostic code, e.g. `E0879`. */
  static isCode(text: string): boolean {
    return DiagnosticManifest.CODE_EXACT.test(text);
  }

  /**
   * The diagnostic codes an `.expected.error` body asserts, deduplicated and
   * sorted so the manifest diff reflects a real change rather than line order.
   */
  static parseCodes(body: string): string[] {
    // A fresh RegExp per call rather than one shared /g instance: lastIndex is
    // stateful, so a shared pattern would carry a position between fixtures --
    // and a throw mid-loop would leave it carrying one indefinitely.
    const pattern = new RegExp(DiagnosticManifest.CODE_PATTERN_SOURCE, "g");
    const codes = new Set<string>();
    let match = pattern.exec(body);
    while (match !== null) {
      codes.add(match[1]);
      match = pattern.exec(body);
    }
    return [...codes].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Every `.expected.error` under `tests/`, named by the fixture it belongs to
   * and sorted so the committed file has an order independent of the walk.
   */
  static collect(rootDir: string): IManifestEntry[] {
    const testsDir = join(rootDir, "tests");
    if (!existsSync(testsDir)) {
      return [];
    }
    return FileScanner.findFiles(testsDir, ".expected.error")
      .map((path) => ({
        fixture: relative(rootDir, path)
          .split(sep)
          .join("/")
          .replace(/\.expected\.error$/, ".test.cnx"),
        codes: DiagnosticManifest.parseCodes(readFileSync(path, "utf-8")),
      }))
      .sort((a, b) => a.fixture.localeCompare(b.fixture));
  }

  /**
   * `.expected.error` files with no `.test.cnx` beside them.
   *
   * Issue #1361. `runTest` decides a fixture is an error test by looking for an
   * `.expected.error` NEXT TO a `.test.cnx`, so an assertion with no fixture is
   * never dispatched -- it cannot pass and it cannot fail. It still occupies a
   * manifest row, and #1321's audit read two `Array size mismatch` throws as
   * fixture-covered on the strength of one.
   *
   * That is the worst state an assertion can be in: absent coverage is visible,
   * and coverage that cannot execute reads as green. It also silently inflates
   * the fixture count the check reports, which is a number #1322's definition
   * of done is measured against.
   *
   * This has to be its own failure rather than a case of `diff`, because an
   * orphan neither shrinks nor grows: the manifest can be perfectly in sync
   * with a corpus that contains one, which is exactly how it survived.
   */
  static orphans(rootDir: string): string[] {
    const testsDir = join(rootDir, "tests");
    if (!existsSync(testsDir)) {
      return [];
    }
    return FileScanner.findFiles(testsDir, ".expected.error")
      .filter(
        (path) => !existsSync(path.replace(/\.expected\.error$/, ".test.cnx")),
      )
      .map((path) => relative(rootDir, path).split(sep).join("/"))
      .sort((a, b) => a.localeCompare(b));
  }

  /** Whether a repository path is one of the manifest's documents. */
  static isDocument(path: string): boolean {
    return (
      path === DiagnosticManifest.INDEX ||
      (path.startsWith(`${DiagnosticManifest.DIRECTORY}/`) &&
        path.endsWith(".md"))
    );
  }

  /** The document a fixture's row is in: its directory's. */
  private static documentOf(fixture: string): string {
    return `${DiagnosticManifest.DIRECTORY}/${posix.dirname(fixture)}.md`;
  }

  /**
   * The manifest as committed Markdown: every document by its repository path.
   *
   * One document per fixture directory, and the index (#2518). A branch that
   * adds a directory adds a document, so two branches that add two
   * directories change no path in common, wherever the directories sort. One
   * sorted table of every fixture put their rows into the same gap, and git
   * cannot order two insertions at one place.
   *
   * A row is a list item, not a table row: Prettier pads a table to its widest
   * cell, so one longer path rewrote every row of it.
   *
   * No document carries a timestamp, by #1150, or a total, by #2517: a line
   * counting the rows is rewritten by every branch that adds one, and two of
   * them then conflict, or merge to a count that matches neither.
   * `checkOutcome` reports the totals instead, computed on each run.
   */
  static documents(entries: readonly IManifestEntry[]): Map<string, string> {
    const rows = new Map<string, string[]>();
    for (const entry of entries) {
      const path = DiagnosticManifest.documentOf(entry.fixture);
      const codes =
        entry.codes.length > 0
          ? entry.codes.join(", ")
          : DiagnosticManifest.UNCODED;
      rows.set(path, [
        ...(rows.get(path) ?? []),
        `- \`${entry.fixture}\`: ${codes}`,
      ]);
    }
    const documents = new Map([
      [DiagnosticManifest.INDEX, DiagnosticManifest.INDEX_TEXT],
    ]);
    for (const [path, lines] of rows) {
      documents.set(
        path,
        [...DiagnosticManifest.GENERATED, "", ...lines, ""].join("\n"),
      );
    }
    return documents;
  }

  /**
   * Reads back the rows of rendered documents: one, or several end to end.
   * Must be lossless against `documents`.
   *
   * A table row is read as well as a list item. The manifest was one table
   * until #2518, and `diagnostic-manifest-compare.ts` reads it at a base ref
   * that can be older than that.
   */
  static parse(markdown: string): IManifestEntry[] {
    const entries: IManifestEntry[] = [];
    for (const line of markdown.split("\n")) {
      const cells =
        DiagnosticManifest.listCells(line) ??
        DiagnosticManifest.tableCells(line);
      if (cells === null || cells[0] === "Fixture") {
        continue;
      }
      entries.push({
        fixture: cells[0],
        codes:
          cells[1] === DiagnosticManifest.UNCODED
            ? []
            : cells[1].split(",").map((code) => code.trim()),
      });
    }
    return entries;
  }

  /** The fixture and the codes of a row, or null for any other line. */
  private static listCells(line: string): [string, string] | null {
    const row = DiagnosticManifest.ROW.exec(line);
    return row === null ? null : [row[1], row[2]];
  }

  /**
   * The two cells of a row of the table the manifest was until #2518, or null
   * for any other line -- prose, the header comment, and the `| --- |`
   * separator alike.
   */
  private static tableCells(line: string): [string, string] | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
      return null;
    }
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 2 || /^-+$/.test(cells[0])) {
      return null;
    }
    return [cells[0], cells[1]];
  }

  /**
   * What a whole migration lost, comparing a BASE manifest to the current one.
   *
   * `checkOutcome` compares against `HEAD`, which is right per commit and says
   * nothing across a branch: a commit that deletes a row AND its fixture is
   * self-consistent and passes. #1322's definition of done is the stronger
   * claim -- that no diagnostic was lost anywhere between the merge base and
   * the tip -- and nothing in the repo could express it.
   *
   * Keyed on the SET OF CODES, not on fixtures, and that choice is the whole
   * design. #1322 also relocates fixtures into `tests/adr-NNN/`; a
   * fixture-keyed comparison would report every one of those as a loss, would
   * therefore be overridden as a matter of routine, and a check that is
   * routinely overridden is worse than no check. A code asserted at base and
   * asserted by SOME fixture at tip has not been lost, wherever it now lives.
   *
   * `movedFixtures` is reported, never failed on: it is the list a reviewer
   * pairs up by eye to confirm each disappearance was a rename.
   */
  static compareToBase(
    base: readonly IManifestEntry[],
    current: readonly IManifestEntry[],
  ): { lostCodes: string[]; movedFixtures: string[] } {
    const asserted = new Set(current.flatMap((entry) => entry.codes));
    const present = new Set(current.map((entry) => entry.fixture));
    const lost = new Set<string>();
    const moved: string[] = [];
    for (const entry of base) {
      for (const code of entry.codes) {
        if (!asserted.has(code)) {
          lost.add(code);
        }
      }
      if (!present.has(entry.fixture)) {
        moved.push(entry.fixture);
      }
    }
    return {
      lostCodes: [...lost].sort((a, b) => a.localeCompare(b)),
      movedFixtures: moved.sort((a, b) => a.localeCompare(b)),
    };
  }

  /** The rows of a set of committed documents, whichever document holds them. */
  private static rowsOf(
    documents: ReadonlyMap<string, string>,
  ): IManifestEntry[] {
    return DiagnosticManifest.parse([...documents.values()].join("\n"));
  }

  /**
   * The paths at which two sets of documents differ: a document whose text
   * differs, one the generator writes and nothing has committed, and one that
   * is committed for a directory that asserts nothing any more.
   */
  static stale(
    committed: ReadonlyMap<string, string>,
    fresh: ReadonlyMap<string, string>,
  ): string[] {
    return [...new Set([...committed.keys(), ...fresh.keys()])]
      .filter((path) => committed.get(path) !== fresh.get(path))
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Describes a `check` run without performing any of its I/O. `committed`
   * and `fresh` are the manifest's documents by path, as they are on disk and
   * as the generator writes them.
   */
  static checkOutcome(
    committed: ReadonlyMap<string, string>,
    current: readonly IManifestEntry[],
    fresh: ReadonlyMap<string, string>,
    orphans: readonly string[] = [],
  ): IManifestOutcome {
    // Reported before anything else and independently of it: an orphan is not
    // a shrinkage, so a corpus containing one can be in perfect sync (#1361).
    // Collected rather than returned early, so a run that has both an orphan
    // and a real loss reports both -- one failure hiding another is how the
    // second gets fixed a release later.
    const orphanErrors =
      orphans.length === 0
        ? []
        : [
            `${orphans.length} .expected.error file(s) have no .test.cnx and cannot run:`,
            ...orphans.map((path) => `  ${path}`),
            "Write the fixture, or delete the assertion and its manifest row.",
          ];
    if (committed.size === 0) {
      return {
        ok: false,
        errors: [
          ...orphanErrors,
          `${DiagnosticManifest.INDEX} and ${DiagnosticManifest.DIRECTORY}/ are missing. Run: npm run diagnostics:manifest`,
        ],
        warnings: [],
        info: [],
      };
    }

    const failures = DiagnosticManifest.diff(
      DiagnosticManifest.rowsOf(committed),
      current,
    );
    if (failures.length > 0) {
      return {
        ok: false,
        errors: [
          ...orphanErrors,
          `${failures.length} fixture(s) no longer assert what the manifest records:`,
          ...failures.map(
            (failure) =>
              `  ${failure.fixture}: ${failure.detail} [${failure.reason}]`,
          ),
          // Regeneration first: a rename presents as `assertion-removed`, and it
          // is the commoner cause. Advising row deletion first would turn a
          // rename into the real loss the gate exists to catch.
          "\nIf the fixture was renamed or moved, regenerate: npm run diagnostics:manifest",
          "If the diagnostic was removed on purpose, delete its row from its document",
          `under ${DiagnosticManifest.DIRECTORY}/ in the same commit so the loss is reviewed.`,
        ],
        warnings: [],
        info: [],
      };
    }

    const stale = DiagnosticManifest.stale(committed, fresh);
    if (stale.length > 0) {
      // Growth alone reaches here: a new fixture or a promoted code. Not a
      // failure of the guard, but the committed documents must track it or the
      // next real shrinkage diffs against a stale baseline.
      const shown = stale.slice(0, DiagnosticManifest.STALE_SHOWN);
      const more = stale.length - shown.length;
      return {
        ok: false,
        errors: [
          `The diagnostic manifest is stale in ${stale.length} document(s):`,
          ...shown.map((path) => `  ${path}`),
          ...(more > 0 ? [`  and ${more} more`] : []),
          "Run: npm run diagnostics:manifest",
        ],
        warnings: [],
        info: [],
      };
    }

    // An orphan reaches here on its own: the manifest is in sync, nothing
    // shrank, and one assertion still cannot run. This is the state #1361 sat
    // in, and it is the reason the check cannot be expressed as a diff.
    if (orphanErrors.length > 0) {
      return { ok: false, errors: orphanErrors, warnings: [], info: [] };
    }

    // Say what was enforced, not just that nothing failed. An identical line for
    // 287 fixtures and for zero is what would let a silently-emptied manifest
    // pass unremarked in a CI log.
    const coded = current.filter((entry) => entry.codes.length > 0).length;
    return {
      ok: true,
      errors: [],
      warnings: [],
      info: [
        `Diagnostic manifest is satisfied (${current.length} fixture(s) asserting a diagnostic, ${coded} coded)`,
      ],
    };
  }

  /**
   * Describes a `write` run: regenerating is the reflex `check` trains, so an
   * assertion it is about to erase has to be named at the moment it happens
   * rather than left to a one-line diff inside a GENERATED-FILE header.
   */
  static writeOutcome(
    committed: ReadonlyMap<string, string>,
    current: readonly IManifestEntry[],
  ): IManifestOutcome {
    const lost = DiagnosticManifest.diff(
      DiagnosticManifest.rowsOf(committed),
      current,
    );
    return {
      ok: true,
      errors: [],
      warnings: lost.map(
        (failure) => `  dropped ${failure.fixture}: ${failure.detail}`,
      ),
      info: [],
    };
  }

  /**
   * The ways `current` shrank against `committed`.
   *
   * Growth is never a failure: a fixture that gains a code, or a wholly new
   * fixture, is the behavior the gate exists to encourage. Only loss is
   * reported, so a diagnostic migration is not blocked by its own guard.
   */
  static diff(
    committed: readonly IManifestEntry[],
    current: readonly IManifestEntry[],
  ): IManifestFailure[] {
    const currentByFixture = new Map(
      current.map((entry) => [entry.fixture, entry]),
    );

    const failures: IManifestFailure[] = [];
    for (const entry of committed) {
      const now = currentByFixture.get(entry.fixture);
      if (now === undefined) {
        failures.push({
          fixture: entry.fixture,
          reason: "assertion-removed",
          detail: "no .expected.error on disk",
        });
        continue;
      }

      const stillAsserted = new Set(now.codes);
      const lost = entry.codes.filter((code) => !stillAsserted.has(code));
      if (lost.length > 0) {
        failures.push({
          fixture: entry.fixture,
          reason: "code-removed",
          detail: `no longer asserts ${lost.join(", ")}`,
        });
      }
    }
    return failures;
  }
}

export default DiagnosticManifest;
