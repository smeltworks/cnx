import { describe, expect, it } from "vitest";

import ArrayDimensionText from "../ArrayDimensionText";

describe("ArrayDimensionText", () => {
  describe("parse", () => {
    // Issue #1127: SymbolUtils.parseArrayDimensions and
    // TypeResolver.parseArrayType each extracted dimensions from a string and
    // disagreed. TypeResolver used a base-10 parseInt, so "0x10" -- a
    // 16-element array -- was reported as dimension 0, and "8+1" was truncated
    // to 8. Both now call this, so the rows below hold for either caller.
    it.each([
      ["a decimal dimension", "u8[10]", [10]],
      ["a hex dimension", "u8[0x10]", [16]],
      ["a binary dimension", "u8[0b1010]", [10]],
      ["a macro dimension", "u8[BUF_SIZE]", ["BUF_SIZE"]],
      ["an enum-qualified dimension", "u8[EColor.COUNT]", ["EColor.COUNT"]],
      ["multiple dimensions", "u8[2][3]", [2, 3]],
      ["mixed numeric and symbolic", "u8[2][N]", [2, "N"]],
      ["surrounding whitespace", "u8[ 8 ]", [8]],
      ["no dimensions at all", "u8", []],
    ])("parses %s", (_label, source, expected) => {
      expect(ArrayDimensionText.parse(source as string)).toEqual(expected);
    });

    // These previously produced a truncated number rather than text. Keeping
    // the source is what stops a silently wrong size reaching the generated C.
    it.each([
      ["an arithmetic expression", "u8[8+1]", ["8+1"]],
      ["a spaced arithmetic expression", "u8[SIZE + 1]", ["SIZE + 1"]],
      ["a literal with a C suffix", "u8[8ul]", ["8ul"]],
      // #1760 review: 2^53 + 1 has no exact double; its text is its value
      ["a literal past 2^53", "u8[9007199254740993]", ["9007199254740993"]],
    ])(
      "keeps %s as source text rather than truncating it",
      (_label, source, expected) => {
        expect(ArrayDimensionText.parse(source as string)).toEqual(expected);
      },
    );

    it("reads a header's octal dimension as C does (#2484 review)", () => {
      expect(ArrayDimensionText.parseC("t[010][0x10][4u]")).toEqual([8, 16, 4]);
      expect(ArrayDimensionText.parseC("t[N + 1]")).toEqual(["N + 1"]);
    });

    it("keeps the position of an unsized dimension", () => {
      // The empty string holds the slot so dimension i still matches subscript
      // i; dropping it would shift every dimension that follows.
      expect(ArrayDimensionText.parse("u8[][4]")).toEqual(["", 4]);
    });

    it("returns the same result on repeated calls", () => {
      // Guards against reintroducing shared scan state. The first version used
      // a module-level global regex, where a stale lastIndex made every second
      // call start mid-string.
      expect(ArrayDimensionText.parse("u8[2][3]")).toEqual([2, 3]);
      expect(ArrayDimensionText.parse("u8[2][3]")).toEqual([2, 3]);
    });

    it.each([
      ["an unterminated bracket", "u8[8", []],
      ["a dimension before an unterminated bracket", "u8[2][3", [2]],
      ["a stray closing bracket", "u8]8[", []],
    ])("stops cleanly on %s", (_label, source, expected) => {
      expect(ArrayDimensionText.parse(source as string)).toEqual(expected);
    });
  });

  // #1760 review: only a folded size is a size; text is never parsed for one
  describe("numeric", () => {
    it("keeps each folded size and marks every other slot unresolved", () => {
      expect(ArrayDimensionText.numeric([4, "2*BUF", "", "0x10", 3])).toEqual([
        4, 0, 0, 0, 3,
      ]);
    });
  });

  describe("declarator text from a header", () => {
    it.each([
      ["a single dimension", "data[8]", [8]],
      ["a bare dimension", "[32]", [32]],
      ["several dimensions", "cube[2][3][4]", [2, 3, 4]],
      ["a non-array", "int x", []],
      ["a full declaration", "uint8_t data[10];", [10]],
      // Issue #981: macro-sized arrays are captured as strings
      ["a macro size", "char buffer[BUFFER_SIZE]", ["BUFFER_SIZE"]],
    ])("parses %s", (_label, source, expected) => {
      expect(ArrayDimensionText.parse(source)).toEqual(expected);
    });
  });
});
