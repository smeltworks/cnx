import { describe, it, expect } from "vitest";
import cTypeName from "../cTypeName";
import type IStructKeywordFacts from "../types/IStructKeywordFacts";

const tagged = (...tags: string[]): IStructKeywordFacts => ({
  checkNeedsStructKeyword: (name) => tags.includes(name),
});

describe("cTypeName", () => {
  it("writes the struct keyword for a C tag with no typedef (#1944)", () => {
    expect(cTypeName("Point", tagged("Point"))).toBe("struct Point");
  });

  it("leaves a typedef'd or cnx struct bare", () => {
    expect(cTypeName("Motor", tagged("Point"))).toBe("Motor");
  });

  it("maps a primitive", () => {
    expect(cTypeName("u32", tagged())).toBe("uint32_t");
  });

  it("maps cstring to char* (ADR-046)", () => {
    expect(cTypeName("cstring", tagged())).toBe("char*");
  });
});
