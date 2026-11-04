/**
 * #1881: the other files whose C includes a header carries, because one of its
 * array dimensions names a macro only a file it includes reached.
 */
import { describe, expect, it } from "vitest";

import HeaderUserIncludes from "../HeaderUserIncludes";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import TTypeUtils from "../../../utils/TTypeUtils";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";
import TestSymbolUtils from "../../../PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import type IProgram from "../../../types/IProgram";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type TConstExpr from "../../../types/TConstExpr";

const AT = { line: 1, column: 0, endLine: 1, endColumn: 0 };
const name = (n: string): TConstExpr => ({
  kind: "name",
  root: null,
  path: [n],
  at: AT,
});
const plusOne = (expr: TConstExpr): TConstExpr => ({
  kind: "binary",
  op: "+",
  left: expr,
  right: { kind: "literal", digits: "1", text: "1", typeName: null },
});

function array(
  dimensions: ReadonlyArray<number | string>,
  exprs: ReadonlyArray<TConstExpr | null>,
): IVariableSymbol {
  return {
    ...TestSymbolUtils.base({
      kind: "variable",
      name: "x",
      scopePath: "",
      sourceFile: "main.cnx",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cnx,
      visibility: "public",
    }),
    type: TTypeUtils.createPrimitive("u8"),
    isConst: false,
    isVolatile: false,
    overflowBehavior: "clamp",
    isAtomic: false,
    isArray: true,
    arrayDimensions: dimensions,
    arrayDimensionExprs: exprs,
  };
}

/** A program where each macro is defined by the named file's includes */
const definedBy = (macros: Record<string, string>): IProgram =>
  ({
    headerMacroIncluder: (_sourceFile: string, macro: string) =>
      macros[macro] ?? null,
  }) as unknown as IProgram;

describe("HeaderUserIncludes.macroIncluders", () => {
  it("names the file that reached a macro the dimension spells", () => {
    const x = array(["BUF_SIZE + 1"], [plusOne(name("BUF_SIZE"))]);

    expect(
      HeaderUserIncludes.macroIncluders(
        [x],
        definedBy({ BUF_SIZE: "mid.cnx" }),
        "main.cnx",
      ),
    ).toEqual(["mid.cnx"]);
  });

  it("names each file once, however many dimensions it supplies", () => {
    const x = array(
      ["ROWS", "COLS", "ROWS"],
      [name("ROWS"), name("COLS"), name("ROWS")],
    );

    expect(
      HeaderUserIncludes.macroIncluders(
        [x],
        definedBy({ ROWS: "mid.cnx", COLS: "mid.cnx" }),
        "main.cnx",
      ),
    ).toEqual(["mid.cnx"]);
  });

  it("names no file for a macro the header's own includes define", () => {
    const x = array(["BUF_SIZE"], [name("BUF_SIZE")]);

    expect(
      HeaderUserIncludes.macroIncluders(
        [x],
        definedBy({ BUF_SIZE: "main.cnx" }),
        "main.cnx",
      ),
    ).toEqual([]);
  });

  it("names no file for a dimension that folded to a number", () => {
    const x = array([8], [name("BUF_SIZE")]);

    expect(
      HeaderUserIncludes.macroIncluders(
        [x],
        definedBy({ BUF_SIZE: "mid.cnx" }),
        "main.cnx",
      ),
    ).toEqual([]);
  });
});
