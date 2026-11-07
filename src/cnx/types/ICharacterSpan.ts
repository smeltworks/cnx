import type TExpression from "./syntax/TExpression";

/**
 * #1748, #2373, #2385: the characters one assignment target writes in a
 * scalar `string<N>` -- `s[i]` is `s[i, 1]` (owner ruling, 2026-11-05)
 */
interface ICharacterSpan {
  /** The first character written, as the target spells it */
  readonly start: TExpression;
  /** How many characters the span holds: 1 for `s[i]` */
  readonly count: number;
  /** The `N` of the `string<N>` it is in */
  readonly capacity: number;
}

export default ICharacterSpan;
