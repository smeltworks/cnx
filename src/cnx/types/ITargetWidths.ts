/**
 * ADR-072: the target widths a register member's C layout depends on -- an
 * `ISR` slot's pointer, an enum's `int` and an `f64`'s `double`; null where
 * the target is unknown
 */
interface ITargetWidths {
  readonly pointerBits: number | null;
  readonly intBits: number | null;
  readonly doubleBits: number | null;
  /** ADR-072 ruling 14: the compiler sizes an enum by its values */
  readonly shortEnums: boolean | null;
}

export default ITargetWidths;
