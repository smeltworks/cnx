import type IResolvedSymbols from "../../types/IResolvedSymbols";
import type IProgram from "../../types/IProgram";
import type TSymbol from "../../types/symbols/TSymbol";
import HeaderTypeNames from "./HeaderTypeNames";

/**
 * Whether a generated header carries its source's own C/C++ includes -- a 2.2
 * decision the header capture reads (#1443: it was the orchestrator's until
 * the capture moved into 2.3, which decides nothing).
 */
class HeaderUserIncludes {
  /**
   * Whether the header must carry the source's own C/C++ includes.
   *
   * Two reasons, and they are different questions over the same symbols:
   *
   *   - the header names a MACRO it does not define -- an array dimension that
   *     stayed an identifier, which only the source's headers supply (#424); or
   *   - the header names a TYPE whose definition lives in one of them.
   *
   * The second used to be asked per symbol kind, here, and answered `false` for
   * a struct -- so a struct field typed by a C++ header got no include and the
   * header would not compile (#1520). The enumeration is now
   * `HeaderTypeNames.collect`, shared with the other derivation that had the
   * same hole, and this asks only the question it owns.
   */
  static needed(
    symbols: readonly TSymbol[],
    symbolTable: IResolvedSymbols,
    program: IProgram | null,
  ): boolean {
    if (symbols.some(HeaderUserIncludes.namesMacroDimension)) {
      return true;
    }
    for (const typeName of HeaderTypeNames.collect(symbols)) {
      if (
        HeaderUserIncludes.needsDefiningHeader(typeName, symbolTable, program)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Issue #424/#1164: does this header name something only the source's own C
   * headers define, so that it cannot compile standalone?
   *
   * Two cases. A non-numeric array dimension is a macro the header uses but does
   * not define. An opaque typedef (`typedef struct opaque_t* handle_t`) cannot be
   * forward-declared as a struct, so it too has to come from its real header.
   *
   * Deliberately narrow: propagating every C include into every generated header
   * would put implementation-only dependencies into the public interface, and
   * would double-include any hand-written header lacking an include guard.
   */
  /**
   * A type the header names but cannot correctly declare for itself.
   *
   * The forward declaration the header would otherwise emit,
   * `typedef struct X X;`, is a guess: it is right only when X really is an
   * opaque struct. For `typedef struct opaque_t* handle_t` it declares a
   * different type and contradicts the real definition. When we know a C/C++
   * header declares the type, including that header beats guessing.
   */
  private static needsDefiningHeader(
    typeName: string,
    symbolTable: IResolvedSymbols,
    program: IProgram | null,
  ): boolean {
    if (symbolTable.isPointerTypedef(typeName)) {
      return true;
    }

    // Known to a C/C++ header, but not as something forward-declarable.
    //
    // The C++ index is keyed by the C++ NAME, `SeaDash::Parse::ParseResult`,
    // and that is the spelling a cnx type naming it carries: 1.3 settled the
    // written path from the header's symbols (#2116). #1520's four headers
    // declared a field whose type nothing defined because this lookup used to
    // get the C join, `SeaDash__Parse__ParseResult`, and answered no.
    const declared =
      symbolTable.getCppSymbol(typeName) ?? symbolTable.getCSymbol(typeName);
    if (!declared) {
      return false;
    }

    // #1511: the artifact's verdict, not the table's.
    return !(program?.isOpaqueType(typeName) ?? false);
  }

  /**
   * Issue #424: an array dimension that is still an identifier is a macro the
   * header names and does not define -- wherever the header spells one: a
   * variable, a struct field (#1970) or a parameter.
   */
  private static namesMacroDimension(symbol: TSymbol): boolean {
    return HeaderUserIncludes.dimensionsOf(symbol).some(
      (dimension) => typeof dimension === "string",
    );
  }

  private static dimensionsOf(symbol: TSymbol): ReadonlyArray<number | string> {
    switch (symbol.kind) {
      case "variable":
        return symbol.arrayDimensions ?? [];
      case "struct":
        return [...symbol.fields.values()].flatMap(
          (field) => field.dimensions ?? [],
        );
      case "function":
        return symbol.parameters.flatMap(
          (parameter) => parameter.arrayDimensions ?? [],
        );
      default:
        return [];
    }
  }
}

export default HeaderUserIncludes;
