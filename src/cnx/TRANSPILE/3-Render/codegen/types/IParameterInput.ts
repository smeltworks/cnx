/**
 * Normalized parameter input for signature generation
 *
 * This interface serves as the contract between ParameterInputAdapter
 * (which normalizes AST or symbol data) and ParameterSignatureBuilder
 * (which generates the final C/C++ parameter string).
 *
 * All decisions are pre-computed before reaching the builder:
 * - Type classification (callback, string, array, etc.)
 * - Const qualifiers (explicit and auto-inferred)
 * - Pass-by-value vs pass-by-reference
 * - Array dimensions
 */
interface IParameterInput {
  /** Parameter name */
  name: string;

  /** Original cnx type: 'u32', 'string<32>', 'Point', etc. */
  baseType: string;

  /** Mapped C type: 'uint32_t', 'char', 'Point', etc. */
  mappedType: string;

  /** Explicit const modifier from source code */
  isConst: boolean;

  /** Whether this is an array type */
  isArray: boolean;

  /** Array dimensions as strings: ['10', '20'] or ['33'] for string capacity */
  arrayDimensions?: string[];

  /** Whether this is a callback type (from TranspileState.callbackTypes) */
  isCallback: boolean;

  /** The typedef name for callback types (e.g., 'HandleClickCallback') */
  callbackTypedefName?: string;

  /** Whether this is a string type (bounded or unbounded) */
  isString: boolean;

  /** Whether this is an unbounded string (no capacity) */
  isUnboundedString?: boolean;

  /** String capacity for non-array strings (used for tracking, not output) */
  stringCapacity?: number;

  /** Whether to use pass-by-value semantics (ISR, float, enum, small primitive) */
  isPassByValue: boolean;

  /** Whether to use pass-by-reference semantics (known struct or known primitive) */
  isPassByReference: boolean;

  /**
   * Issue #895: Force pointer syntax even in C++ mode.
   * Required for callback-compatible functions because C callback typedefs
   * expect pointers, not C++ references.
   */
  forcePointerSyntax?: boolean;

  /**
   * Issue #895: Force const qualifier from callback typedef signature.
   * When the C typedef has `const T*`, this preserves const on the generated param.
   */
  forceConst?: boolean;

  /**
   * Issue #995: Whether the parameter type is an opaque handle (incomplete struct typedef).
   * This is a pass-through flag; the rule (suppress auto-const, force pointer) is applied
   * in ParameterSignatureBuilder to avoid dual code paths. For an array parameter it
   * says each element is a handle, so the element is spelled `T*` (#996).
   */
  isOpaqueHandle?: boolean;

  /** ADR-072: a register parameter, written `Layout* name` in C and C++ */
  isRegister?: boolean;
}

export default IParameterInput;
