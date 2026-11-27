/**
 * Issue #1322: hold `docs/error-codes.md` to what it claims about itself.
 *
 * Its own preamble states the problem:
 *
 * > "next available" is read from this table: a code reserved elsewhere and
 * > recorded nowhere gets assigned a second time, and the collision is silent
 * > -- the registry is hand-maintained and has no gate, while
 * > `npm run diagnostics:manifest:check` only sees codes that already have a
 * > fixture.
 *
 * That was tolerable while the file held 55 codes and grew by one or two a
 * release. #1322 allocates roughly 45-60 at once, across eight ranges, with
 * eight reserved-do-not-reuse entries scattered through them. A silent
 * double-assignment there does not surface until a user reports two unrelated
 * errors sharing a code.
 *
 * Every invariant below holds on `main` today. The gate is added while it is
 * green, which is the only time adding one is cheap.
 *
 * Rows are keyed on their FIRST and LAST cell rather than on a fixed cell
 * count: E0807's description contains `|` characters and splits into six
 * cells, and a row this gate skipped would be a row it did not defend.
 *
 * #2521: the registry counts none of its rows. Its range table held a count
 * per range and a total, and this gate required both to match -- so every
 * pull request that registered a code rewrote the total, and any two of them
 * conflicted on it or merged to a total that counted one of them. The gate
 * counts the rows itself (`summary`) and refuses a registry that does
 * (`countingRows`).
 */

interface IRegistryRow {
  readonly code: string;
  readonly description: string;
  readonly source: string;
}

/** A row of the range table that counts code rows: which, and the number. */
interface ICountingRow {
  readonly label: string;
  readonly count: string;
}

class ErrorCodeRegistry {
  /** `E0424`, not the `E04xx` range-summary rows. */
  private static readonly CODE = /^E\d{4}$/;

  private static readonly RANGE = /^E(\d\d)xx$/;

  /** A cell that is a number and nothing else, once its `**` is off. */
  private static readonly COUNT = /^\d+$/;

  private static cells(line: string): string[] | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
      return null;
    }
    return trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
  }

  static rows(markdown: string): IRegistryRow[] {
    const rows: IRegistryRow[] = [];
    for (const line of markdown.split("\n")) {
      const cells = ErrorCodeRegistry.cells(line);
      if (cells === null || cells.length < 2) continue;
      if (!ErrorCodeRegistry.CODE.test(cells[0])) continue;
      rows.push({
        code: cells[0],
        description: cells.slice(1, -1).join(" | "),
        source: cells[cells.length - 1],
      });
    }
    return rows;
  }

  /**
   * #2521: the rows of the range table that count code rows, each with the
   * number it gives: a range row with a number in a cell, and a `**Total**`
   * row. A count is refused whether or not it is right, because a right one
   * is what the next registration has to rewrite.
   */
  private static countingRows(markdown: string): ICountingRow[] {
    const counting: ICountingRow[] = [];
    for (const line of markdown.split("\n")) {
      const cells = ErrorCodeRegistry.cells(line);
      if (cells === null) continue;
      const [label, ...rest] = cells.map((cell) =>
        cell.replaceAll("*", "").trim(),
      );
      if (label !== "Total" && !ErrorCodeRegistry.RANGE.test(label)) continue;
      const count = rest.find((cell) => ErrorCodeRegistry.COUNT.test(cell));
      if (count !== undefined) counting.push({ label, count });
    }
    return counting;
  }

  /**
   * #2521: the counts the range table used to hold, for the gate to print
   * when it passes: `173 row(s): E00xx 1, E02xx 5, ...`. Read off the rows
   * each time, so no pull request edits them.
   */
  static summary(markdown: string): string {
    const perRange = new Map<string, number>();
    const rows = ErrorCodeRegistry.rows(markdown);
    for (const row of rows) {
      const range = `${row.code.slice(0, 3)}xx`;
      perRange.set(range, (perRange.get(range) ?? 0) + 1);
    }
    const ranges = [...perRange]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([range, count]) => `${range} ${count}`);
    const total = `${rows.length} row(s)`;
    return ranges.length > 0 ? `${total}: ${ranges.join(", ")}` : total;
  }

  /**
   * A row for a code no source raises is legitimate only when the row says so.
   * Two spellings exist and both are load-bearing: `_(reserved)_` in the
   * description (E0428, E0506 -- reserved BY the #1321 audit precisely so they
   * would not be assigned twice) and `Planned` in the source cell (E0854,
   * E0855). Accepting neither would fail the file today; accepting anything
   * would let a genuinely orphaned row hide behind prose.
   */
  private static isUnimplemented(row: IRegistryRow): boolean {
    return row.description.includes("_(reserved)_") || row.source === "Planned";
  }

  /** #1620 review: the codes the registry marks `_(retired)_`. */
  static retired(markdown: string): Set<string> {
    return new Set(
      ErrorCodeRegistry.rows(markdown)
        .filter((row) => row.description.startsWith("_(retired)_"))
        .map((row) => row.code),
    );
  }

  static check(markdown: string, emitted: ReadonlySet<string>): string[] {
    const rows = ErrorCodeRegistry.rows(markdown);
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      if (seen.has(row.code)) {
        errors.push(
          `${row.code} is listed twice -- "next available" is read from this table, so a duplicate row hides a collision`,
        );
      }
      seen.add(row.code);
      if (!emitted.has(row.code) && !ErrorCodeRegistry.isUnimplemented(row)) {
        errors.push(
          `${row.code} has a row but no source emits it -- mark it _(reserved)_ or Planned, or delete the row`,
        );
      }
    }

    for (const code of [...emitted].sort((a, b) => a.localeCompare(b))) {
      if (!seen.has(code)) {
        errors.push(
          `${code} is emitted in src/ but not registered in docs/error-codes.md`,
        );
      }
    }

    const codes = rows.map((row) => row.code);
    for (let index = 1; index < codes.length; index += 1) {
      if (codes[index] < codes[index - 1]) {
        errors.push(
          `${codes[index - 1]} -> ${codes[index]} is out of order; the table is read in sequence to find the next free code`,
        );
      }
    }

    for (const { label, count } of ErrorCodeRegistry.countingRows(markdown)) {
      const what = label === "Total" ? "the code rows" : `${label}'s rows`;
      errors.push(
        `the range table counts ${what} (${count}) -- every pull request that registers a code rewrites a count, so any two of them conflict on it (#2521); delete the cell, this check prints the counts`,
      );
    }

    return errors;
  }
}

export default ErrorCodeRegistry;
