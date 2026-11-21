import { describe, expect, it } from "vitest";
import C_CPP_KEYWORDS from "../C_CPP_KEYWORDS";

describe("C_CPP_KEYWORDS", () => {
  it("holds C and C++ keywords", () => {
    expect(C_CPP_KEYWORDS.has("default")).toBe(true);
    expect(C_CPP_KEYWORDS.has("this")).toBe(true);
    expect(C_CPP_KEYWORDS.has("template")).toBe(true);
  });

  it("does not hold an ordinary name", () => {
    expect(C_CPP_KEYWORDS.has("DR")).toBe(false);
  });
});
