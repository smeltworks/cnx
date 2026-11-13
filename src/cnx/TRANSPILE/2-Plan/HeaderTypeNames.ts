/**
 * 2.2 Plan -- every type name a file's public header will name.
 *
 * ## Why this is one function and not two predicates
 *
 * "Which types does this header name?" was derived twice, and both derivations
 * stopped in the same place: at functions and variables (#1520).
 *
 *   `Transpiler._headerNeedsUserCHeaders` branched on `symbol.kind`, handled
 *   `variable` and `function`, and answered `false` for a struct -- so a struct
 *   never asked for the header defining its FIELD's type.
 *
 *   `HeaderGeneratorUtils.collectExternalTypes` walked function returns,
 *   function parameters and variables, and had no struct-field loop.
 *
 * Four `tests/issue-502` headers declared `SeaDash::Parse::ParseResult result;`
 * and included nothing that defines it. Patching one derivation would have left
 * the other wrong, which is why the enumeration moved here instead: a type the
 * header names is a fact about the symbols, and it has one answer.
 *
 * ## It enumerates; it does not judge
 *
 * Whether a name is a builtin, local, forward-declarable or needs an include
 * are all different questions with different answers, asked by different
 * callers. Deciding any of them here would put a second question in a function
 * that answers one -- and it is exactly how the `::` skip came to serve two
 * masters, right for "can this be forward-declared" and wrong for "does this
 * need an include".
 */

import type TSymbol from "../../types/symbols/TSymbol";
import TypeResolver from "../../utils/TypeResolver";

class HeaderTypeNames {
  /**
   * Every type name the header's declarations will name, bare.
   *
   * @param symbols the file's public interface, as `PublicInterface.forFile`
   *   settled it
   */
  static collect(symbols: readonly TSymbol[]): Set<string> {
    const named = new Set<string>();
    for (const symbol of symbols) {
      HeaderTypeNames.addNamesOf(symbol, named);
    }
    named.delete("");
    return named;
  }

  /** The type names one symbol contributes, by kind. */
  private static addNamesOf(symbol: TSymbol, into: Set<string>): void {
    if (symbol.kind === "variable") {
      into.add(TypeResolver.getTypeName(symbol.type));
      return;
    }

    if (symbol.kind === "function") {
      // #1209: an array return is a `void` function filling a buffer of the
      // element type, which is what the header names
      const returned = symbol.returnType;
      into.add(
        TypeResolver.getTypeName(
          returned.kind === "array" ? returned.elementType : returned,
        ),
      );
      for (const parameter of symbol.parameters) {
        into.add(TypeResolver.getTypeName(parameter.type));
      }
      return;
    }

    // A struct's own name is not what it NAMES -- its fields are. The struct is
    // declared by this header, so it needs nothing included for itself; the
    // types of its fields may need a great deal (#1520).
    if (symbol.kind === "struct") {
      for (const field of symbol.fields.values()) {
        into.add(TypeResolver.getTypeName(field.type));
      }
      return;
    }

    // A bitmap emits `typedef uint8_t Flags;`, and that `uint8_t` is the one
    // type it names. It is not on a field and not on the symbol's own `type` --
    // it is `backingType`, which is why the first version of this missed it and
    // twelve bitmap headers lost `<stdint.h>`. `headers:standalone:check`
    // caught it, for the second time on the same construct.
    if (symbol.kind === "bitmap") {
      into.add(symbol.backingType);
    }
  }
}

export default HeaderTypeNames;
