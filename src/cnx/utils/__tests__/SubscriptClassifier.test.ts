import { describe, it, expect } from "vitest";
import SubscriptClassifier from "../SubscriptClassifier";
import TTypeInfo from "../../types/TTypeInfo";

describe("SubscriptClassifier", () => {
  describe("classify", () => {
    describe("register access", () => {
      it("returns bit_range for a one-bit register access", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          length: 1,
          isRegisterAccess: true,
        });
        expect(result).toBe("bit_range");
      });

      it("returns bit_range for four-bit register access", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          length: 4,
          isRegisterAccess: true,
        });
        expect(result).toBe("bit_range");
      });
    });

    describe("array types", () => {
      it("returns array_element for array type with length 1", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });

      it("returns array_slice for array type with length 4", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 4,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_slice");
      });
    });

    describe("string types", () => {
      it("returns array_element for string type with length 1", () => {
        const typeInfo: TTypeInfo = {
          baseType: "string",
          bitWidth: 0,
          isArray: false,
          isConst: false,
          isString: true,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });
    });

    describe("parameter types (Issue #1100)", () => {
      // A parameter's array-ness is determined solely by its declared type
      // (isArray, from explicit `T[N]` syntax, ADR-006) — identical to local
      // variables. A parameter flag forcing array classification was the
      // Issue #579 heuristic, reverted by Issue #1100 because it broke ADR-007
      // bit-indexing for scalar parameters; the flag itself is gone (#1668
      // review: written for every parameter, read by nothing).
      it("returns bit_range for non-array parameter with [a], which is [a, 1]", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("bit_range");
      });

      it("returns bit_range for non-array parameter with length 4", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 4,
          isRegisterAccess: false,
        });
        expect(result).toBe("bit_range");
      });

      it("returns array_element for array parameter with length 1", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });
    });

    describe("scalar types (bit manipulation)", () => {
      it("returns bit_range for scalar integer with [a], which is [a, 1]", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("bit_range");
      });

      it("returns bit_range for scalar integer with length 4", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u16",
          bitWidth: 16,
          isArray: false,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          length: 4,
          isRegisterAccess: false,
        });
        expect(result).toBe("bit_range");
      });
    });

    describe("null type info", () => {
      it("returns array_element for null type with length 1 (safety default)", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          length: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });

      it("returns array_slice for null type with length 4 (safety default)", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          length: 4,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_slice");
      });
    });
  });

  describe("isArrayAccess", () => {
    it("returns true for null type info (safety default)", () => {
      expect(SubscriptClassifier.isArrayAccess(null)).toBe(true);
    });

    it("returns true for array type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(true);
    });

    it("returns true for string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "string",
        bitWidth: 0,
        isArray: false,
        isConst: false,
        isString: true,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(true);
    });

    it("returns false for non-array parameter type (Issue #1100)", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(false);
    });

    it("returns true for array parameter type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(true);
    });

    it("returns false for scalar non-parameter type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(false);
    });
  });

  describe("depthLimit", () => {
    it.each([
      ["u8", 0, 1],
      ["i64", 2, 3],
      ["f32", 0, 1],
      ["f64", 1, 2],
      ["bool", 0, 0],
      ["bool", 2, 2],
      ["char", 0, 0],
      ["char", 1, 1],
    ])("%s with %i dimension(s) takes %i subscript(s)", (type, dims, limit) => {
      expect(SubscriptClassifier.depthLimit(type, dims)).toBe(limit);
    });

    it.each(["string", "Point", "EColor"])("does not measure %s", (type) => {
      expect(SubscriptClassifier.depthLimit(type, 1)).toBeNull();
    });
  });

  describe("fieldDepthLimit", () => {
    it.each([
      [1, 0],
      [3, 1],
      [8, 1],
    ])("a %i-bit field takes %i subscript(s)", (width, limit) => {
      expect(SubscriptClassifier.fieldDepthLimit(width)).toBe(limit);
    });
  });
});
