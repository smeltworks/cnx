/**
 * ADR-072: how many bytes each register member covers. 2.1's overlap,
 * alignment and pointer-range rules and the layout 2.3 writes in C all read
 * this one answer.
 */
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import RegisterAddress from "./RegisterAddress";
import type IRegisterMemberSymbol from "../types/symbols/IRegisterMemberSymbol";

class RegisterLayout {
  /** The member's byte width; null for an ISR slot on a target of unknown pointer width */
  static bytesOf(
    member: IRegisterMemberSymbol,
    pointerBits: number | null,
    bitmapBitWidth: ReadonlyMap<string, number>,
  ): bigint | null {
    const name = RegisterLayout.typeNameOf(member);
    // an ISR slot is a function pointer, as wide as the target's pointers
    const bits =
      name === "ISR"
        ? pointerBits
        : (TYPE_WIDTH[name] ?? bitmapBitWidth.get(name) ?? 8);
    return bits === null ? null : BigInt(Math.ceil(bits / 8));
  }

  /** The C union an offset group is written as: `AT_0x00` */
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
