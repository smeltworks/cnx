import { describe, expect, it } from "vitest";
import LengthProperty from "../LengthProperty";
import TTypeUtils from "../TTypeUtils";
import type IElementWidthFacts from "../types/IElementWidthFacts";
import type ILengthSubject from "../types/ILengthSubject";
import type TLengthUnit from "../types/TLengthUnit";
import type TLengthKind from "../types/TLengthKind";

const NO_FACTS: IElementWidthFacts = {
  enumBitWidth: () => null,
  enumBits: () => null,
  bitmapBitWidth: () => null,
};

const SCALAR: ILengthSubject = {
  namesType: false,
  category: "unsigned",
  isString: false,
  isArray: false,
  isStruct: false,
  isBitField: false,
  spelling: "u8",
};

const ruleOf = (property: string, subject: Partial<ILengthSubject>) =>
  LengthProperty.rule(LengthProperty.parse(property)!, {
    ...SCALAR,
    ...subject,
  }).kind;

describe("LengthProperty (ADR-058, #1175, #1975 review 2)", () => {
  it.each<[TLengthUnit, (number | string)[], number | null, number | null]>([
    ["element_count", [4], 8, 4],
    ["element_count", [3, 7], 8, 3],
    ["bit_length", [4], 16, 64],
    ["byte_length", [4], 16, 8],
    ["byte_length", [2, 3], 8, 6],
    ["bit_length", [], 32, 32],
    // byte lengths round up to the bytes that hold the bits
    ["byte_length", [], 3, 1],
    ["byte_length", [], 9, 2],
    ["byte_length", [3], 3, 2],
    // a dimension only C knows, or none settled, has no value here
    ["element_count", ["BUF_SIZE"], 8, null],
    ["byte_length", [4, "BUF_SIZE"], 8, null],
    ["byte_length", [0], 8, null],
    ["byte_length", [4], null, null],
    ["char_count", [], 8, null],
  ])("%s of %j at %s bits is %s", (unit, dims, bits, expected) => {
    expect(LengthProperty.of(unit, dims, bits)).toBe(expected);
  });

  it("names twelve properties, and knows the four removed ones", () => {
    expect(LengthProperty.NAMES).toHaveLength(12);
    expect(LengthProperty.parse("memory_char_count")).toEqual({
      kind: "memory",
      unit: "char_count",
    });
    expect(LengthProperty.parse("bit_length")).toBeNull();
    expect(LengthProperty.parse("type_length")).toBeNull();
    expect(LengthProperty.isLength("bit_length")).toBe(true);
    expect(LengthProperty.isLength("capacity")).toBe(false);
    expect(LengthProperty.removedHelp("char_count")).toContain(
      ".value_char_count",
    );
    expect(LengthProperty.removedHelp("type_bit_length")).toBeNull();
  });

  it("measures a string<N> by its N characters", () => {
    expect(LengthProperty.stringElementBits(15)).toBe(120);
  });

  it.each([
    [[0, 1, 2], 2],
    [[0], 1],
    [[0, 1], 1],
    [[0, 4], 3],
    [[255], 8],
    [[0, null], null],
    [[-1, 0], null],
  ])("an enum of %j is %s bits wide", (values, expected) => {
    expect(LengthProperty.enumBits(values)).toBe(expected);
  });

  it.each([
    ["a primitive", TTypeUtils.createPrimitive("u16"), 16],
    ["a bool, one bit", TTypeUtils.createPrimitive("bool"), 1],
    ["an enum no lookup finds", TTypeUtils.createEnum("EColor"), null],
    ["a string, its characters", TTypeUtils.createString(7), 56],
    ["a struct no lookup finds", TTypeUtils.createStruct("P"), null],
  ])("a declared %s is %s bits wide", (_label, type, expected) => {
    expect(LengthProperty.elementBitsOfType(type, () => undefined)).toBe(
      expected,
    );
  });

  it("strips a string field's C buffer, its last dimension", () => {
    const s = TTypeUtils.createString(7);
    expect(LengthProperty.fieldDimensions(s, [8])).toEqual([]);
    expect(LengthProperty.fieldDimensions(s, [3, 8])).toEqual([3]);
    const u = TTypeUtils.createPrimitive("u8");
    expect(LengthProperty.fieldDimensions(u, [8])).toEqual([8]);
  });

  it("asks the facts for an enum's and a bitmap's width, after the primitives", () => {
    const facts: IElementWidthFacts = {
      enumBitWidth: (name) => (name === "motor_mode_t" ? 8 : null),
      enumBits: (name) => (name === "EMode" ? 2 : null),
      bitmapBitWidth: (name) => (name === "Flags" ? 16 : null),
    };
    expect(LengthProperty.elementBits("u32", facts)).toBe(32);
    expect(LengthProperty.elementBits("bool", facts)).toBe(1);
    expect(LengthProperty.elementBits("motor_mode_t", facts)).toBe(8);
    expect(LengthProperty.elementBits("EMode", facts)).toBe(2);
    expect(LengthProperty.elementBits("Flags", facts)).toBe(16);
    expect(LengthProperty.elementBits("uint8_t", NO_FACTS)).toBeNull();
  });

  describe("rule: the Decision's table", () => {
    const kinds: TLengthKind[] = ["value", "type", "memory"];
    const units: TLengthUnit[] = [
      "bit_length",
      "byte_length",
      "char_count",
      "element_count",
    ];
    const subjects: Record<string, Partial<ILengthSubject>> = {
      unsigned: {},
      signed: { category: "signed" },
      float: { category: "floating" },
      bool: { category: "boolean" },
      enum: { category: "enum" },
      string: { category: "none", isString: true },
      array: { isArray: true },
      struct: { category: "none", isStruct: true },
      bitField: { isBitField: true },
      typeName: { namesType: true },
      structType: { category: "none", isStruct: true, namesType: true },
    };
    // Each cell: what answers it, or "error"
    const table: Record<string, string[]> = {
      // value bit, value byte, value char, value element, type ..., memory ...
      unsigned: [
        "bits",
        "bits",
        "decimal",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "error",
        "error",
      ],
      signed: [
        "error",
        "error",
        "decimal",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "error",
        "error",
      ],
      float: [
        "logical",
        "logical",
        "error",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "error",
        "error",
      ],
      bool: [
        "logical",
        "logical",
        "spelling",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "error",
        "error",
      ],
      enum: [
        "logical",
        "logical",
        "spelling",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "error",
        "error",
      ],
      string: [
        "string",
        "string",
        "string",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "stringBuffer",
        "error",
      ],
      array: [
        "logical",
        "logical",
        "spelling",
        "logical",
        "logical",
        "logical",
        "spelling",
        "logical",
        "memory",
        "memory",
        "error",
        "logical",
      ],
      struct: [
        "logical",
        "logical",
        "spelling",
        "logical",
        "logical",
        "logical",
        "spelling",
        "logical",
        "memory",
        "memory",
        "error",
        "logical",
      ],
      bitField: [
        "bits",
        "bits",
        "decimal",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "error",
        "error",
        "error",
        "error",
      ],
      typeName: [
        "error",
        "error",
        "error",
        "error",
        "logical",
        "logical",
        "spelling",
        "error",
        "memory",
        "memory",
        "error",
        "error",
      ],
      structType: [
        "error",
        "error",
        "error",
        "error",
        "logical",
        "logical",
        "spelling",
        "logical",
        "memory",
        "memory",
        "error",
        "logical",
      ],
    };
    const cells = Object.entries(table).flatMap(([subject, row]) =>
      kinds.flatMap((kind, k) =>
        units.map((unit, u): [string, string, string] => [
          `${kind}_${unit}`,
          subject,
          row[k * 4 + u],
        ]),
      ),
    );
    it.each(cells)(".%s of %s is %s", (property, subject, expected) => {
      expect(ruleOf(property, subjects[subject])).toBe(expected);
    });

    it("a signed char count keeps its sign", () => {
      expect(
        LengthProperty.rule(LengthProperty.parse("value_char_count")!, {
          ...SCALAR,
          category: "signed",
        }),
      ).toEqual({ kind: "decimal", signed: true });
    });

    it("names the helper a runtime integer length needs, and no other", () => {
      expect(LengthProperty.helperOf({ kind: "bits" })).toBe(
        LengthProperty.VALUE_BIT_LENGTH,
      );
      expect(LengthProperty.helperOf({ kind: "decimal", signed: true })).toBe(
        LengthProperty.VALUE_CHAR_COUNT_SIGNED,
      );
      expect(LengthProperty.helperOf({ kind: "string" })).toBeNull();
    });

    it("reads at runtime only a value's length now: a helper's or strlen's", () => {
      expect(LengthProperty.readsAtRuntime({ kind: "bits" })).toBe(true);
      expect(
        LengthProperty.readsAtRuntime({ kind: "decimal", signed: false }),
      ).toBe(true);
      expect(LengthProperty.readsAtRuntime({ kind: "string" })).toBe(true);
      for (const kind of [
        "logical",
        "spelling",
        "stringBuffer",
        "memory",
      ] as const) {
        expect(LengthProperty.readsAtRuntime({ kind })).toBe(false);
      }
    });

    it("types the memory row a u32 on every subject, and .value_char_count where it counts now (#1806, #1742)", () => {
      const subjects = [
        SCALAR,
        { ...SCALAR, isArray: true },
        { ...SCALAR, category: "none", isString: true },
        { ...SCALAR, category: "enum" },
      ] as const;
      for (const subject of subjects) {
        for (const property of [
          "memory_bit_length",
          "memory_byte_length",
          "memory_char_count",
        ]) {
          expect(LengthProperty.operandType(property, subject)).toBe(
            LengthProperty.MEMORY_TYPE,
          );
        }
        expect(
          LengthProperty.operandType("memory_element_count", subject),
        ).toBeNull();
        expect(
          LengthProperty.operandType("type_byte_length", subject),
        ).toBeNull();
      }
      expect(LengthProperty.operandType("value_char_count", SCALAR)).toBe(
        LengthProperty.CHAR_COUNT_TYPE,
      );
      expect(
        LengthProperty.operandType("value_char_count", {
          ...SCALAR,
          isArray: true,
        }),
      ).toBeNull();
      expect(LengthProperty.operandType("value_bit_length", SCALAR)).toBeNull();
      expect(LengthProperty.operandType("bit_length", SCALAR)).toBeNull();
    });

    it("writes the memory row in its own C type", () => {
      expect(LengthProperty.memoryC("sizeof(Cfg)", [3], true)).toBe(
        `((${LengthProperty.MEMORY_C_TYPE})sizeof(Cfg) * 3U * 8U)`,
      );
    });

    it("reads a string's characters now only for its value lengths", () => {
      expect(LengthProperty.readsStringNow("value_char_count")).toBe(true);
      expect(LengthProperty.readsStringNow("value_byte_length")).toBe(true);
      expect(LengthProperty.readsStringNow("type_char_count")).toBe(false);
      expect(LengthProperty.readsStringNow("char_count")).toBe(false);
    });
  });
});
