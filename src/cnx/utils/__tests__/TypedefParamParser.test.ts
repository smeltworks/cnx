/**
 * Unit tests for TypedefParamParser
 */

import { describe, expect, it } from "vitest";
import TypedefParamParser from "../TypedefParamParser";

describe("TypedefParamParser", () => {
  describe("parse", () => {
    // The base type is derived by dropping a trailing parameter name. These
    // rows are the corpus that replacement was checked against when it stopped
    // using /\s+\w+$/ (S8786), kept so the behavior stays pinned -- in
    // particular that a trailing token which is not a plain identifier is left
    // alone rather than cut at the last space.
    it.each([
      ["a named parameter", "void (*)(rect_t area)", "rect_t"],
      ["an unnamed parameter", "void (*)(rect_t)", "rect_t"],
      [
        "a multi-word type with a name",
        "void (*)(unsigned int count)",
        "unsigned int",
      ],
      [
        "a multi-word type with no name",
        "void (*)(unsigned int)",
        "unsigned int",
      ],
      ["a struct-qualified type", "void (*)(struct foo_t item)", "foo_t"],
    ])("derives the base type from %s", (_label, signature, expected) => {
      const result = TypedefParamParser.parse(signature as string);

      expect(result).not.toBeNull();
      expect(result!.params[0].baseType).toBe(expected);
    });

    it("should parse simple callback with pointer params", () => {
      const result = TypedefParamParser.parse(
        "void (*)(widget_t *, const rect_t *, uint8_t *)",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].isPointer).toBe(true);
      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("widget_t");

      expect(result!.params[1].isPointer).toBe(true);
      expect(result!.params[1].isConst).toBe(true);
      expect(result!.params[1].baseType).toBe("rect_t");

      expect(result!.params[2].isPointer).toBe(true);
      expect(result!.params[2].isConst).toBe(false);
      expect(result!.params[2].baseType).toBe("uint8_t");
    });

    it("does not read a type named const... as const", () => {
      // #2063: `constraint_t` begins with the letters of `const`
      const result = TypedefParamParser.parse("void (*)(constraint_t*c)");

      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("constraint_t");
    });

    it("reads a const after the * as the pointer's, not the pointee's", () => {
      // #2348 review: 1.2 keeps `uint8_t*const buf`'s words apart now
      const result = TypedefParamParser.parse(
        "void (*)(uint8_t*const buf, const uint8_t*const src)",
      );

      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("uint8_t");
      expect(result!.params[1].isConst).toBe(true);
    });

    it("should parse callback without spaces (C grammar format)", () => {
      // This is the actual format from CResolver - getText() may strip spaces
      const result = TypedefParamParser.parse(
        "void (*)(widget_t*,const rect_t*,uint8_t*)",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].isPointer).toBe(true);
      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("widget_t");

      expect(result!.params[1].isPointer).toBe(true);
      expect(result!.params[1].isConst).toBe(true);
      expect(result!.params[1].baseType).toBe("rect_t");

      expect(result!.params[2].isPointer).toBe(true);
      expect(result!.params[2].isConst).toBe(false);
      expect(result!.params[2].baseType).toBe("uint8_t");
    });

    it("should parse callback with value params", () => {
      const result = TypedefParamParser.parse("void (*)(Point p)");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(1);

      expect(result!.params[0].isPointer).toBe(false);
      expect(result!.params[0].isConst).toBe(false);
      expect(result!.params[0].baseType).toBe("Point");
    });

    it("should parse callback with no params", () => {
      const result = TypedefParamParser.parse("void (*)(void)");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(0);
    });

    it("should parse callback with primitive return type", () => {
      const result = TypedefParamParser.parse("int (*)(int x, int y)");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("int");
      expect(result!.params).toHaveLength(2);

      expect(result!.params[0].isPointer).toBe(false);
      expect(result!.params[0].baseType).toBe("int");

      expect(result!.params[1].isPointer).toBe(false);
      expect(result!.params[1].baseType).toBe("int");
    });

    it("should return null for invalid typedef", () => {
      expect(TypedefParamParser.parse("not a typedef")).toBeNull();
      expect(TypedefParamParser.parse("void foo()")).toBeNull();
      expect(TypedefParamParser.parse("")).toBeNull();
    });

    it("should handle mixed pointer and value params", () => {
      const result = TypedefParamParser.parse(
        "void (*)(Point* p, int count, Rect r)",
      );

      expect(result).not.toBeNull();
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].isPointer).toBe(true);
      expect(result!.params[0].baseType).toBe("Point");

      expect(result!.params[1].isPointer).toBe(false);
      expect(result!.params[1].baseType).toBe("int");

      expect(result!.params[2].isPointer).toBe(false);
      expect(result!.params[2].baseType).toBe("Rect");
    });

    it("should parse callback with nested function pointer param", () => {
      // Nested function pointer: void (*)(void (*)(int))
      const result = TypedefParamParser.parse("void (*)(void (*)(int))");

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(1);

      // The param is itself a function pointer
      expect(result!.params[0].type).toBe("void (*)(int)");
      expect(result!.params[0].isPointer).toBe(true); // Function pointers are pointers
    });

    it("should parse callback with deeply nested function pointer", () => {
      // Two levels of nesting: void (*)(void (*)(void (*)(int)))
      const result = TypedefParamParser.parse(
        "void (*)(void (*)(void (*)(int)))",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(1);
      expect(result!.params[0].type).toBe("void (*)(void (*)(int))");
    });

    it("should parse callback with mixed nested and regular params", () => {
      // Mix of nested function pointer and regular params
      const result = TypedefParamParser.parse(
        "void (*)(int x, void (*)(int), char* str)",
      );

      expect(result).not.toBeNull();
      expect(result!.returnType).toBe("void");
      expect(result!.params).toHaveLength(3);

      expect(result!.params[0].baseType).toBe("int");
      expect(result!.params[0].isPointer).toBe(false);

      expect(result!.params[1].type).toBe("void (*)(int)");
      expect(result!.params[1].isPointer).toBe(true);

      expect(result!.params[2].baseType).toBe("char");
      expect(result!.params[2].isPointer).toBe(true);
    });
  });

  describe("isParamPointer", () => {
    it("should return true for pointer params", () => {
      const typedef = "void (*)(widget_t *, uint8_t *)";

      expect(TypedefParamParser.isParamPointer(typedef, 0)).toBe(true);
      expect(TypedefParamParser.isParamPointer(typedef, 1)).toBe(true);
    });

    it("should return false for value params", () => {
      const typedef = "void (*)(Point p, int count)";

      expect(TypedefParamParser.isParamPointer(typedef, 0)).toBe(false);
      expect(TypedefParamParser.isParamPointer(typedef, 1)).toBe(false);
    });

    it("should return null for out of bounds index", () => {
      const typedef = "void (*)(Point p)";

      expect(TypedefParamParser.isParamPointer(typedef, 1)).toBeNull();
      expect(TypedefParamParser.isParamPointer(typedef, 99)).toBeNull();
    });

    it("should return null for invalid typedef", () => {
      expect(TypedefParamParser.isParamPointer("invalid", 0)).toBeNull();
    });
  });

  describe("isParamConst", () => {
    it("should return true for const params", () => {
      const typedef = "void (*)(const Point* p, const char* s)";

      expect(TypedefParamParser.isParamConst(typedef, 0)).toBe(true);
      expect(TypedefParamParser.isParamConst(typedef, 1)).toBe(true);
    });

    it("should return false for non-const params", () => {
      const typedef = "void (*)(Point* p, uint8_t* buf)";

      expect(TypedefParamParser.isParamConst(typedef, 0)).toBe(false);
      expect(TypedefParamParser.isParamConst(typedef, 1)).toBe(false);
    });

    it("should handle mixed const params", () => {
      const typedef = "void (*)(widget_t* w, const rect_t* area, uint8_t* buf)";

      expect(TypedefParamParser.isParamConst(typedef, 0)).toBe(false);
      expect(TypedefParamParser.isParamConst(typedef, 1)).toBe(true);
      expect(TypedefParamParser.isParamConst(typedef, 2)).toBe(false);
    });
  });
});
