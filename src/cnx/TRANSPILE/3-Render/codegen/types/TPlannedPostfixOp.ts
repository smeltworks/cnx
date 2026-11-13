import type IPlannedFloatBits from "../../../2-Plan/types/IPlannedFloatBits";
import type TPlannedNarrowing from "../../../2-Plan/types/TPlannedNarrowing";
import type IPlannedCallArgument from "./IPlannedCallArgument";
import type TSubscriptKind from "../../../../types/TSubscriptKind";
import type IChainStep from "../../../../types/IChainStep";

/**
 * One operation applied to a postfix expression's primary.
 *
 * The grammar's `postfixOp` is three things behind one node, told apart by
 * which child it carries: an IDENTIFIER is a member access, one or two
 * bracketed expressions are a subscript, and neither is a call. That
 * discrimination is the planner's now, so what arrives is already the arm.
 *
 * #1445 box 3: `PostfixExpressionGenerator` is 2028 lines and touched a parse
 * node in eight of them -- this union is most of what those eight did.
 */
type TPlannedPostfixOp =
  /** `.field` */
  | {
      readonly kind: "member";
      readonly name: string;
      /** #1994: it is the chain head's `rootOp`, as the write path's is */
      readonly appliesToRoot: boolean;
      /** #1668 (C12): the typer's step, or null where its root consumed it */
      readonly step: IChainStep | null;
      /** 2.2's decision for a bitmap field read (MISRA 10.3), or null */
      readonly narrowing: TPlannedNarrowing | null;
    }
  /**
   * `[i]` or `[start, width]`.
   *
   * `indexCount` is 1 or 2 and it is the DISCRIMINATOR: one index is an array
   * or bit access, two is a bit RANGE. Counting operations rather than
   * expressions is what keeps `flags[4, 3]` (one op, two expressions) distinct
   * from `flags[4][3]` (two ops, one each).
   *
   * `renderIndexes` returns them together, in order. Each is written against
   * `size_t`, which 2.2 planned for it, so an index literal takes MISRA
   * C:2012 Rule 7.2's `U` suffix (#1991).
   */
  | {
      readonly kind: "subscript";
      readonly indexCount: number;
      readonly renderIndexes: () => readonly string[];
      /**
       * The FINAL index folded to a compile-time constant, or undefined.
       *
       * Issue #1094: a bit range resolves a const or macro width to its value
       * so the mask is precomputed, byte-identical to a literal width, instead
       * of a runtime `((1U << W) - 1)` -- which is undefined behavior at full
       * width and uses the wrong base type above 32 bits. Only the two-index
       * arm asks.
       */
      readonly foldWidth: () => number | undefined;
      /**
       * What this subscript IS -- an element, a slice, a bit, a bit range --
       * as the one operand typer's chain classifies it (#1668). 2.1's
       * bit-access rules read the same answer, so a C header's scalar
       * integer is subscripted as bits (ADR-024) in both passes.
       */
      readonly typedAs: TSubscriptKind;
      /** 2.2's decision: how this range reads a float's bits (ADR-007), or null */
      readonly floatBits: IPlannedFloatBits | null;
      /** #1668 (C12): the typer's step, or null for an untyped chain */
      readonly step: IChainStep | null;
      /** 2.2's decision for a bit or bit-range read (MISRA 10.3), or null */
      readonly narrowing: TPlannedNarrowing | null;
    }
  /**
   * `(args)`
   *
   * `line` is where ADR-010's promise -- a declaration reached through an
   * `#include` is callable exactly where a local one is -- is recorded when it
   * fires. At the CALL rather than at the directive: an `#include` sits in no
   * scope, function or variable, so the matrix's context axis has nothing to
   * ask it (#1508).
   *
   * The arguments are unevaluated: a call whose result is discarded must not
   * render its arguments, and planning them reads the callee's parameters.
   */
  | {
      readonly kind: "call";
      readonly line: number | undefined;
      /**
       * The cnx type of the value being called -- everything before this
       * operation -- or null when that is not a typed value, as for a
       * function's own name. ADR-029: a field, variable or parameter of a
       * callback type holds a function with that type's parameters.
       *
       * Deferred like an argument's `expressionType`, and for the same
       * reason: it reads mutable render-time state.
       */
      readonly calleeType: () => string | null;
      readonly planArguments: () => readonly IPlannedCallArgument[] | null;
      /** ADR-051: the helper 2.2 planned this `safe_div`/`safe_mod` call as, else null */
      readonly safeDivisionHelper: string | null;
      /**
       * #1209: the declaration of the buffer a `string<N>` or array return
       * fills, given its name -- or null when the call returns by value
       */
      readonly returnBuffer: ((name: string) => string) | null;
    };

export default TPlannedPostfixOp;
