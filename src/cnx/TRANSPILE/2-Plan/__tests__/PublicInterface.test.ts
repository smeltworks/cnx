import { describe, expect, it } from "vitest";

import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import PublicInterface from "../PublicInterface";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";
import TestMembers from "../../../types/__testUtils__/testMembers";
import TestSymbolUtils from "../../../PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import type IBitmapSymbol from "../../../types/symbols/IBitmapSymbol";
import type IRegisterSymbol from "../../../types/symbols/IRegisterSymbol";
import type TSymbol from "../../../types/symbols/TSymbol";
import TypeResolver from "../../../utils/TypeResolver";

/**
 * #1453: a register is part of the public interface, and its accessor block
 * is rendered into the header -- the only file a `#define` can be exported
 * from. Before this, `isHeaderVisible` excluded registers because no header
 * path emitted one, so a board file declaring the hardware wrote an empty
 * header and every consumer's `HW.CTRL` reached the C compiler undeclared.
 *
 * The closure has to follow a register's member types for the same reason a
 * public function's signature drags a private struct in (#1300): the accessor
 * casts to the member's type, so a private bitmap a public register names is
 * defined in the header or the header does not compile.
 */
const FILE = "hw.cnx";

const base = <K extends "register" | "bitmap">(
  kind: K,
  name: string,
  scopePath: string,
  visibility: "public" | "private",
) =>
  TestSymbolUtils.base({
    kind,
    name,
    scopePath,
    sourceFile: FILE,
    span: TestSourceSpan.at(1),
    sourceLanguage: ESourceLanguage.Cnx,
    visibility,
  });

const register = (
  name: string,
  scopePath: string,
  visibility: "public" | "private",
  bitmapType?: string,
): IRegisterSymbol => ({
  ...base("register", name, scopePath, visibility),
  registerType: "Peripheral",
  addressExpr: null,
  baseAddress: 0x40000000n,
  members: TestMembers.asRegisterMembers(
    scopePath === "" ? name : `${scopePath}__${name}`,
    new Map([
      [
        "DR",
        {
          offset: {
            kind: "literal",
            digits: "0",
            text: "0x00",
            typeName: null,
          },
          offsetValue: 0x00n,
          type: TypeResolver.resolve(bitmapType ?? "u32"),
          access: "rw",
        },
      ],
    ]),
  ),
});

const bitmap = (
  name: string,
  scopePath: string,
  visibility: "public" | "private",
): IBitmapSymbol => ({
  ...base("bitmap", name, scopePath, visibility),
  backingType: "uint8_t",
  bitWidth: 8,
  fields: TestMembers.asBitmapFields(
    scopePath === "" ? name : `${scopePath}__${name}`,
    new Map([["LED", { offset: 0, width: 1 }]]),
  ),
});

const interfaceOf = (symbols: TSymbol[]): string[] => {
  const table = new SymbolTable();
  table.addTSymbols(symbols);
  return PublicInterface.forFile(table, FILE).map(
    (symbol) => symbol.fullyQualifiedCName,
  );
};

describe("PublicInterface -- registers (#1453)", () => {
  it("counts a file-scope register toward the public interface", () => {
    expect(interfaceOf([register("HW", "", "public")])).toEqual(["HW"]);
  });

  it("counts a public scoped register, and not a private one", () => {
    expect(
      interfaceOf([
        register("R", "Board", "public"),
        register("Hidden", "Board", "private"),
      ]),
    ).toEqual(["Board__R"]);
  });

  it("drags a private bitmap into the header when a public register names it", () => {
    // The accessor is `(*(volatile Chip__Pins*)(...))`, so the header that
    // exports the register must define `Chip__Pins` or it does not compile.
    const pins = bitmap("Pins", "Chip", "private");
    const found = interfaceOf([
      pins,
      register("R", "Chip", "public", pins.fullyQualifiedCName),
    ]);
    expect(found).toContain("Chip__R");
    expect(found).toContain("Chip__Pins");
  });

  it("leaves a private bitmap out when only a private register names it", () => {
    const pins = bitmap("Pins", "Chip", "private");
    expect(
      interfaceOf([
        pins,
        register("Hidden", "Chip", "private", pins.fullyQualifiedCName),
      ]),
    ).toEqual([]);
  });
});
