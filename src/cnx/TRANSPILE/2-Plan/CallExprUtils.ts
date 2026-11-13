/**
 * Pure utility functions for function call expression generation.
 * Extracted from CallExprGenerator for testability (Issue #420).
 */
import TYPE_MAP from "./types/TYPE_MAP";
import SafeDivision from "../../utils/SafeDivision";
import type IPlannedOverflowHelper from "../../types/IPlannedOverflowHelper";
import IFunctionSignature from "../../types/IFunctionSignature";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import TypeResolver from "../../utils/TypeResolver";
import TypeCheckUtils from "../../utils/TypeCheckUtils";

class CallExprUtils {
  /**
   * Issue #304: Map cnx type to C type for static_cast.
   * Returns the input unchanged if not a known cnx primitive type.
   */
  static mapTypeToCType(cnxType: string): string {
    return TYPE_MAP[cnxType] || cnxType;
  }

  /**
   * ADR-051: Generate the helper function name for safe_div/safe_mod. One
   * that divides through a `wrap` helper is its own (#1790), and so is a
   * signed one with no counted operand, which divides as plain C (#2409).
   */
  static generateSafeDivModHelperName(
    funcName: "safe_div" | "safe_mod",
    cnxType: string,
    inner: IPlannedOverflowHelper | null,
  ): string {
    let family = "";
    if (inner?.behavior === "wrap") family = "wrap_";
    else if (inner === null && TypeCheckUtils.isSigned(cnxType)) {
      family = "plain_";
    }
    return `cnx_safe_${family}${SafeDivision.operationOf(funcName)}_${cnxType}`;
  }

  /**
   * Issue #315: Resolve target parameter info from local signature or cross-file IResolvedSymbols.
   * Returns the parameter info.
   *
   * Issue #1139: `funcName` is a transpiled C name (`Sensors__readValue`), so
   * the cross-file lookup resolves by canonical identity. Asking the bare-name
   * index returned nothing for every scoped function, leaving `param`
   * undefined — which the caller could not distinguish from a function that
   * genuinely takes no such parameter, so a struct argument lost its `&`.
   */
  static resolveTargetParam(
    sig: IFunctionSignature | undefined,
    paramIndex: number,
    funcName: string,
    symbolTable: IResolvedSymbols | null,
  ): {
    param: IFunctionSignature["parameters"][0] | undefined;
  } {
    const localParam = sig?.parameters[paramIndex];
    if (localParam) {
      return { param: localParam };
    }

    if (symbolTable) {
      const symbols = symbolTable.getOverloadsByCName(funcName);
      for (const sym of symbols) {
        if (sym.kind === "function" && sym.parameters?.[paramIndex]) {
          const p = sym.parameters[paramIndex];
          // Convert TType to string for cnx symbols, use string directly for C/C++
          const paramType = p.type;
          const baseType =
            typeof paramType === "string"
              ? paramType
              : TypeResolver.getTypeName(paramType);
          return {
            param: {
              name: p.name,
              baseType,
              isConst: p.isConst,
              isArray: p.isArray,
            },
          };
        }
      }
    }

    return { param: undefined };
  }
}

export default CallExprUtils;
