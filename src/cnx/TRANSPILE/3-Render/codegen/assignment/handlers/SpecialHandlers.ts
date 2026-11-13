/**
 * Special assignment handlers (ADR-065).
 *
 * Handles special compound assignment operations:
 * - ATOMIC_RMW: atomic counter +<- 1
 * - OVERFLOW_CLAMP: clamp u8 saturated +<- 200
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import AssignmentClassifier from "../../../../2-Plan/AssignmentClassifier";
import TAssignmentHandler from "./TAssignmentHandler";
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";
import TYPE_MAP from "../../../../2-Plan/types/TYPE_MAP";
import invariant from "../../../../../utils/invariant";

/**
 * Handle atomic read-modify-write: atomic counter +<- 1
 *
 * Delegates to CodeGenerator's generateAtomicRMW, in the form 2.2 planned:
 * LDREX/STREX or the masked region. Whether the inner
 * operation saturates is the classifier's decision, passed in.
 */
function handleAtomicRMW(ctx: IAssignmentContext): string {
  const atomic = ctx.atomic;
  invariant(atomic !== null, "2.2 planned every atomic 2.3 writes");
  const target = ctx.renderTarget();

  return ctx.state.requireGenerator().generateAtomicRMW(
    target,
    ctx.cOp,
    ctx.generatedValue,
    // #1179: the value 2.2 found atomic, however the target spells it
    atomic,
    AssignmentClassifier.compoundClamp(ctx)?.name ?? null,
  );
}

const HOISTED_CLAMP_ANNOTATION =
  "/* ADR-044 / Issue #1887: target reached once through a temp (its subscript has a side effect, and the clamp reads the element as well as writing it). */";

/**
 * Handle overflow-clamped compound assignment: clamp u8 saturated +<- 200
 *
 * Generates calls to cnx_clamp_add_u8, cnx_wrap_div_i32, etc. Classified only
 * when `AssignmentClassifier.compoundClamp` names a helper.
 */
function handleOverflowClamp(ctx: IAssignmentContext): string {
  const clamp = AssignmentClassifier.compoundClamp(ctx);
  invariant(clamp !== null, "OVERFLOW_CLAMP is classified only with a helper");
  const target = ctx.renderTarget();

  // #1241: ADR-044's rule firing on the COMPOUND form. The expression form
  // (`a <- a + b`) records in BinaryExprGenerator; this is the `a +<- b` path,
  // which reaches a different decision and would otherwise leave every
  // compound-only fixture without a derivable context.
  AdrProvenance.record("044", ctx.targetLine);
  const helper = clamp.name;
  if (!ctx.targetIndexHasSideEffect) {
    return `${target} = ${helper}(${target}, ${ctx.generatedValue});`;
  }

  // #1887: `arr[next()] +<- 1` calls next() once, as `+=` did. The element is
  // reached through its address; `volatile` because it may address a volatile
  // element, and adding a qualifier to a pointer is always valid C.
  const cType = TYPE_MAP[clamp.cnxType] ?? clamp.cnxType;
  const element = ctx.state.getNextTempVarName();
  return `${HOISTED_CLAMP_ANNOTATION}\n{ volatile ${cType}* ${element} = &${target}; *${element} = ${helper}(*${element}, ${ctx.generatedValue}); }`;
}

/**
 * All special handlers for registration.
 */
const specialHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.ATOMIC_RMW, handleAtomicRMW],
  [AssignmentKind.OVERFLOW_CLAMP, handleOverflowClamp],
];

export default specialHandlers;
