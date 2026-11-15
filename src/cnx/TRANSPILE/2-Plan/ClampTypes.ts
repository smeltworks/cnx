import TYPE_MAP from "./types/TYPE_MAP";
import WIDER_TYPE_MAP from "./types/WIDER_TYPE_MAP";
import TYPE_LIMITS from "./types/TYPE_LIMITS";
import type IClampTypeInfo from "../../types/IClampTypeInfo";
import invariant from "../../utils/invariant";

/** The C types an overflow helper for a cnx type is written in */
class ClampTypes {
  /**
   * Resolve type information for a cnx type
   */
  static resolve(cnxType: string): IClampTypeInfo | null {
    const cType = TYPE_MAP[cnxType];
    const widerType = WIDER_TYPE_MAP[cnxType] || cType;
    const maxValue = TYPE_LIMITS.TYPE_MAX[cnxType];
    const minValue = TYPE_LIMITS.TYPE_MIN[cnxType];

    if (!cType || !maxValue) {
      return null;
    }

    const isUnsigned = cnxType.startsWith("u");
    // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
    const useWiderArithmetic =
      !isUnsigned && widerType !== cType && cnxType !== "i64";

    return {
      cType,
      widerType,
      maxValue,
      minValue,
      cnxType,
      isUnsigned,
      useWiderArithmetic,
    };
  }

  /** An integer type's information, which every integer type has */
  static of(cnxType: string): IClampTypeInfo {
    const info = ClampTypes.resolve(cnxType);
    invariant(info !== null, `${cnxType} is an integer type`);
    return info;
  }
}

export default ClampTypes;
