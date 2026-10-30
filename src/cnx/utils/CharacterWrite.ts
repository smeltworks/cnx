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
 * and 2.2's lowering all read this one answer.
 */
class CharacterWrite {
  static of(
    target: TExpression,
    value: TExpression,
    ctx: ITypingContext,
  ): "character" | "string" | "other" | null {
    if (!OperandTyper.writesCharacter(target, ctx)) return null;
    if (EssentialCategory.of(value, ctx) === "character") return "character";
    return OperandTyper.isStringValue(value, ctx) === true ? "string" : "other";
  }
}

export default CharacterWrite;
