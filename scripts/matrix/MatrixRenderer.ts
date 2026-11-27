/**
 * Issue #1219: renders the scope-context matrix.
 *
 * Deliberately carries no timestamp. `GRAMMAR-COVERAGE.md` emits one, which
 * churns the file on every run and makes a diff gate permanently red -- so
 * nobody could gate on it and it drifted for seven months (#1150).
 */

import AdrMatrixDeclaration from "./AdrMatrixDeclaration";
import MatrixCell from "./MatrixCell";
import MatrixReport from "./MatrixReport";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixOccupancy from "../types/IMatrixOccupancy";
import TMatrixContext from "../types/TMatrixContext";
import TMatrixRelationship from "../types/TMatrixRelationship";

const BANNER = `<!-- GENERATED FILE - DO NOT EDIT.
     Source: the fixture corpus under tests/ plus each ADR's MATRIX-SEVERITY table.
     Regenerate: npm run coverage:matrix -->`;

/** Column headings, shortened so the grid stays readable. */
const COLUMN_LABELS: Record<TMatrixRelationship, string> = {
  "same-file": "same file",
  "imported-direct": "direct",
  "imported-transitive": "transitive",
  "exercised-from-one-away": "from 1 away",
  "exercised-through-chain": "thru chain",
};

const ROW_LABELS: Record<TMatrixContext, string> = {
  "global-variable": "global variable",
  "top-level-function": "top-level function",
  "scope-member": "scope member",
  "scope-method": "scope method",
  "for-header": "for header",
};

/** One cell's rendering. */
function renderCell(
  declaration: IMatrixDeclaration | undefined,
  occupancy: IMatrixOccupancy | undefined,
  context: TMatrixContext,
  relationship: TMatrixRelationship,
): string {
  const severity =
    declaration === undefined
      ? "off"
      : AdrMatrixDeclaration.severityOf(declaration, context, relationship);
  const occupied = MatrixReport.isOccupied(occupancy, context, relationship);

  if (occupied) return "ok";
  if (severity === "error") return "**MISSING**";
  if (severity === "warn") return "warn";
  return "-";
}

/** The 4x5 grid for one ADR. */
function renderGrid(
  declaration: IMatrixDeclaration | undefined,
  occupancy: IMatrixOccupancy | undefined,
): string {
  const header = `| Context | ${MatrixCell.RELATIONSHIPS.map((r) => COLUMN_LABELS[r]).join(" | ")} |`;
  const divider = `| --- | ${MatrixCell.RELATIONSHIPS.map(() => "---").join(" | ")} |`;
  const rows = MatrixCell.CONTEXTS.map((context) => {
    const cells = MatrixCell.RELATIONSHIPS.map((relationship) =>
      renderCell(declaration, occupancy, context, relationship),
    );
    return `| ${ROW_LABELS[context]} | ${cells.join(" | ")} |`;
  });
  return [header, divider, ...rows].join("\n");
}

/** The whole document. */
function renderDocument(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): string {
  const adrs = [
    ...new Set([...declarations.keys(), ...occupancy.keys()]),
  ].sort();
  const parts: string[] = [
    BANNER,
    "",
    "# Scope-Context Test Matrix",
    "",
    "Which structural contexts and file relationships each ADR's fixtures actually",
    "exercise. Occupancy is derived from the fixture corpus; the obligation for each",
    "cell is declared by the ADR that owns it.",
    "",
    "| Legend | Meaning |",
    "| --- | --- |",
    "| `ok` | a fixture occupies this cell |",
    "| `**MISSING**` | the ADR declared `error` and nothing occupies it |",
    "| `warn` | the ADR declared `warn` and nothing occupies it |",
    "| `-` | no obligation declared (`off`) |",
    "",
  ];

  if (adrs.length === 0) {
    parts.push(
      "No ADR declares a matrix and no fixture carries a `// test-adr:` marker.",
    );
    parts.push("");
    return parts.join("\n");
  }

  for (const adr of adrs) {
    const declaration = declarations.get(adr);
    const adrOccupancy = occupancy.get(adr);
    parts.push(`## ADR-${adr}`, "");
    parts.push(renderGrid(declaration, adrOccupancy), "");

    const pending = adrOccupancy?.fixturesWithoutContext ?? [];
    if (pending.length > 0) {
      // #2517: no count in this line. A count is rewritten by every branch
      // that adds a fixture to the list, so any two of them conflict on it,
      // or merge to a count that matches neither. The list is its own length.
      parts.push("Linked fixtures with no derivable context:", "");
      for (const fixture of [...pending].sort()) parts.push(`- \`${fixture}\``);
      parts.push("");
    }
  }

  return parts.join("\n");
}

function positionCell(
  severity: string,
  occupied: boolean,
  occupants: number,
): string {
  if (occupied) return `ok (${occupants})`;
  if (severity === "error") return "**MISSING**";
  if (severity === "warn") return "warn";
  return "-";
}

/** #1618: each code's position table, beside how many fixtures land there. */
function renderPositions(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): string {
  if (declarations.size === 0) return "";
  const parts: string[] = [
    "## Positions",
    "",
    "Which part of its statement each code's diagnostics land in, for a code whose",
    "ADR declares a position table.",
    "",
  ];
  for (const id of [...declarations.keys()].sort()) {
    parts.push(`### ADR-${id}`, "");
    parts.push("| Position | Severity | Fixtures |", "| --- | --- | --- |");
    for (const [position, severity] of declarations.get(id)!.severities) {
      const occupied = MatrixReport.isPositionOccupied(occupancy, id, position);
      const occupants = MatrixReport.positionOccupants(occupancy, id, position);
      const cell = positionCell(severity, occupied, occupants);
      parts.push(
        `| ${position.replaceAll("-", " ")} | ${severity} | ${cell} |`,
      );
    }
    parts.push("");
  }
  return parts.join("\n");
}

class MatrixRenderer {
  static renderPositions = renderPositions;
  /** @public test seam: matrix-renderer.test.ts drives this module value directly */
  static readonly BANNER = BANNER;
  /** @public test seam: matrix-renderer.test.ts drives this module function directly */
  static renderCell = renderCell;
  /** @public test seam: matrix-renderer.test.ts drives this module function directly */
  static renderGrid = renderGrid;
  static renderDocument = renderDocument;
}

export default MatrixRenderer;
