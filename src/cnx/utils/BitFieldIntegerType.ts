import type IOperandType from "../types/IOperandType";
import TypeCheckUtils from "./TypeCheckUtils";

/**
 * The cnx integer a write is folded and judged as. A C bit-field holds its
 * declared width whatever its C type (ADR-072 ruling 19), so a
 * `uint_fast8_t f : 3`, whose C type has no known width, still has a width.
 * Its arithmetic's width is unknown, so it folds at the widest integer and
 * only the declared width can reject a constant.
 */
class BitFieldIntegerType {
  static of(t: IOperandType | null): string {
    const typeName = t?.typeName ?? "";
    const bits = t?.bitWidth ?? null;
    if (t === null || bits === null || TypeCheckUtils.isInteger(typeName)) {
      return typeName;
    }
    if (t.category !== "signed" && t.category !== "unsigned") return typeName;
    if (bits > 64) return typeName;
    return t.category === "signed" ? "i64" : "u64";
  }
}

export default BitFieldIntegerType;
