/**
 * ParameterSignatureBuilder - Stateless builder for C/C++ parameter signatures
 *
 * Takes a normalized IParameterInput and produces the final parameter string.
 * All decisions (const, pass-by-value, etc.) are pre-computed in the input.
 *
 * This is the single source of truth for parameter formatting, used by both:
 * - CodeGenerator (via ParameterInputAdapter.fromAST)
 * - BaseHeaderGenerator (via ParameterInputAdapter.fromSymbol)
 */

import ParameterConst from "../../../../utils/ParameterConst";
import IParameterInput from "../types/IParameterInput";

/**
 * Static helper class for building C/C++ parameter signature strings.
 */
class ParameterSignatureBuilder {
  /**
   * Build a parameter signature string from normalized input.
   *
   * @param param - Normalized parameter input (all decisions pre-computed)
   * @param refSuffix - '*' for C mode (pointer), '&' for C++ mode (reference)
   * @returns The formatted parameter string (e.g., "const uint32_t* value")
   */
  static build(param: IParameterInput, refSuffix: string): string {
    // ADR-072: the layout is written through, so the pointee is never const
    if (param.isRegister) {
      return `${param.mappedType}* ${param.name}`;
    }

    // Callback parameters: just typedef name and param name
    if (param.isCallback && param.callbackTypedefName) {
      return `${param.callbackTypedefName} ${param.name}`;
    }

    // Array parameters with dimensions
    if (
      param.isArray &&
      param.arrayDimensions &&
      param.arrayDimensions.length > 0
    ) {
      return this._buildArrayParam(param);
    }

    // Pass-by-value parameters (ISR, float, enum, small primitives)
    if (param.isPassByValue) {
      return this._buildPassByValueParam(param);
    }

    // Non-array string: string<N> -> const char* name
    if (param.isString && !param.isArray) {
      return this._buildStringParam(param);
    }

    // Issue #995: Opaque handles are always pass-by-reference with pointer syntax
    if (param.isOpaqueHandle) {
      return this._buildRefParam(param, refSuffix);
    }

    // Known struct or known primitive: pass by reference
    if (param.isPassByReference) {
      return this._buildRefParam(param, refSuffix);
    }

    // Unknown types: pass by value (standard C semantics)
    return this._buildUnknownParam(param);
  }

  /**
   * Build array parameter signature.
   * Examples:
   * - u32[10] arr -> const uint32_t arr[10]
   * - u8[4][4] matrix -> const uint8_t matrix[4][4]
   * - string<32>[5] names -> const char names[5][33]
   * - string[5] names -> char* names[5] (unbounded string array)
   */
  private static _buildArrayParam(param: IParameterInput): string {
    const constPrefix = this._getConstPrefix(param);
    const dims = param.arrayDimensions!.map((d) => `[${d}]`).join("");

    // Unbounded string arrays use char* (array of char pointers)
    if (param.isUnboundedString) {
      return `${constPrefix}char* ${param.name}${dims}`;
    }

    // Bounded string arrays use char (dimensions include capacity)
    if (param.isString) {
      return `${constPrefix}char ${param.name}${dims}`;
    }

    // ADR-030 / #996: an array of opaque handles is an array of pointers, the
    // same shape a scope member of that type takes -- `Dev arr[2]` is an array
    // of an incomplete type, which C rejects.
    const elementType = param.isOpaqueHandle
      ? `${param.mappedType}*`
      : param.mappedType;
    return `${constPrefix}${elementType} ${param.name}${dims}`;
  }

  /**
   * Build pass-by-value parameter signature.
   * Used for: ISR, f32, f64, enums, small unmodified primitives.
   * Example: float value, ISR handler, Status s
   */
  private static _buildPassByValueParam(param: IParameterInput): string {
    const constMod = ParameterConst.isWritten(
      param.isConst,
      param.baseType,
      false,
    )
      ? "const "
      : "";
    return `${constMod}${param.mappedType} ${param.name}`;
  }

  /**
   * Build non-array string parameter signature.
   * string<N> -> const char* name (with auto-const if unmodified)
   */
  private static _buildStringParam(param: IParameterInput): string {
    const constPrefix = this._getConstPrefix(param);
    return `${constPrefix}char* ${param.name}`;
  }

  /**
   * Build pass-by-reference parameter signature.
   * C mode: const Point* p
   * C++ mode: const Point& p (unless forcePointerSyntax or isOpaqueHandle)
   *
   * Issue #895: When forcePointerSyntax is set, always use pointer syntax
   * because C callback typedefs expect pointers, not C++ references.
   * Issue #995: Opaque handles must use pointer syntax because C APIs
   * expect pointers to incomplete struct types (e.g., widget_t*).
   */
  private static _buildRefParam(
    param: IParameterInput,
    refSuffix: string,
  ): string {
    const constPrefix = this._getConstPrefix(param);
    // Issue #895/#995: Override refSuffix for callback-compatible or opaque handle params
    const actualSuffix =
      param.forcePointerSyntax || param.isOpaqueHandle ? "*" : refSuffix;
    return `${constPrefix}${param.mappedType}${actualSuffix} ${param.name}`;
  }

  /**
   * Build unknown type parameter (pass by value, standard C semantics).
   */
  private static _buildUnknownParam(param: IParameterInput): string {
    const constMod = param.isConst ? "const " : "";
    return `${constMod}${param.mappedType} ${param.name}`;
  }

  /**
   * The const prefix: the parameter is read-only (ADR-071), or its callback
   * typedef's signature says const (#895, `forceConst`).
   */
  private static _getConstPrefix(param: IParameterInput): string {
    // Any source of const results in "const " prefix
    if (param.forceConst || param.isConst) {
      return "const ";
    }
    return "";
  }
}

export default ParameterSignatureBuilder;
