import { describe, it, expect } from "vitest";
import type IOperandType from "../../../types/IOperandType";
import AtomicOperandType from "../AtomicOperandType";

const U8 = { typeName: "u8", cType: "uint8_t", bits: 8 };
const U32 = { typeName: "u32", cType: "uint32_t", bits: 32 };
const F32 = { typeName: "f32", cType: "float", bits: 32 };
const HEADER = { typeName: null, cType: "int_fast16_t", bits: 16 };

describe("AtomicOperandType.ofCompound", () => {
  // #2120 review 2: the temporary must not narrow before the clamp helper
  it("holds a saturating value in the helper's wider type", () => {
    expect(AtomicOperandType.ofCompound(U8, "u8", "uint8_t")).toBe("uint32_t");
  });

  // #1790 review: a signed `/<-` helper's `b` is wider too, so an i32's
  // `__operand` is the int64_t it takes, not narrowed (-Wconversion)
  it("holds a signed division's divisor in the helper's wider type", () => {
    const I32 = { typeName: "i32", cType: "int32_t", bits: 32 };
    expect(AtomicOperandType.ofCompound(I32, "i32", "int32_t")).toBe("int64_t");
  });

  it("keeps a wider float value's precision", () => {
    expect(AtomicOperandType.ofCompound(F32, null, "double")).toBe("double");
  });

  it("holds a value in the type the inline form computes it in (#2250)", () => {
    // `v %<- d` with a u32 `d` divides by all of `d`, as `pv % d` does
    expect(AtomicOperandType.ofCompound(U8, null, "uint32_t")).toBe("uint32_t");
  });

  it("holds a C header type's value in its C type", () => {
    expect(AtomicOperandType.ofCompound(HEADER, null, null)).toBe(
      "int_fast16_t",
    );
  });
});

describe("AtomicOperandType.ofBits", () => {
  it("holds one bit in a bool", () => {
    expect(AtomicOperandType.ofBits(U32, true, false, "uint32_t")).toBe("bool");
  });

  it("holds a float's bits in its bits' unsigned integer", () => {
    expect(AtomicOperandType.ofBits(F32, false, true, "uint8_t")).toBe(
      "uint32_t",
    );
  });

  // #2155 review 8: `c[0, 4] <- x` with `x: u32` on an `atomic i8` writes
  // `x` unconverted inline, so the hoisted value is not narrowed to `int8_t`
  it("keeps wider bits in the value's own C type", () => {
    expect(
      AtomicOperandType.ofBits(
        { typeName: "i8", cType: "int8_t", bits: 8 },
        false,
        false,
        "uint32_t",
      ),
    ).toBe("uint32_t");
  });

  it("falls back to the atomic's C type for a value with none", () => {
    expect(AtomicOperandType.ofBits(U8, false, false, null)).toBe("uint8_t");
  });
});

describe("AtomicOperandType.valueCTypeOf", () => {
  const literal = {
    typeName: "int",
    category: "signed",
    form: { kind: "literal" },
  } as unknown as IOperandType;
  const I8 = { typeName: "i8", cType: "int8_t", bits: 8 };

  it("holds a constant in the unsigned type that holds it, never a signed atomic's", () => {
    expect(AtomicOperandType.valueCTypeOf(literal, 200, I8)).toBe("uint8_t");
    expect(AtomicOperandType.valueCTypeOf(literal, 256, U8)).toBe("uint16_t");
    expect(AtomicOperandType.valueCTypeOf(literal, 5, U32)).toBe("uint32_t");
  });

  it("holds a negative constant in the atomic's type", () => {
    expect(AtomicOperandType.valueCTypeOf(literal, -1, I8)).toBe("int8_t");
  });

  it("holds a typed value in its own C type", () => {
    const typed = {
      typeName: "u32",
      category: "unsigned",
      form: { kind: "declared" },
    } as unknown as IOperandType;
    expect(AtomicOperandType.valueCTypeOf(typed, undefined, U8)).toBe(
      "uint32_t",
    );
  });

  it("holds a float literal in its float type", () => {
    const f = {
      typeName: "f64",
      category: "floating",
      form: { kind: "literal" },
    } as unknown as IOperandType;
    expect(AtomicOperandType.valueCTypeOf(f, 2, F32)).toBe("double");
  });
});
