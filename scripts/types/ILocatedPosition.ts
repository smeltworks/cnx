import type { ProgramContext } from "../../src/cnx/PARSE/2-Parse/grammar/CnxParser";
import type TMatrixRelationship from "./TMatrixRelationship";

/**
 * #1402: a position the matrix credits, in the file it sits in, with the
 * relationship measured for it.
 */
interface ILocatedPosition {
  /** The parse tree of the file the position is in */
  readonly tree: ProgramContext;
  readonly line: number;
  readonly column?: number;
  readonly relationship: TMatrixRelationship;
}

export default ILocatedPosition;
