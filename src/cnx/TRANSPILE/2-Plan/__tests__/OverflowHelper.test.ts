import { describe, it, expect } from "vitest";
import OverflowHelper from "../OverflowHelper";

describe("OverflowHelper.of (ADR-044)", () => {
  const nameOf = (
    behavior: "clamp" | "wrap",
    operator: string,
    cnxType: string,
  ): string | null =>
    OverflowHelper.of(behavior, operator, cnxType, null)?.name ?? null;

  it("saturates a clamp + - * of any integer", () => {
    expect(nameOf("clamp", "+", "u8")).toBe("cnx_clamp_add_u8");
    expect(nameOf("clamp", "-", "i16")).toBe("cnx_clamp_sub_i16");
    expect(nameOf("clamp", "*", "u32")).toBe("cnx_clamp_mul_u32");
  });

  it("leaves a wrap + - * to C", () => {
    expect(nameOf("wrap", "+", "u8")).toBeNull();
    expect(nameOf("wrap", "*", "i32")).toBeNull();
  });

  // #1790: C leaves MIN / -1 and MIN % -1 undefined
  it("routes a signed / and % through a helper under either modifier", () => {
    expect(nameOf("clamp", "/", "i32")).toBe("cnx_clamp_div_i32");
    expect(nameOf("clamp", "%", "i8")).toBe("cnx_clamp_mod_i8");
    expect(nameOf("wrap", "/", "i64")).toBe("cnx_wrap_div_i64");
    expect(nameOf("wrap", "%", "i16")).toBe("cnx_wrap_mod_i16");
  });

  // #1790 review: only MIN / -1 overflows, so a known divisor other than -1
  // keeps C's division
  it("leaves a signed / and % by a known divisor other than -1 to C", () => {
    expect(OverflowHelper.of("clamp", "/", "i32", 5)).toBeNull();
    expect(OverflowHelper.of("wrap", "%", "i8", 200)).toBeNull();
    expect(OverflowHelper.of("clamp", "/", "i32", -1)?.name).toBe(
      "cnx_clamp_div_i32",
    );
    expect(OverflowHelper.of("clamp", "*", "i32", 5)?.name).toBe(
      "cnx_clamp_mul_i32",
    );
  });

  it("leaves an unsigned / and % to C, which cannot overflow", () => {
    expect(nameOf("clamp", "/", "u32")).toBeNull();
    expect(nameOf("wrap", "%", "u8")).toBeNull();
  });

  it("plans no helper for a type that is not a cnx integer", () => {
    expect(nameOf("clamp", "+", "f32")).toBeNull();
    expect(nameOf("clamp", "/", "int_fast16_t")).toBeNull();
  });

  it("plans no helper for an operator outside + - * / %", () => {
    expect(nameOf("clamp", "<<", "u32")).toBeNull();
  });
});
