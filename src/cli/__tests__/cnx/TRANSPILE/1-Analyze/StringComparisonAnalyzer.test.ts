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
  symbolTable.addCSymbol({
    ...at,
    kind: "variable",
    name: "other",
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
const help = (body: string) => errors(body).map((e) => e.helpText);

const RULE = "ADR-045: '=' and '!=' compare a string only with another string.";

describe("StringComparisonAnalyzer", () => {
  it("admits two strings, and a string with a string literal", () => {
    expect(errors('    bool r <- a = b;\n    bool s <- "x" != a;')).toEqual([]);
  });

  it("admits comparisons with no string in them", () => {
    expect(errors("    bool r <- x = 5;\n    bool s <- p = p = p;")).toEqual(
      [],
    );
  });

  it("names the type of a non-string beside a string (#2017)", () => {
    const found = errors(
      '    bool r <- x = "abc";\n    bool s <- "abc" != x;\n    bool t <- p = a;\n    bool u <- a = (a = b);\n    bool v <- 5 = a;\n    bool w <- a != 1.5;',
    );
    expect(found.map((e) => e.code)).toEqual([
      "E0929",
      "E0929",
      "E0929",
      "E0929",
      "E0929",
      "E0929",
    ]);
    expect(found.map((e) => e.message)).toEqual([
      "'x' is a u32, not a string",
      "'x' is a u32, not a string",
      "'p' is a bool, not a string",
      "'(a = b)' is a bool, not a string",
      "'5' is an integer, not a string",
      "'1.5' is a floating-point number, not a string",
    ]);
    expect(found[0].helpText).toBe(RULE);
  });

  it("names the bool and the string a chain compares it with (#1373)", () => {
    expect(
      messages("    bool r <- a = b = c;\n    bool s <- a != b != c;"),
    ).toEqual([
      "'a = b = c' compares the bool 'a = b' with the string 'c'",
      "'a != b != c' compares the bool 'a != b' with the string 'c'",
    ]);
  });

  it("suggests each adjacent pair, every operator kept", () => {
    expect(
      help(
        "    bool r <- a = b != c;\n    bool s <- a != b != c != name;\n    bool t <- a = b = c = name;",
      ),
    ).toEqual([
      "ADR-045: did you mean '(a = b) && (b != c)'?",
      "ADR-045: did you mean '(a != b) && (b != c) && (c != name)'?",
      "ADR-045: did you mean '(a = b) && (b = c) && (c = name)'?",
    ]);
  });

  it("suggests no pairs for a chain that is not all strings", () => {
    expect(help("    bool r <- p = p = a;\n    bool s <- x = x = a;")).toEqual([
      RULE,
      RULE,
    ]);
  });

  it("suggests the plain pair for a bool literal past a string pair", () => {
    const plain = (pair: string) =>
      `ADR-045: a string comparison takes two operands. Did you mean '${pair}'?`;
    expect(
      help(
        "    bool r <- a = b = true;\n    bool s <- a = c != false;\n    bool t <- a != b = false;\n    bool u <- a = b != true;\n    bool v <- a != c = p;\n    bool w <- a = b = true = p;",
      ),
    ).toEqual([
      plain("a = b"),
      plain("a = c"),
      plain("a = b"),
      plain("a != b"),
      plain("(a != c) = p"),
      plain("(a = b) = true = p"),
    ]);
    expect(
      messages("    bool r <- a = b = true;\n    bool s <- a != c = p;"),
    ).toEqual([
      "'a = b = true' compares the bool 'a = b' with 'true'",
      "'a != c = p' compares the bool 'a != c' with 'p'",
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
      "'p = p = p = a' compares the bool 'p = p = p' with the string 'a'",
    ]);
  });

  it("reports a non-string first pair once, not again for the chain", () => {
    expect(messages("    bool r <- p = a = b;")).toEqual([
      "'p' is a bool, not a string",
    ]);
  });

  it("takes a C char array as a string, at the first pair and past it", () => {
    expect(
      errors(
        "    bool r <- a = name;\n    bool s <- name != a;\n    bool t <- name != other;",
      ),
    ).toEqual([]);
    expect(
      messages("    bool r <- p = name;\n    bool s <- p = p = name;"),
    ).toEqual([
      "'p' is a bool, not a string",
      "'p = p = name' compares the bool 'p = p' with the string 'name'",
    ]);
  });

  it("takes a cstring as a string", () => {
    expect(
      messages(
        '    cstring c_s <- "x";\n    bool r <- a = c_s;\n    bool s <- x != c_s;',
      ),
    ).toEqual(["'x' is a u32, not a string"]);
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
