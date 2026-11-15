/**
 * Issue #1219: How the construct under test crosses a file boundary.
 *
 * The first three are consumer-side -- the fixture reaches OUT to a declaration
 * that many hops away. The last two are provider-side: the declaration lives in
 * this file and is reached INTO from elsewhere. #1164 is only observable
 * provider-side, which is why the two halves are not redundant.
 *
 * #1402: both halves are measured over the include graph a fixture's run
 * resolved (MatrixCell.relationshipFor).
 */
type TMatrixRelationship =
  | "same-file"
  | "imported-direct"
  | "imported-transitive"
  | "exercised-from-one-away"
  | "exercised-through-chain";

export default TMatrixRelationship;
