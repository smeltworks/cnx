/**
 * Information extracted from a C/C++ parameter declaration.
 */
interface IExtractedParameter {
  /** Parameter name (may be empty for abstract declarators) */
  readonly name: string;

  /** Parameter type as string */
  readonly type: string;

  /** Whether the parameter is const-qualified */
  readonly isConst: boolean;

  /** Whether the parameter is an array */
  readonly isArray: boolean;

  /** #2062: a C++ `T&`, which the callee may write through unless const */
  readonly isReference?: boolean;

  /** #2473 review: a C++ default argument, `int n = 0`, which a call may leave out */
  readonly hasDefault?: boolean;

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

export default IExtractedParameter;
