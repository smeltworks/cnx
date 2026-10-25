/**
 * Unit tests for MixedTypeCategoryAnalyzer
 * Tests detection of binary operators combining mixed essential type categories
 * (MISRA C:2012 Rule 10.4, ADR-024 / Issue #1091).
 */
import { describe, it, expect } from "vitest";
import MixedTypeCategoryAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/MixedTypeCategoryAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import type THeaderMacro from "../../../../../cnx/types/THeaderMacro";

function analyze(
  source: string,
  symbolTable?: SymbolTable,
  macros?: Record<string, THeaderMacro>,
) {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
    symbolTable,
    macros,
  });
  return new MixedTypeCategoryAnalyzer(context).analyze(syntax);
}

describe("MixedTypeCategoryAnalyzer", () => {
  describe("mixed-category operands (rejected)", () => {
    it("rejects unsigned + signed (u32 + i32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          u32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0810");
      expect(errors[0].message).toContain("essential type categories");
    });

    it("rejects signed + unsigned (i32 + u32), order-independent", () => {
      const errors = analyze(`
        void main() {
          i32 a <- 1;
          u32 b <- 2;
          i32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed comparison (u32 = i32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          bool c <- (a = b);
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed multiplication (u16 * i16)", () => {
      const errors = analyze(`
        void main() {
          u16 a <- 1;
          i16 b <- 2;
          u16 c <- a * b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed bitwise-or (u8 | i8)", () => {
      const errors = analyze(`
        void main() {
          u8 a <- 1;
          i8 b <- 2;
          u8 c <- a | b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed operand reached through parentheses and negation", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          u32 c <- a + (-b);
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("reports the differing pair in a chain (u32 + u32 + i32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 b <- 2;
          i32 c <- 3;
          u32 d <- a + b + c;
        }
      `);
      expect(errors).toHaveLength(1);
    });
  });

  describe("same-category and exempt operands (accepted)", () => {
    it("accepts same category (u32 + u32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 b <- 2;
          u32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts same category, different width (u8 + u32 widening)", () => {
      const errors = analyze(`
        void main() {
          u8 a <- 1;
          u32 b <- 2;
          u32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts an unsigned variable plus an integer literal", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 c <- a + 5;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts the sanctioned bit-indexed reinterpretation (a + b[0, 32])", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          u32 c <- a + b[0, 32];
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts a single operand (no binary operator)", () => {
      const errors = analyze(`
        void main() {
          i32 b <- 2;
          i32 c <- b;
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("scope-aware variable typing (Issue #1085 review, Finding A)", () => {
    it("does not flag a valid same-category expression because a same-named variable of a different category exists in another function", () => {
      // main's `value` is u32; other's parameter `value` is i32. A flat,
      // file-wide name->type map (last write wins) made `base + value` in main
      // resolve `value` as i32 and falsely reject valid u32 + u32 code.
      const errors = analyze(`
        u32 main() {
          u32 base <- 1;
          u32 value <- 2;
          u32 result <- base + value;
          return 0;
        }
        i32 other(i32 value) {
          return value;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("flags the genuinely mixed expression in its own function, not masked by a same-named variable elsewhere", () => {
      // main's `value + delta` is u32 + i32 (mixed -> 1 error). other's
      // `value + value` is i32 + i32 (same category -> no error). A flat map
      // would mis-type main's `value` as i32 and MISS the real violation.
      const errors = analyze(`
        u32 main() {
          u32 value <- 1;
          i32 delta <- 2;
          u32 r <- value + delta;
          return 0;
        }
        void other(i32 value) {
          i32 x <- value + value;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("does not flag !a = !b — logical negation yields Boolean, not the operand category (Issue #1085)", () => {
      // `!a` and `!b` are both essentially Boolean regardless of a/b signedness,
      // so the comparison shares a category and Rule 10.4 must NOT fire. The old
      // code recursed through `!` and compared a's (unsigned) vs b's (signed)
      // category, falsely rejecting valid code.
      const errors = analyze(`
        void main() {
          u32 a <- 5;
          i32 b <- 3;
          bool r <- !a = !b;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("still flags a + b when operands differ in signedness (control for the ! fix)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 5;
          i32 b <- 3;
          i32 r <- a + b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("isolates variables declared in different named scopes", () => {
      // Each scope's `count` has its own type; neither scope's expression is mixed.
      const errors = analyze(`
        scope A {
          u32 count <- 1;
          u32 total <- count + count;
        }
        scope B {
          i32 count <- 1;
          i32 total <- count + count;
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("shift operators (Rule 10.4 does not govern shifts)", () => {
    it("does not flag a left shift whose count is signed (u32 << i32)", () => {
      // Rule 10.4 only governs operators subject to the usual arithmetic
      // conversions; shifts are not (the count is promoted independently). A
      // signed shift COUNT is a Rule 10.1 concern, not 10.4, so E0810 must not
      // fire here (Issue #1085 review).
      const errors = analyze(`
        void main() {
          u32 value <- 256;
          i32 count <- 2;
          u32 r <- value << count;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("does not flag a right shift whose count is signed (u32 >> i32)", () => {
      const errors = analyze(`
        void main() {
          u32 value <- 256;
          i32 count <- 2;
          u32 r <- value >> count;
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("block-aware variable typing (Issue #1085 review)", () => {
    it("does not flag an outer expression when a different-category variable of the same name is declared in a nested block", () => {
      // The inner `i32 x` shadows only within the if-block. The outer `x + a`
      // (both u32) must not be poisoned by it. A function-wide last-write-wins
      // map mis-typed the outer `x` as i32 and falsely rejected valid code.
      const errors = analyze(`
        void main() {
          u32 x <- 1;
          u32 a <- 2;
          u32 r <- x + a;
          if (r > 0) {
            i32 x <- 5;
            i32 z <- x + x;
          }
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("does not flag an outer expression poisoned by a different-category for-loop variable", () => {
      const errors = analyze(`
        void main() {
          u32 i <- 1;
          mut u32 a <- 2;
          u32 r <- i + a;
          for (mut i32 i <- 0; i < 4; i <- i + 1) {
            a <- a + 1;
          }
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("no cascade of duplicate errors (Issue #1085 review)", () => {
    it("reports a mixed nested expression once, not again at the enclosing level", () => {
      // `a * b` is i32 * u32 (one violation). Representing the product by its
      // leftmost operand (`a`, signed) let the `+ c` level re-report it against
      // `c` (unsigned) — a second, misleading error. The product's category is
      // ambiguous, so the enclosing level must not re-flag it.
      const errors = analyze(`
        void main() {
          i32 a <- 1;
          u32 b <- 2;
          u32 c <- 3;
          u32 r <- a * b + c;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("reports a mix inside parentheses once, not again at the outer operator", () => {
      const errors = analyze(`
        void main() {
          i32 a <- 1;
          u32 b <- 2;
          u32 c <- 3;
          u32 r <- (a + b) + c;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("still flags a uniform compound operand mixed against an outer operand", () => {
      // (a + b) is u32 + u32 (uniform unsigned); combining it with the signed `c`
      // is a real Rule 10.4 violation that must still be caught at the outer `+`.
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 b <- 2;
          i32 c <- 3;
          i32 r <- (a + b) + c;
        }
      `);
      expect(errors).toHaveLength(1);
    });
  });
  // #1668: an integer and a floating operand are different categories, and a
  // compound assignment is the same operator as its binary form.
  describe("floating category and compound assignment (#1668)", () => {
    it.each([
      [
        "an unsigned times a float literal",
        "u32 i <- 3; f32 x <- i * 2.5;",
        "integer and floating",
      ],
      [
        "a float first",
        "f32 k <- 1.0; u32 i <- 3; f32 x <- k * i;",
        "integer and floating",
      ],
      [
        "a signed plus a float",
        "i32 i <- 3; f32 k <- 1.0; f32 x <- i + k;",
        "integer and floating",
      ],
      [
        "a comparison with a float literal",
        "u32 i <- 3; bool b <- (i < 2.5);",
        "integer and floating",
      ],
      [
        "a compound times a float literal",
        "u32 y <- 3; y *<- 2.5;",
        "integer and floating",
      ],
      [
        "a float target plus an unsigned",
        "f32 x <- 1.0; u32 i <- 3; x +<- i;",
        "integer and floating",
      ],
      [
        "a compound signed into unsigned",
        "u32 y <- 3; i32 b <- 2; y +<- b;",
        "signed and unsigned",
      ],
      [
        "a for-update by a signed step",
        "i32 step <- 1; for (u32 i <- 0; i < 8; i +<- step) { }",
        "signed and unsigned",
      ],
    ])("rejects %s", (_label, body, pair) => {
      const errors = analyze(`void main() { ${body} }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0810");
      expect(errors[0].message).toContain(`(${pair})`);
    });

    it.each([
      ["an explicit cast", "u32 i <- 3; f32 x <- (f32)i * 2.5;"],
      ["a float times an integer literal", "f32 k <- 1.0; f32 x <- k * 3;"],
      ["a char literal containing a dot", "u8 c <- 100; u8 d <- c + '.';"],
      ["a hex literal ending in F32", "u32 y <- 3; y +<- 0xFF32;"],
      ["a compound with an integer literal", "u32 y <- 3; y +<- 1;"],
      ["a shift compound", "u32 y <- 3; y <<<- 2;"],
      [
        "a plain assignment, which is Rule 10.3 (#1682)",
        "u32 y <- 3; f32 k <- 1.0; y <- k;",
      ],
      ["a same-category compound", "u32 y <- 3; u8 s <- 1; y +<- s;"],
    ])("accepts %s", (_label, body) => {
      expect(analyze(`void main() { ${body} }`)).toHaveLength(0);
    });
  });
  // #1092 item 1, folded into #1668: an operand is classified by its declared
  // type whatever the path to it. Each of these contributed no category before.
  describe("operands classified by declared type (#1092, #1668)", () => {
    const PRELUDE = [
      "struct Sample { f32 v; i32 offset; u32 count; }",
      "f32 half() { return 2.5; }",
      "i32 minusOne() { return -1; }",
      "Sample makeSample() { Sample s <- { v: 2.5, offset: -1, count: 3 }; return s; }",
    ].join(" ");

    it.each([
      [
        "an array element",
        "u32 a <- 5; i32[2] s <- [1, 2]; u32 r <- a + s[0];",
        "signed and unsigned",
      ],
      [
        "a struct field",
        "Sample p; u32 i <- 3; f32 x <- i * p.v;",
        "integer and floating",
      ],
      [
        "a call result",
        "u32 a <- 5; u32 r <- a + minusOne();",
        "signed and unsigned",
      ],
      [
        "a member after a call",
        "u32 i <- 3; f32 x <- i * makeSample().v;",
        "integer and floating",
      ],
      [
        "a cast",
        "u32 i <- 3; u32 j <- 4; f32 x <- (f32)i * j;",
        "integer and floating",
      ],
      [
        "a ternary's float arm",
        "f32 k <- 1.0; u32 i <- 3; f32 x <- ((i > 0) ? k : k) * i;",
        "integer and floating",
      ],
      [
        "a compound into an element",
        "u32[1] arr <- [3]; arr[0] *<- 2.5;",
        "integer and floating",
      ],
      [
        "a compound into a field",
        "Sample p; p.count +<- p.offset;",
        "signed and unsigned",
      ],
      [
        "a compound in a for initializer",
        "u32 i <- 0; i32 step <- 2; for (i +<- step; i < 8; i +<- 1) { }",
        "signed and unsigned",
      ],
    ])("rejects %s", (_label, body, pair) => {
      const errors = analyze(`${PRELUDE} void main() { ${body} }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`(${pair})`);
    });

    it.each([
      ["a bit extraction", "i32 b <- 1; u32 a <- 5; u32 r <- a + b[0, 32];"],
      [
        "a same-category element",
        "u32[1] arr <- [3]; u32 a <- 5; u32 r <- a + arr[0];",
      ],
      ["a float field times a float literal", "Sample p; f32 x <- p.v * 2.5;"],
      [
        "a cast of the integer beside a float field",
        "Sample p; u32 i <- 3; f32 x <- (f32)i * p.v;",
      ],
      [
        "a signed operand only in a ternary condition",
        "i32 s <- 1; u32 i <- 3; u32 j <- 4; u32 x <- ((s > 0) ? i : j) + i;",
      ],
      ["a float call result times a float", "f32 x <- half() * 2.5;"],
    ])("accepts %s", (_label, body) => {
      expect(analyze(`${PRELUDE} void main() { ${body} }`)).toHaveLength(0);
    });

    it("rejects an integer times a C header float", () => {
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        kind: "variable",
        name: "apiScale",
        type: "float",
        sourceFile: "api.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });
      const errors = analyze(
        "void main() { u32 i <- 3; f32 x <- i * apiScale; }",
        symbolTable,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("(integer and floating)");
    });
  });

  // #1668, ruling 2: Rule 10.4's categories, not only signedness and floating
  describe("MISRA Rule 10.4 categories (#1668)", () => {
    const ENUMS = "enum Color { RED, GREEN } enum Shape { ROUND, SQUARE }";
    const LOCALS =
      "u32 a <- 1; u8 ch <- 65; bool b <- true; Color c <- Color.RED; Shape sh <- Shape.ROUND;";

    it.each([
      [
        "an unsigned compared with a character literal",
        "bool r <- ch = 'A';",
        "unsigned and character",
      ],
      [
        "a character subtracted in a compound",
        "a -<- 'A';",
        "unsigned and character",
      ],
      [
        "an unsigned compared with a Boolean",
        "bool r <- a = b;",
        "unsigned and Boolean",
      ],
      [
        "a signed suffixed literal",
        "u32 r <- a + 5i32;",
        "signed and unsigned",
      ],
    ])("rejects %s", (_label, body, pair) => {
      const errors = analyze(`${ENUMS} void main() { ${LOCALS} ${body} }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`(${pair})`);
    });

    // #1191: an operand its operator does not take is Rule 10.1's (E0925),
    // so the mix it is part of is not reported a second time here
    it.each([
      ["an unsigned plus an enum", "u32 r <- a + c;"],
      ["two different enums", "u32 r <- c + sh;"],
      ["a character literal times an unsigned", "u32 r <- a * 'A';"],
    ])("leaves %s to Rule 10.1", (_label, body) => {
      const errors = analyze(`${ENUMS} void main() { ${LOCALS} ${body} }`);
      expect(errors).toHaveLength(0);
    });

    it.each([
      ["a character added to an unsigned", "u32 r <- a + 'A';"],
      ["a character added in a compound", "a +<- 'A';"],
      ["a cast character literal", "bool r <- ch = (u8)'A';"],
      ["the same enum", "bool r <- c = Color.GREEN;"],
      // E0434 owns a comparison with an enum operand (ADR-017)
      ["an enum compared with an integer", "bool r <- a = c;"],
      ["an unsuffixed literal", "u32 r <- a + 5;"],
      // Rule 10.1 owns a Boolean outside equality (E0807/E0806)
      ["a Boolean operand of arithmetic", "u32 r <- a + b;"],
      ["a Boolean operand of a relational", "bool r <- a < b;"],
      ["a Boolean compound value", "a +<- b;"],
      // An array operand is #1191's defect, not a category mix
      ["a partially indexed array", "i8[2][3] g; u32 r <- a + g[0];"],
    ])("accepts %s", (_label, body) => {
      expect(
        analyze(`${ENUMS} void main() { ${LOCALS} ${body} }`),
      ).toHaveLength(0);
    });

    it("rejects an unsigned plus a C header enum, named by its typedef", () => {
      const symbolTable = new SymbolTable();
      const at = {
        sourceFile: "api.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      } as const;
      symbolTable.addCSymbol({
        kind: "type",
        name: "c_color_t",
        type: "enum {C_RED,C_GREEN}",
        ...at,
      });
      symbolTable.addCSymbol({
        kind: "variable",
        name: "cColor",
        type: "c_color_t",
        ...at,
      });
      const errors = analyze(
        "void main() { u32 a <- 1; u32 r <- a + cColor; }",
        symbolTable,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("(unsigned and enum c_color_t)");
    });

    it("keeps one category for an anonymous C enum reached through an alias", () => {
      const symbolTable = new SymbolTable();
      const at = {
        sourceFile: "api.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      } as const;
      symbolTable.addCSymbol({
        kind: "type",
        name: "c_color_t",
        type: "enum {C_RED,C_GREEN}",
        ...at,
      });
      symbolTable.addCSymbol({
        kind: "type",
        name: "alias_t",
        type: "c_color_t",
        ...at,
      });
      for (const [name, type] of [
        ["cColor", "c_color_t"],
        ["cAlias", "alias_t"],
      ]) {
        symbolTable.addCSymbol({ kind: "variable", name, type, ...at });
      }
      const errors = analyze(
        "void main() { bool same <- cColor = cAlias; u32 a <- 1; u32 r <- a + cAlias; }",
        symbolTable,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("(unsigned and enum c_color_t)");
    });
  });
});

// #1991: read off 1.2's syntax, so where each report lands, which operator
// joins each pair, and an inner level's folded category are asserted directly.
describe("MixedTypeCategoryAnalyzer -- positions, operators, inner levels", () => {
  const where = (body: string) =>
    analyze(`void main() {\n${body}\n}`).map((e) => [e.code, e.line, e.column]);

  it.each([
    ["at a binary level's right operand", "    u8 r <- u + s;", 4, 16],
    ["at a ternary's false arm", "    u8 r <- (s > 0) ? s : u;", 4, 26],
    ["at a compound assignment's value", "    u +<- s;", 4, 10],
  ])("reports %s", (_where, line, row, column) => {
    expect(where(`    i8 s <- 1;\n    u8 u <- 2;\n${line}`)).toEqual([
      ["E0810", row, column],
    ]);
  });

  it("exempts a character only beside the '+' that joins it", () => {
    expect(where("    u32 a <- 1;\n    u32 r <- a - a + 'A';")).toEqual([]);
  });

  it("reads an inner level as the category it folded to", () => {
    expect(where("    u32 a <- 1;\n    u32 r <- (a + 'A') * a;")).toEqual([
      ["E0810", 3, 25],
    ]);
  });
});

describe("MixedTypeCategoryAnalyzer -- an integer beside an unreadable header macro (#1688)", () => {
  function analyzeWithMacro(body: string) {
    return analyze(
      `void main() { u32 i <- 3; bool lt <- true; ${body} }`,
      undefined,
      { RAW: { kind: "unreadable" } },
    ).map((e) => `${e.code} ${e.message}`);
  }

  it.each([
    [
      "a binary operator",
      "u32 b <- i * RAW;",
      "E0811 Binary operator combines an integer operand and a header macro whose type cnx cannot read",
    ],
    [
      "a compound assignment",
      "i +<- RAW;",
      "E0811 Compound assignment combines an integer and a header macro whose type cnx cannot read",
    ],
    [
      "a conditional's value arms",
      "u32 e <- (lt = true) ? i : RAW;",
      "E0812 Conditional operator's value arms combine an integer and a header macro whose type cnx cannot read",
    ],
  ])("names the site for %s", (_label, body, expected) => {
    expect(analyzeWithMacro(body)).toEqual([expected]);
  });
});

describe("MixedTypeCategoryAnalyzer -- a member of the enum being declared", () => {
  it("is an i32, so it does not mix with a u32 (E0810)", () => {
    const errors = analyze(
      "u32 BASE <- 0x10; enum Perm { READ <- 1, X <- Perm.READ + BASE }",
    );
    expect(errors.map((e) => `${e.code} ${e.message}`)).toEqual([
      "E0810 Binary operator combines operands of different essential type categories (signed and unsigned)",
    ]);
  });

  it("is an i32 inside a scope too", () => {
    const errors = analyze(
      "u32 BASE <- 0x10; scope Motor { public enum Perm { READ <- 1, X <- Perm.READ + BASE } }",
    );
    expect(errors.map((e) => e.code)).toEqual(["E0810"]);
  });

  it("combines with its own enum's members silently", () => {
    const errors = analyze(
      "scope Motor { public enum Perm { READ <- 1, WRITE <- 2, RW <- Perm.READ | Perm.WRITE } }",
    );
    expect(errors).toEqual([]);
  });
});
