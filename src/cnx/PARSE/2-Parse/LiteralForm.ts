/**
 * ADR-044 "Integer Literals" (owner ruling, 2026-10-03, #1728): an integer
 * literal is decimal, `0x` hexadecimal or `0b` binary. There is no octal
 * literal, so a decimal literal never has a leading zero: `010` is E0912.
 *
 * C reads `010` as 8. The transpiler read it as 10 in some places and as no
 * value in others, so one spelling could mean two numbers in one program.
 *
 * A token's spelling is syntax, so 1.2 reports it, off the tokens it already
 * lexed (#1991): every literal token is checked, wherever the grammar allows
 * one -- a const, a dimension, a bitmap field width, a case label, an operand.
 */

import type { CommonTokenStream } from "antlr4ng";
import FormError from "./FormError";
import { CnxLexer } from "./grammar/CnxLexer";
import type ITranspileError from "../../types/ITranspileError";
import LiteralUtils from "../../utils/LiteralUtils";

/** The decimal literal tokens, suffixed or not; hex and binary have a prefix */
const DECIMAL_TOKENS: ReadonlySet<number> = new Set([
  CnxLexer.INTEGER_LITERAL,
  CnxLexer.SUFFIXED_DECIMAL,
]);

class LiteralForm {
  /** E0912 for each decimal literal written with a leading zero */
  static errorsIn(tokens: CommonTokenStream): ITranspileError[] {
    return tokens
      .getTokens()
      .filter(
        (token) =>
          DECIMAL_TOKENS.has(token.type) &&
          LiteralUtils.hasLeadingZero(token.text ?? ""),
      )
      .map((token) =>
        FormError.at(
          token,
          "E0912",
          `Integer literal '${token.text}' has a leading zero: cnx has no octal literal (ADR-044)`,
          "Write the value in decimal without the leading zero, or as 0x... or 0b...",
        ),
      );
  }
}

export default LiteralForm;
