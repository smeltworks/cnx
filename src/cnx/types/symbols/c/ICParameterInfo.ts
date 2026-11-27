/**
 * Parameter info for C functions.
 * Uses simple strings for types since C types pass through unchanged.
 */
interface ICParameterInfo {
  /** Parameter name (may be empty for prototypes) */
  readonly name: string;

  /** Parameter type as string (e.g., "int", "const char*") */
  readonly type: string;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Whether this parameter is an array */
  readonly isArray: boolean;

  /**
   * #1619: every `[...]` of an array parameter, as written: `g[4][8]` is
   * `["4", "8"]`. Only the first decays; the rest are part of the type.
   */
  readonly arrayDimensions?: ReadonlyArray<string>;

  /**
   * #1619: the declarator nests (`(*f)(void)`, `(*rows)[4]`), so the parameter
   * is a pointer to a function or to an array, which `type` does not spell.
   */
  readonly isNestedDeclarator?: boolean;

  /**
   * #2348 review: the nested declarator is a pointer to a function
   * (`(*make)(void)`), and `type` is what that function returns
   */
  readonly isFunctionPointer?: boolean;

  /** #1619: the pointee is `volatile`, which `type` does not spell */
  readonly isVolatile?: boolean;
}

export default ICParameterInfo;
