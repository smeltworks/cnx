/**
 * 2.2's decision for an assignment that writes a whole array (#1782): the C
 * type of one element and every dimension the copy walks, leading first. A
 * string array's last dimension is its characters' (`string<8>` is `[9]`).
 */
interface IPlannedWholeArrayWrite {
  readonly elementCType: string;
  readonly dimensions: ReadonlyArray<number | string>;
  /** A list, whose fill-all form expands; otherwise a `u8` array's string */
  readonly fromList: boolean;
  /** #1209: another array, copied straight from, with no temporary */
  readonly fromArray: boolean;
  /** The target is `volatile` (or `atomic`, which C writes `volatile`) */
  readonly volatileTarget: boolean;
}

export default IPlannedWholeArrayWrite;
