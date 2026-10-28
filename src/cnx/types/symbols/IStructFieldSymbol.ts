import type IBaseSymbol from "./IBaseSymbol";
import type TType from "../TType";
import type TConstExpr from "../TConstExpr";
import type TOverflowBehavior from "../TOverflowBehavior";

/**
 * Symbol representing one field of a struct.
 *
 * Was `IFieldInfo`, a plain record with no position and no identity (#1318).
 * Every field of a struct declared across twenty lines reported the struct's
 * line, or reported nothing at all, because there was nowhere to put one.
 *
 * `fullyQualifiedCName` here is an INDEX KEY, not an emitted identifier -- see
 * the note on `IBaseSymbol`. A struct field is emitted `p.x`; `SPoint__x` is
 * what distinguishes this field from `SOther__x` in the symbol table, and
 * nothing generated ever contains it.
 */
interface IStructFieldSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "struct_field" */
  readonly kind: "struct_field";

  /** Field type */
  readonly type: TType;

  /** Whether this field is const */
  readonly isConst: boolean;

  /** Whether this field is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /**
   * ADR-044: the field's own `clamp`/`wrap`, `clamp` when it has none -- the
   * same rule as a variable's (#1411).
   */
  readonly overflowBehavior: TOverflowBehavior;

  /** Whether this field is an array */
  readonly isArray: boolean;

  /**
   * ADR-030 / #1744: the field's type is an opaque C handle, so the struct
   * holds it through a pointer (`Dev* d;`). Stamped by 1.4 Resolve, as a
   * parameter's `isOpaqueHandle` is (#1722).
   */
  readonly isOpaqueHandle?: boolean;

  /** Array dimensions if isArray is true */
  readonly dimensions?: ReadonlyArray<number | string>;
  /**
   * #1175: each dimension as written, index-aligned with the dimensions --
   * null where 1.3 already knew the size (a literal, arithmetic over literals,
   * an unsized `[]`). 1.4 Resolve settles the rest from this, never from
   * source text.
   */
  readonly dimensionExprs?: ReadonlyArray<TConstExpr | null>;
}

export default IStructFieldSymbol;
