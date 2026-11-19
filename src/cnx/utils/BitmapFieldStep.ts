import type IChainStep from "../types/IChainStep";
import type IBitmapFieldLayout from "../types/IBitmapFieldLayout";
import type IBitmapFieldTarget from "../types/IBitmapFieldTarget";

/**
 * ADR-034: whether an assignment target's final step is a field the bitmap
 * declares -- a `.field` read off a bitmap value, or off a register member a
 * bitmap types -- as the one operand typer typed the chain. The one answer for
 * every rule that asks: the classifier routing the write, its handlers, and
 * E0857 rejecting a compound operator on it (#2159). A field the bitmap does
 * not declare is no field of it, so E0882 reports it, not E0857.
 */
class BitmapFieldStep {
  /** The bitmap field a final step names, or null when it names none */
  static fieldOf(
    step: IChainStep | undefined,
    bitmapFields: ReadonlyMap<string, ReadonlyMap<string, IBitmapFieldLayout>>,
  ): IBitmapFieldTarget | null {
    const fieldName = step?.member;
    if (!fieldName || step.property !== null) {
      return null;
    }
    const before = step.before;
    if (!before?.bitmapTypeName || before.dimensions.length !== 0) {
      return null;
    }
    const layout = bitmapFields.get(before.bitmapTypeName)?.get(fieldName);
    return layout === undefined
      ? null
      : { bitmapType: before.bitmapTypeName, fieldName, layout };
  }

  /**
   * ADR-007/034: whether a final step writes some of the bits of the value
   * before it -- a bit index, a bit range, or `field`, the bitmap field it
   * names. The one answer for the rules that treat those writes alike.
   */
  static writesBits(
    step: IChainStep | undefined,
    field: IBitmapFieldTarget | null,
  ): boolean {
    return step?.subscript === "bit_range" || field !== null;
  }

  /**
   * Whether a final step writing bits (`writesBits`) writes exactly one: a
   * subscript one bit long (ADR-007 §1), or a one-bit field. The one answer for the value's C type
   * (`bool`), E0872's wording, and the rendered form.
   */
  static writesOneBit(
    step: IChainStep | undefined,
    field: IBitmapFieldTarget | null,
  ): boolean {
    if (field !== null) return field.layout.width === 1;
    const bits = step?.subscript === "bit_range" ? step.after?.form : null;
    return bits?.kind === "bitRange" && bits.width === 1;
  }
}

export default BitmapFieldStep;
