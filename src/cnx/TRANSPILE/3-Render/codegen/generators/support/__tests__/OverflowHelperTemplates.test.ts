/**
 * Unit tests for OverflowHelperTemplates
 */

import ClampTypes from "../../../../../2-Plan/ClampTypes";
import { describe, it, expect } from "vitest";
import OverflowHelperTemplates from "../OverflowHelperTemplates";

describe("OverflowHelperTemplates", () => {
  describe("resolveTypeInfo", () => {
    it("should resolve unsigned type info correctly", () => {
      const info = ClampTypes.resolve("u32");

      expect(info).not.toBeNull();
      expect(info?.cType).toBe("uint32_t");
      expect(info?.isUnsigned).toBe(true);
      expect(info?.useWiderArithmetic).toBe(false);
    });

    it("should resolve signed narrow type info with wider arithmetic", () => {
      const info = ClampTypes.resolve("i16");

      expect(info).not.toBeNull();
      expect(info?.cType).toBe("int16_t");
      expect(info?.isUnsigned).toBe(false);
      expect(info?.useWiderArithmetic).toBe(true);
    });

    it("should resolve i64 without wider arithmetic (widest type)", () => {
      const info = ClampTypes.resolve("i64");

      expect(info).not.toBeNull();
      expect(info?.cType).toBe("int64_t");
      expect(info?.isUnsigned).toBe(false);
      expect(info?.useWiderArithmetic).toBe(false);
    });

    it("should return null for invalid types", () => {
      const info = ClampTypes.resolve("invalid");
      expect(info).toBeNull();
    });
  });

  describe("generateClampHelper", () => {
    describe("unsigned types", () => {
      it("should generate add helper for u32", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "add",
          "u32",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_add_u32");
        expect(helper).toContain("(uint32_t)(a + (uint32_t)b)");
        expect(helper).toContain("return UINT32_MAX");
      });

      it("should generate sub helper for u32 with underflow protection", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "sub",
          "u32",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_sub_u32");
        expect(helper).toContain("return 0"); // Underflow clamps to 0
      });

      it("should generate mul helper for u32", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "mul",
          "u32",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_mul_u32");
        expect(helper).toContain("(uint32_t)(a * (uint32_t)b)");
      });
    });

    describe("signed narrow types (wider arithmetic)", () => {
      it("should generate add helper for i16 using wider type", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "add",
          "i16",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_add_i16");
        expect(helper).toContain("int32_t result"); // Uses wider type
        expect(helper).toContain("(int16_t)result"); // Cast back
      });

      it("should generate sub helper for i8 using wider type", () => {
        const helper = OverflowHelperTemplates.generateClampHelper("sub", "i8");

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_sub_i8");
        expect(helper).toContain("int32_t result"); // Uses wider type (i8 -> int32_t)
      });
    });

    describe("i64 (widest type)", () => {
      it("should generate add helper for i64 with manual checks", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "add",
          "i64",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_add_i64");
        expect(helper).toContain("if (b > 0 && a > INT64_MAX - b)");
        expect(helper).toContain("if (b < 0 && a < INT64_MIN - b)");
      });

      it("should generate mul helper for i64 with all quadrant checks", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "mul",
          "i64",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_mul_i64");
        expect(helper).toContain("a > 0 && b > 0");
        expect(helper).toContain("a < 0 && b < 0");
      });
    });

    it("should return null for invalid operation", () => {
      const helper = OverflowHelperTemplates.generateClampHelper("div", "u32");
      expect(helper).toBeNull();
    });
  });

  // #1790: ADR-044's table for MIN / -1 and MIN % -1
  describe("signed division", () => {
    // #1790 review: `b` is the wider type (#94), so a header macro divisor
    // past the type keeps its value, but the division itself stays in the
    // operand's width and an i32 never reaches a 64-bit library division
    it("clamps a quotient in its own width", () => {
      const helper = OverflowHelperTemplates.generateClampHelper("div", "i32");
      expect(helper).toContain(
        "static inline int32_t cnx_clamp_div_i32(int32_t a, int64_t b)",
      );
      expect(helper).toContain(
        "if (b == -1 && a == INT32_MIN) return INT32_MAX;",
      );
      expect(helper).toContain("return (int32_t)(a / (int32_t)b);");
      expect(helper).not.toContain("(int64_t)a");
    });

    it("gives the exact quotient of a divisor past the type", () => {
      const helper = OverflowHelperTemplates.generateClampHelper("div", "i8");
      expect(helper).toContain("if (b < INT8_MIN || b > INT8_MAX) {");
      expect(helper).toContain(
        "return (a == INT8_MIN && b == (int32_t)INT8_MAX + 1) ? -1 : 0;",
      );
    });

    it("gives the exact remainder of a divisor past the type", () => {
      const helper = OverflowHelperTemplates.generateClampHelper("mod", "i8");
      expect(helper).toContain(
        "return (a == INT8_MIN && b == (int32_t)INT8_MAX + 1) ? 0 : a;",
      );
    });

    it("wraps a narrow quotient to MIN", () => {
      const helper = OverflowHelperTemplates.generateWrapHelper("div", "i8");
      expect(helper).toContain("cnx_wrap_div_i8(int8_t a, int32_t b)");
      expect(helper).toContain(
        "if (b == -1 && a == INT8_MIN) return INT8_MIN;",
      );
    });

    it("gives a remainder by -1 of 0 under either modifier", () => {
      expect(
        OverflowHelperTemplates.generateClampHelper("mod", "i16"),
      ).toContain("if (b == -1) return 0;");
      expect(
        OverflowHelperTemplates.generateWrapHelper("mod", "i64"),
      ).toContain("if (b == -1) return 0;");
    });

    it("tests i64 the same way", () => {
      expect(
        OverflowHelperTemplates.generateClampHelper("div", "i64"),
      ).toContain("if (b == -1 && a == INT64_MIN) return INT64_MAX;");
      expect(
        OverflowHelperTemplates.generateWrapHelper("div", "i64"),
      ).toContain("if (b == -1 && a == INT64_MIN) return INT64_MIN;");
    });

    it("panics on the overflowing quotient in debug mode", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("div", "i32");
      expect(helper).toContain("PANIC: Integer overflow in i32 division");
    });

    it("writes no wrap helper for + - * or an unsigned type", () => {
      expect(
        OverflowHelperTemplates.generateWrapHelper("add", "i32"),
      ).toBeNull();
      expect(
        OverflowHelperTemplates.generateWrapHelper("div", "u32"),
      ).toBeNull();
    });
  });

  describe("generatePanicHelper", () => {
    it("should generate panic helper with fprintf and abort for u32", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("add", "u32");

      expect(helper).not.toBeNull();
      expect(helper).toContain('fprintf(stderr, "PANIC: Integer overflow');
      expect(helper).toContain("abort()");
    });

    it("should use underflow message for unsigned subtraction", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("sub", "u32");

      expect(helper).not.toBeNull();
      expect(helper).toContain("Integer underflow");
    });

    it("should generate panic helper for signed types", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("mul", "i32");

      expect(helper).not.toBeNull();
      expect(helper).toContain("cnx_clamp_mul_i32");
      expect(helper).toContain('fprintf(stderr, "PANIC:');
    });
  });

  describe("output consistency", () => {
    it("should produce consistent output for same inputs", () => {
      const helper1 = OverflowHelperTemplates.generateClampHelper("add", "u32");
      const helper2 = OverflowHelperTemplates.generateClampHelper("add", "u32");

      expect(helper1).toBe(helper2);
    });

    it("should produce different output for debug vs clamp mode", () => {
      const clampHelper = OverflowHelperTemplates.generateClampHelper(
        "add",
        "u32",
      );
      const panicHelper = OverflowHelperTemplates.generatePanicHelper(
        "add",
        "u32",
      );

      expect(clampHelper).not.toBe(panicHelper);
      expect(clampHelper).not.toContain("abort()");
      expect(panicHelper).toContain("abort()");
    });
  });
});
