import CompositeType from "./CompositeType";
import CExpression from "./CExpression";
import CNX_TO_C_TYPE_MAP from "./constants/TypeMappings";
import type IBitWidth from "../types/IBitWidth";
import type TPlannedBitValue from "../types/TPlannedBitValue";
import type IOperandType from "../types/IOperandType";

/**
 * The storage's width, from its fixed-width C type: `uint32_t`, `int16_t`, ...
 * A type this does not name (`bool`, or none known) has no width here.
 */
const FIXED_WIDTH = /^u?int(8|16|32|64)_t$/;

/** A bit width written as a constant: `24`, or `24U` once suffixed */
const CONSTANT_WIDTH = /^(\d+)U?$/;

/**
 * Bit manipulation utilities for C code generation: the one rule for
 * writing a bit or a bit range of an integer, whatever names it -- a
 * variable, a bitmap field, a register member, or a float's bits.
 *
 * Every write takes its storage's C type, because two decisions depend on
 * it (#1668):
 * - an operand shifted into storage wider than 16 bits is cast to the
 *   storage's own unsigned width first. C promises `unsigned int` only 16
 *   bits, and where it is 16 bits (AVR) `1U << 16` is undefined and
 *   `~(1U << 3)` is a 16-bit mask that clears bits 16-31 of the storage it
 *   is ANDed with -- a silent miscompile that compiles cleanly. A
 *   fixed-width type is exact on every target, so the output is too;
 * - storage narrower than 32 bits, or signed, takes the MISRA C:2012 Rule
 *   10.3 cast back to its type: the operators promote, and the result is
 *   unsigned (#1760 second review: an `i32` or `i64` target took none).
 *
 * Any other named storage is an integer whose width the target does not fix
 * (`int_fast16_t`, which is `long` on a 64-bit host): the typer gives it no
 * width, and only such a type is passed here by name. Its write is worked in
 * `uintmax_t` and cast back to the storage type (owner ruling, #1760 review),
 * which is correct at any width and the same on every target. A 32-bit `1U`
 * mask there cleared the upper half of a 64-bit `long`.
 */
class BitUtils {
  /**
   * The C type an integer's bits are read or written in: a known width's
   * fixed-width type, or, for an integer the target gives no width, the type
   * its header spelled, which is worked in `uintmax_t` (see above). Undefined
   * for anything else. #1760 review: a read sized its mask from the ROOT's
   * declared type while a write asked this of the value ranged, so
   * `this.v[0, n]` on a u64 had a 32-bit mask.
   */
  static storageOf(value: IOperandType | null): string | undefined {
    const type = CompositeType.integerOf([value]);
    if (type !== null) return CNX_TO_C_TYPE_MAP[type];
    const isInteger =
      value?.category === "signed" || value?.category === "unsigned";
    return isInteger ? (value.cType ?? undefined) : undefined;
  }

  /**
   * A `[start, width]` width as C: its folded value, `NU`, when it folds, so
   * the mask is a literal (Issue #1094, #1096: `(1U << WIDTH) - 1U` is
   * undefined at full width); its rendered text otherwise
   */
  /**
   * A bit index moved `offset` bits up, as a bit of a bitmap field is a bit of
   * its bitmap (#2251): its folded value, `NU`, when it folds, else the sum
   */
  static shiftedIndex(
    text: string,
    folded: number | undefined,
    offset: number,
  ): string {
    if (offset === 0) return text;
    return folded === undefined
      ? `(${offset}U + ${text})`
      : `${folded + offset}U`;
  }

  static widthText(width: IBitWidth): string {
    return width.folded === undefined ? width.text : `${width.folded}U`;
  }

  /**
   * Convert a boolean expression to an unsigned integer (0U or 1U).
   * A compile-time value is folded, however it is spelled (`true`, `0x1`,
   * `0b0`, a const); any other expression becomes a ternary.
   * Uses unsigned literals for MISRA C:2012 Rule 10.1 compliance.
   *
   * @param expr - The expression to convert
   * @param folded - The expression's compile-time value, when it has one
   * @returns C code string representing the unsigned integer value
   */
  static boolToInt(expr: string, folded?: number): string {
    // A constant is folded: `(1 ? 1U : 0U)` is a controlling expression that
    // is invariant, MISRA C:2012 Rule 14.3, and one branch of it is dead code
    if (folded !== undefined) return folded === 0 ? "0U" : "1U";
    if (expr === "true") return "1U";
    if (expr === "false") return "0U";
    // One operand of `?:`: a ternary or a lower-precedence value would bind
    // the conversion to its last arm only (#2249)
    return `(${CExpression.operand(expr)} ? 1U : 0U)`;
  }

  /**
   * The mask of `width` ones. A constant width is written as its value, a
   * hex literal C sizes to fit on every target; only a width known at run
   * time is computed, in the storage's width.
   *
   * @param width - The bit width (number, or the generated C for it)
   * @param storage - The C type of the value masked, when known
   * @returns C code string for the mask
   */
  static generateMask(width: string | number, storage?: string): string {
    const constant = CONSTANT_WIDTH.exec(String(width));
    if (constant) {
      return BitUtils.maskHex(Number(constant[1]));
    }
    return `((${BitUtils.widen("1U", storage)} << ${width}) - 1U)`;
  }

  /**
   * The hex literal of `width` ones, e.g. 4 -> `0xFU`, 64 ->
   * `0xFFFFFFFFFFFFFFFFU`. The `U` suffix is MISRA C:2012 Rule 7.2's.
   *
   * @param width - The bit width, 0 to 64
   * @returns Hex mask string
   */
  static maskHex(width: number): string {
    const ones = (1n << BigInt(width)) - 1n;
    return `0x${ones.toString(16).toUpperCase()}U`;
  }

  /**
   * Generate read-modify-write code for single bit assignment.
   * Pattern: target = (target & ~(1 << offset)) | (value << offset)
   * Converts boolean values via boolToInt.
   *
   * @param target - The variable to modify
   * @param offset - Bit position (0-indexed)
   * @param value - Value to write (will be converted via boolToInt)
   * @param storage - The target's C type, when known
   * @param folded - The value's compile-time value, when it has one
   * @returns C code string for the assignment
   */
  static singleBitWrite(
    target: string,
    offset: string | number,
    value: string,
    storage?: string,
    folded?: number,
  ): string {
    return `${target} = ${BitUtils.singleBitValue(target, offset, value, storage, folded)};`;
  }

  /**
   * The value a single-bit write stores: `read` with the bit at `offset` set
   * to `value`. An atomic write reads through its own copy (ADR-049).
   */
  static singleBitValue(
    read: string,
    offset: string | number,
    value: string,
    storage?: string,
    folded?: number,
  ): string {
    const one = BitUtils.widen("1U", storage);
    const bit = BitUtils.widen(BitUtils.boolToInt(value, folded), storage);
    const rhs = `(${read} & ~(${one} << ${offset})) | (${bit} << ${offset})`;
    return BitUtils.narrowed(rhs, storage);
  }

  /**
   * Generate read-modify-write code for multi-bit assignment.
   * Pattern: target = (target & ~(mask << offset)) | ((value & mask) << offset)
   *
   * @param target - The variable to modify
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write: a constant, or the C for it with
   *   its fold, so every writer folds (#1096)
   * @param value - Value to write, masked as one operand (#1760 second review:
   *   `a | b & mask` wrote bits outside the range)
   * @param storage - The target's C type, when known
   * @returns C code string for the assignment
   */
  static multiBitWrite(
    target: string,
    offset: string | number,
    width: number | IBitWidth,
    value: string,
    storage?: string,
    written: TPlannedBitValue | null = null,
  ): string {
    return `${target} = ${BitUtils.multiBitValue(target, offset, width, value, storage, written)};`;
  }

  /**
   * The value a bit-range write stores: `read` with `width` bits at `offset`
   * set to `value`. An atomic write reads through its own copy (ADR-049).
   */
  static multiBitValue(
    read: string,
    offset: string | number,
    width: number | IBitWidth,
    value: string,
    storage?: string,
    written: TPlannedBitValue | null = null,
  ): string {
    const field = BitUtils.fieldBits(width, value, storage, written);
    const rhs = `(${read} & ~(${field.mask} << ${offset})) | (${field.masked} << ${offset})`;
    return BitUtils.narrowed(rhs, storage);
  }

  /**
   * Generate write-only register code for single bit assignment.
   * No read-modify-write, just shifts the value into position.
   * Pattern: target = (value << offset)
   *
   * @param target - The register to write
   * @param offset - Bit position (0-indexed)
   * @param value - Value to write (will be converted via boolToInt)
   * @param storage - The target's C type, when known
   * @param folded - The value's compile-time value, when it has one
   * @returns C code string for the assignment
   */
  static writeOnlySingleBit(
    target: string,
    offset: string | number,
    value: string,
    storage?: string,
    folded?: number,
  ): string {
    const bit = BitUtils.widen(BitUtils.boolToInt(value, folded), storage);
    return `${target} = ${BitUtils.narrowCast(storage)}(${bit} << ${offset});`;
  }

  /**
   * Generate write-only register code for multi-bit assignment.
   * No read-modify-write, just shifts the masked value into position.
   * Pattern: target = ((value & mask) << offset)
   *
   * @param target - The register to write
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write (see `multiBitWrite`)
   * @param value - Value to write, masked as one operand
   * @param storage - The target's C type, when known
   * @returns C code string for the assignment
   */
  static writeOnlyMultiBit(
    target: string,
    offset: string | number,
    width: number | IBitWidth,
    value: string,
    storage?: string,
    written: TPlannedBitValue | null = null,
  ): string {
    const cast = BitUtils.narrowCast(storage);
    const field = BitUtils.fieldBits(width, value, storage, written);
    return `${target} = ${cast}(${field.masked} << ${offset});`;
  }

  /** A multi-bit field's mask, and the value it stores masked once (#2483) */
  private static fieldBits(
    width: number | IBitWidth,
    value: string,
    storage: string | undefined,
    written: TPlannedBitValue | null,
  ): { mask: string; masked: string } {
    const mask = BitUtils.shiftedMask(BitUtils.widthOf(width), storage);
    return {
      mask,
      masked: BitUtils.writtenBits(value, mask, storage, written),
    };
  }

  /**
   * The value a multi-bit write shifts into place, masked once (#2483): a
   * literal 2.2 found the target holds as it is, a bit range at its own
   * width, read unmasked; any other value at the target's
   */
  private static writtenBits(
    value: string,
    mask: string,
    storage: string | undefined,
    written: TPlannedBitValue | null,
  ): string {
    if (written?.kind === "fits") return BitUtils.widen(value, storage);
    const own =
      written?.kind === "range"
        ? BitUtils.shiftedMask(written.width, storage)
        : mask;
    return `(${CExpression.operand(value)} & ${own})`;
  }

  /** A writer's width as C: a constant as it is, a written one folded */
  private static widthOf(width: number | IBitWidth): string | number {
    return typeof width === "number" ? width : BitUtils.widthText(width);
  }

  /** A mask about to be shifted into `storage`: a computed one already is */
  private static shiftedMask(
    width: string | number,
    storage: string | undefined,
  ): string {
    const mask = BitUtils.generateMask(width, storage);
    return CONSTANT_WIDTH.test(String(width))
      ? BitUtils.widen(mask, storage)
      : mask;
  }

  /** An operand shifted into `storage`, in the storage's width (see above) */
  private static widen(operand: string, storage: string | undefined): string {
    if (BitUtils.isUnfixed(storage)) return `(uintmax_t)${operand}`;
    const bits = BitUtils.bitsOf(storage);
    return bits > 16 ? `(uint${bits}_t)${operand}` : operand;
  }

  /** A read-modify-write's assignment, cast back as `narrowCast` says */
  private static narrowed(rhs: string, storage: string | undefined): string {
    const cast = BitUtils.narrowCast(storage);
    return cast === "" ? rhs : `${cast}(${rhs})`;
  }

  /**
   * The Rule 10.3 cast back to storage narrower than 32 bits, to signed
   * storage, or to storage of unfixed width, which is worked in `uintmax_t`;
   * none otherwise
   */
  private static narrowCast(storage: string | undefined): string {
    if (BitUtils.isUnfixed(storage)) return `(${storage})`;
    const bits = BitUtils.bitsOf(storage);
    const signed = storage?.startsWith("int") ?? false;
    return bits > 0 && (bits < 32 || signed) ? `(${storage})` : "";
  }

  /** Storage named by a type whose width the target does not fix */
  private static isUnfixed(storage: string | undefined): boolean {
    return storage !== undefined && !FIXED_WIDTH.test(storage);
  }

  /** The storage's width in bits, or 0 when its type is not fixed-width */
  private static bitsOf(storage: string | undefined): number {
    const match = FIXED_WIDTH.exec(storage ?? "");
    return match ? Number(match[1]) : 0;
  }
}

export default BitUtils;
