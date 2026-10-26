import type IOperandType from "../../types/IOperandType";

/** A run of consecutive subscripts that takes more than the value it indexes allows */
interface IOverIndexedRun {
  /** The op index of the run's first subscript */
  readonly start: number;
  readonly count: number;
  readonly allowed: number;
  /** The value the run indexes: the typer's `before` for its first subscript */
  readonly indexed: IOperandType;
  /** The declared width when that value is a bit-field, a bitmap's or a C struct's */
  readonly fieldWidth: number | null;
}

export default IOverIndexedRun;
