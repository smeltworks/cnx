/**
 * NarrowingCastHelper - MISRA C:2012 Rule 10.3 compliance
 *
 * Issue #845: Wraps expressions with explicit casts when assigning
 * to narrower types or different essential type categories.
 *
 * C's integer promotion rules mean bit operations on u8/u16 produce int,
 * which MISRA flags when assigned back to narrower types without explicit cast.
 */

import type TPlannedNarrowing from "./types/TPlannedNarrowing";
import type TranspileState from "../TranspileState";
import CppModeHelper from "./CppModeHelper";
import TYPE_MAP from "./types/TYPE_MAP";
import CastRequirement from "./CastRequirement";

/**
 * Types that get promoted to int in C's integer promotion rules.
 * In C, operations on types smaller than int get promoted to int.
 */
const PROMOTED_TO_INT = new Set(["u8", "i8", "u16", "i16", "bool"]);

/**
 * Float types for cross-category detection -- cnx's `f32`/`f64` AND the C
 * spellings a header brings in, because MISRA 10.3's essential type categories
 * do not stop at the interop boundary.
 *
 * #1450: deliberately WIDER than `types/FLOAT_TYPES`, which is cnx only and
 * is what `TypeResolver.isFloatType` answers from. Two different questions; the
 * predicates below used to share `TypeResolver`'s names, so picking the wrong
 * one silently answered the other question. `parseArrayTypeDimension` is what
 * that costs when it happens -- see `issue-1450-hex-array-dimension-fill`.
 */
const FLOAT_TYPES = new Set(["f32", "f64", "float", "double"]);

/**
 * Integer types for cross-category detection.
 */
const INTEGER_TYPES = new Set([
  "u8",
  "u16",
  "u32",
  "u64",
  "i8",
  "i16",
  "i32",
  "i64",
  "uint8_t",
  "uint16_t",
  "uint32_t",
  "uint64_t",
  "int8_t",
  "int16_t",
  "int32_t",
  "int64_t",
  "int",
]);

/**
 * Helper for adding MISRA 10.3 compliant casts to generated C code.
 */
class NarrowingCastHelper {
  /**
   * MISRA 10.3: how a value of `sourceType` is written against `targetType`
   * -- 2.2 decides it, once per promoted read
   */
  static narrowingOf(
    sourceType: string,
    targetType: string,
  ): TPlannedNarrowing | null {
    if (!CastRequirement.forConversion(sourceType, targetType)) return null;
    // Bool target: use comparison instead of cast (MISRA 10.5)
    if (targetType === "bool") return { kind: "compare" };
    return { kind: "cast", cType: TYPE_MAP[targetType] ?? targetType };
  }

  /** Write `expr` in 2.2's planned narrowing form */
  static apply(
    expr: string,
    narrowing: TPlannedNarrowing | null,
    state: TranspileState,
  ): string {
    if (narrowing === null) return expr;
    if (narrowing.kind === "compare") return `((${expr}) != 0U)`;
    return CppModeHelper.cast(narrowing.cType, expr, state);
  }

  /**
   * Determine the result type of C integer promotion for a given type.
   *
   * In C, operations on types smaller than int are promoted:
   * - u8, i8, u16, i16, bool -> int (32-bit)
   * - u32, i32, u64, i64 -> no promotion (already >= int width)
   *
   * @param baseType - The cnx type of the operand
   * @returns "int" for promoted types, or the original type
   */
  static getPromotedType(baseType: string): string {
    if (PROMOTED_TO_INT.has(baseType)) {
      return "int";
    }
    return baseType;
  }

  /**
   * Is this type in the FLOAT category, C spellings included?
   *
   * Not `TypeResolver.isFloatType`, which answers about cnx types alone:
   * `double` is true here and false there, on purpose.
   */
  static isFloatCategory(typeName: string): boolean {
    return FLOAT_TYPES.has(typeName);
  }

  /**
   * Is this type in the INTEGER category, C spellings included?
   *
   * Not `TypeResolver.isIntegerType` -- `uint8_t` and `int` are true here and
   * false there, on purpose.
   */
  static isIntegerCategory(typeName: string): boolean {
    return INTEGER_TYPES.has(typeName);
  }

  /**
   * Check if conversion between source and target is a cross-type-category conversion.
   * MISRA 10.3 requires explicit casts for different essential type categories.
   */
  static isCrossTypeCategoryConversion(
    sourceType: string,
    targetType: string,
  ): boolean {
    const sourceIsFloat = NarrowingCastHelper.isFloatCategory(sourceType);
    const targetIsFloat = NarrowingCastHelper.isFloatCategory(targetType);
    const sourceIsInt = NarrowingCastHelper.isIntegerCategory(sourceType);
    const targetIsInt = NarrowingCastHelper.isIntegerCategory(targetType);

    // Float to integer or integer to float
    return (sourceIsFloat && targetIsInt) || (sourceIsInt && targetIsFloat);
  }

  /**
   * Get the appropriate C float type for a cnx type.
   */
  static getCFloatType(typeName: string): string {
    if (typeName === "f32" || typeName === "float") {
      return "float";
    }
    if (typeName === "f64" || typeName === "double") {
      return "double";
    }
    return "double"; // Default to double
  }

  /**
   * Wrap int-to-float conversion with explicit cast for MISRA 10.3.
   *
   * @param expr - The integer expression
   * @param targetType - The float target type (f32/f64)
   * @returns Expression with cast
   */
  static wrapIntToFloat(
    expr: string,
    targetType: string,
    state: TranspileState,
  ): string {
    const floatType = NarrowingCastHelper.getCFloatType(targetType);
    return CppModeHelper.cast(floatType, expr, state);
  }
}

export default NarrowingCastHelper;
