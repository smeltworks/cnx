/**
 * ArrayDimensionText - extracts array dimensions from a type or declarator
 * string.
 *
 * Issue #1127: `SymbolUtils.parseArrayDimensions` and
 * `TypeResolver.parseArrayType` each did this, and disagreed:
 *
 *   "[0x10]"   SymbolUtils "0x10"   TypeResolver 0     parseInt("0x10", 10)
 *   "[8+1]"    SymbolUtils "8+1"    TypeResolver 8     stops at '+'
 *   "[8ul]"    SymbolUtils "8ul"    TypeResolver 8     stops at 'u'
 *
 * TypeResolver's readings are not merely different, they are wrong: a 16-byte
 * array read as dimension 0, and `8+1` read as 8. Both now use this, which
 * folds through `LiteralUtils.exactIntegerLiteral` so every integer notation
 * resolves, and otherwise keeps the source text rather than truncating it.
 *
 * This is the string-level counterpart to `ConstExprLowering`, which works
 * from the parse tree (#1175; `ArrayDimensionParser` before it). Two entry
 * points exist because C and C++ declarators reach the symbol layer as text,
 * with no cnx parse tree behind them.
 *
 * ## An unsized `[]` now yields an entry
 *
 * Both replaced implementations matched `[^\]]+` -- one or more -- so `[]`
 * produced *no* entry and an unsized array was indistinguishable from a
 * non-array. This yields `""`, so `extern unsigned char buf[]` and a flexible
 * array member now reach the C and C++ symbol layers as arrays of one unsized
 * dimension rather than as scalars.
 *
 * ## `""` is not `UNRESOLVED_DIMENSION`
 *
 * They describe different facts and must not be merged:
 *
 * - `""` -- the source declares NO size (`u8[]`). A fact about the
 *   declaration, and the dimension renders back as `[]`, which is valid C for
 *   an extern or a flexible array member.
 * - `UNRESOLVED_DIMENSION` -- the source declares a size that could not be
 *   folded here. A fact about resolution, in a numeric list, where it means
 *   "cannot bounds-check this subscript".
 *
 * Collapsing them would make an unsized array look like a resolution failure,
 * or a resolution failure look like a deliberate `[]` in the emitted C.
 */

import LiteralUtils from "./LiteralUtils";
import UNRESOLVED_DIMENSION from "../types/UNRESOLVED_DIMENSION";

class ArrayDimensionText {
  /**
   * Extract every bracketed dimension from a type or declarator string.
   *
   * @param text e.g. "u8[10]", "buf[2][N]", "arr[BUF_SIZE]"
   * @returns One entry per dimension: a number when the text is an integer
   *          literal in any notation, otherwise the trimmed source text (a
   *          macro name, an enum count, an expression). An unsized `[]` yields
   *          the empty string, so the dimension keeps its position.
   *
   * @example parse("u8[10]")      => [10]
   * @example parse("u8[0x10]")    => [16]
   * @example parse("u8[2][N]")    => [2, "N"]
   * @example parse("u8[8+1]")     => ["8+1"]
   */
  static parse(text: string): (number | string)[] {
    return ArrayDimensionText.scan(text, (content) =>
      LiteralUtils.exactIntegerLiteral(content),
    );
  }

  /**
   * A header declarator's dimensions, each literal read as C reads it: `010`
   * is 8, not 10 (#2484 review), so a fill-all fills the slots C has.
   *
   * @example parseC("t[010]")  => [8]
   */
  static parseC(text: string): (number | string)[] {
    return ArrayDimensionText.scan(
      text,
      (content) => LiteralUtils.cIntegerLiteral(content) ?? undefined,
    );
  }

  private static scan(
    text: string,
    read: (content: string) => number | undefined,
  ): (number | string)[] {
    // Scanned rather than matched with /\[([^\]]*)\]/g. That pattern is
    // super-linear (SonarCloud S8786): on a '[' with no closing bracket the
    // greedy class runs to the end of the string and then backtracks a
    // character at a time, once per '[' in the input. indexOf is linear, needs
    // no lastIndex bookkeeping, and says plainly what it does.
    const dimensions: (number | string)[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      const open = text.indexOf("[", cursor);
      if (open === -1) {
        break;
      }
      const close = text.indexOf("]", open + 1);
      if (close === -1) {
        // Unterminated bracket: nothing after it is a well-formed dimension.
        break;
      }

      const content = text.slice(open + 1, close).trim();
      dimensions.push(read(content) ?? content);
      cursor = close + 1;
    }

    return dimensions;
  }

  /**
   * The numeric list a `TTypeInfo` carries: a folded size as it is, and
   * anything else -- a name, an expression, an unsized `[]` --
   * `UNRESOLVED_DIMENSION`, in its own slot. A string is never read for a
   * number (#1760 review): `parseInt` read `2*BUF` as 2 and `0x10` as 0,
   * and a subscript was bounds-checked against a size the array does not
   * have. Only what 1.3 or 1.4 folded is a size.
   */
  static numeric(dimensions: ReadonlyArray<number | string>): number[] {
    return dimensions.map((dimension) =>
      typeof dimension === "number" ? dimension : UNRESOLVED_DIMENSION,
    );
  }
}

export default ArrayDimensionText;
