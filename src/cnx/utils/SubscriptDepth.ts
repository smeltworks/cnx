import type IChainStep from "../types/IChainStep";
import type IOverIndexedRun from "./types/IOverIndexedRun";
import SubscriptClassifier from "./SubscriptClassifier";

/**
 * ADR-036/ADR-007: how deep each run of subscripts in a typed chain may go.
 * A run is measured against the value it applies to, so a struct field's own
 * shape decides `p.header[4][3]`, not the root `p`'s (#1114); a member access
 * or a call ends a run. Pass 2.1's E0856 and codegen's invariant both read
 * this, on the one typer's chain.
 *
 * A value the typer gives no type -- a C pointer (#2358) -- and a base the
 * limit does not cover -- a struct, an enum or a string (#2357, #2264) -- are
 * not measured.
 */
class SubscriptDepth {
  /** How many subscripts the run starting at `step` may take, or null */
  static limitOf(
    step: IChainStep,
  ): { allowed: number; fieldWidth: number | null } | null {
    const indexed = step.before;
    if (indexed === null) return null;
    if (step.beforeIsBitField) {
      // A bitmap's 1-bit field is typed `bool`, which carries no width
      const width = indexed.bitWidth ?? 1;
      return {
        allowed: SubscriptClassifier.fieldDepthLimit(width),
        fieldWidth: width,
      };
    }
    if (indexed.typeName === null) return null;
    const allowed = SubscriptClassifier.depthLimit(
      indexed.typeName,
      indexed.dimensions.length,
    );
    return allowed === null ? null : { allowed, fieldWidth: null };
  }

  /**
   * Every over-indexed run in a chain whose last `steps.length` ops the
   * typer typed (the ones before them name its head)
   */
  static overIndexed(
    ops: ReadonlyArray<{ readonly kind: string }>,
    steps: readonly IChainStep[],
  ): IOverIndexedRun[] {
    const first = ops.length - steps.length;
    const found: IOverIndexedRun[] = [];
    let index = first;
    while (index < ops.length) {
      const start = index;
      while (ops[index]?.kind === "subscript") index += 1;
      if (index === start) {
        index += 1;
        continue;
      }
      const step = steps[start - first];
      const limit = SubscriptDepth.limitOf(step);
      const count = index - start;
      if (limit === null || step.before === null || count <= limit.allowed) {
        continue;
      }
      found.push({ start, count, indexed: step.before, ...limit });
    }
    return found;
  }
}

export default SubscriptDepth;
