import type IProgram from "../types/IProgram";
import type IByValueFacts from "./types/IByValueFacts";
import type IParameterInfo from "../types/symbols/IParameterInfo";
import SymbolGuards from "../types/symbols/SymbolGuards";
import CNX_TO_C_TYPE_MAP from "./constants/TypeMappings";
import invariant from "./invariant";
import SymbolTypeResolver from "./TypeResolver";

/**
 * #1639: whether a cnx function's parameter is passed by value, decided from
 * its declaration. `ParameterPassing` (2.2) and the `_fp` shape a callback
 * slot is checked against (2.1, #1619) both read this one answer.
 */
class ParameterByValue {
  /**
   * The parameters of `functionName` as 1.4 settled them. A cnx function 2.1
   * checks or 2.2 plans always has a settled symbol under its C name, so a
   * missing one is a defect, not a "no".
   */
  static settledParameters(
    functionName: string | null,
    state: { readonly program: IProgram | null },
  ): ReadonlyArray<IParameterInfo> {
    const symbol =
      functionName === null
        ? undefined
        : state.program?.symbolByCName(functionName);
    invariant(
      symbol !== undefined && SymbolGuards.isFunction(symbol),
      `a cnx function has a settled symbol under its C name (missing ${functionName})`,
    );
    return symbol.parameters;
  }

  /**
   * #1639: parameter `paramIndex` of `functionName`, read off its settled
   * declaration. A call through a callback value (`isDirectCall` false) and
   * the `_fp` typedef that call is checked against both ask this, so neither
   * can pass the parameter differently.
   */
  static ofDeclared(
    functionName: string,
    paramIndex: number,
    facts: IByValueFacts,
    isDirectCall: boolean,
  ): boolean {
    const param = ParameterByValue.settledParameters(functionName, facts)[
      paramIndex
    ];
    return ParameterByValue.of(
      functionName,
      param.name,
      SymbolTypeResolver.getTypeName(param.type),
      param.isArray,
      param.isOpaqueHandle === true,
      facts,
      isDirectCall,
    );
  }

  private static of(
    functionName: string,
    paramName: string,
    typeName: string,
    isArray: boolean,
    isOpaqueHandle: boolean,
    facts: IByValueFacts,
    isDirectCall: boolean,
  ): boolean {
    if (isArray || isOpaqueHandle) return false;
    const program = facts.program;

    // ADR-071 Q6: a read-only scalar, by its declaration (1.4)
    if (program?.passByValueParams().get(functionName)?.has(paramName)) {
      return true;
    }

    // ADR-029: a function pointer is a value. The settled program names the
    // function even before this file registers its callback type, as for the
    // `_fp` typedef of a function declared ahead of the one it takes (#1929).
    const typeSymbol = program?.symbolByCName(typeName);
    if (
      facts.callbackTypes.has(typeName) ||
      (typeSymbol !== undefined && SymbolGuards.isFunction(typeSymbol))
    ) {
      return true;
    }

    // A C++ namespaced struct arrives as `hw::Dev`, the spelling 1.3 stored
    // and the struct registry keys (#1520, #2116)
    const isKnownStruct = facts.isKnownStruct(typeName);

    // #1603: a callback-compatible function whose typedef does not resolve
    // takes a struct by value, as such typedefs usually do
    if (
      isDirectCall &&
      isKnownStruct &&
      program?.callbackCompatibleFunctions().has(functionName)
    ) {
      return true;
    }

    // ADR-006: a struct, primitive, enum or string goes through a pointer.
    // Issue #551: anything else -- an external typedef or enum -- is a value.
    return !(
      isKnownStruct ||
      ParameterByValue.isStringType(typeName) ||
      ParameterByValue.isKnownPrimitiveType(typeName) ||
      (program?.knownEnums().has(typeName) ?? false)
    );
  }

  /** Check if a type is a known primitive type */
  static isKnownPrimitiveType(typeName: string): boolean {
    return !!CNX_TO_C_TYPE_MAP[typeName];
  }

  /**
   * Issue #551: Check if a type is a string type (string<N>).
   * String parameters use pass-by-reference (passed as char*).
   */
  static isStringType(typeName: string): boolean {
    return typeName.startsWith("string<") || typeName === "string";
  }
}

export default ParameterByValue;
