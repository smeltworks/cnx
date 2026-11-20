/**
 * ADR-072: how many bytes each register member covers. 2.1's overlap,
 * alignment and pointer-range rules and the layout 2.3 writes in C all read
 * this one answer.
 */
import type ITargetWidths from "../types/ITargetWidths";
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import RegisterAddress from "./RegisterAddress";
import type IRegisterMemberSymbol from "../types/symbols/IRegisterMemberSymbol";

class RegisterLayout {
  /** The member's byte width; null for an ISR slot on a target of unknown pointer width */
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
        : (TYPE_WIDTH[name] ??
          RegisterLayout.backingBits(bitmapBitWidth.get(name)) ??
          widths.intBits);
    return bits === null ? null : BigInt(Math.ceil(bits / 8));
  }

  /** The bits of the unsigned integer a bitmap of `bits` is typedef'd to */
  private static backingBits(bits: number | undefined): number | undefined {
    if (bits === undefined) return undefined;
    return [8, 16, 32, 64].find((width) => bits <= width) ?? bits;
  }

  static groupName(offset: bigint): string {
    return `AT_${RegisterAddress.hex(offset)}`;
  }

  /** The member's type as written: `u32`, a bitmap's name, `ISR` */
  static typeNameOf(member: IRegisterMemberSymbol): string {
    const type = member.type;
    if (type.kind === "primitive") return type.primitive;
    return "name" in type ? String(type.name) : "";
  }
}

export default RegisterLayout;
