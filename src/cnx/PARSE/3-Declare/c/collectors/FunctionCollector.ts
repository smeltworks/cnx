/**
 * FunctionCollector - C function definitions and prototypes, from 1.2's
 * plain-data header (#1991).
 */
import type ICFunctionSymbol from "../../../../types/symbols/c/ICFunctionSymbol";
import type ICParameterInfo from "../../../../types/symbols/c/ICParameterInfo";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import DeclaratorTypes from "../../../2-Parse/shared/DeclaratorTypes";
import type IExtractedParameter from "../../../2-Parse/shared/IExtractedParameter";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type TCExternalDeclarationSyntax from "../../../2-Parse/types/TCExternalDeclarationSyntax";
import type ISourceSpan from "../../../../types/ISourceSpan";

class FunctionCollector {
  private static _mapParameters(
    extracted: readonly IExtractedParameter[],
  ): ICParameterInfo[] {
    return extracted.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
      ...(p.arrayDimensions && { arrayDimensions: p.arrayDimensions }),
      ...(p.isNestedDeclarator && { isNestedDeclarator: true }),
      ...(p.isFunctionPointer && { isFunctionPointer: true }),
      ...(p.isVolatile && { isVolatile: true }),
    }));
  }

  /** A function definition; null when its declarator names nothing */
  static collectFromDefinition(
    funcDef: Extract<
      TCExternalDeclarationSyntax,
      { kind: "functionDefinition" }
    >,
    sourceFile: string,
  ): ICFunctionSymbol | null {
    const declarator = funcDef.declarator;
    if (!declarator?.name) return null;
    const parameters = FunctionCollector._mapParameters(declarator.parameters);
    return {
      kind: "function",
      name: declarator.name,
      sourceFile,
      span: funcDef.span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: DeclaratorTypes.pointerType(
        DeclaratorTypes.baseType(funcDef.typeSpecifiers),
        declarator,
      ),
      parameters: parameters.length > 0 ? parameters : undefined,
      isVariadic: declarator.isVariadic || undefined,
      ...(declarator.isUnprototyped && { isUnprototyped: true }),
      isDeclaration: false,
    };
  }

  /** A function prototype */
  static collectFromDeclaration(
    name: string,
    baseType: string,
    declarator: IHeaderDeclaratorSyntax,
    sourceFile: string,
    span: ISourceSpan,
  ): ICFunctionSymbol {
    const parameters = FunctionCollector._mapParameters(declarator.parameters);
    return {
      kind: "function",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: DeclaratorTypes.pointerType(baseType, declarator),
      parameters: parameters.length > 0 ? parameters : undefined,
      isVariadic: declarator.isVariadic || undefined,
      ...(declarator.isUnprototyped && { isUnprototyped: true }),
      isDeclaration: true,
    };
  }
}

export default FunctionCollector;
