import IFloatLiteralParts from "../types/IFloatLiteralParts";

/**
 * Utility class for analyzing literal values from their written text.
 *
 * Extracted from DivisionByZeroAnalyzer and the former FloatModuloAnalyzer
 * to eliminate duplicate literal checking code.
 */

/**
 * A float literal's shape as the grammar spells one: digits, an optional
 * fraction, an optional exponent and an optional width suffix, captured. The
 * grammar also requires a fraction or an exponent, which `[.eE]` asserts
 * beside it -- in the pattern, that requirement doubled every arm.
 */
const FLOAT_LITERAL = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?(?:[fF](32|64))?$/;

/**
 * Static utility methods for literal analysis
 */
class LiteralUtils {
  /**
   * The width of a floating literal's type, read from its text: 32 for
   * `2.5f32`, 64 for `2.5f64` and for an unsuffixed `2.5` (a C `double`).
   * Null when the text is not a floating literal.
   *
   * #1668: the one decision of whether a literal is floating. It used to be
   * made three ways, each by a partial test that some other literal also
   * passes. A trailing `f32` also ends the hex integer `0xFF32`, which the
   * render layer then emitted as `0xFf`. A `.` also occurs in the char literal
   * `'.'`, which E0804 then rejected as a floating modulo operand. So the text
   * must match the grammar's FLOAT_LITERAL / SUFFIXED_FLOAT shape as a whole.
   */
  static floatLiteralWidth(text: string): 32 | 64 | null {
    return LiteralUtils.floatLiteralParts(text)?.width ?? null;
  }

  /**
   * A floating literal's parts, read once from its text (#1268 review): the
   * width above and the digits a value is computed from both come from here.
   * Null when the text is not a floating literal.
   */
  static floatLiteralParts(text: string): IFloatLiteralParts | null {
    const match = FLOAT_LITERAL.exec(text);
    if (!match || !/[.eE]/.test(text)) return null;
    return {
      unsuffixed: match[4] === undefined ? text : text.slice(0, -3),
      whole: match[1],
      fraction: match[2] ?? "",
      exponent: Number(match[3] ?? "0"),
      width: match[4] === "32" ? 32 : 64,
    };
  }

  /**
   * ADR-024: Get the type from a literal (suffixed or unsuffixed).
   *
   * #1668: moved here from 2.2's ExpressionTypeResolver so that 2.1 can type a
   * composite's literal operand with the same rule 2.2 uses. Composite typing is
   * one decision (`CompositeType`) that both layers read, and it treats a
   * floating operand as a veto, so both have to agree on which literal operands
   * are floating.
   */
  static typeOf(text: string): string | null {
    if (text === "true" || text === "false") return "bool";

    const suffixMatch = /([uUiI])(8|16|32|64)$/.exec(text);
    if (suffixMatch) {
      const signChar = suffixMatch[1].toLowerCase();
      const width = suffixMatch[2];
      return (signChar === "u" ? "u" : "i") + width;
    }

    // A plain float literal (no suffix) has type double in C
    const floatWidth = LiteralUtils.floatLiteralWidth(text);
    if (floatWidth !== null) {
      return `f${floatWidth}`;
    }

    // Plain integer literals (no suffix) have type int in C
    // Check for integer: starts with digit, no decimal point
    if (/^\d+$/.test(text) || /^0[xXbBoO][\da-fA-F]+$/.test(text)) {
      return "int";
    }

    return null;
  }

  /**
   * Parse an integer literal string to a numeric value.
   *
   * Handles all cnx integer formats:
   * - Decimal: 42, -17
   * - Hex: 0x2A, 0X2a
   * - Binary: 0b101010, 0B101010
   *
   * Issue #455: Used for resolving const values in array dimensions.
   *
   * @param text - The literal text to parse
   * @returns The numeric value, or undefined if not a valid integer literal
   */
  static parseIntegerLiteral(text: string): number | undefined {
    const trimmed = text.trim();

    // Decimal integer (including negative)
    if (/^-?\d+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }

    // Hex literal (0x or 0X prefix)
    if (/^0[xX][0-9a-fA-F]+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }

    // Binary literal (0b or 0B prefix)
    if (/^0[bB][01]+$/.test(trimmed)) {
      return Number.parseInt(trimmed.substring(2), 2);
    }

    return undefined;
  }

  /**
   * Whether a folded value is exact (#1760 review). A double holds every
   * integer up to 2^53 - 1 and rounds past it, so `9007199254740993` parses
   * to 2^53. A fold that computed with the rounded value folded
   * `BIG - 9007199254740992` to 0, a false E0800, where C computes 1. Every
   * fold asks this of each literal it reads and each value it computes, and
   * gives no value otherwise: an unknown is never reported against.
   */
  static isExactInteger(value: number | undefined): value is number {
    return value !== undefined && Number.isSafeInteger(value);
  }

  /** An integer literal's value for a fold, when that value is exact */
  static exactIntegerLiteral(text: string): number | undefined {
    const value = LiteralUtils.parseIntegerLiteral(text);
    return LiteralUtils.isExactInteger(value) ? value : undefined;
  }

  /**
   * ADR-044 "Integer Literals" (owner ruling, 2026-10-03, #1728): whether a
   * decimal literal, with or without its type suffix, has a leading zero.
   * cnx has no octal literal, so 1.2 reports one (E0912), and no reading
   * gives it a value before then -- not the decimal one, which C, reading
   * octal, would disagree with. The one rule every reading asks.
   */
  static hasLeadingZero(decimalText: string): boolean {
    return /^0\d/.test(decimalText);
  }

  /**
   * The value of an integer literal as written in cnx source, with any
   * width suffix (`9u8`, `3i32`): decimal, hex or binary. Null for anything
   * else, and for a leading-zero literal (`010`, E0912).
   */
  static integerValue(text: string): number | null {
    if (LiteralUtils.hasLeadingZero(text)) return null;
    const match = /^(0[xX][\da-fA-F]+|0[bB][01]+|\d+)([uUiI]\d+)?$/.exec(text);
    if (match === null) return null;
    return LiteralUtils.parseIntegerLiteral(match[1]) ?? null;
  }

  /**
   * ADR-052: a slice source with no fixed essential category of its own -- a
   * bare literal (`int`), or one with no direct type (a negative literal, a
   * composite, a ternary) -- is typed to the slice it is written into. A
   * source with a fixed-width type, a named binding's included, keeps it.
   */
  static isContextuallyTyped(directTypeName: string | null): boolean {
    return directTypeName === "int" || directTypeName === null;
  }
}

export default LiteralUtils;
