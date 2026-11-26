import type IUnreadBitWidth from "../IUnreadBitWidth";

/**
 * Serialized struct field information for caching.
 * Uses string types instead of TType for JSON serialization.
 */
interface IStructFieldInfo {
  /** Field type (e.g., "uint32_t", "uint16_t") */
  type: string;
  /** Array dimensions if field is an array - numbers for resolved dimensions, strings for macros */
  arrayDimensions?: (number | string)[];
  /**
   * A bit-field's declared width, `uint32_t a : 3`: a number, or the
   * expression as written when it is no integer literal (#1975 review)
   */
  bitWidth?: number | string;
  /** Why 1.4 could not settle a `bitWidth` written as text (#2484 review) */
  bitWidthUnread?: IUnreadBitWidth;
}

export default IStructFieldInfo;
