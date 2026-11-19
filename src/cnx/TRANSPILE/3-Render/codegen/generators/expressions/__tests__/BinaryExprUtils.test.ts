import { describe, it, expect } from "vitest";
import BinaryExprUtils from "../BinaryExprUtils";

describe("BinaryExprUtils", () => {
  describe("tryParseNumericLiteral", () => {
    it("parses decimal integers", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("42")).toBe(42);
      expect(BinaryExprUtils.tryParseNumericLiteral("0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("123456")).toBe(123456);
    });

    it("parses negative decimal integers", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("-1")).toBe(-1);
      expect(BinaryExprUtils.tryParseNumericLiteral("-42")).toBe(-42);
    });

    it("parses hex literals (0x prefix)", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0xFF")).toBe(255);
      expect(BinaryExprUtils.tryParseNumericLiteral("0x0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("0xDEAD")).toBe(0xdead);
      expect(BinaryExprUtils.tryParseNumericLiteral("0Xff")).toBe(255);
    });

    it("parses binary literals (0b prefix)", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0b1010")).toBe(10);
      expect(BinaryExprUtils.tryParseNumericLiteral("0b0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("0B1111")).toBe(15);
    });

    it("trims whitespace", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("  42  ")).toBe(42);
      expect(BinaryExprUtils.tryParseNumericLiteral("\t0xFF\n")).toBe(255);
    });

    it("returns undefined for non-numeric strings", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("abc")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("x + 1")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("12.5")).toBeUndefined();
    });

    it("returns undefined for invalid hex/binary", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0xGG")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("0b123")).toBeUndefined();
    });
  });

  describe("mapEqualityOperator", () => {
    it("maps = to == (ADR-001)", () => {
      expect(BinaryExprUtils.mapEqualityOperator("=")).toBe("==");
    });

    it("preserves != unchanged", () => {
      expect(BinaryExprUtils.mapEqualityOperator("!=")).toBe("!=");
    });

    it("preserves other operators unchanged", () => {
      expect(BinaryExprUtils.mapEqualityOperator("<")).toBe("<");
      expect(BinaryExprUtils.mapEqualityOperator(">")).toBe(">");
      expect(BinaryExprUtils.mapEqualityOperator("<=")).toBe("<=");
      expect(BinaryExprUtils.mapEqualityOperator(">=")).toBe(">=");
    });
  });

  describe("generateStrcmpCode", () => {
    it("generates strcmp equality check", () => {
      expect(BinaryExprUtils.generateStrcmpCode("str1", "str2", "==")).toBe(
        "strcmp(str1, str2) == 0",
      );
    });

    it("generates strcmp inequality check", () => {
      expect(BinaryExprUtils.generateStrcmpCode("str1", "str2", "!=")).toBe(
        "strcmp(str1, str2) != 0",
      );
    });

    it("generates strcmp ordering checks (#1956)", () => {
      expect(BinaryExprUtils.generateStrcmpCode("a", "b", "<")).toBe(
        "strcmp(a, b) < 0",
      );
      expect(BinaryExprUtils.generateStrcmpCode("a", "b", ">=")).toBe(
        "strcmp(a, b) >= 0",
      );
    });

    it("handles complex expressions as operands", () => {
      expect(
        BinaryExprUtils.generateStrcmpCode("getName()", '"test"', "=="),
      ).toBe('strcmp(getName(), "test") == 0');
    });
  });

  // #1322: the `validateEnumComparison` tests that stood here are gone with the
  // method. ADR-017's comparison rule is E0434 in pass 2.1, asked of resolved
  // types rather than of four booleans a caller had already computed by
  // splitting the operands' source text. Covered by
  // `1-Analyze/__tests__/EnumTypeSafetyAnalyzer.test.ts`.
});
