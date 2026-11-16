/**
 * Issue #1219: The scope-context matrix vocabulary.
 *
 * One place decides what a cell IS, how it is spelled, and which relationship
 * an include distance is (#1402). Every consumer reads that decision rather than
 * re-deriving it -- a second list of contexts that agreed with this one only by
 * coincidence is exactly the divergence the project forbids.
 */

import TMatrixContext from "../types/TMatrixContext";
import TMatrixPosition from "../types/TMatrixPosition";
import TMatrixRelationship from "../types/TMatrixRelationship";

const CONTEXTS: readonly TMatrixContext[] = [
  "global-variable",
  "top-level-function",
  "scope-member",
  "scope-method",
  "for-header",
];

const RELATIONSHIPS: readonly TMatrixRelationship[] = [
  "same-file",
  "imported-direct",
  "imported-transitive",
  "exercised-from-one-away",
  "exercised-through-chain",
];

/** #1618: the rows of a code's position table, in report order. */
const POSITIONS: readonly TMatrixPosition[] = [
  "declaration-initializer",
  "assignment",
  "array-element-assignment",
  "struct-field-assignment",
  "compound-assignment",
  "return-statement",
  "call-argument",
  "array-element-initializer",
  "struct-field-initializer",
  "ternary-branch",
];

function isPosition(value: string): value is TMatrixPosition {
  return (POSITIONS as readonly string[]).includes(value);
}

/** Encode a cell as a stable key. Never build this string by hand elsewhere. */
function key(
  context: TMatrixContext,
  relationship: TMatrixRelationship,
): string {
  return `${context}|${relationship}`;
}

/** Every cell in the matrix, in stable report order. */
function all(): {
  context: TMatrixContext;
  relationship: TMatrixRelationship;
}[] {
  const cells: {
    context: TMatrixContext;
    relationship: TMatrixRelationship;
  }[] = [];
  for (const context of CONTEXTS) {
    for (const relationship of RELATIONSHIPS) {
      cells.push({ context, relationship });
    }
  }
  return cells;
}

/**
 * #1402: one position's relationship, from its include hops.
 *
 * `consumer`: a position in the fixture, `hops` away from the file declaring
 * the construct -- 0 is the fixture itself. `provider`: a position in a file
 * the fixture includes, `hops` away from the fixture (at least 1).
 */
function relationshipFor(
  side: "consumer" | "provider",
  hops: number,
): TMatrixRelationship {
  if (side === "provider") {
    return hops === 1 ? "exercised-from-one-away" : "exercised-through-chain";
  }
  if (hops === 0) return "same-file";
  return hops === 1 ? "imported-direct" : "imported-transitive";
}

class MatrixCell {
  static readonly CONTEXTS = CONTEXTS;
  static readonly RELATIONSHIPS = RELATIONSHIPS;
  static readonly POSITIONS = POSITIONS;
  static isPosition = isPosition;
  static key = key;
  static all = all;
  static relationshipFor = relationshipFor;
}

export default MatrixCell;
