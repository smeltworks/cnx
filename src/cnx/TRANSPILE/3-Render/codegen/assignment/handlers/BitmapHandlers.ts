/**
 * Bitmap field assignment handlers (ADR-065).
 *
 * Handles assignments to bitmap fields:
 * - BITMAP_FIELD: flags.Mode <- 3, gss[1].fl.Mode <- 3, this.fl.A <- true
 * - REGISTER_MEMBER_BITMAP_FIELD: MOTOR.CTRL.Running <- true, Scope.GPIO7.ICR1.LED <- value
 */
import invariant from "../../../../../utils/invariant";
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";
import type IBitmapFieldTarget from "../../../../../types/IBitmapFieldTarget";
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import BitmapFieldStep from "../../../../../utils/BitmapFieldStep";
import AssignmentHandlerUtils from "../../../../2-Plan/AssignmentHandlerUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterAccessMode from "../../../../../utils/RegisterAccessMode";

/**
 * The field 2.2 planned the target to write, which routed it here. A compound operator on it never reaches here: pass 2.1 rejects it as
 * E0857 (#2159), and a literal too wide for the field as E0881 (#1322).
 */
function fieldOfTarget(ctx: IAssignmentContext): IBitmapFieldTarget {
  const field = ctx.bitmapField;
  invariant(field, "the classifier routes a planned bitmap field here");
  return field;
}

/**
 * A bitmap field write: the field's bits of the bitmap's backing scalar,
 * written by `BitUtils`, whose width decisions read the backing type (#1668).
 * A write-1 register member takes a plain write, never a read-modify-write:
 * the member cannot be read (#1776). A zero there is E0872 in pass 2.1, and
 * asserted here as the register bit's is, so the field form keeps the pair.
 */
function writeBitmapField(
  target: string,
  field: IBitmapFieldTarget,
  ctx: IAssignmentContext,
  writeOnly: boolean,
): string {
  const bitmapType = field.bitmapType;
  const layout = field.layout;
  // The one answer 2.2 planned the value's C type from (#2155 review 9)
  const oneBit = BitmapFieldStep.writesOneBit(ctx.target.last, field);
  const storage = ctx.state.symbols!.bitmapBackingType.get(bitmapType);
  invariant(
    storage,
    `a bitmap the resolver collected has a backing type ('${bitmapType}')`,
  );
  const value = ctx.generatedValue;
  if (writeOnly) {
    const bits = oneBit
      ? `${layout.offset}`
      : `${layout.offset}, ${layout.width}`;
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.foldValue(),
      value,
      target,
      bits,
    );
  }
  if (oneBit) {
    return writeOnly
      ? BitUtils.writeOnlySingleBit(
          target,
          layout.offset,
          value,
          storage,
          ctx.foldValue(),
        )
      : AssignmentHandlerUtils.storeBits(ctx, target, (read, bit, folded) =>
          BitUtils.singleBitValue(read, layout.offset, bit, storage, folded),
        );
  }
  return writeOnly
    ? BitUtils.writeOnlyMultiBit(
        target,
        layout.offset,
        layout.width,
        value,
        storage,
        ctx.plannedBitValue,
      )
    : AssignmentHandlerUtils.storeBits(ctx, target, (read, bits) =>
        BitUtils.multiBitValue(
          read,
          layout.offset,
          layout.width,
          bits,
          storage,
          ctx.plannedBitValue,
        ),
      );
}

/**
 * A field of a bitmap value, however the value is named -- a variable, an
 * element, a member, a parameter, through `this.` or `global.`: the target
 * renders as every other bit write's does, and the typer names the bitmap.
 * #1760 second review: rebuilt here from the source spelling, a shadowing
 * local's write went to the global, and a C parameter's (a pointer) was not
 * dereferenced.
 */
function handleBitmapField(ctx: IAssignmentContext): string {
  return writeBitmapField(
    ctx.renderBitTarget(),
    fieldOfTarget(ctx),
    ctx,
    false,
  );
}

/**
 * A field of a register member, however the register is spelled -- an
 * instance or a register parameter: the target renders as every other bit
 * write's does, the typer names the member (#2158), and its access decides
 * the write.
 */
function handleRegisterMemberBitmapField(ctx: IAssignmentContext): string {
  const member = ctx.target.last?.beforeRegisterMember;
  invariant(member, "the classifier routes a field of a register member here");
  const access = ctx.state.symbols!.registerMemberAccess.get(member);
  return writeBitmapField(
    ctx.renderBitTarget(),
    fieldOfTarget(ctx),
    ctx,
    RegisterAccessMode.isWriteOne(access),
  );
}

/**
 * Note that ADR-034's rule fired, for the matrix's occupancy derivation.
 *
 * Every handler in this module IS that rule -- lowering a named bitmap field
 * to a mask-and-shift on its backing scalar -- so the recording sits at the
 * registration boundary below rather than in each body. A handler added to
 * that array is recorded by construction, where an in-body call per handler
 * would be one more chance to add a handler and forget the line.
 *
 * #1241: this is what lets ADR-034's matrix derive occupancy at all. Occupancy
 * comes from source POSITIONS, and a bitmap write that works emits no
 * diagnostic and so supplies none -- every fixture exercising these rules
 * counted as "a linked fixture with no derivable context", leaving all twelve
 * declared cells reading unoccupied no matter how many fixtures reached them.
 */
function recordingAdr034(handler: TAssignmentHandler): TAssignmentHandler {
  return (ctx) => {
    AdrProvenance.record(
      "034",
      ctx.targetLine,
      undefined,
      ctx.targetDeclaredAt,
    );
    return handler(ctx);
  };
}

/**
 * All bitmap handlers for registration.
 */
const declaredBitmapHandlers: ReadonlyArray<
  [AssignmentKind, TAssignmentHandler]
> = [
  [AssignmentKind.BITMAP_FIELD, handleBitmapField],
  [
    AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
    handleRegisterMemberBitmapField,
  ],
];

const bitmapHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> =
  declaredBitmapHandlers.map(
    ([kind, handler]): [AssignmentKind, TAssignmentHandler] => [
      kind,
      recordingAdr034(handler),
    ],
  );

export default bitmapHandlers;
