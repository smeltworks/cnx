/**
 * ADR-029: the single formatter for a callback typedef's parameter list.
 *
 * The `.c` and the `.h` each used to build this string themselves, and they
 * disagreed: the header dropped `const` and array dimensions, so
 * `void (*onReceive_fp)(const Message*)` in the implementation met
 * `void (*onReceive_fp)(Message*)` in the header. Nothing caught it while the
 * `.c` did not include its own header; once it does (#1164), the two meet in
 * one translation unit and the compiler rejects the redeclaration.
 *
 * Both paths now format from here, so there is one answer to "what does this
 * typedef look like?" rather than two that happened to agree for simple cases.
 */

import type ICallbackTypedefParameter from "../types/ICallbackTypedefParameter";
import ReturnBuffer from "./ReturnBuffer";

class CallbackTypedefFormatter {
  /**
   * Format the parameter list between the parentheses of a callback typedef.
   */
  static formatParameterList(
    parameters: readonly ICallbackTypedefParameter[],
    isCppMode: boolean,
  ): string {
    if (parameters.length === 0) {
      return "void";
    }

    return parameters
      .map((parameter) =>
        CallbackTypedefFormatter.formatParameter(parameter, isCppMode),
      )
      .join(", ");
  }

  /**
   * Format a complete callback typedef declaration.
   */
  static format(
    returnType: string,
    typedefName: string,
    parameters: readonly ICallbackTypedefParameter[],
    isCppMode: boolean,
    returnBuffer: string | null,
  ): string {
    // #1209: shaped as the function's own prototype, which fills a buffer
    const signature = ReturnBuffer.signature(
      returnType,
      CallbackTypedefFormatter.formatParameterList(parameters, isCppMode),
      returnBuffer,
    );
    return `typedef ${signature.returnType} (*${typedefName})(${signature.params});`;
  }

  private static formatParameter(
    parameter: ICallbackTypedefParameter,
    isCppMode: boolean,
  ): string {
    const constModifier = parameter.isConst ? "const " : "";

    // ADR-030: an opaque handle is a pointer in every mode, exactly as
    // `ParameterSignatureBuilder` spells the prototype -- and for an array,
    // each element is (#996).
    const handleSuffix = parameter.isOpaqueHandle ? "*" : "";

    if (parameter.isArray) {
      return `${constModifier}${parameter.type}${handleSuffix} ${parameter.name ?? ""}${parameter.arrayDims ?? ""}`;
    }

    if (parameter.isOpaqueHandle) {
      return `${constModifier}${parameter.type}${handleSuffix}`;
    }

    // ADR-045: `string<N>` is `const char*` at a parameter position -- the same
    // shape `ParameterSignatureBuilder._buildStringParam` gives the prototype.
    // Checked BEFORE the plain branch below, which returns the type alone and
    // would drop the `const`, leaving the typedef incompatible with the very
    // function it was derived from.
    if (parameter.isString) {
      return `${constModifier}${parameter.type}`;
    }

    if (parameter.isStruct) {
      // ADR-006: struct parameters become pointers in C, references in C++.
      const pointerOrReference = isCppMode ? "&" : "*";
      return `${constModifier}${parameter.type}${pointerOrReference}`;
    }

    if (parameter.isPointer) {
      // ...a reference in C++, as the prototype spells `mut u32 v` `uint32_t& v`
      return `${parameter.type}${isCppMode ? "&" : "*"}`;
    }

    // ADR-071: a read-only by-value parameter is `const`, as in its prototype;
    // a callback parameter, already a function pointer, never is.
    return `${constModifier}${parameter.type}`;
  }
}

export default CallbackTypedefFormatter;
