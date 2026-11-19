/**
 * ADR-072 Part 1: a register's address and its members' offsets are settled
 * to numbers by 1.4 Resolve, and every C spelling of one goes through here --
 * so the access macro and a direct MMIO write cannot spell one differently.
 */
class RegisterAddress {
  /** `0x` and upper-case hex, at least two digits: `0x00`, `0x401B8000` */
  static render(value: bigint): string {
    return `0x${value.toString(16).toUpperCase().padStart(2, "0")}U`;
  }
}

export default RegisterAddress;
