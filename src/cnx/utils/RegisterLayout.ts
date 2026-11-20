/**
 * ADR-072: how many bytes each register member covers. 2.1's overlap,
 * alignment and pointer-range rules and the layout 2.3 writes in C all read
 * this one answer.
 */
import type ITargetWidths from "../types/ITargetWidths";
import type TRunTarget from "../types/TRunTarget";
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import RegisterAddress from "./RegisterAddress";
import type IRegisterMemberSymbol from "../types/symbols/IRegisterMemberSymbol";

class RegisterLayout {
  /**
   * The bytes a member occupies as C lays it out: an ISR slot a pointer's, a
   * bitmap its backing integer's (a `bitmap24` is a `uint32_t`), an enum a C
   * `int`'s; null where the target, and so that width, is unknown
   */
  static bytesOf(
    member: IRegisterMemberSymbol,
    widths: ITargetWidths,
    bitmapBitWidth: ReadonlyMap<string, number>,
  ): bigint | null {
    const name = RegisterLayout.typeNameOf(member);
    const bits =
      name === "ISR"
        ? widths.pointerBits
        : name === "f64"
          ? widths.doubleBits
          : (TYPE_WIDTH[name] ??
            RegisterLayout.backingBits(bitmapBitWidth.get(name)) ??
            widths.intBits);
    return bits === null ? null : BigInt(Math.ceil(bits / 8));
  }

  /** The widths a layout depends on, from the program's target */
  static widthsOf(target: TRunTarget | null): ITargetWidths {
    if (target?.kind !== "resolved") {
      return { pointerBits: null, intBits: null, doubleBits: null };
    }
    return {
      pointerBits: target.description.pointer_bits,
      intBits: target.description.int_bits,
      doubleBits: target.description.double_bits,
    };
  }

  /** The bits of the unsigned integer a bitmap of `bits` is typedef'd to */
  private static backingBits(bits: number | undefined): number | undefined {
    if (bits === undefined) return undefined;
    return [8, 16, 32, 64].find((width) => bits <= width) ?? bits;
  }

  /**
   * The union an offset group is written as. ADR-063 keeps `__` out of a cnx
   * name, so no member can take this one, nor `reservedName`'s
   */
  static groupName(offset: bigint): string {
    return `AT__${RegisterAddress.hex(offset)}`;
  }

  /** The byte array that fills a layout's gap starting at `offset` */
  static reservedName(offset: bigint): string {
    return `RESERVED__${RegisterAddress.hex(offset)}`;
  }

  /** The member's path within its layout struct: `AT__0x00.RBR`, `LSR` */
  static pathOf(member: IRegisterMemberSymbol): string {
    return member.layoutUnion === null
      ? member.layoutField
      : `${member.layoutUnion}.${member.layoutField}`;
  }

  /** The member's type as written: `u32`, a bitmap's name, `ISR` */
  static typeNameOf(member: IRegisterMemberSymbol): string {
    const type = member.type;
    if (type.kind === "primitive") return type.primitive;
    return "name" in type ? String(type.name) : "";
  }
}

export default RegisterLayout;
