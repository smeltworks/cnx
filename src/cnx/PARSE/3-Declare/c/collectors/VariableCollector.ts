/**
 * VariableCollector - Collects variable symbols from C parse trees.
 */

import type ICVariableSymbol from "../../../../types/symbols/c/ICVariableSymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import DeclaratorTypes from "../../../2-Parse/shared/DeclaratorTypes";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type ISourceSpan from "../../../../types/ISourceSpan";

class VariableCollector {
  /**
   * Collect a variable symbol from a declarator.
   *
   * @param name Variable name
   * @param baseType Variable type
   * @param declarator The declarator context (for array dimensions)
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param isExtern Whether the variable is extern
   */
  static collect(
    name: string,
    baseType: string,
    declarator: IHeaderDeclaratorSyntax,
    sourceFile: string,
    span: ISourceSpan,
    isExtern: boolean,
  ): ICVariableSymbol {
    // Extract array dimensions if present
    const arrayDimensions = declarator.arrayDimensions;

    // Issue #978: Detect pointer variables (e.g., `font_t *ptr`).
    // C grammar puts `*` in the declarator, not the type specifier. A
    // function pointer is `char* (*)(void)`, as a field's is (#2348 review).
    const resolvedType = DeclaratorTypes.declaredType(baseType, declarator);

    return {
      kind: "variable",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: resolvedType,
      isArray: arrayDimensions.length > 0,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isExtern,
    };
  }

  /**
   * Collect a variable from declaration specifiers (when identifier appears as typedefName).
   * This handles the C grammar ambiguity where variable names can be parsed as typedef names.
   *
   * Note: No pointer detection here — this path handles declarations without an
   * initDeclaratorList. Pointer declarations (e.g., `font_t *ptr`) always produce
   * an initDeclaratorList (the `*` creates a declarator), so they go through collect().
   *
   * @param name Variable name
   * @param baseType Variable type
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param isExtern Whether the variable is extern
   */
  static collectFromDeclSpecs(
    name: string,
    baseType: string,
    sourceFile: string,
    span: ISourceSpan,
    isExtern: boolean,
  ): ICVariableSymbol {
    return {
      kind: "variable",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: baseType,
      isArray: false,
      isExtern,
    };
  }
}

export default VariableCollector;
