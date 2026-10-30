/**
 * #1668: 2.2's readings of the one operand typer's facts -- the policy rows
 * for the plan's typing sites, which the design (§5) keeps in one 2-Plan
 * module because several sites share them. The typer reports facts; each row
 * here decides what one site does with them, and nowhere else does.
 */
import type IOperandType from "../../types/IOperandType";
import type TOverflowBehavior from "../../types/TOverflowBehavior";

class PlanTyping {
  /**
   * The type a cast converts FROM, for ADR-024's saturation decision: the
   * typer's type, so a call, a callback, a struct field, an element and a C
   * or C++ header's value are typed like a variable, and a float among them
   * saturates. A Boolean -- `!k`, a comparison -- is the typer's `bool`,
   * whatever its operand was: `(u32)!k` converts 0 or 1, nothing to saturate.
   */
  static castSourceType(t: IOperandType | null): string | null {
    return t?.typeName ?? null;
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
  static overflowOf(
    leaves: ReadonlyArray<IOperandType | null>,
  ): TOverflowBehavior | null {
    let counted = false;
    for (const leaf of leaves) {
      const behavior = PlanTyping.countedBehavior(leaf);
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

export default PlanTyping;
