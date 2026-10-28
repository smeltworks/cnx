/**
 * #1517: the header's system includes, decided from what it declares.
 *
 * These replace a set that asserted the same property over RENDERED TEXT. The
 * property did not change -- a header includes what it uses -- but the input
 * did, from the declarations after they were written to the symbols they are
 * written from, which is what moved the decision out of 2.3 Render.
 */

import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import HeaderIncludes from "../HeaderIncludes";
import TTypeUtils from "../../../utils/TTypeUtils";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";
import TestSymbolUtils from "../../../PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import type IBitmapSymbol from "../../../types/symbols/IBitmapSymbol";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type TSymbol from "../../../types/symbols/TSymbol";
import type TPrimitiveKind from "../../../types/TPrimitiveKind";
import type TType from "../../../types/TType";

function variable(name: string, type: TType): IVariableSymbol {
  return {
    ...TestSymbolUtils.base({
      kind: "variable",
      name,
      scopePath: "",
      sourceFile: "test.cnx",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cnx,
      visibility: "public",
    }),
    type,
    isConst: false,
    isVolatile: false,
    overflowBehavior: "clamp",
    isAtomic: false,
    isArray: false,
    arrayDimensions: undefined,
  };
}

function bitmap(name: string, backingType: string): IBitmapSymbol {
  return {
    ...TestSymbolUtils.base({
      kind: "bitmap",
      name,
      scopePath: "",
      sourceFile: "test.cnx",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cnx,
      visibility: "public",
    }),
    backingType,
    bitWidth: 8,
    fields: new Map(),
  };
}

const decide = (
  symbols: TSymbol[],
  writtenIncludes: readonly string[] = [],
): string[] => HeaderIncludes.decide(symbols, writtenIncludes);

describe("HeaderIncludes.decide (#1517)", () => {
  it.each([
    ["u8", ["<stdint.h>"]],
    ["u32", ["<stdint.h>"]],
    ["i64", ["<stdint.h>"]],
    ["bool", ["<stdbool.h>"]],
    ["f32", []],
    ["f64", []],
  ] as [TPrimitiveKind, string[]][])(
    "a public %s variable decides %s",
    (cnxType, expected) => {
      expect(
        decide([variable("v", TTypeUtils.createPrimitive(cnxType))]),
      ).toEqual(expected);
    },
  );

  it("leaves out a system header the source's own includes already write (#2188)", () => {
    const symbols = [
      variable("flag", TTypeUtils.createPrimitive("bool")),
      variable("count", TTypeUtils.createPrimitive("u16")),
    ];
    expect(
      decide(symbols, ["#include <Arduino.h>", "#include <stdint.h>"]),
    ).toEqual(["<stdbool.h>"]);
    expect(
      decide(symbols, ["#include <stdint.h>", "#include <stdbool.h>"]),
    ).toEqual([]);
  });

  it("emits nothing when the header declares nothing", () => {
    expect(decide([])).toEqual([]);
  });

  it("orders stdint before stdbool whatever order the symbols come in", () => {
    expect(
      decide([
        variable("flag", TTypeUtils.createPrimitive("bool")),
        variable("count", TTypeUtils.createPrimitive("u16")),
      ]),
    ).toEqual(["<stdint.h>", "<stdbool.h>"]);
  });

  it("asks once per header, not once per symbol that uses a type", () => {
    const many = [
      variable("a", TTypeUtils.createPrimitive("u8")),
      variable("b", TTypeUtils.createPrimitive("u8")),
      variable("c", TTypeUtils.createPrimitive("u8")),
    ];

    expect(decide(many)).toEqual(["<stdint.h>"]);
  });

  // `string<N>` maps to `char[N+1]`, and `char` needs no header. The decoration
  // has to come off or the type never matches anything.
  it("looks through array decoration to the element type", () => {
    const s = variable("name", TTypeUtils.createString(8));

    expect(decide([s])).toEqual([]);
  });

  it("does not match a user type whose name merely contains a C type", () => {
    expect(
      decide([variable("v", TTypeUtils.createStruct("uint8_t_wrapper"))]),
    ).toEqual([]);
  });

  // A bitmap emits `typedef uint8_t Flags;`. That type is on `backingType`,
  // not on a field and not on the symbol's own type -- the first version of the
  // walk missed it and twelve bitmap headers lost `<stdint.h>`, which
  // `headers:standalone:check` caught.
  it.each([
    ["u8", ["<stdint.h>"]],
    ["u16", ["<stdint.h>"]],
    ["u32", ["<stdint.h>"]],
  ])("a bitmap backed by %s decides %s", (backing, expected) => {
    expect(decide([bitmap("Flags", backing)])).toEqual(expected);
  });

  // `baseTypeOf` strips pointer and array decoration. These pin the shapes it
  // has to see through, since it was rewritten from regular expressions to
  // index arithmetic to avoid super-linear backtracking (S5852).
  it.each([
    ["a pointer to a fixed-width type", "u8", true],
    ["an array of a fixed-width type", "u16", true],
  ])("sees through decoration on %s", (_label, cnxType, expected) => {
    const decorated = variable(
      "v",
      TTypeUtils.createArray(TTypeUtils.createPrimitive(cnxType as never), [4]),
    );

    expect(decide([decorated]).length > 0).toBe(expected);
  });
});
