/**
 * Issue #1219: combines declared severity with derived occupancy.
 *
 * A violation is a cell an ADR declared an obligation for that no fixture
 * occupies. An `off` cell carries no obligation, but one a tagged fixture
 * occupies contradicts its table (#1620 review: `contradictions`).
 */

import AdrMatrixDeclaration from "./AdrMatrixDeclaration";
import MatrixCell from "./MatrixCell";
import MatrixRule from "./MatrixRule";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixOccupancy from "../types/IMatrixOccupancy";
import IMatrixViolation from "../types/IMatrixViolation";
import IPositionViolation from "../types/IPositionViolation";
import TMatrixContext from "../types/TMatrixContext";
import TMatrixRelationship from "../types/TMatrixRelationship";
import TMatrixSeverity from "../types/TMatrixSeverity";

/**
 * Is a cell occupied by at least one fixture?
 *
 * The key comes from `MatrixCell.key`, which declares itself the sole encoder.
 * Spelling it out here instead made this a second definition of the encoding:
 * changing the separator in the encoder alone then reported every cell as
 * unoccupied, telling the author they were missing tests when nothing about the
 * corpus had changed.
 */
function isOccupied(
  occupancy: IMatrixOccupancy | undefined,
  context: TMatrixContext,
  relationship: TMatrixRelationship,
): boolean {
  if (occupancy === undefined) return false;
  const occupants = occupancy.cells.get(MatrixCell.key(context, relationship));
  return occupants !== undefined && occupants.length > 0;
}

/** Decides whether a declared cell belongs in the collected set. */
type TCellPredicate = (
  relationship: TMatrixRelationship,
  adr: string,
  context: TMatrixContext,
  severity: TMatrixSeverity,
) => boolean;

/**
 * Walk every declared cell across every ADR, keeping those the predicate accepts.
 *
 * One walker rather than two near-identical loops: adding a context or a
 * relationship must not require the same edit in two places.
 */
function collect(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  accept: TCellPredicate,
): IMatrixViolation[] {
  const found: IMatrixViolation[] = [];

  for (const adr of [...declarations.keys()].sort()) {
    const declaration = declarations.get(adr)!;
    for (const { context, relationship } of MatrixCell.all()) {
      const severity = AdrMatrixDeclaration.severityOf(
        declaration,
        context,
        relationship,
      );
      if (!accept(relationship, adr, context, severity)) continue;
      found.push({ adr, context, relationship, severity });
    }
  }

  return found;
}

/**
 * Every unmet obligation across all ADRs, most severe first.
 */
function violations(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): IMatrixViolation[] {
  return collect(
    declarations,
    (relationship, adr, context, severity) =>
      severity !== "off" &&
      !isOccupied(occupancy.get(adr), context, relationship),
  ).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return a.adr.localeCompare(b.adr);
  });
}

/**
 * #1620 review: cells declared, or left, `off` that a fixture tagged for the
 * table's ADR occupies anyway. With occupancy per code, the table says the
 * code cannot fire there and the ADR's own fixture shows that it does.
 */
function contradictions(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): IMatrixViolation[] {
  return collect(
    declarations,
    (relationship, adr, context, severity) =>
      severity === "off" &&
      isOccupied(occupancy.get(adr), context, relationship),
  );
}

/** Total number of cells carrying an obligation, across every ADR. */
function obligationCount(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
): number {
  let total = 0;
  for (const declaration of declarations.values()) {
    for (const severity of declaration.severities.values()) {
      if (severity !== "off") total += 1;
    }
  }
  return total;
}

/**
 * #1731 review: rule matrices fixtures occupy that no ADR declares a table for.
 *
 * A rule name the transpiler records and the ADR does not declare is a typo on
 * one side. Its occupancy would otherwise render under its own heading with no
 * obligation, and the rule's real table would sit unoccupied without a word.
 *
 * #1620: a code matrix is left to `ungatedCodes`, since a fixture may assert a
 * code its ADR does not own.
 */
function undeclaredRules(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): string[] {
  return [...occupancy.keys()]
    .filter(
      (id) =>
        MatrixRule.ruleOf(id) !== null &&
        !MatrixRule.isCode(id) &&
        !declarations.has(id),
    )
    .sort();
}

/**
 * #1620 review: code matrices fixtures occupy whose code no ADR's table gates.
 * A code another ADR declares is that ADR's to gate; a code no ADR declares
 * would otherwise render under its own heading and be checked by nothing.
 */
function ungatedCodes(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): string[] {
  const gated = new Set(
    [...declarations.keys()]
      .filter((id) => MatrixRule.isCode(id))
      .map((id) => MatrixRule.ruleOf(id)),
  );
  return [...occupancy.keys()]
    .filter((id) => MatrixRule.isCode(id) && !gated.has(MatrixRule.ruleOf(id)))
    .sort();
}

/** #1618: how many fixtures land `id`'s diagnostic in `position`. */
function positionOccupants(
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
  id: string,
  position: string,
): number {
  return occupancy.get(id)?.positions.get(position)?.length ?? 0;
}

/** #1618: whether any fixture lands `id`'s diagnostic in `position`. */
function isPositionOccupied(
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
  id: string,
  position: string,
): boolean {
  return positionOccupants(occupancy, id, position) > 0;
}

/**
 * #1618: position rows the fixtures contradict -- `warn` or `error` with no
 * fixture landing a diagnostic there, or `off` with one.
 */
function positionViolations(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): IPositionViolation[] {
  const found: IPositionViolation[] = [];
  for (const id of [...declarations.keys()].sort()) {
    for (const [position, severity] of declarations.get(id)!.severities) {
      // The parser keeps only position slugs in a position table
      if (!MatrixCell.isPosition(position)) continue;
      const occupied = isPositionOccupied(occupancy, id, position);
      if (severity === "off" ? occupied : !occupied) {
        found.push({ id, position, severity });
      }
    }
  }
  return found;
}

class MatrixReport {
  static positionViolations = positionViolations;
  static isPositionOccupied = isPositionOccupied;
  static positionOccupants = positionOccupants;
  static isOccupied = isOccupied;
  static undeclaredRules = undeclaredRules;
  static ungatedCodes = ungatedCodes;
  static violations = violations;
  static contradictions = contradictions;
  static obligationCount = obligationCount;
}

export default MatrixReport;
