import type ICallArgumentFacts from "./types/ICallArgumentFacts";
import type IPlanQueries from "./types/IPlanQueries";
import CallExprUtils from "./CallExprUtils";
import ParameterPassing from "./ParameterPassing";
import type IArgumentPassing from "./types/IArgumentPassing";

/**
 * How a call passes each argument: the parameter it binds to, and whether it
 * goes to a C function, by value or by reference. 2.3 writes the argument
 * this way, and 2.2 plans the type it is written against from the same
 * answer (#1991).
 */
class CallArgumentPassing {
  /**
   * The function a callback-typed callee names: the name a call through it
   * looks its parameters up by.
   *
   * ADR-029: a value of a callback type -- a struct field, a variable, a
   * parameter -- holds a function with the parameters of the function that IS
   * the type. A call through it takes exactly the arguments a direct call to
   * that function takes, so every question about them is asked of that
   * function's name. Asked of `h.onPeek`, which names no function, they found no
   * parameters, and a struct argument went by value into a `const Point*`.
   */
  static callbackFunction(
    calleeType: string | null,
    input: ICallArgumentFacts,
  ): string | undefined {
    return calleeType === null
      ? undefined
      : input.callbackTypes.get(calleeType)?.functionName;
  }

  /**
   * Issue #304: the integer C type a C++ enum class argument is cast to for
   * an integer parameter, or null
   */
  static cppEnumCast(
    argType: string | null,
    targetParamBaseType: string | undefined,
    orchestrator: IPlanQueries,
  ): string | null {
    if (!orchestrator.isCppMode() || !targetParamBaseType) return null;
    if (argType === null || !orchestrator.isCppEnumClass(argType)) return null;
    return orchestrator.isIntegerType(targetParamBaseType)
      ? CallExprUtils.mapTypeToCType(targetParamBaseType)
      : null;
  }

  /**
   * Argument `index` of a call to `signatureName`; null when it names none.
   * `isDirectCall` is false for a call through an ADR-029 callback value,
   * whose `_fp` type is built from the declaration, not from a C typedef.
   * `argumentCount` picks the C++ overloads the call reaches (#2473 review).
   */
  static of(
    signatureName: string | null,
    index: number,
    input: ICallArgumentFacts,
    orchestrator: IPlanQueries,
    isDirectCall: boolean,
    argumentCount: number,
  ): IArgumentPassing {
    if (signatureName === null) return { param: undefined, mode: "c" };
    const resolved = CallExprUtils.resolveTargetParam(
      input.functionSignatures.get(signatureName),
      index,
      signatureName,
      input.symbolTable,
      argumentCount,
    );
    if (!orchestrator.isCnxFunction(signatureName)) {
      return { param: resolved.param, mode: "c" };
    }
    // #1639: the callee's signature is written from this same answer
    return {
      param: resolved.param,
      mode: ParameterPassing.of(signatureName, index, input, isDirectCall)
        .argument,
    };
  }
}

export default CallArgumentPassing;
