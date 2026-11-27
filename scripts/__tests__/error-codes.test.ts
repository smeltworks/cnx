import { describe, expect, it } from "vitest";

import ErrorCodeRegistry from "../diagnostics/ErrorCodeRegistry";

/**
 * #1322. `docs/error-codes.md` says of itself that it "is hand-maintained and
 * has no gate, while `npm run diagnostics:manifest:check` only sees codes that
 * already have a fixture" -- so a code reserved in one place and recorded
 * nowhere gets assigned twice, silently.
 *
 * This card allocates roughly 45-60 new codes across eight ranges, into a file
 * that currently holds 55. Every invariant below is TRUE on `main` today, which
 * is the point: the gate is added while it is green, before the allocation that
 * would otherwise break it unnoticed.
 */
const doc = (...lines: string[]): string =>
  ["| Range | Category |", "| --- | --- |", ...lines].join("\n");

describe("ErrorCodeRegistry.check", () => {
  const good = doc(
    "| E04xx | Symbol Resolution |",
    "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
    "| E0429 | Register in a type position | Name the type | `output/codegen/TypeValidator.ts` |",
  );

  it("passes when every emitted code has a row and every row is emitted", () => {
    expect(ErrorCodeRegistry.check(good, new Set(["E0424", "E0429"]))).toEqual(
      [],
    );
  });

  it("fails a code emitted in src/ with no row -- the silent double-assignment", () => {
    const errors = ErrorCodeRegistry.check(
      good,
      new Set(["E0424", "E0429", "E0431"]),
    );
    expect(errors.join("\n")).toContain("E0431");
    expect(errors.join("\n")).toContain("not registered");
  });

  it("fails a row whose code nothing emits", () => {
    // A row for a code no source raises is either a removal nobody finished or
    // a typo, and both make "next available" wrong for the next author.
    const errors = ErrorCodeRegistry.check(good, new Set(["E0424"]));
    expect(errors.join("\n")).toContain("E0429");
    expect(errors.join("\n")).toContain("no source emits");
  });

  it("accepts a row marked _(reserved)_ that no source emits", () => {
    const reserved = doc(
      "| E04xx | Symbol Resolution |",
      "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
      "| E0428 | _(reserved)_ — cannot assign integer to enum | Not yet | `output/codegen/X.ts` |",
    );
    expect(ErrorCodeRegistry.check(reserved, new Set(["E0424"]))).toEqual([]);
  });

  it("accepts a row whose source cell says Planned and which no source emits", () => {
    const planned = doc(
      "| E08xx | Arithmetic |",
      "| E0854 | Constant index out of bounds | Fix the index | Planned |",
    );
    expect(ErrorCodeRegistry.check(planned, new Set())).toEqual([]);
  });

  it("fails a code that has two rows", () => {
    const twice = doc(
      "| E04xx | Symbol Resolution |",
      "| E0424 | One meaning | fix | `output/codegen/A.ts` |",
      "| E0424 | Another meaning | fix | `output/codegen/B.ts` |",
    );
    expect(
      ErrorCodeRegistry.check(twice, new Set(["E0424"])).join("\n"),
    ).toContain("listed twice");
  });

  it("fails rows that are out of ascending order", () => {
    // "Next available is read from this table", so an unsorted table is one a
    // contributor appends to instead of reading -- the exact way `.cspell.json`
    // grew a second sorted island (#1309).
    const unsorted = doc(
      "| E04xx | Symbol Resolution |",
      "| E0429 | Register in a type position | Name it | `output/codegen/TypeValidator.ts` |",
      "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
    );
    expect(
      ErrorCodeRegistry.check(unsorted, new Set(["E0424", "E0429"])).join("\n"),
    ).toContain("out of order");
  });

  it("fails a range row that counts its codes, right or wrong (#2521)", () => {
    // A count is rewritten by every pull request that registers a code in the
    // range, so any two of them conflict on it. A correct count is refused
    // too: the next registration is what makes it a conflict.
    const counted = (count: number): string =>
      [
        "| Range | Category | Count |",
        "| --- | --- | --- |",
        `| E04xx | Symbol Resolution | ${count} |`,
        "| E0424 | Unqualified enum member | Qualify it | `a.ts` |",
      ].join("\n");
    for (const count of [1, 5]) {
      const errors = ErrorCodeRegistry.check(
        counted(count),
        new Set(["E0424"]),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(`counts E04xx's rows (${count})`);
    }
  });

  it("fails a **Total** row, right or wrong (#2521)", () => {
    // Every registration rewrites a total, whatever its range. And two that
    // write the same number merge without a conflict to a total that counts
    // one of them: in the issue's reproduction it read 174 above 175 rows.
    const totalled = (total: string): string =>
      doc(
        "| E04xx | Symbol Resolution |",
        `| **Total** | ${total} |`,
        "| E0424 | Unqualified enum member | Qualify it | `a.ts` |",
        "| E0429 | Register in a type position | Name the type | `b.ts` |",
      );
    for (const total of ["**2**", "**7**", "2"]) {
      const errors = ErrorCodeRegistry.check(
        totalled(total),
        new Set(["E0424", "E0429"]),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("counts the code rows");
    }
  });

  it("reads the source cell of a row whose text contains its own pipes", () => {
    // E0807's description contains `|` characters, so it splits into six cells
    // rather than four. Keying on the FIRST and LAST cell is what stops a row
    // like that from being skipped -- and a row this gate silently skips is a
    // row it does not defend.
    const piped = doc(
      "| E08xx | Arithmetic |",
      "| E0807 | bitwise `a | b` on a bool | Use `||` | `logic/analysis/BooleanOperandAnalyzer.ts` |",
    );
    expect(ErrorCodeRegistry.check(piped, new Set(["E0807"]))).toEqual([]);
  });
});

describe("ErrorCodeRegistry.summary (#2521)", () => {
  it("counts the rows of each range and all of them, in range order", () => {
    // The numbers the range table held, printed by the check instead: read
    // off the rows each time, so no pull request edits them.
    const markdown = doc(
      "| E04xx | Symbol Resolution |",
      "| E08xx | Arithmetic |",
      "| E0424 | Unqualified enum member | Qualify it | `a.ts` |",
      "| E0429 | Register in a type position | Name the type | `b.ts` |",
      "| E0854 | Constant index out of bounds | Fix the index | Planned |",
    );
    expect(ErrorCodeRegistry.summary(markdown)).toBe(
      "3 row(s): E04xx 2, E08xx 1",
    );
  });

  it("says so of a registry with no rows", () => {
    expect(
      ErrorCodeRegistry.summary(doc("| E04xx | Symbol Resolution |")),
    ).toBe("0 row(s)");
  });
});

describe("ErrorCodeRegistry.retired (#1620 review)", () => {
  it("lists the codes whose row is marked retired", () => {
    const markdown = doc(
      "| E0877 | _(retired)_ — was: assignment to a const binding | Folded into E0900 | `a.ts` |",
      "| E0900 | Write to a binding not declared mut | Declare it mut | `b.ts` |",
    );
    expect([...ErrorCodeRegistry.retired(markdown)]).toEqual(["E0877"]);
  });
});
