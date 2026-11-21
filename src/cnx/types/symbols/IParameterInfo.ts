import type TType from "../TType";
import type TConstExpr from "../TConstExpr";

/**
 * Metadata for a function parameter.
 */
interface IParameterInfo {
  /** Parameter name */
  readonly name: string;

  /**
   * #1290: the C identifier the parameter is emitted under -- its frame's
   * settled declaration's (`ILocalDeclaration.emittedName`), copied on by 1.4
   * Resolve, so the `.h` prototype reads the answer the `.c` signature and
   * every use in the body read. ADR-057: one that shadows a file-scope name is
   * `<function>__<name>`. Null until 1.4 settles it.
   */
  readonly emittedName: string | null;

  /** Parameter type */
  readonly type: TType;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Whether this parameter is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
  /**
   * #1175: each dimension as written, index-aligned with the dimensions --
   * null where 1.3 already knew the size (a literal, arithmetic over literals,
   * an unsized `[]`). 1.4 Resolve settles the rest from this, never from
   * source text.
   */
  readonly arrayDimensionExprs?: ReadonlyArray<TConstExpr | null>;

  /**
   * ADR-030 / #1722: the parameter's type is an opaque (incomplete) C type, so
   * it is held through a pointer -- for an array, each element is. Decided
   * once, by 1.4 Resolve, which knows which typedefs never received a body;
   * the `.c` signature, its call sites and the `.h` prototype all read this
   * stamp rather than asking the type again, so they cannot disagree.
   */
  readonly isOpaqueHandle?: boolean;

  /**
   * ADR-072: the parameter's type is a register type, so it is held through a
   * pointer to that type's layout. Decided once, by 1.4 Resolve, which first
   * knows the program's register types; the `.c` signature, its call sites
   * and the `.h` prototype all read this stamp.
   */
  readonly isRegister?: boolean;
}

export default IParameterInfo;
