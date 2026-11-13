/**
 * Overflow Helper Templates
 *
 * Template-based generation for overflow-safe arithmetic helpers.
 * Reduces duplication between clamp (release) and panic (debug) modes
 * by extracting common type resolution and function structure.
 *
 * Issue #707: Extracted from HelperGenerator.ts to reduce code duplication.
 */

import ClampTypes from "../../../../2-Plan/ClampTypes";
import type IClampTypeInfo from "../../../../2-Plan/types/IClampTypeInfo";
import ReservedCnxName from "../../../../../utils/ReservedCnxName";
import type TOverflowBehavior from "../../../../../types/TOverflowBehavior";

// C newline escape for generated fprintf statements (S7780: use raw string)
const C_NEWLINE = String.raw`\n`;

/**
 * Generate function signature
 */
function generateSignature(
  operation: string,
  info: IClampTypeInfo,
  bParamType?: string,
  behavior: TOverflowBehavior = "clamp",
): string {
  const paramB = bParamType ?? info.cType;
  return `static inline ${info.cType} ${ReservedCnxName.overflowHelper(behavior, operation, info.cnxType)}(${info.cType} a, ${paramB} b)`;
}

/**
 * Generate panic block for debug mode
 */
function generatePanicBlock(cnxType: string, opName: string): string {
  return `        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}${C_NEWLINE}");
        abort();`;
}

// Operation names for panic messages
const OPERATION_NAMES: Record<string, string> = {
  add: "addition",
  sub: "subtraction",
  mul: "multiplication",
  div: "division",
};

const MIN_BY_MINUS_ONE_COMMENT =
  "    /* ADR-044 / Issue #1790: C leaves MIN / -1 and MIN % -1 undefined, and x86 traps on them. */";

/**
 * Templates for unsigned clamp operations.
 *
 * Issue #94: the wide-operand check runs in the wider type, so it also
 * prevents the narrowing cast below from truncating.
 *
 * Issue #1143: these previously called __builtin_add_overflow /
 * __builtin_sub_overflow / __builtin_mul_overflow after the wide-operand
 * check. That call was unreachable -- the check is already a complete
 * overflow test, so the builtin's condition could never be true (verified
 * over 58,903,538 cases: u8 exhaustive, u16 exhaustive, u32/u64
 * boundary-biased; the branch fired zero times). It was introduced by #238
 * as a value-range hint for -Wstringop-overflow, but it does not suppress
 * that diagnostic either: with and without it, GCC emits identical
 * -Wstringop-overflow and -Warray-bounds output. Removing it drops a
 * GCC 5+ / Clang 3.8+ requirement from generated code, which is otherwise
 * C99, and shrinks these helpers by ~30% at -Os on Cortex-M4.
 */
class UnsignedClampTemplates {
  static add(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("add", info, info.widerType);
    const opName = OPERATION_NAMES.add;

    if (debugMode) {
      return `${sig} {
    if (b > (${info.widerType})(${info.maxValue} - a)) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return (${info.cType})(a + (${info.cType})b);
}`;
    }

    return `${sig} {
    if (b > (${info.widerType})(${info.maxValue} - a)) return ${info.maxValue};
    return (${info.cType})(a + (${info.cType})b);
}`;
  }

  static sub(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("sub", info, info.widerType);
    const opName = OPERATION_NAMES.sub;
    // Use "underflow" message for unsigned subtraction
    const panicMsg = `Integer underflow in ${info.cnxType} ${opName}`;

    if (debugMode) {
      return `${sig} {
    if (b > (${info.widerType})a) {
        fprintf(stderr, "PANIC: ${panicMsg}${C_NEWLINE}");
        abort();
    }
    return (${info.cType})(a - (${info.cType})b);
}`;
    }

    // Use > (not >=) since b == a is in range and yields 0 from the subtraction
    return `${sig} {
    if (b > (${info.widerType})a) return 0;
    return (${info.cType})(a - (${info.cType})b);
}`;
  }

  static mul(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("mul", info, info.widerType);
    const opName = OPERATION_NAMES.mul;

    if (debugMode) {
      return `${sig} {
    if (b != 0 && a > ${info.maxValue} / b) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return (${info.cType})(a * (${info.cType})b);
}`;
    }

    return `${sig} {
    if (b != 0 && a > ${info.maxValue} / b) return ${info.maxValue};
    return (${info.cType})(a * (${info.cType})b);
}`;
  }
}

/**
 * Templates for signed narrow types using wider arithmetic
 * Issue #94: Compute in wider type, then clamp to avoid UB
 */
class SignedWiderTemplates {
  static add(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("add", info, info.widerType);
    const opName = OPERATION_NAMES.add;

    if (debugMode) {
      return `${sig} {
    ${info.widerType} result = (${info.widerType})a + b;
    if (result > ${info.maxValue} || result < ${info.minValue}) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return (${info.cType})result;
}`;
    }

    return `${sig} {
    ${info.widerType} result = (${info.widerType})a + b;
    if (result > ${info.maxValue}) return ${info.maxValue};
    if (result < ${info.minValue}) return ${info.minValue};
    return (${info.cType})result;
}`;
  }

  static sub(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("sub", info, info.widerType);
    const opName = OPERATION_NAMES.sub;

    if (debugMode) {
      return `${sig} {
    ${info.widerType} result = (${info.widerType})a - b;
    if (result > ${info.maxValue} || result < ${info.minValue}) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return (${info.cType})result;
}`;
    }

    return `${sig} {
    ${info.widerType} result = (${info.widerType})a - b;
    if (result > ${info.maxValue}) return ${info.maxValue};
    if (result < ${info.minValue}) return ${info.minValue};
    return (${info.cType})result;
}`;
  }

  static mul(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("mul", info, info.widerType);
    const opName = OPERATION_NAMES.mul;

    if (debugMode) {
      return `${sig} {
    ${info.widerType} result = (${info.widerType})a * b;
    if (result > ${info.maxValue} || result < ${info.minValue}) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return (${info.cType})result;
}`;
    }

    return `${sig} {
    ${info.widerType} result = (${info.widerType})a * b;
    if (result > ${info.maxValue}) return ${info.maxValue};
    if (result < ${info.minValue}) return ${info.minValue};
    return (${info.cType})result;
}`;
  }
}

/**
 * Templates for i64 (widest type) using manual overflow checks
 */
class SignedWidestTemplates {
  static add(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("add", info);
    const opName = OPERATION_NAMES.add;

    if (debugMode) {
      return `${sig} {
    if ((b > 0 && a > ${info.maxValue} - b) || (b < 0 && a < ${info.minValue} - b)) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return a + b;
}`;
    }

    return `${sig} {
    if (b > 0 && a > ${info.maxValue} - b) return ${info.maxValue};
    if (b < 0 && a < ${info.minValue} - b) return ${info.minValue};
    return a + b;
}`;
  }

  static sub(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("sub", info);
    const opName = OPERATION_NAMES.sub;

    if (debugMode) {
      return `${sig} {
    if ((b < 0 && a > ${info.maxValue} + b) || (b > 0 && a < ${info.minValue} + b)) {
${generatePanicBlock(info.cnxType, opName)}
    }
    return a - b;
}`;
    }

    return `${sig} {
    if (b < 0 && a > ${info.maxValue} + b) return ${info.maxValue};
    if (b > 0 && a < ${info.minValue} + b) return ${info.minValue};
    return a - b;
}`;
  }

  static mul(info: IClampTypeInfo, debugMode: boolean): string {
    const sig = generateSignature("mul", info);
    const opName = OPERATION_NAMES.mul;

    if (debugMode) {
      return `${sig} {
    if (a != 0 && b != 0) {
        if ((a > 0 && b > 0 && a > ${info.maxValue} / b) ||
            (a < 0 && b < 0 && a < ${info.maxValue} / b) ||
            (a > 0 && b < 0 && b < ${info.minValue} / a) ||
            (a < 0 && b > 0 && a < ${info.minValue} / b)) {
${generatePanicBlock(info.cnxType, opName)}
        }
    }
    return a * b;
}`;
    }

    return `${sig} {
    if (a == 0 || b == 0) return 0;
    if (a > 0 && b > 0 && a > ${info.maxValue} / b) return ${info.maxValue};
    if (a < 0 && b < 0 && a < ${info.maxValue} / b) return ${info.maxValue};
    if (a > 0 && b < 0 && b < ${info.minValue} / a) return ${info.minValue};
    if (a < 0 && b > 0 && a < ${info.minValue} / b) return ${info.minValue};
    return a * b;
}`;
  }
}

/**
 * ADR-044 (#1790): a signed `/` and `%`, the one case of each that overflows
 * being `MIN / -1`. `clamp` gives MAX, `wrap` gives MIN, and the remainder is
 * 0 under either. Every type tests the case in its own width, so an i32
 * divides in 32 bits rather than through a 64-bit library division on the
 * embedded targets (#1790 review). `b` is the operand type: 2.2 plans no
 * helper for a known divisor other than -1, and a wider run-time divisor is
 * E0869.
 */
class SignedDivisionTemplates {
  static div(
    info: IClampTypeInfo,
    behavior: TOverflowBehavior,
    debugMode: boolean,
  ): string {
    const onOverflow =
      behavior === "wrap"
        ? `return ${info.minValue};`
        : debugMode
          ? `{
${generatePanicBlock(info.cnxType, OPERATION_NAMES.div)}
    }`
          : `return ${info.maxValue};`;
    const sig = generateSignature("div", info, undefined, behavior);
    return `${sig} {
${MIN_BY_MINUS_ONE_COMMENT}
    if (b == -1 && a == ${info.minValue}) ${onOverflow}
    return (${info.cType})(a / b);
}`;
  }

  static mod(info: IClampTypeInfo, behavior: TOverflowBehavior): string {
    const sig = generateSignature("mod", info, undefined, behavior);
    return `${sig} {
${MIN_BY_MINUS_ONE_COMMENT}
    if (b == -1) return 0;
    return (${info.cType})(a % b);
}`;
  }
}

/**
 * Generate an overflow helper function for the given operation and type
 *
 * @param operation - The arithmetic operation (add, sub, mul, div, mod)
 * @param cnxType - The cnx type (u8, i32, etc.)
 * @param debugMode - If true, generate panic helpers; otherwise, clamp helpers
 * @returns The generated helper function or null if type is invalid
 */
function generateHelper(
  operation: string,
  cnxType: string,
  debugMode: boolean,
  behavior: TOverflowBehavior = "clamp",
): string | null {
  const info = ClampTypes.resolve(cnxType);
  if (!info) {
    return null;
  }

  if (!info.isUnsigned && operation === "div") {
    return SignedDivisionTemplates.div(info, behavior, debugMode);
  }
  if (!info.isUnsigned && operation === "mod") {
    return SignedDivisionTemplates.mod(info, behavior);
  }
  if (behavior === "wrap") {
    return null;
  }

  // Select template based on type characteristics
  if (info.isUnsigned) {
    switch (operation) {
      case "add":
        return UnsignedClampTemplates.add(info, debugMode);
      case "sub":
        return UnsignedClampTemplates.sub(info, debugMode);
      case "mul":
        return UnsignedClampTemplates.mul(info, debugMode);
      default:
        return null;
    }
  } else if (info.useWiderArithmetic) {
    switch (operation) {
      case "add":
        return SignedWiderTemplates.add(info, debugMode);
      case "sub":
        return SignedWiderTemplates.sub(info, debugMode);
      case "mul":
        return SignedWiderTemplates.mul(info, debugMode);
      default:
        return null;
    }
  } else {
    // i64: widest signed type
    switch (operation) {
      case "add":
        return SignedWidestTemplates.add(info, debugMode);
      case "sub":
        return SignedWidestTemplates.sub(info, debugMode);
      case "mul":
        return SignedWidestTemplates.mul(info, debugMode);
      default:
        return null;
    }
  }
}

/**
 * Overflow Helper Templates API
 */
class OverflowHelperTemplates {
  /**
   * Generate a clamp helper (returns boundary value on overflow)
   */
  static generateClampHelper(
    operation: string,
    cnxType: string,
  ): string | null {
    return generateHelper(operation, cnxType, false);
  }

  /**
   * ADR-044 (#1790): a `wrap` helper, the two's-complement result where C
   * leaves it undefined. It has no panic body: under `--debug` 2.2 plans a
   * `wrap` operation as a `clamp` one, whose helper panics (#2408).
   */
  static generateWrapHelper(operation: string, cnxType: string): string | null {
    return generateHelper(operation, cnxType, false, "wrap");
  }

  /**
   * Generate a panic helper (calls abort on overflow)
   */
  static generatePanicHelper(
    operation: string,
    cnxType: string,
  ): string | null {
    return generateHelper(operation, cnxType, true);
  }
}

export default OverflowHelperTemplates;
