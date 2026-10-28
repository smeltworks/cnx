/**
 * Tests for generateBitmapHeader
 */

import generateBitmapHeader from "../generateBitmapHeader";
import IHeaderTypeInput from "../IHeaderTypeInput";
import type IBitmapFieldLayout from "../../../../../types/IBitmapFieldLayout";

/**
 * Creates a minimal IHeaderTypeInput with bitmap data populated
 */
function createInput(
  bitmapBackingType: Map<string, string>,
  bitmapFields?: Map<string, Map<string, IBitmapFieldLayout>>,
): IHeaderTypeInput {
  return {
    enumMembers: new Map(),
    memberCNames: new Map(),
    structFields: new Map(),
    structFieldDimensions: new Map(),
    bitmapBackingType,
    bitmapFields: bitmapFields ?? new Map(),
  };
}

describe("generateBitmapHeader", () => {
  describe("basic bitmap generation", () => {
    it("should generate typedef with backing type", () => {
      const backingTypes = new Map([["StatusFlags", "uint8_t"]]);
      const fields = new Map([
        [
          "StatusFlags",
          new Map([
            ["enabled", { offset: 0, width: 1 }],
            ["mode", { offset: 1, width: 2 }],
          ]),
        ],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("StatusFlags", input);

      expect(result).toContain("typedef uint8_t StatusFlags;");
    });

    it("should generate field layout comment", () => {
      const backingTypes = new Map([["Flags", "uint8_t"]]);
      const fields = new Map([
        [
          "Flags",
          new Map([
            ["a", { offset: 0, width: 1 }],
            ["b", { offset: 1, width: 3 }],
          ]),
        ],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("Flags", input);

      expect(result).toContain("/* Bitmap: Flags");
      expect(result).toContain(" */");
    });

    it("should handle different backing types", () => {
      const backingTypes = new Map([
        ["Small", "uint8_t"],
        ["Medium", "uint16_t"],
        ["Large", "uint32_t"],
      ]);
      const input = createInput(backingTypes);

      expect(generateBitmapHeader("Small", input)).toContain(
        "typedef uint8_t Small;",
      );
      expect(generateBitmapHeader("Medium", input)).toContain(
        "typedef uint16_t Medium;",
      );
      expect(generateBitmapHeader("Large", input)).toContain(
        "typedef uint32_t Large;",
      );
    });
  });

  describe("field layout documentation", () => {
    it("should format single-bit fields correctly", () => {
      const backingTypes = new Map([["SingleBits", "uint8_t"]]);
      const fields = new Map([
        [
          "SingleBits",
          new Map([
            ["flag0", { offset: 0, width: 1 }],
            ["flag1", { offset: 1, width: 1 }],
            ["flag7", { offset: 7, width: 1 }],
          ]),
        ],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("SingleBits", input);

      expect(result).toContain("flag0: bit 0");
      expect(result).toContain("flag1: bit 1");
      expect(result).toContain("flag7: bit 7");
      // Should NOT say "bits" for single-bit fields
      expect(result).not.toMatch(/flag0: bits/);
    });

    it("should format multi-bit fields with range", () => {
      const backingTypes = new Map([["MultiBits", "uint8_t"]]);
      const fields = new Map([
        [
          "MultiBits",
          new Map([
            ["mode", { offset: 0, width: 2 }],
            ["value", { offset: 2, width: 4 }],
          ]),
        ],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("MultiBits", input);

      expect(result).toContain("mode: bits 0-1 (2 bits)");
      expect(result).toContain("value: bits 2-5 (4 bits)");
    });

    it("should sort fields by offset", () => {
      const backingTypes = new Map([["Sorted", "uint8_t"]]);
      // Insert in non-sorted order
      const fields = new Map([
        [
          "Sorted",
          new Map([
            ["third", { offset: 4, width: 2 }],
            ["first", { offset: 0, width: 1 }],
            ["second", { offset: 1, width: 3 }],
          ]),
        ],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("Sorted", input);
      const lines = result.split("\n");

      // Find field lines and verify order
      const fieldLines = lines.filter(
        (l) => l.includes(":") && !l.includes("Bitmap"),
      );
      expect(fieldLines[0]).toContain("first");
      expect(fieldLines[1]).toContain("second");
      expect(fieldLines[2]).toContain("third");
    });
  });

  describe("missing bitmap handling", () => {
    it("should return comment when bitmap not found", () => {
      const input = createInput(new Map());

      const result = generateBitmapHeader("Unknown", input);

      expect(result).toBe(
        "/* Bitmap: Unknown (see implementation for layout) */",
      );
    });

    it("should handle bitmap with no fields", () => {
      const backingTypes = new Map([["NoFields", "uint8_t"]]);
      const input = createInput(backingTypes);

      const result = generateBitmapHeader("NoFields", input);

      expect(result).toContain("/* Bitmap: NoFields");
      expect(result).toContain("typedef uint8_t NoFields;");
    });
  });

  describe("edge cases", () => {
    it("should handle full-width single field", () => {
      const backingTypes = new Map([["FullByte", "uint8_t"]]);
      const fields = new Map([
        ["FullByte", new Map([["value", { offset: 0, width: 8 }]])],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("FullByte", input);

      expect(result).toContain("value: bits 0-7 (8 bits)");
    });

    it("should handle 32-bit bitmap", () => {
      const backingTypes = new Map([["Wide", "uint32_t"]]);
      const fields = new Map([
        [
          "Wide",
          new Map([
            ["low", { offset: 0, width: 16 }],
            ["high", { offset: 16, width: 16 }],
          ]),
        ],
      ]);
      const input = createInput(backingTypes, fields);

      const result = generateBitmapHeader("Wide", input);

      expect(result).toContain("typedef uint32_t Wide;");
      expect(result).toContain("low: bits 0-15 (16 bits)");
      expect(result).toContain("high: bits 16-31 (16 bits)");
    });
  });
});
