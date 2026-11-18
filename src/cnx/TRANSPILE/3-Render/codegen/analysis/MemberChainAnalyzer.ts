/**
 * MemberChainAnalyzer - Analyzes member access chains for bit access patterns
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Used to detect bit access at the end of member chains, e.g.:
 * - grid[2][3].flags[0] - detects that [0] is bit access on flags
 * - s.arr[1][3] - detects that [3] is bit access on an array field's element
 *
 * ## It reads the typer's chain, not its own (#1668, C12)
 *
 * What the final subscript indexes is the one operand typer's answer: the
 * last step of the target's chain says the type before the subscript and the
 * subscript's kind, as 2.1's bit rules and the read path already read them.
 * This class walked the chain itself, through the render state's struct
 * fields, with its own count of how many subscripts an array field takes. That
 * count was wrong for an element of an array field, so `s.arr[1][3] <- true`
 * was emitted as `s.arr[1][3] = true;`, and it knew only cnx integer names,
 * so a C header's `uint8_t` field was never a bit target. What is left here is
 * the decision; the write itself is `AssignmentHandlerUtils.writeBits`, the
 * one every bit handler uses (#1668 review: this class rendered the base
 * from the source spelling, so a renamed local wrote the global it shadows).
 */

import IBitAccessAnalysis from "../../../../types/IBitAccessAnalysis";
import TPlannedTargetOp from "../../../../types/TPlannedTargetOp";
import type IChainStep from "../../../../types/IChainStep";
import OperandTyper from "../../../../utils/OperandTyper";

class MemberChainAnalyzer {
  /**
   * Whether the chain's final subscript writes a bit, or a bit range, of an
   * integer or a float.
   *
   * @param lastStep - The typer's step for the final op, or undefined
   * @param ops - The chain's ops
   */
  static analyze(
    lastStep: IChainStep | undefined,
    ops: readonly TPlannedTargetOp[],
  ): IBitAccessAnalysis {
    if (ops.at(-1)?.kind !== "subscript") {
      return { isBitAccess: false };
    }
    const indexed = lastStep?.before ?? null;
    const isBits = lastStep?.subscript === "bit_range";
    if (!isBits || indexed === null) {
      return { isBitAccess: false };
    }
    return { isBitAccess: OperandTyper.hasWritableBits(indexed) };
  }
}

export default MemberChainAnalyzer;
