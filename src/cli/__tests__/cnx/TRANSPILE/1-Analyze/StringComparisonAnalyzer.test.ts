import { describe, expect, it } from "vitest";

import StringComparisonAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/StringComparisonAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * E0929 (ADR-045): `=` / `!=` compares a string only with a string. #2017: an
 * integer beside a string literal reached C as a strcmp argument. #1373: past
 * a chain's first pair a string is compared with that pair's bool.
 */
const errors = (body: string) => {
  const { syntax, context } = testAnalysisContextFor(
    `void f() {\n    string<8> a <- "x";\n    string<8> b <- "x";\n    string<8> c <- "y";\n    u32 x <- 5;\n    bool p <- true;\n${body}\n}`,
    { cppMode: false },
  );
  return new StringComparisonAnalyzer(context).analyze(syntax);
};

const messages = (body: string) => errors(body).map((e) => e.message);

describe("StringComparisonAnalyzer", () => {
  it("admits two strings, and a string with a string literal", () => {
    expect(errors('    bool r <- a = b;\n    bool s <- "x" != a;')).toEqual([]);
  });

  it("admits comparisons with no string in them", () => {
    expect(errors("    bool r <- x = 5;\n    bool s <- p = p = p;")).toEqual(
      [],
    );
  });

  it("rejects an integer on either side of = and != (#2017)", () => {
    const found = errors(
      '    bool r <- x = "abc";\n    bool s <- "abc" != x;\n    bool t <- p = a;',
    );
    expect(found.map((e) => e.code)).toEqual(["E0929", "E0929", "E0929"]);
    expect(found.map((e) => e.message)).toEqual([
      "A string cannot be compared with a value that is not a string: 'x'",
      "A string cannot be compared with a value that is not a string: 'x'",
      "A string cannot be compared with a value that is not a string: 'p'",
    ]);
  });

  it("rejects a string past a chain's first pair, which meets a bool (#1373)", () => {
    expect(
      messages("    bool r <- a = b = c;\n    bool s <- a != b != c;"),
    ).toEqual([
      "A string cannot be compared with a value that is not a string: 'a = b'",
      "A string cannot be compared with a value that is not a string: 'a != b'",
    ]);
  });

  it("names the whole chain before the string it rejects", () => {
    expect(messages("    bool r <- p = p = p = a;")).toEqual([
      "A string cannot be compared with a value that is not a string: 'p = p = p'",
    ]);
  });

  it("admits a bool past a string chain's first pair", () => {
    expect(
      errors("    bool r <- a = b = true;\n    bool s <- a != c = p;"),
    ).toEqual([]);
  });

  it("finds a comparison nested inside another expression", () => {
    expect(errors("    bool r <- p && (x != a);").map((e) => e.code)).toEqual([
      "E0929",
    ]);
  });
});
