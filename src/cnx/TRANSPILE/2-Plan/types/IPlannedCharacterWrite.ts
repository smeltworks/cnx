import type TStringValueForm from "../../../types/TStringValueForm";

/**
 * #1748, #2373, #2385: a write into the characters of a `string<N>` --
 * `s[i]` is `s[i, 1]` (owner ruling, 2026-11-05), so both spellings plan one
 * write: what the value is, how many characters it can write, and where
 * the first one lands
 */
interface IPlannedCharacterWrite {
  /**
   * A character, written as it is; an integer, split into bytes as ADR-007
   * splits a slice's; or a string by its form, copied in only as many
   * characters as it holds. A string other than a literal is `staged`
   * (built whole in a temporary) when it can write more than one character
   * or is a concatenation; otherwise its one character is read once and
   * written unless it is the terminator.
   */
  readonly value:
    | { readonly kind: "character" }
    | { readonly kind: "integer" }
    | {
        readonly kind: "string";
        readonly form: TStringValueForm;
        readonly staged: boolean;
      };
  /** The most characters the value writes */
  readonly count: number;
  /** The first character's index when it folds, else null */
  readonly offset: number | null;
  /**
   * The C type a runtime start is bound to, once, when more than one
   * character is written from it; else null (owner ruling, 2026-11-05)
   */
  readonly startCType: string | null;
}

export default IPlannedCharacterWrite;
