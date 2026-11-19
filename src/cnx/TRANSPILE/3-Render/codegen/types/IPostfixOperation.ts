/**
 * One operation in a postfix chain, reduced to what rendering it needs.
 *
 * #1652: `expressions` was `unknown[]` and held live `Parser.ExpressionContext`
 * values. The type named no parse type, so `parse-tree-confined-to-parser`
 * counted `PostfixChainBuilder` as clean while it was handed parse nodes and
 * passed them back out to be rendered -- the under-measurement that let the
 * render layer reach zero with the coupling intact.
 *
 * The shape is `TPlannedTargetOp`'s, which the WRITE path already used: a count
 * to decide on, and a thunk to render with.
 */
interface IPostfixOperation {
  /** Member name if this is a member access */
  memberName: string | null;

  /** #1994: it is the chain head's `rootOp`, as the read path's is */
  appliesToRoot: boolean;

  /**
   * The subscript indexes, rendered on demand.
   *
   * A THUNK, and that is load-bearing rather than stylistic: rendering an index
   * can queue a pending temp declaration, so it must happen behind the branch
   * that uses the result. A member access renders none, and eagerly rendering
   * would queue a temp for a chain that never asked.
   */
  renderIndexes: () => string[];
}

export default IPostfixOperation;
