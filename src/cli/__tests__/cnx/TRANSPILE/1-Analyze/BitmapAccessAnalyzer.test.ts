import { describe, expect, it } from "vitest";

import BitmapAccessAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/BitmapAccessAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-034's three access rules: E0881 (a literal too wide for the
 * field), E0882 (a member the bitmap does not declare) and E0883 (bracket
 * indexing where a named field is required).
 *
 * A bitmap's layouts come from the per-file symbol view, which the program
 * 1.4 builds from the declarations below. The register route needs a register
 * whose member is typed by the bitmap as well, which is what separates the
 * two ways a bitmap is reached.
 */
const FLAGS = "bitmap8 Flags { Mode[3], Enable, Reserved[4] }";
const REGISTER = "register R @ 0x40000000 { CTRL: Flags rw @ 0x00, }";

const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new BitmapAccessAnalyzer(context).analyze(syntax);
};

describe("BitmapAccessAnalyzer (E0881)", () => {
  it("rejects a value wider than the field, in every literal base", () => {
    const found = errors(
      [
        FLAGS,
        "Flags f;",
        "void t() {",
        "    f.Mode <- 8;",
        "    f.Mode <- 0x8;",
        "    f.Mode <- 0b1000;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0881", 4],
      ["E0881", 5],
      ["E0881", 6],
    ]);
    expect(found[0].message).toBe(
      "Value 8 exceeds 3-bit field 'Mode' maximum of 7",
    );
  });

  // #1760 second review: a const is its value, folded by the one binder,
  // and a local const shadows a file-scope one where it is written
  it("folds a const and a const expression, as the binder binds them", () => {
    const found = errors(
      [
        FLAGS,
        "Flags f;",
        "u8 BIG <- 20;",
        "u8 FITS <- 7;",
        "void t() {",
        "    f.Mode <- BIG;",
        "    f.Mode <- FITS + 1;",
        "    f.Mode <- FITS;",
        "    u8 BIG <- 3;",
        "    f.Mode <- BIG;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line, e.message])).toEqual([
      ["E0881", 6, "Value 20 exceeds 3-bit field 'Mode' maximum of 7"],
      ["E0881", 7, "Value 8 exceeds 3-bit field 'Mode' maximum of 7"],
    ]);
  });

  it("accepts the widest value the field holds, and declines a runtime one", () => {
    expect(
      errors(
        [
          FLAGS,
          "Flags f;",
          "void t(u8 v) {",
          "    f.Mode <- 7;",
          "    f.Enable <- 1;",
          "    f.Mode <- v;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

describe("BitmapAccessAnalyzer (E0882)", () => {
  it("rejects a member the bitmap does not declare, and names the ones it does", () => {
    const [found] = errors(
      `${FLAGS}\nFlags f;\nvoid t() {\n    f.Missing <- 1;\n}`,
    );
    expect(found.code).toBe("E0882");
    expect(found.message).toBe("Unknown bitmap field 'Missing' on 'Flags'");
    expect(found.helpText).toContain("'Mode'");
  });

  it("does not report ADR-058's shape properties as unknown fields", () => {
    // They describe the type rather than name a field. Both analyzers read one
    // shared list so this cannot drift; before it was shared, `f.type_bit_length`
    // reported "Unknown bitmap field" while ADR-058 defined it.
    expect(
      errors(
        `${FLAGS}\nFlags f;\nvoid t() {\n    u8 a <- f.type_bit_length;\n    u8 b <- f.type_byte_length;\n}`,
      ),
    ).toEqual([]);
  });
});

describe("BitmapAccessAnalyzer (E0883)", () => {
  it("rejects bracket indexing on a bitmap VARIABLE -- the route codegen could not see", () => {
    const [found] = errors(
      `${FLAGS}\nFlags f;\nvoid t() {\n    bool b <- f[0];\n}`,
    );
    expect(found.code).toBe("E0883");
    expect(found.message).toBe(
      "Cannot use bracket indexing on bitmap type 'Flags'",
    );
  });

  it("rejects it through a register member typed by a bitmap, read and written", () => {
    const found = errors(
      [
        FLAGS,
        REGISTER,
        "void t() {",
        "    bool b <- R.CTRL[0];",
        "    R.CTRL[1] <- true;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0883", 4],
      ["E0883", 5],
    ]);
  });

  it("accepts the named-field form on both routes", () => {
    expect(
      errors(
        [
          FLAGS,
          REGISTER,
          "Flags f;",
          "void t() {",
          "    bool a <- f.Enable;",
          "    f.Mode <- 1;",
          "    bool b <- R.CTRL.Enable;",
          "    R.CTRL.Mode <- 1;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

// #1991: read off 1.2's syntax, so where each report lands, and a chain that
// starts at `this.`, are asserted directly.
describe("BitmapAccessAnalyzer -- positions and rooted chains", () => {
  const where = (source: string) =>
    errors(source).map((e) => [e.code, e.span.line, e.span.column]);

  it("reports a too-wide value at the value", () => {
    expect(
      where(
        [FLAGS, "Flags f;", "void t() {", "    f.Mode <- 8;", "}"].join("\n"),
      ),
    ).toEqual([["E0881", 4, 14]]);
  });

  it("rejects bracket indexing on a bitmap reached through `this.`", () => {
    expect(
      where(
        [
          FLAGS,
          "scope S {",
          "    Flags f;",
          "    public void t() {",
          "        this.f[3] <- true;",
          "    }",
          "}",
        ].join("\n"),
      ),
    ).toEqual([["E0883", 5, 8]]);
  });
});

// #2186: a field belongs to one bitmap value, so a field of an array of
// bitmaps, or of a row of one, names no storage.
describe("BitmapAccessAnalyzer (E0921)", () => {
  it("rejects a field of an array or a row, and accepts a whole element's", () => {
    const found = errors(
      [
        FLAGS,
        "mut Flags[2] a1;",
        "mut Flags[2][2] g2;",
        "void t() {",
        "    a1.Enable <- true;",
        "    g2[1].Enable <- true;",
        "    g2[1][0].Enable <- true;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0921", 5],
      ["E0921", 6],
    ]);
    expect(found[0].message).toBe(
      "Field 'Enable' of an array of 'Flags' names no element",
    );
  });
});
