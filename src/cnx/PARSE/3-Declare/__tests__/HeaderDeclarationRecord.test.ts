/**
 * #2474: a header's record carries the struct fields that header declares,
 * so a cached forward declaration restores none of another header's fields.
 */
import { describe, expect, it } from "vitest";
import CResolver from "../c/index";
import TestHelpers from "../c/__tests__/testHelpers";
import HeaderDeclarationRecord from "../HeaderDeclarationRecord";
import SymbolTable from "../SymbolTable";

function declare(table: SymbolTable, path: string, source: string): void {
  table.addCSymbols(
    CResolver.resolve(TestHelpers.parseC(source)!, path, table).symbols,
  );
}

describe("HeaderDeclarationRecord struct fields (#2474)", () => {
  it("a forward declaration's record carries no fields", () => {
    const table = new SymbolTable();
    declare(table, "/lib/fwd.h", "struct frame_t;");
    declare(table, "/lib/def.h", "struct frame_t { int data[8]; };");

    const record = HeaderDeclarationRecord.of("/lib/fwd.h", table);

    expect(record.symbols.map((symbol) => symbol.name)).toContain("frame_t");
    expect(record.structFields.get("frame_t")).toBeUndefined();
  });

  it("a defining header's record restores its fields under that header", () => {
    const table = new SymbolTable();
    declare(table, "/lib/fwd.h", "struct frame_t;");
    declare(table, "/lib/def.h", "struct frame_t { int data[8]; };");
    const restored = new SymbolTable();

    HeaderDeclarationRecord.restore(
      HeaderDeclarationRecord.of("/lib/fwd.h", table),
      "/lib/fwd.h",
      restored,
    );
    HeaderDeclarationRecord.restore(
      HeaderDeclarationRecord.of("/lib/def.h", table),
      "/lib/def.h",
      restored,
    );

    expect(
      restored.getStructFieldsDeclaredIn("frame_t", "/lib/fwd.h"),
    ).toBeUndefined();
    expect(
      restored.getStructFieldsDeclaredIn("frame_t", "/lib/def.h")?.get("data")
        ?.arrayDimensions,
    ).toEqual([8]);
  });
});

describe("HeaderDeclarationRecord undefined macros (#2494 review)", () => {
  const table = new SymbolTable();
  table.markUndefinedMacros("a.h", ["LATE_BITS"]);
  table.markUndefinedMacros("b.h", []);

  it("records only the macros its own header removes with #undef", () => {
    expect(HeaderDeclarationRecord.of("b.h", table).undefinedMacros).toEqual(
      [],
    );
    expect(HeaderDeclarationRecord.of("a.h", table).undefinedMacros).toEqual([
      "LATE_BITS",
    ]);
  });

  it("keeps a header's undefined macros when a recovered slice reports none", () => {
    const recovered = new SymbolTable();
    recovered.markUndefinedMacros("a.h", ["LATE_BITS"]);
    recovered.markUndefinedMacros("a.h", []);
    expect([...recovered.undefinedMacros()]).toEqual(["LATE_BITS"]);
  });

  it("restores them for that header", () => {
    const fresh = new SymbolTable();
    HeaderDeclarationRecord.restore(
      HeaderDeclarationRecord.of("a.h", table),
      "a.h",
      fresh,
    );
    expect([...fresh.undefinedMacros()]).toEqual(["LATE_BITS"]);
  });
});
