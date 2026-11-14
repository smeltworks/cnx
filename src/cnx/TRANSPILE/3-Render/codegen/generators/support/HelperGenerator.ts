/**
 * Helper function generators for overflow-safe arithmetic and safe division.
 * Extracted from CodeGenerator.ts.
 *
 * Portability note: Uses __builtin_add_overflow, __builtin_sub_overflow, and
 * __builtin_mul_overflow intrinsics (GCC 5+, Clang 3.4+). cnx targets embedded
 * systems using arm-none-eabi-gcc, so these are available. MSVC is not supported.
 *
 * Issue #707: Refactored to use OverflowHelperTemplates for reduced duplication.
 */
import TYPE_MAP from "../../../../2-Plan/types/TYPE_MAP";
import SafeDivisionTypes from "../../../../2-Plan/SafeDivisionTypes";
import OverflowHelperTemplates from "./OverflowHelperTemplates";
import SaturatingCast from "../../helpers/SaturatingCast";
import CppModeHelper from "../../../../2-Plan/CppModeHelper";
import ReservedCnxName from "../../../../../utils/ReservedCnxName";
import LengthProperty from "../../../../../utils/LengthProperty";
import StringUtils from "../../../../../utils/StringUtils";
import ComplianceAnnotations from "../../../../2-Plan/ComplianceAnnotations";
import type IPlannedSafeDivision from "../../../../../types/IPlannedSafeDivision";
import type IPlannedOverflowHelper from "../../../../../types/IPlannedOverflowHelper";

/**
 * Generate a safe arithmetic helper function (div or mod).
 * Extracted to eliminate duplication between safe_div and safe_mod generation.
 */
const generateSafeArithmeticHelper = (
  helper: IPlannedSafeDivision,
  cType: string,
): string[] => {
  // #1790: a signed quotient goes through ADR-044's helper, so MIN / -1 gives
  // what `/` gives rather than trapping
  const opSymbol = helper.operation === "div" ? "/" : "%";
  const quotient =
    helper.inner === null
      ? `numerator ${opSymbol} divisor`
      : `${helper.inner}(numerator, divisor)`;
  return [
    `static inline ${SafeDivisionTypes.RESULT_C_TYPE} ${helper.name}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
    `    if (divisor == 0) {`,
    `        *output = defaultValue;`,
    `        return true;  // Error occurred`,
    `    }`,
    `    *output = ${quotient};`,
    `    return false;  // Success`,
    `}`,
    "",
  ];
};

/**
 * The #94 note above every overflow helper block: each helper's `b` is the
 * wider type (`OverflowHelperTemplates`), debug or not.
 */
const WIDER_PARAMETER_NOTE: readonly string[] = [
  "/* ADR-044 / Issue #94: the second parameter is the WIDER type, not the value type.",
  "   Narrowing it first would let an out-of-range operand truncate INTO range and defeat",
  "   the check: cnx_clamp_add_u8(0, 256) must saturate to 255, but (uint8_t)256 is 0, so a",
  "   uint8_t parameter would return 0 -- the opposite of saturation. */",
];

/**
 * Generate all needed overflow helper functions
 * ADR-044: Overflow helper functions with clamping or panic behavior
 *
 * @param panic - 2.2's decision (`plan.panicOverflowHelpers`), not a re-read
 *   of debug mode: the block that decides it carries its hosted-libc cost
 */
const generateOverflowHelpers = (
  helpers: readonly IPlannedOverflowHelper[],
  panic: boolean,
): string[] => {
  if (helpers.length === 0) {
    return [];
  }

  const lines: string[] = [];

  if (panic) {
    lines.push(
      "// ADR-044: Debug overflow helper functions (panic on overflow)",
      "#include <limits.h>",
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "",
      ...WIDER_PARAMETER_NOTE,
      "",
    );
  } else {
    lines.push(
      "// ADR-044: Overflow helper functions",
      "#include <limits.h>",
      "",
      ...WIDER_PARAMETER_NOTE,
      "",
    );
  }

  // Sort for deterministic output
  const sorted = [...helpers].sort((x, y) => x.name.localeCompare(y.name));
  for (const helper of sorted) {
    const definition = OverflowHelperTemplates.generate(helper, panic);
    if (definition) {
      lines.push(definition, "");
    }
  }

  return lines;
};

/**
 * Generate safe division helper functions for used integer types only
 * ADR-051: Safe division helpers that return error flag on division by zero
 */
const generateSafeDivHelpers = (
  helpers: readonly IPlannedSafeDivision[],
): string[] => {
  if (helpers.length === 0) {
    return [];
  }

  const lines: string[] = [];

  // Issue #1108: the <stdbool.h> dependency (helpers return a bool error flag)
  // is recorded as the `bool` type when the safe-div effect is applied, and the
  // plan decides the header from it (#1927). Emitting it here too would
  // duplicate the include.
  lines.push("// ADR-051: Safe division helper functions", "");

  const integerTypes = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"];
  const ordered = [...helpers].sort(
    (a, b) =>
      integerTypes.indexOf(a.cnxType) - integerTypes.indexOf(b.cnxType) ||
      a.operation.localeCompare(b.operation) ||
      a.name.localeCompare(b.name),
  );

  for (const helper of ordered) {
    lines.push(
      ...generateSafeArithmeticHelper(
        helper,
        SafeDivisionTypes.operandOf(helper.cnxType),
      ),
    );
  }

  return lines;
};

/**
 * #1668: the single-evaluation saturating casts a file calls, one per
 * source/target pair (`"f32_u8"`). Each body is ADR-024's bounded ternary,
 * from the one shape `SaturatingCast` writes, over its parameter -- which is
 * the operand, evaluated once, at the call.
 */
const generateCastHelpers = (
  keys: readonly string[],
  cppMode: boolean,
): string[] => {
  if (keys.length === 0) return [];
  const cast = (type: string, expr: string): string =>
    CppModeHelper.cast(type, expr, { cppMode });
  const lines: string[] = [
    "/* ADR-024 / Issue #1668: a saturating float-to-integer cast whose operand has a side",
    "   effect -- a call, or a volatile or atomic read -- calls one of these, so the operand is",
    "   evaluated once. The inline bounded ternary reads its operand up to three times,",
    "   repeating the side effect. */",
    "",
  ];
  for (const key of keys) {
    const [sourceType, targetType] = key.split("_");
    const cType = TYPE_MAP[targetType];
    const body = SaturatingCast.expression(
      "value",
      sourceType,
      targetType,
      cType,
      cast,
    );
    if (cType === undefined || body === null) continue;
    lines.push(
      `static inline ${cType} ${ReservedCnxName.castHelper(sourceType, targetType)}(${SaturatingCast.floatCType(sourceType)} value) {`,
      `    return ${body};`,
      "}",
      "",
    );
  }
  return lines;
};

// Export as an object for consistent module pattern
/**
 * ADR-058: the runtime integer lengths. Each is a loop over the value, not a
 * compiler builtin (`__builtin_clz`) or `snprintf`: C99 has no bit-width
 * operation (C23's `stdc_bit_width` is not on C99 targets), and counting
 * decimal digits by division needs no buffer, format or <stdio.h>. The
 * value is widened to 64 bits, so one helper serves every integer width.
 */
const generateLengthHelpers = (used: readonly string[]): string[] => {
  if (used.length === 0) return [];
  const needs = new Set(used);
  const lines: string[] = ["// ADR-058: runtime length helpers", ""];
  if (needs.has(LengthProperty.VALUE_BIT_LENGTH)) {
    lines.push(
      "/* .value_bit_length: an unsigned value's bits up to its highest 1 */",
      `static inline uint32_t ${LengthProperty.VALUE_BIT_LENGTH}(uint64_t value) {`,
      "    uint32_t bits = 0U;",
      "    uint64_t rest = value;",
      "    while (rest != 0U) {",
      "        bits++;",
      "        rest >>= 1U;",
      "    }",
      "    return bits;",
      "}",
      "",
    );
  }
  const signed = needs.has(LengthProperty.VALUE_CHAR_COUNT_SIGNED);
  if (signed || needs.has(LengthProperty.VALUE_CHAR_COUNT)) {
    lines.push(
      "/* .value_char_count: an integer's characters in decimal */",
      `static inline ${LengthProperty.CHAR_COUNT_C_TYPE} ${LengthProperty.VALUE_CHAR_COUNT}(uint64_t value) {`,
      `    ${LengthProperty.CHAR_COUNT_C_TYPE} chars = 1U;`,
      "    uint64_t rest = value;",
      "    while (rest >= 10U) {",
      "        chars++;",
      "        rest /= 10U;",
      "    }",
      "    return chars;",
      "}",
      "",
    );
  }
  if (signed) {
    lines.push(
      "/* A negative value's '-' is a character too. Its magnitude is taken in",
      " * uint64_t, so negating INT64_MIN is defined (C99 6.2.5p9) */",
      `static inline ${LengthProperty.CHAR_COUNT_C_TYPE} ${LengthProperty.VALUE_CHAR_COUNT_SIGNED}(int64_t value) {`,
      "    uint64_t magnitude = (value < 0) ? (0U - (uint64_t)value) : (uint64_t)value;",
      `    return ${LengthProperty.VALUE_CHAR_COUNT}(magnitude) + ((value < 0) ? 1U : 0U);`,
      "}",
      "",
    );
  }
  return lines;
};

/**
 * #2207: the copy a string written from another string goes through. It moves
 * one character at a time, so a source that is the target copies each
 * character onto itself, where `strncpy` with overlapping arguments is
 * undefined. Then it zero-fills to the capacity as `strncpy` does, so the
 * bytes past the terminator are the same however the value was spelled. The
 * source is walked by pointer, not indexed by the target's count, so cppcheck
 * does not read `capacity` as a bound on a shorter literal (#2207 review).
 */
const generateStringCopyHelper = (needed: boolean): string[] =>
  needed
    ? [
        ComplianceAnnotations.render(ComplianceAnnotations.STRING_SELF_COPY),
        `static inline void ${StringUtils.COPY_HELPER}(char* target, const char* source, uint32_t capacity) {`,
        "    const char* next = source;",
        "    uint32_t i = 0U;",
        "    while ((i < capacity) && (*next != '\\0')) {",
        "        target[i] = *next;",
        "        next++;",
        "        i++;",
        "    }",
        "    while (i < capacity) {",
        "        target[i] = '\\0';",
        "        i++;",
        "    }",
        "    target[capacity] = '\\0';",
        "}",
        "",
      ]
    : [];

const helperGenerators = {
  generateLengthHelpers,
  generateStringCopyHelper,
  generateOverflowHelpers,
  generateSafeDivHelpers,
  generateCastHelpers,
};

export default helperGenerators;
