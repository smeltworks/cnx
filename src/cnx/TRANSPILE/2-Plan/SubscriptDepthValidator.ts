/**
 * Issue #1106: shared validation for subscript-chain depth.
 *
 * Per ADR-036 each subscript peels one array dimension; per ADR-007 a scalar
 * integer/float may be bit-indexed once, and a `bool` not at all (#2354). The
 * limit is `SubscriptClassifier.depthLimit`, the one pass 2.1's E0856 reads.
 * A deeper chain indexes a value that is not an array — e.g. `flags[4][3]` on
 * a scalar `u8`, where `flags[4]` is already a single bit.
 *
 * This is the single source of truth for the "how many subscripts may this
 * base take?" decision. Both the assignment (write) path
 * (AssignmentClassifier) and the expression (read) path
 * (PostfixExpressionGenerator) consult it, so the two paths cannot diverge.
 * It owns the *counting* as well as the check (`countLeadingSubscripts`):
 * sharing only the check while each path re-derived the count would leave the
 * two agreeing by coincidence rather than by construction.
 */
import TTypeInfo from "../../types/TTypeInfo";
import SubscriptClassifier from "../../utils/SubscriptClassifier";
import invariant from "../../utils/invariant";

/**
 * A planned postfix operation, which STATES its kind.
 *
 * #1445 review: there were two shapes here -- this one and an
 * `IPostfixOpLike { expression(): unknown[] }` for raw nodes -- chosen between
 * by a `"kind" in op` probe. In the one module whose stated purpose is that
 * the read and write paths "cannot diverge on what counts as a subscript",
 * that was the question being answered from two representations. Both callers
 * pass planned ops now.
 *
 * The kind is the literal union rather than `string`, so a planner emitting a
 * fourth kind is a compile error here instead of silently counting as
 * not-a-subscript.
 */
interface IPlannedOpLike {
  readonly kind: "member" | "subscript" | "call";
}

function isSubscript(op: IPlannedOpLike): boolean {
  return op.kind === "subscript";
}

class SubscriptDepthValidator {
  /**
   * Count the leading run of subscript operations applied directly to a base,
   * starting at `startIndex` and stopping at the first operation that changes
   * the type (member access or call) — after that, subsequent subscripts apply
   * to a different value, not to this base.
   *
   * Counts OPERATIONS, not expressions: the bit range `flags[4, 3]` is one
   * operation with two expressions, whereas the chain `flags[4][3]` is two
   * operations with one each. Conflating them would reject valid bit ranges.
   *
   * `startIndex` skips operations already consumed in identifying the base —
   * on the read path `this.flags[4][3]` parses as `this` plus the ops
   * `.flags`, `[4]`, `[3]`, so the member op is skipped with `startIndex: 1`.
   * The write path needs no offset: `assignmentTarget` consumes the `this .
   * IDENTIFIER` prefix in the grammar rule itself, so its ops are subscripts
   * from index 0.
   */
  static countLeadingSubscripts(
    ops: readonly IPlannedOpLike[],
    startIndex = 0,
  ): number {
    let count = 0;
    for (let index = startIndex; index < ops.length; index++) {
      if (!isSubscript(ops[index])) {
        break;
      }
      count++;
    }
    return count;
  }

  /**
   * Validate that a leading run of `subscriptOpCount` subscript operations
   * applied directly to `varName` (declared type `typeInfo`) is within range.
   *
   * Only integer, float and bool bases are checked (`depthLimit` covers
   * those). Strings are char arrays with their own semantics,
   * bitmaps reject bracket indexing elsewhere, and struct/other bases are
   * handled by the member-access paths — none are validated here.
   *
   * #1322: the `line` parameter went with the throw. It existed only to be
   * spelled into the message, which is what a diagnostic's position is for.
   */
  static validate(
    typeInfo: TTypeInfo | undefined,
    subscriptOpCount: number,
    varName: string,
  ): void {
    if (!typeInfo || typeInfo.isString || typeInfo.isBitmap) {
      return;
    }

    const allowed = SubscriptClassifier.depthLimit(
      typeInfo.baseType,
      typeInfo.arrayDimensions?.length ?? 0,
    );
    if (allowed === null) {
      return;
    }

    // #1322: ADR-036/ADR-007's depth limit is E0856 in pass 2.1, decided from
    // the declaration's own dimensions. The throw here built `Error at line N:`
    // into its message -- a position carried as prose, which is what the
    // relocation removes.
    invariant(
      subscriptOpCount <= allowed,
      `'${varName}' is subscripted no deeper than its shape allows -- E0856 rejects this in pass 2.1, before this runs`,
    );
  }
}

export default SubscriptDepthValidator;
