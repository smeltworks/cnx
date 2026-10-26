/**
 * Context extracted from an assignment statement for classification (ADR-065).
 *
 * This interface captures all information needed to classify and generate
 * code for an assignment. Built once by the context extractor, then used
 * by the classifier and handlers.
 */
import type TRenderedStringPart from "../../../types/TRenderedStringPart";
import type IPlannedFloatBits from "./IPlannedFloatBits";
import type IPlannedSliceSource from "./IPlannedSliceSource";
import type IPlannedAtomic from "../../types/IPlannedAtomic";
import type IBitmapFieldTarget from "../../../types/IBitmapFieldTarget";
import type IPlannedWholeArrayWrite from "./IPlannedWholeArrayWrite";
import type IBitAccessAnalysis from "../../../types/IBitAccessAnalysis";
import type TPlannedTargetOp from "../../../types/TPlannedTargetOp";
import type IChainBase from "../../../types/IChainBase";
import type TranspileState from "../../TranspileState";
import type TExpression from "../../../types/syntax/TExpression";

/**
 * Context extracted from assignment statement for classification.
 */
interface IAssignmentContext {
  /**
   * 2.3 Render's per-file working state (#1452 box 4).
   *
   * Handlers are module-level functions that receive only this context, so it
   * is their channel to the state -- the same role the orchestrator plays for
   * the generators.
   */
  readonly state: TranspileState;

  // === The target, as renders rather than as a node ===

  /**
   * The fully-resolved target, rendered on demand.
   *
   * This renders the SAME text `resolvedTarget` already holds, and that
   * duplication is pre-existing: the builder renders the target once to derive
   * `resolvedTarget` and `resolvedBaseIdentifier`, and six handlers rendered it
   * again from the node. Preserved rather than collapsed here, because
   * `generateAssignmentTarget` renders chain subscripts and so is not obviously
   * free to call once instead of twice -- collapsing it changes emitted C if it
   * is not. Keeping both makes the duplication visible instead of hiding it
   * behind a node that looked like data.
   */
  readonly renderTarget: () => string;

  /**
   * The target without its final subscript, by the same renderer: the value
   * whose bits a bit write reads and writes (#1668 review).
   *
   * The bit-write handlers used to build it themselves from the source
   * spelling, so a local renamed `f__gs` was written as `gs` -- the global
   * it shadows -- and `S.cfg`, `pv` and a struct parameter's `p.arr` were
   * emitted as written, not as C names.
   */
  readonly renderBitTarget: () => string;

  /** ADR-034 bit-access analysis of the target's member chain. */
  readonly analyzeTargetForBitAccess: () => IBitAccessAnalysis;

  /**
   * The target's source line -- where ADR-044's overflow decision is recorded.
   *
   * #1318: position comes from the span, not from holding the node that had
   * one. This is the only thing any consumer asked the target's start for.
   */
  readonly targetLine: number | undefined;

  // === The value, as questions rather than as a node ===

  /** Whether the assignment has a right-hand side at all. */
  readonly hasValue: boolean;
  /** 2.2's decision: how the target writes a float's bits (ADR-007), or null */
  readonly floatBits: IPlannedFloatBits | null;
  /** 2.2's decision: the bitmap field the target writes (ADR-034), or null */
  readonly bitmapField: IBitmapFieldTarget | null;
  /** 2.2's decision: how this write is atomic (ADR-049), or null if it is not */
  readonly atomic: IPlannedAtomic | null;
  /** 2.2's decision: the ADR-044 helper this compound write calls, or null */
  readonly plannedClamp: { operation: string; cnxType: string } | null;
  /** 2.2's decision: how a slice write reads its source (#1081), or null */
  readonly plannedSliceSource: IPlannedSliceSource | null;
  /** 2.2's decision: the capacity of the one `string<N>` this write copies, or null (#1731) */
  readonly plannedStringCapacity: number | null;
  /**
   * 2.2's decision that the value is a concatenation or a substring
   * (`StringValueForm`, #1257): its parts, rendered when the handler builds
   * them; null for a copy
   */
  readonly plannedStringParts: (() => readonly TRenderedStringPart[]) | null;
  /** 2.2's decision: the shape a whole array is copied in (#1782), or null */
  readonly plannedWholeArray: IPlannedWholeArrayWrite | null;
  /** 2.2's decision: the C type a narrow compound write is cast to, or null */
  readonly plannedCompoundCast: string | null;
  /** 2.2's decision: the `uintN_t` a write-only register range is written through, or null */
  readonly plannedRegisterAccess: string | null;

  /**
   * The value's essential type, its integer type, and its constant fold.
   *
   * All three are pure -- they read the type registry and fold literals, and
   * none of them generates. They are thunks so an assignment form that does
   * not ask does not pay, which is what the node gave for free.
   */
  readonly valueExpressionType: () => string | null;
  readonly valueIntegerType: () => string | null;
  readonly foldValue: () => number | undefined;

  /**
   * #1668: whether any operand of the value is floating. A compound assignment
   * with a floating operand is not integer arithmetic, so it must not reach an
   * integer clamp helper. False when there is no value.
   */
  readonly valueHasFloatingOperand: () => boolean;

  // === Extracted identifiers and expressions ===

  /** All identifiers in the target chain */
  readonly identifiers: readonly string[];

  /**
   * How many subscript EXPRESSIONS the target carries, across all of its
   * operations -- `a[i][j]` is 2, and so is `a[start, width]`.
   *
   * The classifier asks only this, at twelve sites, and asked it as
   * `subscripts.length`.
   */
  readonly subscriptCount: number;

  /**
   * One subscript expression, rendered or folded. Indexed as `subscripts` was.
   *
   * Two accessors because the handlers ask two different questions of the same
   * expression: ADR-046's slice needs its offset and length to FOLD at compile
   * time (E0859/E0860 reject a runtime one), while a bit index is RENDERED into
   * the shift. A single accessor returning generated code cannot answer the
   * first, and one returning a number cannot answer the second.
   */
  readonly renderSubscript: (index: number) => string;
  /** Any expression a handler reads off a symbol, by the same renderer (#1991) */
  readonly renderExpression: (expr: TExpression) => string;
  readonly foldSubscript: (index: number) => number | undefined;

  /** The postfix operations, reduced to what is asked of them. */
  readonly postfixOps: readonly TPlannedTargetOp[];

  // #1445 review: `leadingSubscriptCount` stood here, written by the builder
  // and read by NOTHING in production. Its doc said it existed so the two
  // paths would "share the decision rather than each counting for itself" --
  // while `AssignmentClassifier` counts for itself two lines from where it
  // would have read this, off `postfixOps.slice(memberOpCount)`. This one was
  // counted from offset 0, so the two disagree on every scope-qualified chain
  // (`global.Other.buf[3][1]`): a reader who trusted the comment and removed
  // the "duplicate" would have got a wrong depth, silently. Deleted rather
  // than fixed, because the classifier's count is the live one. (#1114
  // review: that count went too -- the depth invariant now reads every run
  // off the target's typed chain, in `FilePlanner.targetDeclaration`.)

  // === Target classification flags ===

  /** Target starts with 'this' keyword */
  readonly hasThis: boolean;

  /** Target starts with 'global' keyword */
  readonly hasGlobal: boolean;

  /**
   * The path of the scope enclosing the target, `""` at file scope (#1934).
   * From Program's lexical frames, the answer 2.1 also uses, never from the
   * scope 2.3 Render has entered on the state.
   */
  readonly scopePath: string;

  /** Target has .member access */
  readonly hasMemberAccess: boolean;

  /** Target has [index] access */
  readonly hasArrayAccess: boolean;

  /** Number of postfix operations */
  readonly postfixOpsCount: number;

  // === Operator info ===

  /** cnx operator (e.g., "<-", "+<-") */
  readonly cnxOp: string;

  /** Mapped C operator (e.g., "=", "+=") */
  readonly cOp: string;

  /** True if compound assignment (+<-, -<-, etc.) */
  readonly isCompound: boolean;

  // === Generated values ===

  /** Generated C expression for the value (right-hand side) */
  readonly generatedValue: string;

  /**
   * Fully-resolved assignment target with scope prefixes applied.
   * Use this instead of raw identifiers to ensure proper scope resolution.
   * Example: "data" inside scope ArrayBug -> "ArrayBug_data"
   */
  readonly resolvedTarget: string;

  /**
   * Resolved base identifier for type lookups.
   * Extracted from resolvedTarget by removing subscripts and member access.
   * Example: "ArrayBug_data[0]" -> "ArrayBug_data"
   * Its declared type is `target.typeInfo` (#1668), not a lookup by this name.
   */
  readonly resolvedBaseIdentifier: string;

  // === Type info ===

  /**
   * #1668 (C7): what the target writes -- its root binding and the written
   * variable's declared type -- bound once, where the target is typed
   */
  readonly target: IChainBase;

  // === Computed properties ===

  /** Number of .member accesses in the chain */
  readonly memberAccessDepth: number;

  /** Number of [index] accesses in the chain */
  readonly subscriptDepth: number;

  /** Number of expressions in the last subscript operation (1=element, 2=slice/bit-range) */
  readonly lastSubscriptExprCount: number;

  /** True if target is a simple identifier (no prefix, no postfix) */
  readonly isSimpleIdentifier: boolean;

  /** True if this is this.member with no further postfix ops */
  readonly isSimpleThisAccess: boolean;

  /** True if this is global.member with no further postfix ops */
  readonly isSimpleGlobalAccess: boolean;

  /** An index in the target calls a function or reads a volatile (#1887) */
  readonly targetIndexHasSideEffect: boolean;
}

export default IAssignmentContext;
