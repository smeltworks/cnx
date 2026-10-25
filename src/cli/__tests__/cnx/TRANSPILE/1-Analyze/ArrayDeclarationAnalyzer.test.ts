import { describe, expect, it } from "vitest";

import ArrayDeclarationAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ArrayDeclarationAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/** The analyzer's findings on `source`, declared and resolved as 1.3/1.4 do */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new ArrayDeclarationAnalyzer(context).analyze(syntax);
};

describe("ArrayDeclarationAnalyzer", () => {
  describe("E0866 -- a scoped const sizes its own scope's array", () => {
    // #1322 review: the program artifact keyed every const by BARE name, so
    // two scopes each declaring `SIZE` shared one slot and the last one derived
    // won. This legal program was REJECTED, `declared [8] but the initializer
    // has 2 element(s)`, against `Small.table` sized by `Large.SIZE`.
    //
    // The emitted size agrees since #1538 was fixed (#1668, C11): 1.3, 1.4 and
    // render all fold a scope's dimension with that scope's own consts, which
    // `tests/bugs/issue-1538-scope-const-collision/` asserts in the C.
    const twoScopes = (first: string, second: string) =>
      [
        `scope ${first} { private const u8 SIZE <- ${first === "Small" ? 2 : 8}; public u8[SIZE] table <- [${first === "Small" ? "1, 2" : "1, 2, 3, 4, 5, 6, 7, 8"}]; }`,
        `scope ${second} { private const u8 SIZE <- ${second === "Small" ? 2 : 8}; public u8[SIZE] table <- [${second === "Small" ? "1, 2" : "1, 2, 3, 4, 5, 6, 7, 8"}]; }`,
      ].join("\n");

    it("accepts both arrays whichever scope is declared first", () => {
      expect(errors(twoScopes("Small", "Large"))).toEqual([]);
      expect(errors(twoScopes("Large", "Small"))).toEqual([]);
    });

    it("still counts a genuine mismatch inside a scope", () => {
      // The control: without it, "resolves to nothing" would pass this suite
      // exactly as "resolves correctly" does.
      const found = errors(
        "scope Small { private u8 SIZE <- 2; public u8[SIZE] table <- [1, 2, 3]; }",
      );
      expect(found.map((e) => e.code)).toEqual(["E0866"]);
      expect(found[0].message).toContain("declared [2]");
    });
  });

  describe("E0866 -- the initializer against the declaration", () => {
    it("rejects too few and too many elements", () => {
      const found = errors("u8[3] a <- [1, 2];\nu8[3] b <- [1, 2, 3, 4];");
      expect(found.map((e) => [e.code, e.span.line])).toEqual([
        ["E0866", 1],
        ["E0866", 2],
      ]);
      expect(found[0].message).toBe(
        "Array size mismatch: declared [3] but the initializer has 2 element(s)",
      );
    });

    it("counts every nesting level (the closed hole)", () => {
      // Codegen counted the outer list only; the inner excess reached C.
      const found = errors("u8[2][2] m <- [[1, 2, 3], [4, 5]];");
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("at nesting level 2");
    });

    it("accepts a string literal into a u8 array, fill-all at any level, and exact counts", () => {
      const source = [
        'u8[] text <- "Hello";',
        'u8[6] sized <- "Hello";',
        "u8[4] fill <- [0*];",
        "u8[2][3] inner <- [[1*], [2*]];",
        "u8[2][2] exact <- [[1, 2], [3, 4]];",
        "u8[] inferred <- [1, 2, 3];",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });
  });

  it("counts a function's local declaration", () => {
    const found = errors("void f() {\n    u8[3] a <- [1, 2];\n}");
    expect(found.map((e) => [e.code, e.span.line])).toEqual([["E0866", 2]]);
  });
});
