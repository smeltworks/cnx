import { describe, expect, it } from "vitest";

import StringComparisonAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/StringComparisonAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";

/**
 * E0929 (ADR-045): `=` / `!=` compares a string only with a string, and a
 * string comparison has two operands. #2017: an integer beside a string
 * literal reached C as a strcmp argument. #1373: past a chain's first pair the
 * left operand is that pair's bool.
 */
const header = () => {
  const symbolTable = new SymbolTable();
  const at = {
    sourceFile: "names.h",
    span: TestSourceSpan.at(1),
    sourceLanguage: ESourceLanguage.C as const,
    visibility: "public" as const,
  };
  symbolTable.addCSymbol({
    ...at,
    kind: "variable",
    name: "name",
    type: "char",
    isArray: true,
    arrayDimensions: [8],
  });
  return symbolTable;
};

const errors = (body: string) => {
  const { syntax, context } = testAnalysisContextFor(
    `void f() {\n    string<8> a <- "x";\n    string<8> b <- "x";\n    string<8> c <- "y";\n    u32 x <- 5;\n    bool p <- true;\n${body}\n}`,
    {
      cppMode: false,
      symbolTable: header(),
      macros: { RAW: { kind: "unreadable" } },
    },
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

  it("names the bool and suggests comparing each operand with the string", () => {
    const help = (body: string) => errors(body).map((e) => e.helpText);
    const rule =
      "ADR-045: '=' and '!=' compare a string only with another string.";
    expect(
      help(
        "    bool r <- a = b = name;\n    bool s <- a = b = c = name;\n    bool t <- a != b = true;\n    bool u <- p = a;",
      ),
    ).toEqual([
      `${rule} 'a = b' is a bool, and a bool cannot be compared with the string 'name'. Did you mean '(a = name) && (b = name)'?`,
      `${rule} 'a = b' is a bool, and a bool cannot be compared with the string 'c'. Did you mean '(a = name) && (b = name) && (c = name)'?`,
      `${rule} 'a != b' is a bool. To compare that bool with 'true', write '(a != b) = true'.`,
      `${rule} Compare the string with another string, a string<N> or a string literal.`,
    ]);
  });

  it("rejects a string comparison with a third operand (#1373)", () => {
    expect(
      messages("    bool r <- a = b = c;\n    bool s <- a != b != c;"),
    ).toEqual([
      "A string comparison takes exactly two operands: 'a = b = c'",
      "A string comparison takes exactly two operands: 'a != b != c'",
    ]);
  });

  it("rejects a bool past a string pair, which (a = b) = true writes out", () => {
    expect(
      messages("    bool r <- a = b = true;\n    bool s <- a != c = p;"),
    ).toEqual([
      "A string comparison takes exactly two operands: 'a = b = true'",
      "A string comparison takes exactly two operands: 'a != c = p'",
    ]);
    expect(errors("    bool r <- (a = b) = true;")).toEqual([]);
  });

  it("reports a chain once, at the comparison before the operand", () => {
    const found = errors("    bool r <- a = b = c = a;");
    expect(found).toHaveLength(1);
    expect(found[0].span).toMatchObject({ line: 7, column: 14, endColumn: 19 });
  });

  it("names the whole chain before a string that meets its bool", () => {
    expect(messages("    bool r <- p = p = p = a;")).toEqual([
      "A string cannot be compared with a value that is not a string: 'p = p = p'",
    ]);
  });

  it("reports a non-string first pair once, not again for the chain", () => {
    expect(messages("    bool r <- p = a = b;")).toEqual([
      "A string cannot be compared with a value that is not a string: 'p'",
    ]);
  });

  it("takes a C char array as a string, at the first pair and past it", () => {
    expect(errors("    bool r <- a = name;\n    bool s <- name != a;")).toEqual(
      [],
    );
    expect(
      messages("    bool r <- p = name;\n    bool s <- p = p = name;"),
    ).toEqual([
      "A string cannot be compared with a value that is not a string: 'p'",
      "A string cannot be compared with a value that is not a string: 'p = p'",
    ]);
  });

  it("takes a cstring as a string", () => {
    expect(
      messages(
        '    cstring c_s <- "x";\n    bool r <- a = c_s;\n    bool s <- x != c_s;',
      ),
    ).toEqual([
      "A string cannot be compared with a value that is not a string: 'x'",
    ]);
  });

  it("leaves an operand cnx cannot type to the C compiler", () => {
    expect(
      errors("    bool r <- a = RAW;\n    bool s <- unknown != a;"),
    ).toEqual([]);
  });

  it("finds a comparison nested inside another expression", () => {
    expect(errors("    bool r <- p && (x != a);").map((e) => e.code)).toEqual([
      "E0929",
    ]);
  });
});
