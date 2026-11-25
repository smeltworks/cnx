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
      restored,
    );
    HeaderDeclarationRecord.restore(
      HeaderDeclarationRecord.of("/lib/def.h", table),
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
