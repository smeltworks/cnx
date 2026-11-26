import { describe, expect, it } from "vitest";
import ConstQualifier from "../ConstQualifier";

describe("ConstQualifier", () => {
  it("writes const for a read-only binding of a plain type", () => {
    expect(ConstQualifier.prefix("uint32_t", true)).toBe("const ");
  });

  it("writes nothing for a mut binding", () => {
    expect(ConstQualifier.prefix("uint32_t", false)).toBe("");
  });

  it("writes nothing when the C type already spells const (#2311)", () => {
    expect(ConstQualifier.prefix("const char*", true)).toBe("");
  });

  it("reads const only as the leading qualifier", () => {
    expect(ConstQualifier.isSpelled("const char*")).toBe(true);
    expect(ConstQualifier.isSpelled("constant_t")).toBe(false);
    expect(ConstQualifier.isSpelled("char*")).toBe(false);
  });
});
