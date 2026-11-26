import { describe, expect, it } from "vitest";
import HeaderDeclarationRecord from "../HeaderDeclarationRecord";
import SymbolTable from "../SymbolTable";

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
