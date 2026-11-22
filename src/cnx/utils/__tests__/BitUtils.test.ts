import { describe, it, expect } from "vitest";
import BitUtils from "../BitUtils";
import type IOperandType from "../../types/IOperandType";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";

// ========================================================================
// boolToInt
// ========================================================================
describe("BitUtils.boolToInt", () => {
  it("converts literal true to 1U (MISRA 10.1 compliance)", () => {
    expect(BitUtils.boolToInt("true")).toBe("1U");
  });

  it("converts literal false to 0U (MISRA 10.1 compliance)", () => {
    expect(BitUtils.boolToInt("false")).toBe("0U");
  });

  it("wraps comparison expressions in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("x > 5")).toBe("((x > 5) ? 1U : 0U)");
  });

  it("wraps variable expressions in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("isEnabled")).toBe("(isEnabled ? 1U : 0U)");
  });

  it("wraps complex expressions in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("a && b")).toBe("((a && b) ? 1U : 0U)");
  });

  it("wraps function calls in ternary with unsigned values", () => {
    expect(BitUtils.boolToInt("isReady()")).toBe("(isReady() ? 1U : 0U)");
  });
  // A compile-time value folds however it is spelled: `(0x1 ? 1U : 0U)` is
  // an invariant controlling expression (MISRA C:2012 Rule 14.3)
  it.each([
    ["1", 1, "1U"],
    ["1U", 1, "1U"],
    ["0x1", 1, "1U"],
    ["0b1", 1, "1U"],
    ["ONE", 1, "1U"],
    ["0", 0, "0U"],
    ["0U", 0, "0U"],
    ["0x0", 0, "0U"],
    ["0b0", 0, "0U"],
    ["OFF", 0, "0U"],
  ])("folds %s, whose value is %d, to %s", (expr, folded, expected) => {
    expect(BitUtils.boolToInt(expr, folded)).toBe(expected);
  });

  it("folds a single-bit write's constant value by its value", () => {
    expect(BitUtils.singleBitWrite("x", 3, "0x1", "uint8_t", 1)).toBe(
      BitUtils.singleBitWrite("x", 3, "true", "uint8_t"),
    );
  });
});

// ========================================================================
// maskHex
// ========================================================================
describe("BitUtils.maskHex", () => {
  // A constant width is written as its value, so no mask is ever computed by
  // a shift that could overflow the type it is done in
  it.each([
    [0, "0x0U"],
    [1, "0x1U"],
    [4, "0xFU"],
    [8, "0xFFU"],
    [12, "0xFFFU"],
    [16, "0xFFFFU"],
    [24, "0xFFFFFFU"],
    [31, "0x7FFFFFFFU"],
    [32, "0xFFFFFFFFU"],
    [40, "0xFFFFFFFFFFU"],
    [64, "0xFFFFFFFFFFFFFFFFU"],
  ])("writes width %i as %s", (width, hex) => {
    expect(BitUtils.maskHex(width)).toBe(hex);
  });
});

// ========================================================================
// generateMask
// ========================================================================
describe("BitUtils.generateMask", () => {
  it.each([
    [8, undefined, "0xFFU"],
    ["8", undefined, "0xFFU"],
    // A width folded from a const carries MISRA's suffix
    ["24U", undefined, "0xFFFFFFU"],
    ["4U", "uint64_t", "0xFU"],
  ])("writes constant width %s as a literal", (width, storage, mask) => {
    expect(BitUtils.generateMask(width, storage)).toBe(mask);
  });

  it.each([
    [undefined, "((1U << width) - 1U)"],
    // `unsigned int` holds a 16-bit storage's widths on every target
    ["uint16_t", "((1U << width) - 1U)"],
    ["uint32_t", "(((uint32_t)1U << width) - 1U)"],
    ["int32_t", "(((uint32_t)1U << width) - 1U)"],
    ["uint64_t", "(((uint64_t)1U << width) - 1U)"],
  ])("computes a run-time width in %s's width", (storage, mask) => {
    expect(BitUtils.generateMask("width", storage)).toBe(mask);
  });

  it("computes a width that only starts with digits, rather than reading its prefix", () => {
    expect(BitUtils.generateMask("4 + n", "uint32_t")).toBe(
      "(((uint32_t)1U << 4 + n) - 1U)",
    );
  });
});

// ========================================================================
// singleBitWrite
// ========================================================================
describe("BitUtils.singleBitWrite", () => {
  it.each([
    ["true", "flags = (flags & ~(1U << 0)) | (1U << 0);"],
    ["false", "flags = (flags & ~(1U << 0)) | (0U << 0);"],
    ["x > 5", "flags = (flags & ~(1U << 0)) | (((x > 5) ? 1U : 0U) << 0);"],
  ])("writes %s into storage of unknown type", (value, code) => {
    expect(BitUtils.singleBitWrite("flags", 0, value)).toBe(code);
  });

  it.each([
    ["uint8_t", "b = (uint8_t)((b & ~(1U << 7)) | (1U << 7));"],
    ["int16_t", "b = (int16_t)((b & ~(1U << 7)) | (1U << 7));"],
  ])(
    "casts %s storage back to its type (MISRA C:2012 Rule 10.3)",
    (storage, code) => {
      expect(BitUtils.singleBitWrite("b", 7, "true", storage)).toBe(code);
    },
  );

  it("shifts in the storage's width even at a low offset (#1668)", () => {
    // Where `unsigned int` is 16 bits, `~(1U << 3)` is 0xFFF7: the AND
    // would clear bits 16-31 of the storage, with nothing to warn about
    expect(BitUtils.singleBitWrite("w", 3, "true", "uint32_t")).toBe(
      "w = (w & ~((uint32_t)1U << 3)) | ((uint32_t)1U << 3);",
    );
  });

  // #1760 second review: the result is unsigned, so a signed target takes
  // the Rule 10.3 cast back whatever its width
  it("shifts a signed storage's bit in its unsigned width, cast back", () => {
    expect(BitUtils.singleBitWrite("w", 31, "isSet", "int32_t")).toBe(
      "w = (int32_t)((w & ~((uint32_t)1U << 31)) | ((uint32_t)(isSet ? 1U : 0U) << 31));",
    );
  });

  it("shifts a 64-bit storage's bit in 64 bits", () => {
    expect(BitUtils.singleBitWrite("q", 48, "false", "uint64_t")).toBe(
      "q = (q & ~((uint64_t)1U << 48)) | ((uint64_t)0U << 48);",
    );
  });

  it("keeps a run-time offset as written", () => {
    expect(BitUtils.singleBitWrite("byte", "n", "true")).toBe(
      "byte = (byte & ~(1U << n)) | (1U << n);",
    );
  });
});

// ========================================================================
// multiBitWrite
// ========================================================================
describe("BitUtils.multiBitWrite", () => {
  it("writes a constant width's mask as a literal", () => {
    expect(BitUtils.multiBitWrite("reg", 0, 4, "0x0F")).toBe(
      "reg = (reg & ~(0xFU << 0)) | ((0x0F & 0xFU) << 0);",
    );
  });

  it("casts 16-bit storage back to its type", () => {
    expect(BitUtils.multiBitWrite("s", 12, 4, "n", "uint16_t")).toBe(
      "s = (uint16_t)((s & ~(0xFU << 12)) | ((n & 0xFU) << 12));",
    );
  });

  it("widens the mask for 32-bit storage, which widens the value it masks (#1668)", () => {
    expect(BitUtils.multiBitWrite("word", 8, 8, "value", "uint32_t")).toBe(
      "word = (word & ~((uint32_t)0xFFU << 8)) | ((value & (uint32_t)0xFFU) << 8);",
    );
  });

  it("widens the mask for 64-bit storage", () => {
    expect(BitUtils.multiBitWrite("q", 32, 16, "0xABCD", "uint64_t")).toBe(
      "q = (q & ~((uint64_t)0xFFFFU << 32)) | ((0xABCD & (uint64_t)0xFFFFU) << 32);",
    );
  });

  it("computes a run-time width's mask once, in the storage's width", () => {
    expect(
      BitUtils.multiBitWrite(
        "d",
        0,
        { text: "width", folded: undefined },
        "bits",
        "uint32_t",
      ),
    ).toBe(
      "d = (d & ~((((uint32_t)1U << width) - 1U) << 0)) | ((bits & (((uint32_t)1U << width) - 1U)) << 0);",
    );
  });

  // #1760 second review: the width folds in the writer, so every caller's
  // `[0, W]` masks a literal, not the undefined `1U << 32`
  it("masks a folded width as a literal", () => {
    expect(
      BitUtils.multiBitWrite(
        "fx",
        0,
        { text: "W", folded: 32 },
        "v",
        "uint32_t",
      ),
    ).toBe(
      "fx = (fx & ~((uint32_t)0xFFFFFFFFU << 0)) | ((v & (uint32_t)0xFFFFFFFFU) << 0);",
    );
  });

  // #1760 second review: `a | b & mask` wrote bits outside the range
  it("masks a value with an operator as one operand", () => {
    expect(BitUtils.multiBitWrite("x", 0, 8, "a | b", "uint8_t")).toBe(
      "x = (uint8_t)((x & ~(0xFFU << 0)) | (((a | b) & 0xFFU) << 0));",
    );
  });

  // #1760 second review: an `i32` or `i64` target took no cast back
  it.each([
    [
      "int32_t",
      "s = (int32_t)((s & ~((uint32_t)0xFU << 4)) | ((v & (uint32_t)0xFU) << 4));",
    ],
    [
      "int64_t",
      "s = (int64_t)((s & ~((uint64_t)0xFU << 4)) | ((v & (uint64_t)0xFU) << 4));",
    ],
  ])("casts %s storage back to its type", (storage, expected) => {
    expect(BitUtils.multiBitWrite("s", 4, 4, "v", storage)).toBe(expected);
  });

  it("keeps a run-time offset as written", () => {
    expect(BitUtils.multiBitWrite("reg", "start", 8, "val")).toBe(
      "reg = (reg & ~(0xFFU << start)) | ((val & 0xFFU) << start);",
    );
  });
});

// ========================================================================
// #2483: a value 2.2 found already within the field is masked once
// ========================================================================
describe("BitUtils masks a written value once (#2483)", () => {
  const op = {} as TPostfixOpSyntax;

  it("writes a literal the field holds as it is", () => {
    expect(
      BitUtils.multiBitValue("pl", 1, 3, "5U", "uint16_t", { kind: "fits" }),
    ).toBe("(uint16_t)((pl & ~(0x7U << 1)) | (5U << 1))");
  });

  it("widens a literal the field holds to 32-bit storage", () => {
    expect(
      BitUtils.multiBitValue("w", 29, 3, "7U", "uint32_t", { kind: "fits" }),
    ).toBe("(w & ~((uint32_t)0x7U << 29)) | ((uint32_t)7U << 29)");
  });

  it("masks a bit range at its own width, not the field's", () => {
    expect(
      BitUtils.multiBitValue("pl", 1, 3, "(m >> 1U)", "uint16_t", {
        kind: "range",
        op,
        width: 2,
      }),
    ).toBe("(uint16_t)((pl & ~(0x7U << 1)) | (((m >> 1U) & 0x3U) << 1))");
  });

  it("writes a write-only field's literal as it is", () => {
    expect(
      BitUtils.writeOnlyMultiBit("R", 4, 2, "3U", "uint8_t", { kind: "fits" }),
    ).toBe("R = (uint8_t)(3U << 4);");
  });

  it("masks a value 2.2 knows nothing of at the field's width", () => {
    expect(BitUtils.multiBitValue("pl", 1, 3, "v", "uint16_t", null)).toBe(
      "(uint16_t)((pl & ~(0x7U << 1)) | ((v & 0x7U) << 1))",
    );
  });
});

// ========================================================================
// writeOnlySingleBit
// ========================================================================
describe("BitUtils.writeOnlySingleBit", () => {
  it("writes a one without reading the target", () => {
    expect(BitUtils.writeOnlySingleBit("SET", 0, "true")).toBe(
      "SET = (1U << 0);",
    );
  });

  it("writes the value it is given, not a one (#1775)", () => {
    expect(BitUtils.writeOnlySingleBit("SET", 5, "on", "uint32_t")).toBe(
      "SET = ((uint32_t)(on ? 1U : 0U) << 5);",
    );
  });

  it("casts 8-bit storage back to its type, in the parentheses that group it", () => {
    expect(BitUtils.writeOnlySingleBit("CMD", 1, "go", "uint8_t")).toBe(
      "CMD = (uint8_t)((go ? 1U : 0U) << 1);",
    );
  });
});

// ========================================================================
// writeOnlyMultiBit
// ========================================================================
describe("BitUtils.writeOnlyMultiBit", () => {
  it("writes the masked value without reading the target", () => {
    expect(BitUtils.writeOnlyMultiBit("DATA", 0, 4, "value")).toBe(
      "DATA = ((value & 0xFU) << 0);",
    );
  });

  it("widens the mask for 32-bit storage", () => {
    expect(BitUtils.writeOnlyMultiBit("WORD", 8, 8, "byte", "uint32_t")).toBe(
      "WORD = ((byte & (uint32_t)0xFFU) << 8);",
    );
  });

  it("casts 8-bit storage back to its type", () => {
    expect(BitUtils.writeOnlyMultiBit("R", 1, 3, "v", "uint8_t")).toBe(
      "R = (uint8_t)((v & 0x7U) << 1);",
    );
  });

  it("computes a run-time width's mask in the storage's width", () => {
    expect(
      BitUtils.writeOnlyMultiBit(
        "R",
        "start",
        { text: "n", folded: undefined },
        "bits",
        "uint32_t",
      ),
    ).toBe("R = ((bits & (((uint32_t)1U << n) - 1U)) << start);");
  });

  it("masks a value with an operator as one operand", () => {
    expect(BitUtils.writeOnlyMultiBit("R", 0, 4, "c ^ b", "uint8_t")).toBe(
      "R = (uint8_t)(((c ^ b) & 0xFU) << 0);",
    );
  });
});

// #1760 review, owner ruling: an integer the target gives no width is
// written in uintmax_t and cast back to the type its header spelled
describe("BitUtils with storage of unfixed width", () => {
  it("works a single bit in uintmax_t and casts back", () => {
    expect(BitUtils.singleBitWrite("hf", 3, "true", "int_fast16_t")).toBe(
      "hf = (int_fast16_t)((hf & ~((uintmax_t)1U << 3)) | ((uintmax_t)1U << 3));",
    );
  });

  it("works a bit range in uintmax_t and casts back", () => {
    expect(BitUtils.multiBitWrite("hf", 0, 4, "v", "int_fast16_t")).toBe(
      "hf = (int_fast16_t)((hf & ~((uintmax_t)0xFU << 0)) | ((v & (uintmax_t)0xFU) << 0));",
    );
  });

  it("leaves a fixed-width and an unknown storage as they were", () => {
    expect(BitUtils.singleBitWrite("w", 3, "true", "uint32_t")).toBe(
      "w = (w & ~((uint32_t)1U << 3)) | ((uint32_t)1U << 3);",
    );
    expect(BitUtils.singleBitWrite("w", 3, "true")).toBe(
      "w = (w & ~(1U << 3)) | (1U << 3);",
    );
  });
});

// #1760 review: one answer for a read and a write
describe("BitUtils.storageOf and widthText", () => {
  const operand = (
    typeName: string | null,
    category: IOperandType["category"],
    cType: string | null = null,
    bitWidth: number | null = null,
  ): IOperandType => ({
    typeName,
    cType,
    dimensions: [],
    category,
    bitWidth,
    stringCapacity: null,
    enumTypeName: null,
    bitmapTypeName: null,
    callbackTypeName: null,
    overflow: null,
    hasSideEffect: false,
    volatileAccess: false,
    signChosenByCompiler: false,
    form: { kind: "declared" },
    binding: null,
  });

  it("stores a known integer in its fixed-width type", () => {
    expect(BitUtils.storageOf(operand("u64", "unsigned", null, 64))).toBe(
      "uint64_t",
    );
    expect(BitUtils.storageOf(operand("i16", "signed", null, 16))).toBe(
      "int16_t",
    );
  });

  it("stores an integer of unfixed width in the type its header spelled", () => {
    expect(BitUtils.storageOf(operand(null, "signed", "int_fast16_t"))).toBe(
      "int_fast16_t",
    );
  });

  it("stores nothing else", () => {
    expect(
      BitUtils.storageOf(operand("f32", "floating", "float")),
    ).toBeUndefined();
    expect(BitUtils.storageOf(null)).toBeUndefined();
  });

  it("writes a folded width as its value, and any other as its text", () => {
    expect(BitUtils.widthText({ text: "WIDTH", folded: 32 })).toBe("32U");
    expect(BitUtils.widthText({ text: "n", folded: undefined })).toBe("n");
  });
});
