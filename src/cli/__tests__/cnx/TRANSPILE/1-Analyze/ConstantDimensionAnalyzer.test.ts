import { describe, expect, it } from "vitest";
import CResolver from "../../../../../cnx/PARSE/3-Declare/c/index";
import HeaderParser from "../../../../../cnx/PARSE/2-Parse/HeaderParser";
import ConstantDimensionAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ConstantDimensionAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";

function errors(
  source: string,
  helpers?: Record<string, string>,
): {
  code: string;
  span: { line: number; column: number };
  message: string;
}[] {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
    helpers,
  });
  return new ConstantDimensionAnalyzer(context).analyze(syntax);
}

describe("ConstantDimensionAnalyzer (#1175: E0909, E0910)", () => {
  // Every position the grammar has a dimension at, so a rule checked at one
  // and silent at another is caught -- the hole this card closes
  it.each([
    ["a global", "mut u8 n <- 3;\nu8[n] g;", "'n' is a variable"],
    [
      "a local",
      "void f(u32 n) {\n    mut u8[n] a;\n    a[0] <- 1;\n}",
      "'n' is a parameter",
    ],
    ["a parameter", "void f(u32 n, u8[n] p) {\n}", "'n' is a parameter"],
    [
      "a struct field",
      "mut u8 n <- 3;\nstruct S {\n    u8[n] data;\n}",
      "'n' is a variable",
    ],
    [
      "a scope member",
      "mut u8 n <- 3;\nscope M {\n    u8[n] slots;\n}",
      "'n' is a variable",
    ],
    // #1863 review: reported by nothing else, these reached render's invariant
    [
      "a divisor that is zero only once computed",
      "u8[4 / (2 - 2)] g;",
      "it divides by zero",
    ],
    [
      "a member the scope does not have",
      "scope S {\n    public u8 MAX <- 4;\n}\nu8[S.NOPE] g;",
      "'S.NOPE' is not declared",
    ],
  ])("rejects a dimension with no value: %s", (_label, source, why) => {
    const [found] = errors(source);
    expect(found?.code).toBe("E0909");
    expect(found?.message).toContain(why);
  });

  it("rejects one whose arithmetic overflows its operands' type (ADR-044)", () => {
    const [found] = errors("u8 A <- 200;\nu8[A + A] buf;");
    expect(found).toMatchObject({
      code: "E0910",
      span: { line: 2, column: 3 },
    });
    expect(found.message).toContain("overflows u8");
  });

  it.each([
    ["a literal", "u8[4] a;"],
    ["a const, and arithmetic over it", "u8 N <- 4;\nu8[N * 2 + 1] a;"],
    ["a wider cast", "u8 A <- 200;\nu8[(u16)A + (u16)A] a;"],
    ["a primitive's length", "u8[u32.type_byte_length] a;"],
    ["an enum member", "enum E { A, B, COUNT }\nu8[E.COUNT] a;"],
    ["a property", "u8[3] src;\nu8[src.type_element_count] a;"],
    // not this analyzer's: E0427 reports an undeclared bare name
    ["an undeclared name", "u8[NOT_DECLARED] a;"],
  ])("accepts %s", (_label, source) => {
    expect(errors(source)).toEqual([]);
  });

  it("folds a const declared in an included file", () => {
    expect(
      errors(`#include "lib.cnx"\nu8[(LIB_N + 1)] a;`, {
        "lib.cnx": "u32 LIB_N <- 4;\n",
      }),
    ).toEqual([]);
  });

  describe("a C header's struct (#2076)", () => {
    /** `typedef struct { uint32_t a; uint8_t b; } Cfg;` and a pointer holder */
    const headerErrors = (source: string) => {
      // A header's struct is a declared type, as Stage 2 declares it
      const symbolTable = new SymbolTable();
      const tree = HeaderParser.parseC(
        "typedef struct { uint32_t a; uint8_t b; } Cfg;\n" +
          "typedef struct { int32_t i; char *p; } Odd;\n",
      ).syntax;
      symbolTable.addCSymbols(
        CResolver.resolve(tree!, "shapes.h", symbolTable).symbols,
      );
      const { syntax, context } = testAnalysisContextFor(source, {
        cppMode: false,
        symbolTable,
      });
      return {
        errors: new ConstantDimensionAnalyzer(context).analyze(syntax),
        program: context.program,
      };
    };

    it.each([
      ["the type", "u8[Cfg.type_byte_length] a;", 5],
      ["a field of the type", "u8[Cfg.a.type_bit_length] a;", 32],
      ["a value", "Cfg c;\nu8[c.type_byte_length] a;", 5],
      ["a field of a value", "Cfg c;\nu8[c.b.type_byte_length] a;", 1],
    ])("sizes an array by %s's fields summed", (_label, source, length) => {
      const { errors: found, program } = headerErrors(source);
      expect(found).toEqual([]);
      const array = program.symbolByCName("a");
      expect(array?.kind === "variable" && array.arrayDimensions).toEqual([
        length,
      ]);
    });

    it("has no size for a struct holding a pointer (cnx has none)", () => {
      const { errors: found } = headerErrors(
        "u8[Odd.i.type_byte_length] ok;\nu8[Odd.type_byte_length] a;",
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ code: "E0909", span: { line: 2 } });
      expect(found[0].message).toContain("'Odd.type_byte_length'");
    });
  });
});

describe("ConstantDimensionAnalyzer on 1.2's syntax (#1991)", () => {
  // A dimension after the name and a cast's are each their own
  // place in 1.2's syntax, so each is asked on its own
  it.each([
    ["a global", "mut u8 n <- 3;\nu8 g[n];"],
    ["a local", "void f(u32 n) {\n    mut u8 a[n];\n    a[0] <- 1;\n}"],
    ["a parameter", "void f(u32 n, u8 p[n]) {\n}"],
    ["a struct field", "mut u8 n <- 3;\nstruct S {\n    u8 data[n];\n}"],
    ["a scope member", "mut u8 n <- 3;\nscope M {\n    u8 slots[n];\n}"],
    [
      "a cast's type",
      "mut u8 n <- 3;\nvoid f(u8 x) {\n    u32 y <- (u8[n])x;\n}",
    ],
  ])("rejects a dimension with no value: %s", (_label, source) => {
    expect(errors(source).map((e) => e.code)).toEqual(["E0909"]);
  });

  it("leaves a length of a subscript to the expression it is", () => {
    expect(
      errors(
        "u8[4] arr;\nvoid f(u32 i) {\n    u32 s <- arr[i].type_byte_length;\n}",
      ),
    ).toEqual([]);
  });

  it("reports a declaration's dimensions in source order", () => {
    const found = errors("mut u8 n <- 3;\nu8[n] g[n];");
    expect(found.map((e) => [e.span.line, e.span.column])).toEqual([
      [2, 3],
      [2, 8],
    ]);
  });
});

describe("ConstantDimensionAnalyzer (#1283: E0359)", () => {
  const macros = {
    N_HANDLERS: {
      kind: "integer",
      valueByIntBits: new Map([
        [16, 3],
        [32, 3],
      ]),
    },
    N_UNREADABLE: {
      kind: "integer",
      valueByIntBits: new Map([
        [16, null],
        [32, null],
      ]),
    },
  } as const;
  const errorsWith = (source: string) => {
    const { syntax, context } = testAnalysisContextFor(source, {
      cppMode: false,
      macros,
    });
    return new ConstantDimensionAnalyzer(context).analyze(syntax);
  };
  const callback = "u32 onSample(u32 input) {\n    return input + 1;\n}\n";
  const withDefault = `${callback}struct Inner {\n    onSample handler;\n}\n`;

  it.each([
    [
      "a callback field",
      `${callback}struct S {\n    onSample[N_UNREADABLE] hs;\n}`,
    ],
    ["a callback global", `${callback}onSample[N_UNREADABLE] hs;`],
    ["a struct with a default", `${withDefault}Inner[N_UNREADABLE] g;`],
    ["a global-qualified one", `${withDefault}global.Inner[N_UNREADABLE] g;`],
    [
      "a scope's own, by this.",
      `${callback}scope M {\n    struct T {\n        onSample h;\n    }\n    this.T[N_UNREADABLE] ts;\n}`,
    ],
    [
      "a scope's, qualified",
      `${callback}scope M {\n    public struct T {\n        onSample h;\n    }\n}\nM.T[N_UNREADABLE] ts;`,
    ],
    [
      "a scope's own, bare",
      `${callback}scope M {\n    struct T {\n        onSample h;\n    }\n    T[N_UNREADABLE] ts;\n}`,
    ],
    [
      "a callback field, C-style",
      `${callback}struct S {\n    onSample hs[N_UNREADABLE];\n}`,
    ],
    ["a struct global, C-style", `${withDefault}Inner g[N_UNREADABLE];`],
    [
      "a local",
      `${withDefault}u32 run() {\n    Inner[N_UNREADABLE] ls;\n    return 0;\n}`,
    ],
    [
      "a scope method's local, bare",
      `${callback}scope M {\n    struct T {\n        onSample h;\n    }\n    public u32 run() {\n        T[N_UNREADABLE] ls;\n        return 0;\n    }\n}`,
    ],
    [
      "an enum in a struct with no callback (#1971)",
      "enum Mode { IDLE, RUN }\nstruct S {\n    Mode[N_UNREADABLE] modes;\n}",
    ],
    [
      "an enum outside a struct (#1971)",
      "enum Mode { IDLE, RUN }\nMode[N_UNREADABLE] modes;",
    ],
    [
      "an enum in a struct with a default",
      `${callback}enum Mode { IDLE, RUN }\nstruct S {\n    onSample h;\n    Mode[N_UNREADABLE] modes;\n}`,
    ],
  ])("rejects %s sized by a macro cnx cannot read", (_label, source) => {
    const found = errorsWith(source);
    expect(found.map((error) => error.code)).toEqual(["E0359"]);
    expect(found[0].message).toContain("'N_UNREADABLE'");
  });

  it.each([
    ["a readable macro", `${callback}onSample[N_HANDLERS] hs;`],
    ["readable arithmetic", `${callback}onSample[N_HANDLERS * 2 - 1] hs;`],
    ["a primitive array", "u8[N_UNREADABLE] bytes;"],
    [
      "a struct with no default",
      "struct P {\n    u8 x;\n}\nP[N_UNREADABLE] ps;",
    ],
  ])("accepts %s", (_label, source) => {
    expect(errorsWith(source)).toEqual([]);
  });
});
