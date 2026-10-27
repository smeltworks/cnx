/**
 * Tests for generateStructHeader
 */

import generateStructHeader from "../generateStructHeader";
import IHeaderTypeInput from "../IHeaderTypeInput";

/**
 * Creates a minimal IHeaderTypeInput with struct fields populated
 */
function createInput(
  structFields: Map<string, Map<string, string>>,
  structFieldDimensions?: Map<string, Map<string, readonly number[]>>,
): IHeaderTypeInput {
  return {
    enumMembers: new Map(),
    memberCNames: new Map(),
    structFields,
    structFieldDimensions: structFieldDimensions ?? new Map(),
    bitmapBackingType: new Map(),
    bitmapFields: new Map(),
  };
}

describe("generateStructHeader", () => {
  describe("basic struct generation", () => {
    it("should generate typedef struct with mapped types", () => {
      const fields = new Map<string, string>([
        ["x", "u32"],
        ["y", "u32"],
        ["z", "u32"],
      ]);
      const input = createInput(new Map([["Point3D", fields]]));

      const result = generateStructHeader("Point3D", input);

      // Issue #296: Named structs for forward declaration compatibility
      expect(result).toContain("typedef struct Point3D {");
      expect(result).toContain("uint32_t x;");
      expect(result).toContain("uint32_t y;");
      expect(result).toContain("uint32_t z;");
      expect(result).toContain("} Point3D;");
    });

    it("should handle mixed primitive types", () => {
      const fields = new Map<string, string>([
        ["id", "u16"],
        ["value", "f32"],
        ["flags", "u8"],
        ["active", "bool"],
      ]);
      const input = createInput(new Map([["Sensor", fields]]));

      const result = generateStructHeader("Sensor", input);

      expect(result).toContain("uint16_t id;");
      expect(result).toContain("float value;");
      expect(result).toContain("uint8_t flags;");
      expect(result).toContain("bool active;");
    });

    it("should preserve field order", () => {
      const fields = new Map<string, string>([
        ["first", "u8"],
        ["second", "u16"],
        ["third", "u32"],
      ]);
      const input = createInput(new Map([["Ordered", fields]]));

      const result = generateStructHeader("Ordered", input);
      const lines = result.split("\n");

      // Fields should appear in insertion order
      expect(lines[1]).toContain("first");
      expect(lines[2]).toContain("second");
      expect(lines[3]).toContain("third");
    });
  });

  describe("array field dimensions", () => {
    it("should generate single-dimension array fields", () => {
      const fields = new Map<string, string>([["buffer", "u8"]]);
      const dimensions = new Map<string, Map<string, readonly number[]>>([
        ["Buffer", new Map([["buffer", [256]]])],
      ]);
      const input = createInput(new Map([["Buffer", fields]]), dimensions);

      const result = generateStructHeader("Buffer", input);

      expect(result).toContain("uint8_t buffer[256];");
    });

    it("should generate multi-dimension array fields", () => {
      const fields = new Map<string, string>([["matrix", "f32"]]);
      const dimensions = new Map<string, Map<string, readonly number[]>>([
        ["Matrix", new Map([["matrix", [4, 4]]])],
      ]);
      const input = createInput(new Map([["Matrix", fields]]), dimensions);

      const result = generateStructHeader("Matrix", input);

      expect(result).toContain("float matrix[4][4];");
    });

    it("should handle mixed array and non-array fields", () => {
      const fields = new Map<string, string>([
        ["name", "u8"],
        ["length", "u32"],
      ]);
      const dimensions = new Map<string, Map<string, readonly number[]>>([
        ["String", new Map([["name", [64]]])],
      ]);
      const input = createInput(new Map([["String", fields]]), dimensions);

      const result = generateStructHeader("String", input);

      expect(result).toContain("uint8_t name[64];");
      expect(result).toContain("uint32_t length;");
      expect(result).not.toContain("length[");
    });
  });

  describe("user-defined types", () => {
    it("should pass through user-defined types unchanged", () => {
      const fields = new Map<string, string>([
        ["nested", "NestedStruct"],
        ["status", "StatusEnum"],
      ]);
      const input = createInput(new Map([["Container", fields]]));

      const result = generateStructHeader("Container", input);

      expect(result).toContain("NestedStruct nested;");
      expect(result).toContain("StatusEnum status;");
    });
  });

  describe("missing struct handling", () => {
    it("should return forward declaration when struct not found", () => {
      const input = createInput(new Map());

      const result = generateStructHeader("Unknown", input);

      expect(result).toBe("typedef struct Unknown Unknown;");
    });

    it("should return forward declaration when struct has no fields", () => {
      const input = createInput(new Map([["Empty", new Map()]]));

      const result = generateStructHeader("Empty", input);

      expect(result).toBe("typedef struct Empty Empty;");
    });
  });

  describe("edge cases", () => {
    it("should handle single-field struct", () => {
      const fields = new Map<string, string>([["value", "i64"]]);
      const input = createInput(new Map([["Wrapper", fields]]));

      const result = generateStructHeader("Wrapper", input);

      // Issue #296: Named structs for forward declaration compatibility
      expect(result).toBe(
        "typedef struct Wrapper {\n    int64_t value;\n} Wrapper;",
      );
    });

    it("should handle struct with pointer field type", () => {
      const fields = new Map<string, string>([
        ["data", "u8*"],
        ["size", "u32"],
      ]);
      const input = createInput(new Map([["Slice", fields]]));

      const result = generateStructHeader("Slice", input);

      expect(result).toContain("uint8_t* data;");
      expect(result).toContain("uint32_t size;");
    });
  });

  describe("string field dimensions", () => {
    it("should not double the string capacity dimension for plain string fields", () => {
      const fields = new Map<string, string>([
        ["name", "string<64>"],
        ["age", "u32"],
      ]);
      const dimensions = new Map<string, Map<string, readonly number[]>>([
        ["Person", new Map([["name", [65]]])],
      ]);
      const input = createInput(new Map([["Person", fields]]), dimensions);

      const result = generateStructHeader("Person", input);

      expect(result).toContain("char name[65];");
      expect(result).not.toContain("name[65][65]");
      expect(result).toContain("uint32_t age;");
    });

    it("should not double the string capacity for array-of-string fields", () => {
      const fields = new Map<string, string>([["arr", "string<64>"]]);
      const dimensions = new Map<string, Map<string, readonly number[]>>([
        ["Container", new Map([["arr", [4, 65]]])],
      ]);
      const input = createInput(new Map([["Container", fields]]), dimensions);

      const result = generateStructHeader("Container", input);

      expect(result).toContain("char arr[4][65];");
      expect(result).not.toContain("arr[4][65][65]");
    });

    it("should handle string field with no dimensions in map", () => {
      const fields = new Map<string, string>([["label", "string<16>"]]);
      const input = createInput(new Map([["Widget", fields]]));

      const result = generateStructHeader("Widget", input);

      expect(result).toContain("char label[17];");
    });
  });
});
