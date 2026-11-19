import type IBitWidth from "../../types/IBitWidth";
import type IPlannedAtomic from "./IPlannedAtomic";

/**
 * A float bit write (ADR-007): the float written, its type, and the bits
 * written into it. #1760: one argument, where it was six.
 */
interface IFloatBitWrite {
  /** The float written, as C: a variable's name, or an lvalue */
  readonly target: string;
  /** Its cnx type, `f32` or `f64`, as the typer gives it */
  readonly floatType: string;
  /** Bit index expression (the start position of a range) */
  readonly bitIndex: string;
  /** Bit width with its fold (#1096), or null when it is one bit (ADR-007 §1) */
  readonly width: IBitWidth | null;
  /** The value written */
  readonly value: string;
  /** The value's constant fold, as an integer bit write folds it (Rule 14.3) */
  readonly folded: number | undefined;
  /** Whether `target` names a variable, which has a shadow union */
  readonly isVariable: boolean;
  /** What 2.2 planned for the bits of an `atomic` float (ADR-049), or null */
  readonly atomic: IPlannedAtomic | null;
}

export default IFloatBitWrite;
