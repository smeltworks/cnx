/**
 * #1881: the other files whose C includes a header carries, because one of its
 * array dimensions names a macro only a file it includes reached.
 */
import { describe, expect, it } from "vitest";

import HeaderUserIncludes from "../HeaderUserIncludes";
import EFileType from "../../../PARSE/1-Discover/types/EFileType";
import type IFileIncludes from "../../../PARSE/1-Discover/types/IFileIncludes";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import TTypeUtils from "../../../utils/TTypeUtils";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";
import TestSymbolUtils from "../../../PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import type IProgram from "../../../types/IProgram";
import type IResolvedSymbols from "../../../types/IResolvedSymbols";
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
    headerMacroIncludingFile: (_sourceFile: string, macro: string) =>
      macros[macro] ?? null,
  }) as unknown as IProgram;

/** A symbol table whose files declare only the given public symbols */
const declaring = (
  byFile: Record<string, readonly IVariableSymbol[]>,
): IResolvedSymbols =>
  ({
    getTSymbolsByFile: (file: string) => [...(byFile[file] ?? [])],
  }) as unknown as IResolvedSymbols;
const NO_PUBLIC_SYMBOLS = declaring({});

describe("HeaderUserIncludes.macroIncludingFiles", () => {
  it("names the file that reached a macro the dimension spells", () => {
    const x = array(["BUF_SIZE + 1"], [plusOne(name("BUF_SIZE"))]);

    expect(
      HeaderUserIncludes.macroIncludingFiles(
        [x],
        NO_PUBLIC_SYMBOLS,
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
      HeaderUserIncludes.macroIncludingFiles(
        [x],
        NO_PUBLIC_SYMBOLS,
        definedBy({ ROWS: "mid.cnx", COLS: "mid.cnx" }),
        "main.cnx",
      ),
    ).toEqual(["mid.cnx"]);
  });

  it("names no file for a macro the header's own includes define", () => {
    const x = array(["BUF_SIZE"], [name("BUF_SIZE")]);

    expect(
      HeaderUserIncludes.macroIncludingFiles(
        [x],
        NO_PUBLIC_SYMBOLS,
        definedBy({ BUF_SIZE: "main.cnx" }),
        "main.cnx",
      ),
    ).toEqual([]);
  });

  it("names no file for a dimension that folded to a number", () => {
    const x = array([8], [name("BUF_SIZE")]);

    expect(
      HeaderUserIncludes.macroIncludingFiles(
        [x],
        NO_PUBLIC_SYMBOLS,
        definedBy({ BUF_SIZE: "mid.cnx" }),
        "main.cnx",
      ),
    ).toEqual([]);
  });

  it("names no file whose own header already carries the macro's include", () => {
    const x = array(["BUF_SIZE"], [name("BUF_SIZE")]);

    expect(
      HeaderUserIncludes.macroIncludingFiles(
        [x],
        declaring({ "mid.cnx": [array(["BUF_SIZE"], [name("BUF_SIZE")])] }),
        definedBy({ BUF_SIZE: "mid.cnx" }),
        "main.cnx",
      ),
    ).toEqual([]);
  });
});

/** A file's includes: each directive's kind, and the file it resolved to */
const includesOf = (
  directives: ReadonlyArray<[string, EFileType, string | null]>,
): IFileIncludes =>
  ({
    kinds: new Map(directives.map((d) => [d[0], d[1]])),
    resolutions: new Map(directives.map((d) => [d[0], d[2]])),
  }) as unknown as IFileIncludes;

describe("HeaderUserIncludes.macroCHeaders", () => {
  const x = array(["BUF_SIZE"], [name("BUF_SIZE")]);

  it("spells a found C header from the generated header's directory", () => {
    const includes = new Map([
      [
        "lib/mid.cnx",
        includesOf([["buf-size.h", EFileType.CHeader, "/p/lib/buf-size.h"]]),
      ],
    ]);

    expect(
      HeaderUserIncludes.macroCHeaders(
        [x],
        NO_PUBLIC_SYMBOLS,
        definedBy({ BUF_SIZE: "lib/mid.cnx" }),
        "main.cnx",
        includes,
        new Map([["/p/lib/buf-size.h", '"lib/buf-size.h"']]),
      ),
    ).toEqual(['"lib/buf-size.h"']);
  });

  it("keeps C and C++ headers in source order and skips .cnx includes", () => {
    const includes = new Map([
      [
        "mid.cnx",
        includesOf([
          ["sys.h", EFileType.CHeader, null],
          ["other.cnx", EFileType.Cnx, "/p/other.cnx"],
          ["dev.hpp", EFileType.CppHeader, "/p/dev.hpp"],
        ]),
      ],
    ]);

    expect(
      HeaderUserIncludes.macroCHeaders(
        [x],
        NO_PUBLIC_SYMBOLS,
        definedBy({ BUF_SIZE: "mid.cnx" }),
        "main.cnx",
        includes,
        new Map(),
      ),
    ).toEqual(["sys.h", "dev.hpp"]);
  });

  it("fails loudly when Discover recorded no includes for the file", () => {
    expect(() =>
      HeaderUserIncludes.macroCHeaders(
        [x],
        NO_PUBLIC_SYMBOLS,
        definedBy({ BUF_SIZE: "mid.cnx" }),
        "main.cnx",
        new Map(),
        new Map(),
      ),
    ).toThrow("1.1 Discover records the includes of every file in a closure");
  });
});
