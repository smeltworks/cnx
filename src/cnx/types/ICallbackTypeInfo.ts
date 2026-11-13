/**
 * Callback type info for Function-as-Type pattern
 * Each function definition creates both a callable function AND a type
 */

import type ICallbackTypedefParameter from "./ICallbackTypedefParameter";

interface ICallbackTypeInfo {
  functionName: string; // The original function name (also the type name)
  returnType: string; // Return type for typedef (C type)
  /**
   * The formatter's own parameter type with every field required. It used to
   * re-list the fields and omitted `isString`, which the formatter reads, so
   * nothing checked that a builder supplied it -- the shape #1552 was, one
   * field over. Required, a typedef builder that omits one does not compile.
   *
   * It also carried an `isPointer`, which both builders wrote and nothing
   * read: whether a parameter is a pointer is the formatter's decision, from
   * `isStruct` and `isOpaqueHandle`, and a call through the type asks the
   * function that is the type.
   */
  parameters: Array<Required<ICallbackTypedefParameter>>;
  typedefName: string; // e.g., "onReceive_fp"
  /**
   * #1209: the buffer a `string<N>`- or array-returning function fills,
   * ahead of its parameters, as its prototype has it; null otherwise
   */
  returnBuffer: string | null;
}

export default ICallbackTypeInfo;
