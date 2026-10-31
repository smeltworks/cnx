import EssentialCategory from "./EssentialCategory";
import OperandTyper from "./OperandTyper";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";

/**
 * #1748: what an assignment writes into one character of a scalar
 * `string<N>` -- `s[i]`, `gp.name[0]` -- or null when its target is not one.
 * ADR-045 makes `s[i]` a `string<1>`: a character is written as it is, a
 * string is a `string<1>` write, and any other value is no character (MISRA
 * C:2012 Rule 10.3). A value is a character by its Rule 10.4 category, so
 * MISRA's exempt `'a' + n` is one (ADR-024 D.7, #2375). 2.1's E0927 and E0864
 * and 2.2's lowering all read this one answer. A range `s[i, n]` takes a
 * string too, copied in character by character (owner ruling, 2026-10-30,
 * #2373); any other value there is ADR-007's slice write.
 */
class CharacterWrite {
  static of(
    target: TExpression,
    value: TExpression,
    ctx: ITypingContext,
  ): "character" | "string" | "other" | null {
    const span = OperandTyper.characterSpan(target, ctx);
    if (span === null) return null;
    // #2373: a range takes a string, or an integer as ADR-007's slice does
    if (span.range) {
      return OperandTyper.isStringValue(value, ctx) === true ? "string" : null;
    }
    if (EssentialCategory.of(value, ctx) === "character") return "character";
    return OperandTyper.isStringValue(value, ctx) === true ? "string" : "other";
  }
}

export default CharacterWrite;
