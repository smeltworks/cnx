import { describe, it, expect } from "vitest";
import OverflowOperation from "../OverflowOperation";

describe("OverflowOperation.of (ADR-044)", () => {
  it("saturates a clamp + - * and leaves a wrap one to C", () => {
    expect(OverflowOperation.of("*", true, "clamp", null)).toBe("mul");
    expect(OverflowOperation.of("+", false, "clamp", 5)).toBe("add");
    expect(OverflowOperation.of("*", true, "wrap", null)).toBeUndefined();
  });

  // #1790: only a signed `/ %` overflows, at MIN / -1
  it("routes a signed / and % by an unknown or -1 divisor", () => {
    expect(OverflowOperation.of("/", true, "wrap", null)).toBe("div");
    expect(OverflowOperation.of("%", true, "clamp", -1)).toBe("mod");
    expect(OverflowOperation.of("/", false, "clamp", null)).toBeUndefined();
  });

  // #1790 review: 2.1 reads this too, so `SCALED_CALL / two` is E0812 there
  // as 2.2 plans it plain C
  it("leaves a / and % by a known divisor other than -1 to C", () => {
    expect(OverflowOperation.of("/", true, "clamp", 2)).toBeUndefined();
    expect(OverflowOperation.of("%", true, "wrap", 0)).toBeUndefined();
  });
});
