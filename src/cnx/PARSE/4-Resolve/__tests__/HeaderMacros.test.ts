/**
 * Unit tests for HeaderMacros (#1688, ADR-024)
 */

import { describe, it, expect } from "vitest";
import HeaderMacros from "../HeaderMacros";
import UnreadBitWidth from "../../../utils/UnreadBitWidth";
import type IUnreadBitWidth from "../../../types/IUnreadBitWidth";

describe("HeaderMacros.collect", () => {
  const typeOf = (text: string, name: string) =>
    HeaderMacros.collect(text).get(name);

  it("types a floating literal anywhere as floating, with its C type", () => {
    const macros = HeaderMacros.collect(
      [
        "#define SCALE_F 2.5f",
        "#define SCALE_D (2.5)",
        "#define BIG 1e3",
        "#define VREF 3.3",
        "#define VREF_SCALED (VREF / 4096.0)",
        "#define MIXED (SCALE_F * 2.0)",
        "#define LONG_D 1.5L",
        "#define HEX_F 0x1.8p1f",
      ].join("\n"),
    );
    expect(macros.get("SCALE_F")).toEqual({
      kind: "floating",
      typeName: "f32",
    });
    expect(macros.get("SCALE_D")).toEqual({
      kind: "floating",
      typeName: "f64",
    });
    expect(macros.get("BIG")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("VREF_SCALED")).toEqual({
      kind: "floating",
      typeName: "f64",
    });
    expect(macros.get("MIXED")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("LONG_D")).toEqual({ kind: "floating", typeName: null });
    expect(macros.get("HEX_F")).toEqual({ kind: "floating", typeName: "f32" });
  });

  it("follows a macro that only names a floating one", () => {
    const text = "#define ALIAS SCALE\n#define SCALE 0.5f";
    expect(typeOf(text, "ALIAS")).toEqual({
      kind: "floating",
      typeName: "f32",
    });
  });

  it("types integer literals, operators and integer macros as integer", () => {
    const macros = HeaderMacros.collect(
      [
        "#define LIMIT 10",
        "#define MASK (0xFFu << 4)",
        "#define BITS 0b1010",
        "#define DERIVED ((LIMIT * 2) | MASK)",
        "#define HEXF 0x1F",
      ].join("\n"),
    );
    expect(macros.get("LIMIT")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 10],
        [32, 10],
      ]),
    });
    expect(macros.get("MASK")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 0xff0],
        [32, 0xff0],
      ]),
    });
    expect(macros.get("BITS")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 10],
        [32, 10],
      ]),
    });
    expect(macros.get("DERIVED")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 0xff4],
        [32, 0xff4],
      ]),
    });
    expect(macros.get("HEXF")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 31],
        [32, 31],
      ]),
    });
  });

  it("reads an integer macro's value the way C does (#1283 review)", () => {
    const macros = HeaderMacros.collect(
      [
        "#define N 3",
        "#define M (N - 1)",
        "#define ORDER (1 + 2 * 3 << 1)",
        "#define OCT 010",
        "#define DIV (7 / 2 % 3)",
        "#define UNARY (+N - -0)",
      ].join("\n"),
    );
    expect(macros.get("N")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 3],
        [32, 3],
      ]),
    });
    expect(macros.get("M")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 2],
        [32, 2],
      ]),
    });
    expect(macros.get("ORDER")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 14],
        [32, 14],
      ]),
    });
    expect(macros.get("OCT")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 8],
        [32, 8],
      ]),
    });
    expect(macros.get("DIV")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 0],
        [32, 0],
      ]),
    });
    expect(macros.get("UNARY")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 3],
        [32, 3],
      ]),
    });
  });

  it("reads no value where int, unsigned and long could disagree", () => {
    const macros = HeaderMacros.collect(
      [
        "#define NEG (0 - 1)",
        "#define NOT (~0)",
        "#define WIDE 4294967295u",
        "#define SHIFT (1 << 31)",
        "#define BY_ZERO (1 / 0)",
        "#define BAD_OCT 09",
        "#define UNBALANCED (1 + 2",
      ].join("\n"),
    );
    for (const name of [
      "NEG",
      "NOT",
      "WIDE",
      "SHIFT",
      "BY_ZERO",
      "BAD_OCT",
      "UNBALANCED",
    ]) {
      expect(macros.get(name)).toEqual({
        kind: "integer",
        valueByIntBits: new Map([
          [16, null],
          [32, null],
        ]),
      });
    }
  });

  it("reads a value under each target int width (#1283 review)", () => {
    const macros = HeaderMacros.collect(
      [
        "#define WIDE16 (256 * 256 / 16384)",
        "#define FITS16 (127 * 256 + 255)",
      ].join("\n"),
    );
    expect(macros.get("WIDE16")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, null],
        [32, 4],
      ]),
    });
    expect(macros.get("FITS16")).toEqual({
      kind: "integer",
      valueByIntBits: new Map([
        [16, 32767],
        [32, 32767],
      ]),
    });
  });

  it("leaves a call, cast, dereference, string or unknown name unreadable, whatever a cast or call holds", () => {
    const macros = HeaderMacros.collect(
      [
        "#include <stdint.h>",
        "#define _MMIO_BYTE(mem_addr) (*(volatile uint8_t *)(mem_addr))",
        "#define _SFR_IO8(io_addr) _MMIO_BYTE((io_addr) + 0x20)",
        "#define PINB _SFR_IO8(0x03)",
        "#define CAST ((uint32_t)5)",
        "#define CALL get_value()",
        '#define TEXT "hello"',
        "#define OTHER some_variable",
        "#define GUARD_H",
        "#define SELF SELF",
        "#define CYCLE_A CYCLE_B",
        "#define CYCLE_B CYCLE_A",
        "#define F_CPU 16000000UL",
        "#define TICKS ((uint16_t)(F_CPU / 1000.0))",
        "#define TRUNC ((int)2.5)",
        "#define WIDENED ((double)2.5f)",
        "#define ROUNDED lround(1.5)",
        "#define TICKS_PLUS (TICKS + 1)",
      ].join("\n"),
    );
    for (const name of [
      "PINB",
      "CAST",
      "CALL",
      "TEXT",
      "OTHER",
      "GUARD_H",
      "SELF",
      "CYCLE_A",
      "CYCLE_B",
      "TICKS",
      "TRUNC",
      "WIDENED",
      "ROUNDED",
      "TICKS_PLUS",
    ]) {
      expect(macros.get(name), name).toEqual({ kind: "unreadable" });
    }
  });

  it("reads && and || as C does: a Boolean when outermost, a number inside arithmetic (#2484 review)", () => {
    const macros = HeaderMacros.collect(
      [
        "#define READY (1 && 1)",
        "#define EITHER (2 || 0) && 3",
        "#define COUNT ((1 && 1) + 1)",
        "#define SCALED (2.5 + (1 && 1))",
        "#define READY_ALIAS READY",
        "#define READY_PLUS (READY + 1)",
      ].join("\n"),
    );
    const value = (name: string) => {
      const macro = macros.get(name);
      return macro?.kind === "integer" ? macro.valueByIntBits.get(32) : null;
    };
    expect(macros.get("READY")).toMatchObject({ isBoolean: true });
    expect(value("READY")).toBe(1);
    expect(macros.get("EITHER")).toMatchObject({ isBoolean: true });
    expect(value("EITHER")).toBe(1);
    expect(macros.get("COUNT")).not.toHaveProperty("isBoolean");
    expect(value("COUNT")).toBe(2);
    expect(macros.get("SCALED")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("READY_ALIAS")).toMatchObject({ isBoolean: true });
    expect(macros.get("READY_PLUS")).not.toHaveProperty("isBoolean");
  });

  it("types a character constant alone as character, and mixed as unreadable", () => {
    const macros = HeaderMacros.collect(
      [
        "#define LETTER_A 'A'",
        "#define CR ('\\r')",
        "#define QUOTE '\\''",
        "#define ALIAS LETTER_A",
        "#define NEXT ('A' + 1)",
        "#define WIDE L'A'",
      ].join("\n"),
    );
    for (const name of ["LETTER_A", "CR", "QUOTE", "ALIAS"]) {
      expect(macros.get(name), name).toEqual({ kind: "character" });
    }
    for (const name of ["NEXT", "WIDE"]) {
      expect(macros.get(name), name).toEqual({ kind: "unreadable" });
    }
  });

  it("does not collect a function-like macro", () => {
    const macros = HeaderMacros.collect("#define SQUARE(x) ((x) * (x))");
    expect(macros.has("SQUARE")).toBe(false);
  });

  it("reads a -dM dump, builtins included", () => {
    const macros = HeaderMacros.collect(
      [
        "#define __FLT_EPSILON__ 1.19209289550781250000000000000000000e-7F",
        "#define FLT_EPSILON __FLT_EPSILON__",
        "#define M_PI 3.14159265358979323846",
        '#define NAN (__builtin_nanf (""))',
        "#define __GNUC__ 11",
      ].join("\n"),
    );
    expect(macros.get("FLT_EPSILON")).toEqual({
      kind: "floating",
      typeName: "f32",
    });
    expect(macros.get("M_PI")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("NAN")).toEqual({ kind: "unreadable" });
    expect(macros.get("__GNUC__")).toMatchObject({ kind: "integer" });
  });
});

describe("HeaderMacros.integerTypes (#1619)", () => {
  it("names each exact-width type the compiler defines", () => {
    const types = HeaderMacros.integerTypes(
      [
        "#define __UINT32_TYPE__ long unsigned int",
        "#define __INT32_TYPE__ long int",
        "#define __UINT8_TYPE__ unsigned char",
        "#define __INT64_TYPE__ long long int",
        "#define __UINT_LEAST32_TYPE__ long unsigned int",
        "#define __INT_FAST16_TYPE__ int",
        "#define __SIZE_TYPE__ unsigned int",
        "#define __PTRDIFF_TYPE__ int",
        "#define __UINTPTR_TYPE__ unsigned int",
        "#define __INTMAX_TYPE__ long long int",
        "#define __CHAR16_TYPE__ short unsigned int",
        "#define __SIZEOF_LONG__ 4",
      ].join("\n"),
    );
    expect([...types]).toEqual([
      ["uint32_t", "long unsigned int"],
      ["int32_t", "long int"],
      ["uint8_t", "unsigned char"],
      ["int64_t", "long long int"],
      ["uint_least32_t", "long unsigned int"],
      ["int_fast16_t", "int"],
      ["size_t", "unsigned int"],
      ["ptrdiff_t", "int"],
      ["uintptr_t", "unsigned int"],
      ["intmax_t", "long long int"],
    ]);
  });

  it("names nothing for a dump that defines none of them", () => {
    expect(HeaderMacros.integerTypes("#define FOO 1").size).toBe(0);
  });
});

/** A width's value through these bodies, or null where it is unread */
function widthOf(
  text: string,
  bodiesByFile: readonly ReadonlyMap<string, string>[],
  undefinedNames: ReadonlySet<string>,
): number | null {
  const width = HeaderMacros.width(
    text,
    bodiesByFile.map((bodies) => ({ file: "", bodies })),
    undefinedNames,
    new Set(),
  );
  return typeof width === "number" ? width : null;
}

describe("HeaderMacros.width (#2494)", () => {
  const macros = HeaderMacros.bodies(
    [
      "#define MODE_BITS 3",
      "#define WIDE_BITS (MODE_BITS * 2 + 1)",
      "#define WRAPS (32767 + 1)",
      "#define SCALE 2.5",
      "#define LOOSE 1 + 2",
      "#define LOOP LOOP",
    ].join("\n"),
  );

  it.each([
    ["an integer expression", "1 + 2", 3],
    ["a macro", "MODE_BITS", 3],
    ["a macro of a macro", "WIDE_BITS", 7],
    ["an expression of a macro", "(MODE_BITS << 1) | 1", 7],
    // #2494 review: C substitutes text, so this is 1 + 2 * 2
    ["a macro by its text, not its value", "LOOSE * 2", 5],
  ])("reads %s", (_name, text, value) => {
    expect(widthOf(text, [macros], new Set())).toBe(value);
  });

  it.each([
    ["sizeof", "sizeof(uint8_t)"],
    ["an unknown name", "UNKNOWN_BITS"],
    ["a floating macro", "SCALE"],
    ["a value that differs by int width", "WRAPS"],
    ["a macro that expands to itself", "LOOP"],
  ])("does not read %s", (_name, text) => {
    expect(widthOf(text, [macros], new Set())).toBeNull();
  });

  it("reads a macro two files agree on, not one they disagree on", () => {
    const other = HeaderMacros.bodies("#define MODE_BITS 4");
    const same = HeaderMacros.bodies("#define MODE_BITS 3");
    expect(widthOf("MODE_BITS", [macros, same], new Set())).toBe(3);
    expect(widthOf("MODE_BITS", [macros, other], new Set())).toBeNull();
    expect(widthOf("MODE_BITS", [new Map(), macros], new Set())).toBe(3);
  });
});

describe("HeaderMacros.width with no includer's macros (#2484 review)", () => {
  it("names the macros it reads, not a form cnx cannot read", () => {
    const width = HeaderMacros.width("MODE_BITS", [], new Set(), new Set());
    expect(width).toEqual(UnreadBitWidth.unreadMacros(["MODE_BITS"]));
  });

  it("still reads a width of literals", () => {
    expect(HeaderMacros.width("1 + 2", [], new Set(), new Set())).toBe(3);
  });
});

describe("HeaderMacros.width and #undef (#2494 review)", () => {
  const bodies = HeaderMacros.bodies(
    ["#define LATE 8", "#define VIA (LATE + 1)", "#define KEPT 3"].join("\n"),
  );
  it.each([
    ["a macro a header removes with #undef", "LATE"],
    ["a macro whose body reads one", "VIA"],
  ])("does not read %s", (_label, text) => {
    expect(widthOf(text, [bodies], new Set(["LATE"]))).toBeNull();
  });
  it("still reads a macro no header removes with #undef", () => {
    expect(widthOf("KEPT", [bodies], new Set(["LATE"]))).toBe(3);
  });
});

describe("HeaderMacros.width and a declared name (#2510 review)", () => {
  const bodies = HeaderMacros.bodies(
    ["#define N 8", "#define VIA (N + 1)", "#define KEPT 3"].join("\n"),
  );
  const read = (text: string): number | IUnreadBitWidth =>
    HeaderMacros.width(
      text,
      [{ file: "", bodies }],
      new Set(),
      new Set(["N", "plain"]),
    );
  it.each([
    ["a macro named like a declaration", "N"],
    ["a macro whose body reads one", "VIA"],
  ])("does not read %s", (_label, text) => {
    expect(read(text)).toEqual(UnreadBitWidth.declaredMacro("N"));
  });
  it("still reads a macro no header declares", () => {
    expect(read("KEPT")).toBe(3);
  });
});

describe("HeaderMacros.collect expands macros as text (#2494 review)", () => {
  it("reads a macro of an unparenthesized macro with C's precedence", () => {
    const macros = HeaderMacros.collect(
      ["#define LOOSE 1 + 2", "#define TWICE (LOOSE * 2)"].join("\n"),
    );
    const twice = macros.get("TWICE");
    expect(twice?.kind === "integer" && twice.valueByIntBits.get(32)).toBe(5);
  });
});
