import type IBaseSymbol from "./IBaseSymbol";
import type IRegisterMemberSymbol from "./IRegisterMemberSymbol";
import type TConstExpr from "../TConstExpr";

/**
 * Symbol representing a register block definition.
 */
interface IRegisterSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register" */
  readonly kind: "register";

  /**
   * ADR-072 Part 1: null on the register TYPE (`register GpioPort { ... }`),
   * which has no address; an instance (`GpioPort GPIO1(0x401B8000);`) carries
   * the address its declaration wrote, settled by 1.4.
   */
  /** The type an instance is of, by C name; null on the type itself */
  readonly registerType: string | null;

  /**
   * ADR-072: a register TYPE some function's parameter takes, so it is
   * written as a C layout struct. Decided once by 1.4, which sees every
   * function; false on an instance.
   */
  readonly isParameterLayout: boolean;

  /**
   * ADR-072 ruling 13: a register TYPE that maps hardware -- one with a
   * fixed-address instance, or one a parameter takes -- so its members must
   * be aligned (E0939). Decided once by 1.4; false on an instance.
   */
  readonly isHardwareLayout: boolean;

  readonly addressExpr: TConstExpr | null;

  /**
   * The address `addressExpr` folds to, settled once by 1.4. Null on a type,
   * and on an instance whose address is not a compile-time constant -- which
   * is a compile error, not a runtime address.
   */
  readonly baseAddress: bigint | null;

  /**
   * Members, each a symbol carrying its own span and identity (#1318).
   * Keyed by bare member name, which is how every consumer looks one up.
   */
  readonly members: ReadonlyMap<string, IRegisterMemberSymbol>;
}

export default IRegisterSymbol;
