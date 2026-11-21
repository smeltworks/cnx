/**
 * Parameter information for function signatures
 *
 * `isPassByValue` is `ParameterPassing`'s answer (#1639), the one the
 * signature is written from.
 */
type TParameterInfo = {
  name: string;
  baseType: string; // 'u32', 'f32', 'Point'
  isArray: boolean;
  isStruct: boolean;
  isConst: boolean; // ADR-013
  isCallback: boolean; // ADR-029
  isString: boolean; // ADR-045
  /**
   * Issue #895: True when a primitive param becomes a pointer due to callback typedef.
   * When used as a value in expressions, these params need dereferencing (*param).
   */
  isCallbackPointerPrimitive?: boolean;

  /**
   * Issue #895: True when a param needs pointer semantics due to callback typedef.
   * In C++ mode, this forces -> member access instead of . (reference access).
   * Applies to both struct and primitive callback-compatible params.
   */
  forcePointerSemantics?: boolean;

  /**
   * ADR-030 / #1722: the parameter holds opaque handles -- its type is an
   * incomplete struct, so C holds each value only as a pointer, and that
   * pointer IS the value. For an array parameter, each ELEMENT is a handle: an
   * array of handles is an array of pointers (#996).
   *
   * Decided once, when the parameter is registered. The signature reads it to
   * spell `T*` (`T* arr[N]` for an array), and a whole-value use of the
   * parameter reads it to render the bare name rather than `(*p)`, which C
   * rejects for an incomplete type.
   */
  isOpaqueHandle?: boolean;

  /** #1639: the C parameter is the value itself, as 2.2 decided */
  isPassByValue?: boolean;

  /** ADR-072: a register parameter, a pointer to its layout in C and C++ */
  isRegister?: boolean;
};

export default TParameterInfo;
