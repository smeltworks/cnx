import TypedefParamParser from "../../utils/TypedefParamParser";
import ParameterByValue from "../../utils/ParameterByValue";
import type ICallbackTypeInfo from "../../types/ICallbackTypeInfo";
import type TranspileState from "../TranspileState";
import type IParameterPassing from "../../types/IParameterPassing";

type TParameterPassingFacts = Pick<
  TranspileState,
  "callbackTypedefTypeFor" | "program" | "isKnownStruct"
> & { readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo> };

/**
 * #1639: whether each parameter of a cnx function is passed by value or
 * through a pointer, decided once. The `.c` signature, the `.h` prototype, the
 * body's uses of the parameter and every call to the function read this
 * answer; none of them works it out again. Past a C typedef the function is
 * wired to, the answer is `ParameterByValue.ofDeclared`, which the `_fp`
 * typedef reads too (#1619), so a call through a callback value and the
 * typedef it is checked against cannot differ.
 */
class ParameterPassing {
  /**
   * Parameter `paramIndex` of the function emitted as `functionName`.
   * `isDirectCall` is false for a call through an ADR-029 callback value, and
   * for the `_fp` typedef that call is checked against: both are built from
   * the declaration, never from a C typedef the function is also wired to.
   */
  static of(
    functionName: string,
    paramIndex: number,
    facts: TParameterPassingFacts,
    isDirectCall = true,
  ): IParameterPassing {
    const param = ParameterByValue.settledParameters(functionName, facts)[
      paramIndex
    ];
    const isOpaqueHandle = param.isOpaqueHandle === true;
    // ADR-072: a register argument is the instance's layout, through a pointer
    if (param.isRegister === true) {
      return ParameterPassing.passing(false, false, false, false);
    }

    // Issue #895: a C callback typedef the function is wired to decides
    // pointer or value. A `mut` parameter keeps its pointer even where the
    // typedef takes a copy: the copy would lose the write (#2146).
    const typedef = isDirectCall
      ? ParameterPassing.callbackTypedefParamInfo(
          functionName,
          paramIndex,
          facts,
        )
      : null;
    if (typedef && (typedef.isParamPointer || param.isConst)) {
      return ParameterPassing.passing(
        !typedef.isParamPointer,
        typedef.isParamPointer,
        typedef.isParamConst,
        isOpaqueHandle,
      );
    }
    if (typedef) {
      return ParameterPassing.passing(false, false, false, isOpaqueHandle);
    }

    return ParameterPassing.passing(
      ParameterByValue.ofDeclared(
        functionName,
        paramIndex,
        facts,
        isDirectCall,
      ),
      false,
      false,
      isOpaqueHandle,
    );
  }

  /**
   * Issue #895: the callback typedef's answer for parameter `paramIndex` of
   * `functionName`, or null when no typedef describes it.
   */
  private static callbackTypedefParamInfo(
    functionName: string,
    paramIndex: number,
    state: Pick<TranspileState, "callbackTypedefTypeFor">,
  ): { isParamPointer: boolean; isParamConst: boolean } | null {
    // main's renamed result fields (#1450), with #1545's extracted lookup --
    // the two steps live in state.callbackTypedefTypeFor, so this site and
    // the header's cannot spell the predicate differently.
    const typedefType = state.callbackTypedefTypeFor(functionName);
    if (!typedefType) return null;

    const isParamPointer = TypedefParamParser.isParamPointer(
      typedefType,
      paramIndex,
    );
    const isParamConst = TypedefParamParser.isParamConst(
      typedefType,
      paramIndex,
    );

    if (isParamPointer === null) return null;

    return {
      isParamPointer,
      isParamConst: isParamConst ?? false,
    };
  }
  private static passing(
    byValue: boolean,
    typedefPointer: boolean,
    typedefConst: boolean,
    isOpaqueHandle: boolean,
  ): IParameterPassing {
    return {
      byValue,
      typedefPointer,
      typedefConst,
      argument: byValue || isOpaqueHandle ? "value" : "reference",
    };
  }
}

export default ParameterPassing;
