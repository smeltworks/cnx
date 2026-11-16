/**
 * Issue #1219: declared severity combined with derived occupancy.
 *
 * The gate's whole value is that it fires on evidence. These tests pin the two
 * ways it could fire on something else: an `off` cell being reported, and a
 * cell being called empty when the tool merely cannot see it.
 */

import AdrMatrixDeclaration from "../matrix/AdrMatrixDeclaration";
import MatrixCell from "../matrix/MatrixCell";
import MatrixReport from "../matrix/MatrixReport";
import MatrixTestHelpers from "./matrixTestHelpers";

describe("MatrixReport.violations", () => {
  it("reports a declared error cell that no fixture occupies", () => {
    const declarations = new Map([
      [
        "051",
        MatrixTestHelpers.declare("051", [
          ["top-level-function", "imported-direct", "error"],
        ]),
      ],
    ]);
    const found = MatrixReport.violations(declarations, new Map());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      adr: "051",
      context: "top-level-function",
      relationship: "imported-direct",
      severity: "error",
    });
  });

  it("reports nothing when the declared cell is occupied", () => {
    const declarations = new Map([
      [
        "051",
        MatrixTestHelpers.declare("051", [
          ["top-level-function", "same-file", "error"],
        ]),
      ],
    ]);
    const occupancy = new Map([
      [
        "051",
        MatrixTestHelpers.occupy("051", [["top-level-function", "same-file"]]),
      ],
    ]);
    expect(MatrixReport.violations(declarations, occupancy)).toEqual([]);
  });

  it("never reports an off cell, however empty", () => {
    const declarations = new Map([
      [
        "051",
        MatrixTestHelpers.declare("051", [
          ["scope-member", "imported-transitive", "off"],
        ]),
      ],
    ]);
    expect(MatrixReport.violations(declarations, new Map())).toEqual([]);
  });

  it("reports an undeclared cell as nothing, since undeclared means off", () => {
    const declarations = new Map([
      ["051", MatrixTestHelpers.declare("051", [])],
    ]);
    expect(MatrixReport.violations(declarations, new Map())).toEqual([]);
  });

  it("orders errors before warnings", () => {
    const declarations = new Map([
      [
        "051",
        MatrixTestHelpers.declare("051", [
          ["top-level-function", "same-file", "warn"],
          ["scope-method", "same-file", "error"],
        ]),
      ],
    ]);
    const found = MatrixReport.violations(declarations, new Map());
    expect(found.map((violation) => violation.severity)).toEqual([
      "error",
      "warn",
    ]);
  });
});

describe("AdrMatrixDeclaration.severityOf", () => {
  it("defaults an undeclared cell to off so the tool blocks nothing on arrival", () => {
    const declaration = MatrixTestHelpers.declare("999", []);
    for (const { context, relationship } of MatrixCell.all()) {
      expect(
        AdrMatrixDeclaration.severityOf(declaration, context, relationship),
      ).toBe("off");
    }
  });
});

describe("MatrixReport.undeclaredRules", () => {
  it("names a rule matrix fixtures occupy that no ADR declares (#1731 review)", () => {
    const declarations = new Map([
      ["045", MatrixTestHelpers.declare("045", [])],
      ["045 string-copy", MatrixTestHelpers.declare("045 string-copy", [])],
    ]);
    const occupancy = new Map([
      ["045", MatrixTestHelpers.occupy("045", [])],
      ["045 string-copy", MatrixTestHelpers.occupy("045 string-copy", [])],
      ["045 string-cpy", MatrixTestHelpers.occupy("045 string-cpy", [])],
    ]);
    expect(MatrixReport.undeclaredRules(declarations, occupancy)).toEqual([
      "045 string-cpy",
    ]);
  });

  it("leaves an ADR's own matrix to the existing checks", () => {
    // An ADR whose own table is missing is the reader's concern, not a typo.
    const occupancy = new Map([["099", MatrixTestHelpers.occupy("099", [])]]);
    expect(MatrixReport.undeclaredRules(new Map(), occupancy)).toEqual([]);
  });
});

describe("MatrixReport.ungatedCodes (#1620 review)", () => {
  it("names a code matrix whose code no ADR's table declares", () => {
    const declarations = new Map([
      ["071 E0900", MatrixTestHelpers.declare("071 E0900", [])],
    ]);
    const occupancy = new Map([
      ["013 E0900", MatrixTestHelpers.occupy("013 E0900", [])],
      ["071 E0896", MatrixTestHelpers.occupy("071 E0896", [])],
      ["045 string-copy", MatrixTestHelpers.occupy("045 string-copy", [])],
    ]);
    expect(MatrixReport.ungatedCodes(declarations, occupancy)).toEqual([
      "071 E0896",
    ]);
  });
});

describe("MatrixReport.contradictions (#1620 review)", () => {
  it("names an off cell, declared or left out, that a fixture occupies", () => {
    const declarations = new Map([
      [
        "071 E0899",
        MatrixTestHelpers.declare("071 E0899", [
          ["for-header", "same-file", "off"],
          ["top-level-function", "same-file", "error"],
        ]),
      ],
    ]);
    const occupancy = new Map([
      [
        "071 E0899",
        MatrixTestHelpers.occupy("071 E0899", [
          ["for-header", "same-file"],
          ["top-level-function", "same-file"],
          ["scope-method", "imported-direct"],
        ]),
      ],
    ]);
    expect(
      MatrixReport.contradictions(declarations, occupancy).map(
        (cell) => `${cell.context} / ${cell.relationship}`,
      ),
    ).toEqual(["scope-method / imported-direct", "for-header / same-file"]);
  });
});
