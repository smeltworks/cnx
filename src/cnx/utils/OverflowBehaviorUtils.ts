import type IOperandType from "../types/IOperandType";
import type TOverflowBehavior from "../types/TOverflowBehavior";

/**
 * ADR-044 overflow behavior, decoded from a declaration's `clamp`/`wrap`
 * modifier.
 *
 * Issue #1303: this decision used to be spelled inline in
 * `TypeRegistrationEngine`, the only site that read the modifier at all -- and
 * that site lives in the OUTPUT layer, so it ran solely for the file being
 * generated. A `u8` reached codegen from an included `.cnx` with its declared
 * behavior already gone, and the same statement clamped locally while it
 * wrapped across a file boundary.
 *
 * Keeping the decode here means the symbols layer can author the fact onto the
 * symbol (where it travels across files) without restating the rule that
 * "absent means clamp" -- restating it is what let the two paths diverge.
 */
class OverflowBehaviorUtils {
  /**
   * `clamp` is ADR-044's default: absent modifier means clamp, never wrap.
   * The modifier arrives as 1.2 lowered it (`SyntaxLowering.overflow`, #1991).
   */
  static fromModifier(modifier: TOverflowBehavior | null): TOverflowBehavior {
    return modifier ?? "clamp";
  }

  /**
   * ADR-044: whether a composite's arithmetic saturates or wraps, from its
   * value leaves. Safety wins a mix: it wraps only when every counted integer
   * leaf was declared `wrap`, so one saturating operand makes the result
   * saturate (#231's bounds guards). Null when no leaf is counted, and the
   * expression is left alone.
   *
   * A leaf counts when it is a declared value: a named variable, a struct
   * field (its own modifier, #1411), an array element (its array's, #1887),
   * a call result (its return type's, #1703) or a cast (its own modifier, else
   * its operand's, #1703). A parameter
   * (#1681) and a `for` variable (#1667) count by their declarations like any
   * local: a parameter has no modifier in the grammar, so it clamps.
   */
  static ofLeaves(
    leaves: ReadonlyArray<IOperandType | null>,
  ): TOverflowBehavior | null {
    let counted = false;
    for (const leaf of leaves) {
      const behavior = OverflowBehaviorUtils.countedBehavior(leaf);
      if (behavior === undefined) continue;
      counted = true;
      if (behavior === "clamp") return "clamp";
    }
    return counted ? "wrap" : null;
  }

  /** A leaf's behavior when it counts, null for a counted leaf with none */
  private static countedBehavior(
    leaf: IOperandType | null,
  ): TOverflowBehavior | null | undefined {
    if (leaf === null) return undefined;
    if (!leaf.binding && leaf.overflow === null) return undefined;
    if (leaf.category !== "signed" && leaf.category !== "unsigned") {
      return undefined;
    }
    return leaf.overflow;
  }
}

export default OverflowBehaviorUtils;
