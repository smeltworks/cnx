import { describe, it, expect } from "vitest";
import userCType from "../userCType";

describe("userCType", () => {
  it("maps cstring to const char* (#2311)", () => {
    expect(userCType("cstring", false)).toBe("const char*");
  });

  it("adds struct keyword when needed", () => {
    expect(userCType("MyStruct", true)).toBe("struct MyStruct");
  });

  it("returns type unchanged when struct keyword not needed", () => {
    expect(userCType("MyType", false)).toBe("MyType");
  });
});
