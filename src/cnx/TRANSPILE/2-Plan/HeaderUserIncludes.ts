import EFileType from "../../PARSE/1-Discover/types/EFileType";
import type IFileIncludes from "../../PARSE/1-Discover/types/IFileIncludes";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import type IProgram from "../../types/IProgram";
import type TConstExpr from "../../types/TConstExpr";
import type TSymbol from "../../types/symbols/TSymbol";
import ConstExprNames from "../../utils/ConstExprNames";
import invariant from "../../utils/invariant";
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
   * #1881: the C includes of every file `macroIncludingFiles` names, as this
   * header spells them -- a header the run found is named from this header's
   * directory (#1725), one it did not find is kept as written. In source order.
   */
  static macroCHeaders(
    symbols: readonly TSymbol[],
    program: IProgram,
    sourceFile: string,
    includes: ReadonlyMap<string, IFileIncludes>,
    spelled: ReadonlyMap<string, string>,
  ): string[] {
    const directives: string[] = [];
    for (const file of HeaderUserIncludes.macroIncludingFiles(
      symbols,
      program,
      sourceFile,
    )) {
      const fileIncludes = includes.get(file);
      invariant(
        fileIncludes !== undefined,
        "1.1 Discover records the includes of every file in a closure",
      );
      for (const [directive, kind] of fileIncludes.kinds) {
        if (kind !== EFileType.CHeader && kind !== EFileType.CppHeader)
          continue;
        const header = fileIncludes.resolutions.get(directive) ?? null;
        directives.push(
          header === null ? directive : (spelled.get(header) ?? directive),
        );
      }
    }
    return directives;
  }

  /**
   * #1881: the other files whose C includes the header must carry, because it
   * names a macro only they define -- a `.cnx` it includes reached the macro's
   * header, and C sees that header only through the `.cnx`'s own includes.
   * Nearest file first; the source itself is never one, since `needed` already
   * carries its own includes.
   */
  static macroIncludingFiles(
    symbols: readonly TSymbol[],
    program: IProgram,
    sourceFile: string,
  ): string[] {
    const includingFiles = new Set<string>();
    for (const symbol of symbols) {
      for (const expr of HeaderUserIncludes.macroDimensionExprs(symbol)) {
        for (const name of ConstExprNames.bare(expr)) {
          const includingFile = program.headerMacroIncludingFile(
            sourceFile,
            name.path[0],
          );
          if (includingFile !== null && includingFile !== sourceFile) {
            includingFiles.add(includingFile);
          }
        }
      }
    }
    return [...includingFiles];
  }

  /**
   * Issue #424: an array dimension that is still an identifier is a macro the
   * header names and does not define -- wherever the header spells one: a
   * variable, a struct field (#1970) or a parameter.
   */
  private static namesMacroDimension(symbol: TSymbol): boolean {
    return HeaderUserIncludes.dimensionPairsOf(symbol).some(
      (pair) => typeof pair.dimension === "string",
    );
  }

  /** The written form of each dimension the header spells as C, not a number */
  private static macroDimensionExprs(symbol: TSymbol): TConstExpr[] {
    return HeaderUserIncludes.dimensionPairsOf(symbol).flatMap((pair) =>
      typeof pair.dimension === "string" && pair.expr ? [pair.expr] : [],
    );
  }

  private static dimensionPairsOf(symbol: TSymbol): Array<{
    dimension: number | string;
    expr: TConstExpr | null | undefined;
  }> {
    const pairs = (
      dimensions: ReadonlyArray<number | string> | undefined,
      exprs: ReadonlyArray<TConstExpr | null> | undefined,
    ) =>
      (dimensions ?? []).map((dimension, i) => ({
        dimension,
        expr: exprs?.[i],
      }));
    switch (symbol.kind) {
      case "variable":
        return pairs(symbol.arrayDimensions, symbol.arrayDimensionExprs);
      case "struct":
        return [...symbol.fields.values()].flatMap((field) =>
          pairs(field.dimensions, field.dimensionExprs),
        );
      case "function":
        return symbol.parameters.flatMap((parameter) =>
          pairs(parameter.arrayDimensions, parameter.arrayDimensionExprs),
        );
      default:
        return [];
    }
  }
}

export default HeaderUserIncludes;
