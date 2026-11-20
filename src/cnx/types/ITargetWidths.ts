/**
 * ADR-072: the target widths a register member's C layout depends on -- an
 * `ISR` slot's pointer and an enum's `int`; null where the target is unknown
 */
interface ITargetWidths {
  readonly pointerBits: number | null;
  readonly intBits: number | null;
}

export default ITargetWidths;
