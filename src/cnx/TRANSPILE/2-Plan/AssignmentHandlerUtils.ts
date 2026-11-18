/**
 * Assignment Handler Utilities
 *
 * Common utilities shared across assignment handlers to reduce duplication.
 * Issue #707: Extracted from RegisterHandlers.ts and AccessPatternHandlers.ts.
 */

import invariant from "../../utils/invariant";
import BitUtils from "../../utils/BitUtils";
import BitmapFieldStep from "../../utils/BitmapFieldStep";
import type IAssignmentContext from "./types/IAssignmentContext";

/**
 * Validate that compound assignment operators are not used with bit field access.
 *
 * @param isCompound - Whether this is a compound assignment
 * @param cnxOp - The cnx operator being used
 * @throws Error if compound operator is used with bit fields
 */
// #1322: `validateNoCompoundForBitAccess` is gone. Compound assignment on a
// bit index, bit range, slice, bitmap field (#2159) or string is E0857 in pass 2.1 -- one decision
// where this was six throws with four message variants, and where this very
// helper was defined a second time, verbatim, in `BitAccessHandlers`.

/**
 * A write-1 register bit is never assigned a zero here.
 *
 * #1322: E0872 rejects it in pass 2.1 (ADR-004), by VALUE -- `0x0`, `!true`
 * and a zero-valued const included. The generated form for a single bit is
 * `REG = (1U << bit)`, so a zero reaching this point would be emitted as a
 * set; the assertion holds the emission to the rule by the value 2.2 folds
 * for the write (`foldWrittenValue`), never its spelling. That fold leaves a
 * read of a local unfolded, which E0872's `ZeroValue` still rejects in 2.1.
 *
 * @param folded - The value's constant fold, undefined when not constant
 * @param value - The generated value, for the assertion's text
 * @param targetName - The full register name, for the assertion's text
 * @param bitIndex - The bit index expression, for the assertion's text
 */
function validateWriteOnlyValue(
  folded: number | undefined,
  value: string,
  targetName: string,
  bitIndex: string,
): void {
  invariant(
    folded !== 0,
    `a write-1 register bit takes a non-zero value -- E0872 rejects ` +
      `'${value}' on ${targetName}[${bitIndex}] in pass 2.1, before this runs`,
  );
}

/**
 * The one bit write: the target without its final subscript, rendered by
 * the target renderer, and that subscript's bit or bit range (#1668 review).
 *
 * Five handlers and the member-chain one each rebuilt the base from the
 * source spelling, so a local renamed `f__gs` was written as the global
 * `gs`, and each picked the mask's width from a type NAME only `u64`/`i64`
 * matched: a header's `uint64_t` or a `u64` struct field got `1U << 40`,
 * undefined behavior. The width is the typer's now, for the value the
 * subscript indexes, whatever its spelling -- and the MISRA C:2012 Rule
 * 10.3 narrowing cast comes with it for every form, not only two.
 * `BitUtils` takes it as the C type the value is stored in, which is what a
 * bitmap, a register member and a float's bits give it too.
 *
 * #1760 review: the value's category decides the write, once, for every
 * target. A float's bits go through a union, an element's and a field's too
 * (they fell through to a plain subscript store, and a variable was the only
 * float this reached). An integer the target gives no width, such as a
 * header's `int_fast16_t`, is written in `uintmax_t` by its own type name
 * (owner ruling), where a 32-bit mask cleared the upper half of a `long`.
 */
function writeBits(ctx: IAssignmentContext): string {
  const last = ctx.postfixOps.at(-1);
  invariant(
    last?.kind === "subscript",
    "a bit write's target ends in a subscript: the classifier routed it here",
  );
  // Source order: the base's own subscripts, then the bit's
  const base = ctx.renderBitTarget();
  const [start, widthText] = last.renderIndexes();
  // Every writer takes the width with its fold (#1096): the float branch
  // passed it unfolded, and masked a runtime `1U << 32` at full width
  const width =
    widthText === undefined
      ? undefined
      : { text: widthText, folded: last.foldWidth() };
  // ADR-007 §1: one bit long, however it was spelled -- a `bool` stored with
  // no mask, where a wider range masks its value
  const step = ctx.target.last;
  const oneBit = BitmapFieldStep.writesOneBit(step, null);
  const floatBits = ctx.floatBits;
  if (floatBits !== null) {
    return ctx.state.requireGenerator().generateFloatBitWrite({
      target: base,
      floatType: floatBits.floatType,
      bitIndex: start,
      width: oneBit ? null : (width ?? null),
      value: ctx.generatedValue,
      folded: ctx.foldValue(),
      isVariable: floatBits.shared,
      atomic: ctx.atomic,
    });
  }
  const value = step?.fieldBits
    ? step.fieldBits.storage
    : (step?.before ?? null);
  invariant(
    value?.category !== "floating",
    "2.2 planned every float bit write 2.3 writes",
  );
  const storage = BitUtils.storageOf(value);
  if (oneBit) {
    return storeBits(ctx, base, (read, bit, folded) =>
      BitUtils.singleBitValue(read, start, bit, storage, folded),
    );
  }
  invariant(width !== undefined, "a bit range has a width");
  return storeBits(ctx, base, (read, bits) =>
    BitUtils.multiBitValue(read, start, width, bits, storage),
  );
}

/**
 * Store the bits a write computes from the value read (`newValue`): a plain
 * read-modify-write, or, for an `atomic` value's bits, the form 2.2 planned
 * (ADR-049, #2200). A retry loop reads the written value once, through
 * `__operand`, in the C type 2.2 planned for it.
 */
function storeBits(
  ctx: IAssignmentContext,
  target: string,
  newValue: (read: string, value: string, folded?: number) => string,
): string {
  const atomic = ctx.atomic;
  if (atomic === null) {
    return `${target} = ${newValue(target, ctx.generatedValue, ctx.foldValue())};`;
  }
  // A folded value is the written value only where it is written directly
  const folded = atomic.form === "interrupt-mask" ? ctx.foldValue() : undefined;
  return ctx.state
    .requireGenerator()
    .generateAtomicStore(target, ctx.generatedValue, atomic, (read, value) =>
      newValue(read, value, folded),
    );
}

/**
 * Assignment Handler Utilities
 */
class AssignmentHandlerUtils {
  static readonly writeBits = writeBits;
  static readonly storeBits = storeBits;
  static readonly validateWriteOnlyValue = validateWriteOnlyValue;
}

export default AssignmentHandlerUtils;
