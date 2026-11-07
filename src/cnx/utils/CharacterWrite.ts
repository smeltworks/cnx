import EssentialCategory from "./EssentialCategory";
import LiteralUtils from "./LiteralUtils";
import OperandTyper from "./OperandTyper";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";

/**
 * #1748, #2373, #2385: what an assignment writes into the characters of a
 * scalar `string<N>` -- `s[i]`, `s[i, n]`, `gp.name[0]` -- or null when its
 * target writes none. `s[i]` is `s[i, 1]` (owner ruling, 2026-11-05), so the
 * answer is the same for both spellings. A character is written as it is; a
 * string is copied in character by character, only as many as it holds; an
 * integer is split into bytes, as ADR-007's slice write splits it (owner
 * ruling, 2026-10-30, #2373). Any other value is none of these (E0928). A
 * value is a character by its Rule 10.4 category, so MISRA's exempt
 * `'a' + n` is one (ADR-024 D.7, #2375). 2.1's E0928, E0864 and E0860/E0861
 * and 2.2's lowering all read this one answer.
 */
class CharacterWrite {
  static of(
    target: TExpression,
    value: TExpression,
    ctx: ITypingContext,
  ): "character" | "string" | "integer" | "other" | null {
    if (OperandTyper.characterSpan(target, ctx) === null) return null;
    const category = EssentialCategory.of(value, ctx);
    if (category === "character") return "character";
    if (OperandTyper.isStringValue(value, ctx) === true) return "string";
    if (category === "signed" || category === "unsigned") return "integer";
    // ADR-052: a bare integer literal, which has no category of its own, is
    // typed to the bytes it is split into
    const typed = OperandTyper.typeOf(value, ctx);
    const folded = LiteralUtils.isContextuallyTyped(
      OperandTyper.directTypeName(typed),
    )
      ? OperandTyper.constantOf(value, ctx)
      : null;
    return folded !== null && Number.isInteger(folded) ? "integer" : "other";
  }
}

export default CharacterWrite;
