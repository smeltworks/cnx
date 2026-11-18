/**
 * One step of an assignment target's postfix chain, reduced to what the
 * bit-access analysis asks of it.
 *
 * #1445: `postfixTargetOp` is `.IDENTIFIER` or `[start, length]`, where
 * `[start]` is `[start, 1]` (ADR-007 §1) -- so "is this a member access" is
 * the only question the walk asks of a node, and `kind` answers it. What a
 * subscript IS is the typer's answer, never how many indexes were written.
 *
 * ## The indexes are a thunk
 *
 * Most chains are not bit accesses, and the walk decides that from
 * `CodeGenState` alone -- the indexes are needed only for the target it builds
 * afterwards. Generating an expression queues a pending temp declaration in
 * some shapes, so generating every index up front would leak one for every
 * chain the walk rejects. The thunk keeps each call behind the decision, which
 * is the order the node-walking version had for free.
 */
type TPlannedTargetOp =
  | {
      readonly kind: "member";
      readonly name: string;
    }
  | {
      readonly kind: "subscript";
      readonly renderIndexes: () => readonly string[];
      /** The length folded to a constant (`[start]`'s is `1`); undefined otherwise */
      readonly foldWidth: () => number | undefined;
    };

export default TPlannedTargetOp;
