import type IOperandType from "./IOperandType";

/**
 * What the place a value stands in says about it (#1322, #1991): a
 * declaration's type, the field it initializes, the parameter it is passed to,
 * an assignment's target or the enclosing function's return type.
 */
interface IValuePosition {
  /** The type's spelling; null when the position cannot name one */
  readonly typeText: string | null;
  /** Whether the position takes a whole array */
  readonly isArray: boolean;
  /**
   * The sizes a whole array here is counted against, leading first (ADR-035,
   * E0866): an assignment target's, a field's or a parameter's. A size that
   * does not fold is its C spelling. Empty for a declaration, whose sizes are
   * its own syntax and are counted from there, and wherever no array is taken.
   */
  readonly dimensions: ReadonlyArray<number | string>;
  /** A declaration, whose whole-array initializer ADR-035's rule checks */
  readonly isDeclaration: boolean;
  /** Whether an array initializer stands between the value and the position */
  readonly inList: boolean;
  /** False where nothing establishes a type, as under a subscript (E0357) */
  readonly supplied: boolean;
  /**
   * A header struct's field, as the typer types it: its bit-field width and
   * sign (ADR-072 ruling 19). Null at every other position.
   */
  readonly headerField: IOperandType | null;
}

export default IValuePosition;
