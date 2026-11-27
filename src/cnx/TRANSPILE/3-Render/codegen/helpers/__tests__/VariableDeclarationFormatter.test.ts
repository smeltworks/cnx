/**
 * Unit tests for VariableDeclarationFormatter.
 *
 * Tests the stateless variable declaration formatting used by both
 * CodeGenerator and HeaderGeneratorUtils.
 */

import { describe, expect, it } from "vitest";
import VariableDeclarationFormatter from "../VariableDeclarationFormatter";
import type IVariableFormatInput from "../../types/IVariableFormatInput";

describe("VariableDeclarationFormatter", () => {
  describe("format", () => {
    it("formats simple variable declaration", () => {
      const input: IVariableFormatInput = {
        name: "counter",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "uint32_t counter",
      );
    });

    it("formats const variable", () => {
      const input: IVariableFormatInput = {
        name: "MAX_SIZE",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: true,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "const uint32_t MAX_SIZE",
      );
    });

    it("adds no second const to a read-only cstring (#2311)", () => {
      const input: IVariableFormatInput = {
        name: "c_label",
        cnxType: "cstring",
        mappedType: "const char*",
        modifiers: {
          isConst: true,
          isAtomic: false,
          isVolatile: false,
          isExtern: true,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "extern const char* c_label",
      );
    });

    it("formats extern variable", () => {
      const input: IVariableFormatInput = {
        name: "globalCounter",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: true,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "extern uint32_t globalCounter",
      );
    });

    it("formats extern const variable with correct ordering", () => {
      const input: IVariableFormatInput = {
        name: "MAX_SIZE",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: true,
          isAtomic: false,
          isVolatile: false,
          isExtern: true,
        },
      };

      // Order should be: extern volatile const (volatile before const)
      expect(VariableDeclarationFormatter.format(input)).toBe(
        "extern const uint32_t MAX_SIZE",
      );
    });

    it("formats atomic variable (maps to volatile)", () => {
      const input: IVariableFormatInput = {
        name: "sharedCounter",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: false,
          isAtomic: true,
          isVolatile: false,
          isExtern: false,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "volatile uint32_t sharedCounter",
      );
    });

    it("formats volatile variable", () => {
      const input: IVariableFormatInput = {
        name: "hwRegister",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: true,
          isExtern: false,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "volatile uint32_t hwRegister",
      );
    });

    it("formats extern volatile const with all modifiers", () => {
      const input: IVariableFormatInput = {
        name: "ROM_DATA",
        cnxType: "u32",
        mappedType: "uint32_t",
        modifiers: {
          isConst: true,
          isAtomic: false,
          isVolatile: true,
          isExtern: true,
        },
      };

      // Order: extern volatile const (volatile before const)
      expect(VariableDeclarationFormatter.format(input)).toBe(
        "extern volatile const uint32_t ROM_DATA",
      );
    });

    it("formats array variable with single dimension", () => {
      const input: IVariableFormatInput = {
        name: "buffer",
        cnxType: "u8",
        mappedType: "uint8_t",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
        arrayDimensions: ["256"],
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "uint8_t buffer[256]",
      );
    });

    it("formats array variable with multiple dimensions", () => {
      const input: IVariableFormatInput = {
        name: "matrix",
        cnxType: "u8",
        mappedType: "uint8_t",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
        arrayDimensions: ["4", "4"],
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "uint8_t matrix[4][4]",
      );
    });

    it("formats string<N> variable with embedded dimension", () => {
      const input: IVariableFormatInput = {
        name: "greeting",
        cnxType: "string<32>",
        mappedType: "char[33]", // string<32> maps to char[33]
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
      };

      // Embedded dimension should come after variable name
      expect(VariableDeclarationFormatter.format(input)).toBe(
        "char greeting[33]",
      );
    });

    it("formats string<N> array with additional dimensions first", () => {
      const input: IVariableFormatInput = {
        name: "names",
        cnxType: "string<32>",
        mappedType: "char[33]",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
        arrayDimensions: ["5"],
      };

      // Additional dims first, then embedded dim
      expect(VariableDeclarationFormatter.format(input)).toBe(
        "char names[5][33]",
      );
    });

    it("formats const string<N> array for header extern", () => {
      const input: IVariableFormatInput = {
        name: "messages",
        cnxType: "string<64>",
        mappedType: "char[65]",
        modifiers: {
          isConst: true,
          isAtomic: false,
          isVolatile: false,
          isExtern: true,
        },
        arrayDimensions: ["10"],
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "extern const char messages[10][65]",
      );
    });

    it("formats user-defined type variable", () => {
      const input: IVariableFormatInput = {
        name: "point",
        cnxType: "Point",
        mappedType: "Point",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        },
      };

      expect(VariableDeclarationFormatter.format(input)).toBe("Point point");
    });

    it("handles enum dimension identifiers", () => {
      const input: IVariableFormatInput = {
        name: "colors",
        cnxType: "u8",
        mappedType: "uint8_t",
        modifiers: {
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: true,
        },
        arrayDimensions: ["EColor_COUNT"],
      };

      expect(VariableDeclarationFormatter.format(input)).toBe(
        "extern uint8_t colors[EColor_COUNT]",
      );
    });
  });

  describe("buildModifierPrefix", () => {
    it("returns empty string for no modifiers", () => {
      expect(
        VariableDeclarationFormatter.buildModifierPrefix({
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        }),
      ).toBe("");
    });

    it("builds single modifier", () => {
      expect(
        VariableDeclarationFormatter.buildModifierPrefix({
          isConst: true,
          isAtomic: false,
          isVolatile: false,
          isExtern: false,
        }),
      ).toBe("const ");
    });

    it("builds multiple modifiers in correct order", () => {
      // Order: extern volatile const (volatile before const)
      expect(
        VariableDeclarationFormatter.buildModifierPrefix({
          isConst: true,
          isAtomic: true,
          isVolatile: false,
          isExtern: true,
        }),
      ).toBe("extern volatile const ");
    });
  });

  describe("buildArrayDimensions", () => {
    it("returns empty string for undefined dimensions", () => {
      expect(VariableDeclarationFormatter.buildArrayDimensions(undefined)).toBe(
        "",
      );
    });

    it("returns empty string for empty array", () => {
      expect(VariableDeclarationFormatter.buildArrayDimensions([])).toBe("");
    });

    it("formats single dimension", () => {
      expect(VariableDeclarationFormatter.buildArrayDimensions(["10"])).toBe(
        "[10]",
      );
    });

    it("formats multiple dimensions", () => {
      expect(
        VariableDeclarationFormatter.buildArrayDimensions(["10", "20", "30"]),
      ).toBe("[10][20][30]");
    });
  });
});
