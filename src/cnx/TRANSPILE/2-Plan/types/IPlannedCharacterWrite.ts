import type TStringValueForm from "../../../types/TStringValueForm";

/**
 * #1748, #2373: a string written into one character `s[i]` or a range
 * `s[i, n]` of a `string<N>`: the value's form, how many of its characters
 * are written, and whether the target is a range
 */
interface IPlannedCharacterWrite {
  readonly form: TStringValueForm;
  readonly count: number;
  readonly range: boolean;
}

export default IPlannedCharacterWrite;
