import { describe, expect, it } from "vitest";

import StringDeclarationAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/StringDeclarationAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-045's string declaration rules -- E0862 (a capacity has to be
 * stated or inferable), E0863 (a file-scope string takes only a literal),
 * E0864 (the initializer has to fit), E0865 (a substring's bounds have to be
 * inside its source) -- replacing fourteen `StringDeclHelper` throws, the
 * largest single-file group this card moved.
 *
 * Three of those throws ("from a variable", "concatenation", "substring" at
 * global scope) were ONE rule about the initializer's FORM, which is why E0863
 * is a single check with three shapes exercised below.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new StringDeclarationAnalyzer(context).analyze(
    syntax,
    ValuePositions.of(syntax, context),
  );
};

const codes = (source: string) => errors(source).map((e) => e.code);
const inMain = (body: string) => `void f() {\n${body}\n}`;

describe("StringDeclarationAnalyzer", () => {
  describe("E0864 -- the initializer has to fit", () => {
    it("rejects a literal longer than the declared capacity", () => {
      const [found] = errors('string<4> s <- "hello";');
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("(5 chars) exceeds string<4>");
    });

    it("rejects a WIDER source string, which may not fit at runtime", () => {
      const [found] = errors(
        'string<16> src <- "hi";\n' + inMain("    string<4> s <- src;"),
      );
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("from string<16>");
    });

    it("rejects a concatenation whose combined capacity overflows", () => {
      const [found] = errors(
        'string<8> a <- "hi";\nstring<8> b <- "yo";\n' +
          inMain("    string<8> s <- a + b;"),
      );
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("requires capacity 16");
    });

    it("rejects a substring longer than the destination", () => {
      const [found] = errors(
        'string<16> src <- "hi";\n' + inMain("    string<2> s <- src[0, 8];"),
      );
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("Substring length 8 exceeds");
    });
  });

  describe("E0865 -- a substring stays inside its source", () => {
    it("rejects bounds that run past the source's capacity", () => {
      const [found] = errors(
        'string<8> src <- "hi";\n' + inMain("    string<16> s <- src[6, 4];"),
      );
      expect(found.code).toBe("E0865");
      expect(found.message).toContain("[6, 4] exceed the source string<8>");
    });

    it("accepts bounds that end exactly at the capacity", () => {
      expect(
        codes(
          'string<8> src <- "hi";\n' + inMain("    string<16> s <- src[4, 4];"),
        ),
      ).toEqual([]);
    });
  });

  it("stays silent on the forms ADR-045 allows", () => {
    const source = [
      'string<8> src <- "hi";',
      'string<16> greeting <- "hello";',
      "string<32>[2] names;",
      inMain(
        [
          '    string<16> copied <- "ok";',
          "    string<16> fromVar <- src;",
          '    string<24> joined <- src + "!!";',
          "    string<8> part <- src[0, 4];",
          "    string<8> empty;",
        ].join("\n"),
      ),
    ].join("\n");
    expect(codes(source)).toEqual([]);
  });

  describe("what 1.2 reads, it leaves to 1.2 (#1991)", () => {
    it("judges a literal at file scope, and a string in a scope's method", () => {
      const source = [
        'string<1> greeting <- "hello";',
        "scope S {",
        "    public void f() {",
        '        string<1> s <- "hi";',
        "    }",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.span.line])).toEqual([
        ["E0864", 1],
        ["E0864", 4],
      ]);
    });
  });

  it("counts a literal operand of a concatenation by its length", () => {
    const found = errors(
      inMain('    string<2> src <- "hi";\n    string<3> joined <- src + "!!";'),
    );
    expect(found.map((e) => e.message)).toEqual([
      "String concatenation requires capacity 4, but the declaration is string<3>",
    ]);
  });

  it("reads a one-index substring as one character from that index", () => {
    expect(
      codes(inMain('    string<4> src <- "abcd";\n    string<1> c <- src[3];')),
    ).toEqual([]);
  });
  it("checks an argument against its string<N> parameter (#2239)", () => {
    const source =
      "u32 take(string<4> s) {\n    return s.value_char_count;\n}\n" +
      inMain(
        '    string<8> wide <- "abcdefgh";\n    string<2> narrow <- "ab";\n' +
          "    u32 r1 <- take(wide);\n    u32 r2 <- take(narrow + narrow);",
      );
    expect(errors(source).map((e) => e.message)).toEqual([
      "Cannot pass string<8> to a string<4> parameter -- the source may not fit",
    ]);
  });
  it("checks a struct initializer's string<N> field as any string<N> (#2236)", () => {
    const source =
      "struct Cfg {\n    string<4> name;\n    u8 id;\n}\n" +
      'string<4> gs <- "ab";\nCfg g <- { name: gs, id: 1 };\n' +
      inMain(
        '    string<8> wide <- "abcdefgh";\n    string<2> narrow <- "ab";\n' +
          "    Cfg c <- { name: wide, id: 3 };\n    Cfg d <- { name: narrow, id: 4 };",
      );
    expect(errors(source).map((e) => e.code)).toEqual(["E0863", "E0864"]);
  });
  it("takes a substring's length only as a compile-time constant (#2240)", () => {
    const source =
      "void g(u8 n) {\n" +
      '    string<8> src <- "abcdefgh";\n' +
      "    string<4> t <- src[0, n];\n" +
      "    string<4> u <- src[n, 2];\n" +
      "}\n";
    expect(errors(source).map((e) => e.message)).toEqual([
      "A substring's length must be a compile-time constant, not 'n'",
    ]);
  });
});
