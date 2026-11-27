/**
 * Issue #1219: how one cell's state is rendered.
 *
 * The committed report is diffed by `coverage:matrix:check`, which does protect
 * the renderer -- but only for the branches the report currently exercises.
 * `docs/scope-context-matrix.md` today contains no `-` cell and no `**MISSING**`
 * cell, so those two branches can be rewritten without any committed file
 * changing and without any test failing. Both were verified to survive a
 * deliberate mutation before these tests existed.
 *
 * They are the two that matter most: `**MISSING**` is how a cell that is FAILING
 * its declared obligation appears, and `-` is how one carrying none
 * does.
 */

import MatrixCell from "../matrix/MatrixCell";
import MatrixRenderer from "../matrix/MatrixRenderer";
import MatrixTestHelpers from "./matrixTestHelpers";

const EMPTY = undefined;

describe("MatrixRenderer.renderCell", () => {
  it("renders an occupied cell as ok", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["scope-method", "same-file", "error"],
        ]),
        MatrixTestHelpers.occupy("051", [["scope-method", "same-file"]]),
        "scope-method",
        "same-file",
      ),
    ).toBe("ok");
  });

  it("renders a declared error cell that nothing occupies as **MISSING**", () => {
    // The gate fails on this cell; the report must say so rather than showing
    // it as satisfied.
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["top-level-function", "imported-direct", "error"],
        ]),
        EMPTY,
        "top-level-function",
        "imported-direct",
      ),
    ).toBe("**MISSING**");
  });

  it("renders a declared warn cell that nothing occupies as warn", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["scope-member", "same-file", "warn"],
        ]),
        EMPTY,
        "scope-member",
        "same-file",
      ),
    ).toBe("warn");
  });

  it("renders a cell carrying no obligation as '-'", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", []),
        EMPTY,
        "global-variable",
        "same-file",
      ),
    ).toBe("-");
  });

  it("renders an occupied provider-side cell as ok", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", []),
        MatrixTestHelpers.occupy("051", [
          ["scope-member", "exercised-from-one-away"],
        ]),
        "scope-member",
        "exercised-from-one-away",
      ),
    ).toBe("ok");
  });
});

describe("MatrixRenderer.renderGrid", () => {
  it("emits a header, a divider and one row per context", () => {
    const grid = MatrixRenderer.renderGrid(
      MatrixTestHelpers.declare("051", []),
      EMPTY,
    );
    const lines = grid.split("\n");
    expect(lines).toHaveLength(MatrixCell.CONTEXTS.length + 2);
    expect(lines[1]).toMatch(/^\| --- \|/);
  });

  it("gives every declared relationship a column", () => {
    const header = MatrixRenderer.renderGrid(
      MatrixTestHelpers.declare("051", []),
      EMPTY,
    ).split("\n")[0];
    expect(header.split("|").filter((c) => c.trim() !== "")).toHaveLength(
      MatrixCell.RELATIONSHIPS.length + 1,
    );
  });
});

describe("MatrixRenderer.renderDocument", () => {
  it("carries the generated-file banner", () => {
    expect(MatrixRenderer.renderDocument(new Map(), new Map())).toContain(
      MatrixRenderer.BANNER,
    );
  });

  it("emits no timestamp, so a diff gate can be trusted", () => {
    // GRAMMAR-COVERAGE.md emitted one, churned on every run, and drifted for
    // seven months because nobody could gate on it (#1150).
    const document = MatrixRenderer.renderDocument(
      new Map([["051", MatrixTestHelpers.declare("051", [])]]),
      new Map(),
    );
    expect(document).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(document).toBe(
      MatrixRenderer.renderDocument(
        new Map([["051", MatrixTestHelpers.declare("051", [])]]),
        new Map(),
      ),
    );
  });

  it("says so plainly when no ADR declares a matrix", () => {
    expect(MatrixRenderer.renderDocument(new Map(), new Map())).toContain(
      "No ADR declares a matrix",
    );
  });

  it("orders ADR sections by number", () => {
    const document = MatrixRenderer.renderDocument(
      new Map([
        ["065", MatrixTestHelpers.declare("065", [])],
        ["006", MatrixTestHelpers.declare("006", [])],
      ]),
      new Map(),
    );
    expect(document.indexOf("## ADR-006")).toBeLessThan(
      document.indexOf("## ADR-065"),
    );
  });

  it("lists fixtures whose context could not be derived instead of folding them into a cell", () => {
    const document = MatrixRenderer.renderDocument(
      new Map([["051", MatrixTestHelpers.declare("051", [])]]),
      new Map([
        [
          "051",
          {
            adr: "051",
            cells: new Map(),
            fixturesWithoutContext: ["b/second.test.cnx", "a/first.test.cnx"],
            positions: new Map(),
          },
        ],
      ]),
    );
    expect(document).toContain("Linked fixtures with no derivable context:");
    // Sorted, so the report does not churn on directory-walk order.
    expect(document.indexOf("a/first.test.cnx")).toBeLessThan(
      document.indexOf("b/second.test.cnx"),
    );
  });

  it("heads that list with the same line however many fixtures it holds (#2517)", () => {
    // A count in the heading is rewritten by every branch that adds a fixture
    // to the list, so two such branches conflict on it. Each fixture changes
    // its own line and nothing else.
    const headingOf = (fixturesWithoutContext: string[]): string => {
      const document = MatrixRenderer.renderDocument(
        new Map([["051", MatrixTestHelpers.declare("051", [])]]),
        new Map([
          [
            "051",
            {
              adr: "051",
              cells: new Map(),
              fixturesWithoutContext,
              positions: new Map(),
            },
          ],
        ]),
      );
      return document
        .split("\n")
        .filter((line) => line.includes("no derivable context"))
        .join("\n");
    };
    expect(headingOf(["only/one.test.cnx"])).toBe(
      "Linked fixtures with no derivable context:",
    );
    expect(headingOf(["a/first.test.cnx", "b/second.test.cnx"])).toBe(
      headingOf(["only/one.test.cnx"]),
    );
  });
});
