/**
 * Factory functions and utilities for IFunctionSymbol.
 *
 * Provides utilities for creating and inspecting cnx functions.
 * Scope-qualified C names come from ScopeUtils.getTranspiledCName.
 */
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type TVisibility from "../../../types/TVisibility";
import type IParameterInfo from "../../../types/symbols/IParameterInfo";
import type TType from "../../../types/TType";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../utils/ScopeUtils";
import type ISourceSpan from "../../../types/ISourceSpan";

/**
 * Options for creating a function symbol
 */
interface IFunctionCreateOptions {
  name: string;
  scopePath: string;
  parameters: ReadonlyArray<IParameterInfo>;
  returnType: TType;
  visibility: TVisibility;
  sourceFile: string;
  span: ISourceSpan;
}

class FunctionUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a function symbol with the given properties.
   *
   * @param options - Function properties including bare name and scope path
   */
  static create(options: IFunctionCreateOptions): IFunctionSymbol {
    return {
      kind: "function",
      name: options.name,
      scopePath: options.scopePath,
      // #1285: identity computed once, here, from the enclosing path.
      ...ScopeUtils.identityOf({
        name: options.name,
        scopePath: options.scopePath,
      }),
      parameters: options.parameters,
      returnType: options.returnType,
      returnOverflowBehavior: "clamp",
      visibility: options.visibility,
      sourceFile: options.sourceFile,
      span: options.span,
      sourceLanguage: ESourceLanguage.Cnx,
    };
  }

  // ============================================================================
  // Type Guards and Queries
  // ============================================================================

  /**
   * Check if function is in the global scope.
   */
  static isInGlobalScope(func: IFunctionSymbol): boolean {
    return ScopeUtils.isGlobalScopePath(func.scopePath);
  }
}

export default FunctionUtils;
