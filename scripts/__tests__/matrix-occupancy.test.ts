/**
 * Issue #1219: per-ADR occupancy built from the fixture corpus.
 *
 * The claim under test is that a cell is occupied only when a fixture really
 * exercises it. The cases that matter are the ones where a plausible
 * implementation would over-claim: a fixture holding two contexts, and a
 * diagnostic with no usable position.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import FixtureOccupancy from "../matrix/FixtureOccupancy";
import MatrixCell from "../matrix/MatrixCell";

let dir: string;

const write = (name: string, body: string): string => {
  const path = join(dir, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body, "utf-8");
  return path;
};

const occupancyFor = async (adr: string, fixtures: string[]) =>
  (await FixtureOccupancy.build(fixtures, dir)).get(adr);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cnx-matrix-occ-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FixtureOccupancy.build", () => {
  it("ignores a fixture with no test-adr marker", async () => {
    const fixture = write("plain.test.cnx", "u8 x <- 1;\n");
    expect((await FixtureOccupancy.build([fixture], dir)).size).toBe(0);
  });

  it("places an error fixture in the cell its diagnostic resolves to", async () => {
    const fixture = write(
      "division.test.cnx",
      "// test-adr: 051\nu32 ZERO <- 0;\nvoid go() {\n    u32 bad <- 10 / ZERO;\n}\n",
    );
    write("division.expected.error", "4:22 error[E0800]: Division by zero\n");

    const occupancy = await occupancyFor("051 E0800", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("top-level-function", "same-file"),
    ]);
  });

  it("occupies a cell from provenance when the fixture has no diagnostic", async () => {
    // #1241: THE regression this mechanism exists for. ADR-057 governs
    // resolution SUCCEEDING, so its fixtures assert generated C and emit no
    // diagnostic. Context used to be derived only from an `.expected.error`
    // position, so eleven real fixtures occupied nothing and seventeen declared
    // cells sat `warn` with no path to green -- an observability gap that
    // writing more fixtures could not have closed.
    //
    // Note there is deliberately NO `.expected.error` written here.
    const fixture = write(
      "bare-member.test.cnx",
      "// test-adr: 057\n" +
        "scope Counter {\n" +
        "    mut u32 value <- 0;\n" +
        "    public void bump() {\n" +
        "        value <- value + 1;\n" +
        "    }\n" +
        "}\n",
    );

    const occupancy = await occupancyFor("057 binds-scope", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("scope-method", "same-file"),
    ]);
    expect(occupancy!.fixturesWithoutContext).toEqual([]);
  });

  it("does not invent provenance where the rule declines to fire", async () => {
    // The negative control for the test above. A scope VARIABLE named like a
    // global type must not capture it (ADR-057), so the rule correctly does
    // nothing -- and a mechanism that credited a cell anyway would report
    // coverage for behavior no fixture exercises.
    const fixture = write(
      "no-capture.test.cnx",
      "// test-adr: 057\nu8 plain <- 1;\nvoid go() {\n    u8 local <- 2;\n}\n",
    );

    const all = await FixtureOccupancy.build([fixture], dir);
    for (const rule of ["binds-local", "binds-scope", "binds-global"]) {
      expect(all.get(`057 ${rule}`)).toBeUndefined();
    }
    expect(all.get("057")!.cells.size).toBe(0);
    expect(all.get("057")!.fixturesWithoutContext).toEqual([
      "no-capture.test.cnx",
    ]);
  });

  it("credits a global bound from a scope member to binds-global only", async () => {
    // #1187: the one table ADR-057 had placed by where a name is written, so a
    // scope member reading a global sat in the cell scope-member reads already
    // filled, and a broken global binding there was invisible
    const fixture = write(
      "global-arg.test.cnx",
      "// test-adr: 057\n" +
        "u8 PIN <- 10;\n" +
        "scope Fails {\n" +
        "    public u8 copy <- PIN;\n" +
        "}\n",
    );

    const all = await FixtureOccupancy.build([fixture], dir);
    expect([...all.get("057 binds-global")!.cells.keys()]).toEqual([
      MatrixCell.key("scope-member", "same-file"),
    ]);
    expect(all.get("057 binds-scope")).toBeUndefined();
  });

  it("uses the include graph for the relationship, not just the context", async () => {
    write("provider.cnx", "u32 ZERO <- 0;\n");
    const fixture = write(
      "consumer.test.cnx",
      '// test-adr: 051\n#include "provider.cnx"\nvoid go() {\n    u32 bad <- 10 / ZERO;\n}\n',
    );
    write("consumer.expected.error", "4:22 error[E0800]: Division by zero\n");

    const occupancy = await occupancyFor("051 E0800", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("top-level-function", "imported-direct"),
    ]);
  });

  it("does not credit a context the fixture merely contains", async () => {
    // The fixture declares BOTH a scope and a top-level function, but the
    // diagnostic is inside the scope method. Only that cell may be occupied --
    // a file-structure derivation would claim both.
    const fixture = write(
      "both.test.cnx",
      [
        "// test-adr: 051",
        "u32 ZERO <- 0;",
        "void topLevel() {",
        "    u32 fine <- 1;",
        "}",
        "scope S {",
        "    void go() {",
        "        u32 bad <- 10 / ZERO;",
        "    }",
        "}",
      ].join("\n"),
    );
    write("both.expected.error", "8:24 error[E0800]: Division by zero\n");

    const occupancy = await occupancyFor("051 E0800", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("scope-method", "same-file"),
    ]);
  });

  it("records a fixture with no diagnostic as context-not-derivable", async () => {
    const fixture = write(
      "positive.test.cnx",
      "// test-adr: 049\nu8 x <- 1;\n",
    );
    const occupancy = await occupancyFor("049", [fixture]);
    expect(occupancy!.cells.size).toBe(0);
    expect(occupancy!.fixturesWithoutContext).toEqual(["positive.test.cnx"]);
  });

  it("treats a synthetic 1:0 diagnostic as no position, not as line 1", async () => {
    // #1235: 13 codes report 1:0 as a placeholder. Resolving line 1 would
    // classify them by whatever declaration happens to start the file.
    // Line 1 must be a real DECLARATION for this to discriminate. With a
    // comment on line 1 the classifier returns null either way and the test
    // cannot tell whether the exclusion is doing anything.
    const fixture = write(
      "synthetic.test.cnx",
      "u32 leading <- 1;\n// test-adr: 070\nvoid go() {\n    u32 x <- 1;\n}\n",
    );
    write(
      "synthetic.expected.error",
      "1:0 Code generation failed: E0853: Cannot use 'return' inside critical section\n",
    );

    const occupancy = await occupancyFor("070", [fixture]);
    expect(occupancy!.cells.size).toBe(0);
    expect(occupancy!.fixturesWithoutContext).toEqual(["synthetic.test.cnx"]);
  });

  it("credits every ADR a fixture declares", async () => {
    const fixture = write(
      "multi.test.cnx",
      "// test-adr: 051, 013\nvoid go() {\n    u32 bad <- 1;\n}\n",
    );
    write("multi.expected.error", "3:14 error[E0800]: Division by zero\n");

    const report = await FixtureOccupancy.build([fixture], dir);
    // #1620: a coded diagnostic occupies its code's matrix in each ADR.
    expect([...report.keys()]).toEqual(["013 E0800", "051 E0800"]);
  });

  it("occupies a rule's matrix only from that rule's provenance (#1731 review)", async () => {
    // The copy into `g` is ADR-045's string-copy rule. It must fill that rule's
    // top-level-function cell and not the ADR's own: while occupancy was keyed
    // by ADR alone, it filled the declaration rules' cell as well.
    const fixture = write(
      "copy.test.cnx",
      '// test-adr: 045\nmut string<8> g <- "";\nvoid go() {\n    g <- "ab";\n}\n',
    );

    const built = await FixtureOccupancy.build([fixture], dir);
    expect([...built.get("045 string-copy")!.cells.keys()]).toEqual([
      MatrixCell.key("top-level-function", "same-file"),
    ]);
    expect([...(built.get("045")?.cells.keys() ?? [])]).not.toContain(
      MatrixCell.key("top-level-function", "same-file"),
    );
    expect(built.get("045")?.fixturesWithoutContext ?? []).toEqual([]);
  });
});
