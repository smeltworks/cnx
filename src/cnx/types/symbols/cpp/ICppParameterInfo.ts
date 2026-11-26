/**
 * Parameter info for C++ functions.
 * Uses simple strings for types since C++ types pass through unchanged.
 */
interface ICppParameterInfo {
  /** Parameter name (may be empty for prototypes) */
  readonly name: string;

  /** Parameter type as string (e.g., "int", "const std::string&") */
  readonly type: string;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Whether this parameter is an array */
  readonly isArray: boolean;

  /** #2062: a `T&`, which the callee may write through unless const */
  readonly isReference?: boolean;

  /** #2473 review: a default argument, `int n = 0`, which a call may leave out */
  readonly hasDefault?: boolean;
}

export default ICppParameterInfo;
