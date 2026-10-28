/**
 * FunctionCollector - C++ function symbols from 1.2's lowered header (#1991).
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";
import ICppParameterInfo from "../../../../types/symbols/cpp/ICppParameterInfo";
import type IExtractedParameter from "../../../2-Parse/shared/IExtractedParameter";
import type ICppFunctionDefinitionSyntax from "../../../2-Parse/types/ICppFunctionDefinitionSyntax";
import DeclaratorTypes from "../../../2-Parse/shared/DeclaratorTypes";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type ISourceSpan from "../../../../types/ISourceSpan";

class FunctionCollector {
  private static _mapParameters(
    extracted: readonly IExtractedParameter[],
  ): ICppParameterInfo[] {
    return extracted.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
      ...(p.isReference === true && { isReference: true }),
    }));
  }

  /** A function definition at namespace scope; null when it has no name */
  static collectDefinition(
    funcDef: ICppFunctionDefinitionSyntax,
    sourceFile: string,
    currentNamespace?: string,
  ): ICppFunctionSymbol | null {
    const name = funcDef.declarator.name;
    if (!name) return null;
    const params = FunctionCollector._mapParameters(
      funcDef.declarator.parameters,
    );
    return {
      kind: "function",
      name: CppNamespaceUtils.qualify(currentNamespace, name),
      unqualifiedName: name,
      type: DeclaratorTypes.pointerType(funcDef.returnType, funcDef.declarator),
      sourceFile,
      span: funcDef.span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      parameters: params.length > 0 ? params : undefined,
      isVariadic: funcDef.declarator.isVariadic || undefined,
      isDeclaration: false,
    };
  }

  /** A function prototype; null when its declarator has no name */
  static collectDeclaration(
    declarator: IHeaderDeclaratorSyntax,
    baseType: string,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
  ): ICppFunctionSymbol | null {
    const name = declarator.name;
    if (!name) return null;
    const params = FunctionCollector._mapParameters(declarator.parameters);
    return {
      kind: "function",
      name: CppNamespaceUtils.qualify(currentNamespace, name),
      unqualifiedName: name,
      // #2058: a return type keeps the declarator's `*`s, as in C
      type: DeclaratorTypes.pointerType(baseType, declarator),
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      parameters: params.length > 0 ? params : undefined,
      isVariadic: declarator.isVariadic || undefined,
      isDeclaration: true,
    };
  }

  /** A member function, declared or defined inline in its class */
  static collectMemberFunction(
    className: string,
    funcName: string,
    declarator: IHeaderDeclaratorSyntax,
    returnType: string,
    sourceFile: string,
    span: ISourceSpan,
    isDeclaration: boolean,
  ): ICppFunctionSymbol {
    const params = FunctionCollector._mapParameters(declarator.parameters);
    return {
      kind: "function",
      name: CppNamespaceUtils.qualify(className, funcName),
      unqualifiedName: funcName,
      type: DeclaratorTypes.pointerType(returnType, declarator),
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: className,
      parameters: params.length > 0 ? params : undefined,
      isVariadic: declarator.isVariadic || undefined,
      isDeclaration: isDeclaration || undefined,
      isConstMember: declarator.isConstMember || undefined,
    };
  }
}

export default FunctionCollector;
