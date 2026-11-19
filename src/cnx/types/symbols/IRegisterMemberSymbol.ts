import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing one memory-mapped member of a register block.
 *
 * Was `IRegisterMemberInfo`, which like the bitmap field carried no name and no
 * position (#1318).
 *
 * `fullyQualifiedCName` is an INDEX KEY, not an emitted identifier: a register
 * member is emitted as an offset from a base address.
 */
import type TRegisterAccessMode from "../TRegisterAccessMode";
import type TConstExpr from "../TConstExpr";
import type TType from "../TType";
interface IRegisterMemberSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register_member" */
  readonly kind: "register_member";

  /** The offset from the base address, as written */
  readonly offset: TConstExpr;

  /**
   * ADR-072 Part 1: what `offset` folds to, settled once by 1.4. Null until
   * then, and when it is not a compile-time constant -- a compile error.
   */
  readonly offsetValue: bigint | null;

  /**
   * The member's type as written, settled by 1.4 Resolve like any other
   * (#1514). Whether it is a bitmap is asked of the names the file can see
   * (`DeclaredTypeFacts.registerMemberBitmap`), never stored here: Declare
   * sees one file.
   */
  readonly type: TType;

  /** Access mode for the register */
  readonly access: TRegisterAccessMode;
}

export default IRegisterMemberSymbol;
