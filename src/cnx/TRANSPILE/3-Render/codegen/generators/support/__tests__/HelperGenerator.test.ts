import type IPlannedSafeDivision from "../../../../../../types/IPlannedSafeDivision";
import type IPlannedOverflowHelper from "../../../../../../types/IPlannedOverflowHelper";
import ReservedCnxName from "../../../../../../utils/ReservedCnxName";
import { describe, expect, it } from "vitest";
import helperGenerators from "../HelperGenerator";

/** ADR-044 helpers as 2.2 plans them, from `"add_u8"`-style keys */
const overflowHelpers = (
  clamp: readonly string[],
  wrap: readonly string[] = [],
): IPlannedOverflowHelper[] =>
  [
    ...clamp.map((key) => ["clamp", key] as const),
    ...wrap.map((key) => ["wrap", key] as const),
  ].map(([behavior, key]) => {
    const [operation, cnxType] = key.split("_");
    return {
      name: ReservedCnxName.overflowHelper(behavior, operation, cnxType),
      behavior,
      operation,
      cnxType,
    };
  });

const { generateOverflowHelpers, generateSafeDivHelpers, generateCastHelpers } =
  helperGenerators;

/** ADR-051 helpers that divide in plain C, from `"div_u8"`-style keys */
const safeHelpers = (keys: readonly string[]): IPlannedSafeDivision[] =>
  keys.map((key) => {
    const [operation, cnxType] = key.split("_");
    return {
      name: `cnx_safe_${key}`,
      operation: operation as "div" | "mod",
      cnxType,
      inner: null,
    };
  });

describe("HelperGenerator - generateOverflowHelpers", () => {
  describe("empty input", () => {
    it("returns empty array for empty set", () => {
      const result = generateOverflowHelpers(overflowHelpers([]), false);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty set in debug mode", () => {
      const result = generateOverflowHelpers(overflowHelpers([]), true);
      expect(result).toEqual([]);
    });
  });

  describe("unsigned types - clamp mode", () => {
    it("generates u8 add helper", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_u8"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_add_u8");
      expect(result.join("\n")).toContain("(uint8_t)(a + (uint8_t)b)");
      expect(result.join("\n")).toContain("uint8_t");
      expect(result.join("\n")).toContain("return UINT8_MAX");
    });

    it("generates u16 sub helper", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["sub_u16"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_sub_u16");
      expect(result.join("\n")).toContain("(uint16_t)(a - (uint16_t)b)");
      expect(result.join("\n")).toContain("uint16_t");
      expect(result.join("\n")).toContain("return 0");
    });

    it("generates u32 mul helper", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["mul_u32"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_mul_u32");
      expect(result.join("\n")).toContain("(uint32_t)(a * (uint32_t)b)");
      expect(result.join("\n")).toContain("uint32_t");
    });

    it("generates u64 add helper", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_u64"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_add_u64");
      expect(result.join("\n")).toContain("uint64_t");
      expect(result.join("\n")).toContain("UINT64_MAX");
    });
  });

  describe("signed types - clamp mode", () => {
    it("generates i8 add helper with wider arithmetic", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_i8"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_add_i8");
      expect(result.join("\n")).toContain("int8_t");
      // i8 uses wider arithmetic (i16 or i32)
      expect(result.join("\n")).toContain("INT8_MAX");
      expect(result.join("\n")).toContain("INT8_MIN");
    });

    it("generates i16 sub helper with wider arithmetic", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["sub_i16"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_sub_i16");
      expect(result.join("\n")).toContain("int16_t");
    });

    it("generates i32 mul helper with wider arithmetic", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["mul_i32"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_mul_i32");
      expect(result.join("\n")).toContain("int32_t");
    });

    it("generates i64 add helper with direct check (no wider type)", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_i64"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_add_i64");
      expect(result.join("\n")).toContain("int64_t");
      expect(result.join("\n")).toContain("INT64_MAX");
      expect(result.join("\n")).toContain("INT64_MIN");
      // i64 doesn't use builtin - uses direct checks
      expect(result.join("\n")).toContain("return a + b");
    });

    it("generates i64 sub helper with direct check", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["sub_i64"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_sub_i64");
      expect(result.join("\n")).toContain("return a - b");
    });

    it("generates i64 mul helper with direct check", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["mul_i64"]),
        false,
      );
      expect(result.join("\n")).toContain("cnx_clamp_mul_i64");
      expect(result.join("\n")).toContain("return a * b");
    });
  });

  describe("debug mode", () => {
    it("includes stdio and stdlib headers", () => {
      const result = generateOverflowHelpers(overflowHelpers(["add_u8"]), true);
      expect(result.join("\n")).toContain("#include <stdio.h>");
      expect(result.join("\n")).toContain("#include <stdlib.h>");
    });

    it("generates panic on overflow for unsigned add", () => {
      const result = generateOverflowHelpers(overflowHelpers(["add_u8"]), true);
      expect(result.join("\n")).toContain("fprintf(stderr");
      expect(result.join("\n")).toContain("PANIC");
      expect(result.join("\n")).toContain("abort()");
    });

    it("generates panic on underflow for unsigned sub", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["sub_u16"]),
        true,
      );
      expect(result.join("\n")).toContain("underflow");
      expect(result.join("\n")).toContain("abort()");
    });

    it("generates panic for signed overflow", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_i32"]),
        true,
      );
      expect(result.join("\n")).toContain("PANIC");
      expect(result.join("\n")).toContain("overflow");
    });

    it("generates panic for i64 operations", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["mul_i64"]),
        true,
      );
      expect(result.join("\n")).toContain("fprintf(stderr");
      expect(result.join("\n")).toContain("abort()");
    });
  });

  describe("multiple operations", () => {
    it("generates multiple helpers in sorted order", () => {
      const ops = overflowHelpers(["mul_u32", "add_u8", "sub_u16"]);
      const result = generateOverflowHelpers(ops, false);
      const code = result.join("\n");

      // Should have all three
      expect(code).toContain("cnx_clamp_add_u8");
      expect(code).toContain("cnx_clamp_mul_u32");
      expect(code).toContain("cnx_clamp_sub_u16");

      // Verify sorted order (add_u8 before mul_u32 before sub_u16)
      const addIndex = code.indexOf("cnx_clamp_add_u8");
      const mulIndex = code.indexOf("cnx_clamp_mul_u32");
      const subIndex = code.indexOf("cnx_clamp_sub_u16");
      expect(addIndex).toBeLessThan(mulIndex);
      expect(mulIndex).toBeLessThan(subIndex);
    });

    it("includes limits.h header", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_u8"]),
        false,
      );
      expect(result.join("\n")).toContain("#include <limits.h>");
    });
  });

  describe("invalid operations", () => {
    it("skips unknown operations", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["unknown_u8"]),
        false,
      );
      // Should still have header but no helper functions
      expect(result.join("\n")).toContain("#include <limits.h>");
      expect(result.join("\n")).not.toContain("cnx_clamp_unknown");
    });

    it("skips unknown types", () => {
      const result = generateOverflowHelpers(
        overflowHelpers(["add_float"]),
        false,
      );
      expect(result.join("\n")).not.toContain("cnx_clamp_add_float");
    });
  });
});

describe("HelperGenerator - generateSafeDivHelpers", () => {
  describe("empty input", () => {
    it("returns empty array for empty set", () => {
      const result = generateSafeDivHelpers([]);
      expect(result).toEqual([]);
    });
  });

  describe("div helpers", () => {
    it("generates u8 div helper", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_u8"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u8");
      expect(code).toContain("uint8_t");
      expect(code).toContain("divisor == 0");
      expect(code).toContain("return true");
      expect(code).toContain("return false");
    });

    it("generates i32 div helper", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_i32"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_i32");
      expect(code).toContain("int32_t");
    });

    it("generates u64 div helper", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_u64"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u64");
      expect(code).toContain("uint64_t");
    });
  });

  describe("mod helpers", () => {
    it("generates u16 mod helper", () => {
      const result = generateSafeDivHelpers(safeHelpers(["mod_u16"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_mod_u16");
      expect(code).toContain("uint16_t");
      expect(code).toContain("numerator % divisor");
    });

    it("generates i64 mod helper", () => {
      const result = generateSafeDivHelpers(safeHelpers(["mod_i64"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_mod_i64");
      expect(code).toContain("int64_t");
    });
  });

  describe("multiple helpers", () => {
    it("generates both div and mod for same type", () => {
      const result = generateSafeDivHelpers(
        safeHelpers(["div_u32", "mod_u32"]),
      );
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u32");
      expect(code).toContain("cnx_safe_mod_u32");
    });

    it("generates helpers for multiple types", () => {
      const result = generateSafeDivHelpers(
        safeHelpers(["div_u8", "div_i32", "mod_u64"]),
      );
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u8");
      expect(code).toContain("cnx_safe_div_i32");
      expect(code).toContain("cnx_safe_mod_u64");
    });

    it("does not emit its own stdbool.h include (#1108)", () => {
      // The <stdbool.h> dependency is signalled via requireInclude("stdbool")
      // when the safe-div effect is applied, so it flows through the single
      // addAutoIncludes path. The helper must not emit a duplicate include.
      const result = generateSafeDivHelpers(safeHelpers(["div_u8"]));
      expect(result.join("\n")).not.toContain("#include <stdbool.h>");
    });

    it("divides a signed quotient through its ADR-044 helper (#1790)", () => {
      const code = generateSafeDivHelpers([
        {
          name: "cnx_safe_wrap_div_i32",
          operation: "div",
          cnxType: "i32",
          inner: "cnx_wrap_div_i32",
        },
      ]).join("\n");
      expect(code).toContain("cnx_safe_wrap_div_i32(int32_t* output");
      expect(code).toContain("*output = cnx_wrap_div_i32(numerator, divisor);");
    });

    it("includes ADR-051 comment", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_u8"]));
      expect(result.join("\n")).toContain("ADR-051");
    });
  });

  describe("output pointer pattern", () => {
    it("uses output pointer for result", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_u32"]));
      const code = result.join("\n");
      expect(code).toContain("uint32_t* output");
      expect(code).toContain("*output = numerator / divisor");
    });

    it("sets default value on error", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_u32"]));
      const code = result.join("\n");
      expect(code).toContain("defaultValue");
      expect(code).toContain("*output = defaultValue");
    });
  });

  describe("skip unused types", () => {
    it("only generates requested type helpers", () => {
      const result = generateSafeDivHelpers(safeHelpers(["div_u8"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u8");
      expect(code).not.toContain("cnx_safe_div_u16");
      expect(code).not.toContain("cnx_safe_div_u32");
      expect(code).not.toContain("cnx_safe_mod_u8");
    });
  });
});

// #1668: a saturating cast whose operand has a side effect calls a helper, so
// the operand -- its parameter -- is evaluated once
describe("generateCastHelpers", () => {
  it("emits nothing when no cast needs one", () => {
    expect(generateCastHelpers([], false)).toEqual([]);
  });

  it("emits one helper per pair, the bounded ternary over its parameter", () => {
    const code = generateCastHelpers(["f32_u8", "f64_i16"], false).join("\n");
    expect(code).toContain(
      "static inline uint8_t cnx_cast_sat_f32_u8(float value) {",
    );
    expect(code).toContain(
      "static inline int16_t cnx_cast_sat_f64_i16(double value) {",
    );
    expect(code).toContain(
      "return ((value) >= ((float)UINT8_MAX) ? (uint8_t)UINT8_MAX : (value) < 0.0f ? (uint8_t)0 : (uint8_t)(value));",
    );
  });

  it("spells the casts static_cast in C++", () => {
    const code = generateCastHelpers(["f32_u8"], true).join("\n");
    expect(code).toContain("static_cast<uint8_t>(UINT8_MAX)");
    expect(code).not.toContain("(uint8_t)UINT8_MAX");
  });
});
