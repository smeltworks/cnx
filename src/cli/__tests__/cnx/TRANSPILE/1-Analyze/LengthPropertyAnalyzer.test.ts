import { describe, expect, it } from "vitest";

import CResolver from "../../../../../cnx/PARSE/3-Declare/c/index";
import HeaderParser from "../../../../../cnx/PARSE/2-Parse/HeaderParser";
import LengthPropertyAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/LengthPropertyAnalyzer";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-058's length properties, E0867, replacing eighteen throws in
 * `PostfixExpressionGenerator` -- fourteen diagnostics and four internal
 * conditions the audit had read as diagnostics.
 *
 * The rule asks a question of the chain WITHOUT the property step, so a walk
 * that included it would ask about `.type_element_count`'s own type. The tests that
 * exercise structs, enums and bitmaps declare them in their source, so the
 * symbol view is the one 1.3 and 1.4 build in production.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new LengthPropertyAnalyzer(context).analyze(syntax);
};

const inMain = (decls: string, expr: string): string =>
  `${decls}\nu32 main() {\n    u32 n <- ${expr};\n    return n;\n}`;

describe("LengthPropertyAnalyzer", () => {
  it("rejects .type_element_count on a scalar, with a real position", () => {
    const found = errors(inMain("u32 v <- 5;", "v.type_element_count"));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0867");
    expect(found[0].span.line).toBe(3);
    expect(found[0].span.column).toBeGreaterThan(0);
  });

  it("rejects .value_char_count on a float, and answers it on an integer and an array", () => {
    expect(errors(inMain("f32 v <- 5.0;", "v.value_char_count"))).toHaveLength(
      1,
    );
    expect(errors(inMain("u32 v <- 5;", "v.value_char_count"))).toEqual([]);
    expect(errors(inMain("u32[4] a;", "a.value_char_count"))).toEqual([]);
  });

  describe("a value's length now, at file scope (ADR-058)", () => {
    it("rejects a runtime length in a file-scope initializer", () => {
      for (const expr of [
        "v.value_bit_length",
        "v.value_char_count",
        "s.value_char_count",
        "s.value_byte_length",
      ]) {
        const found = errors(
          `u32 v <- 5;\nstring<8> s <- "ab";\nu32 n <- ${expr};`,
        );
        expect(found.map((e) => e.message)).toEqual([
          `.${expr.split(".")[1]} is read at runtime, and a file-scope initializer must be constant`,
        ]);
      }
    });

    it("rejects one in a scope's member initializer, which is at file scope too", () => {
      const found = errors(
        "u32 v <- 5;\nscope M {\n    u32 n <- v.value_bit_length;\n}",
      );
      expect(found).toHaveLength(1);
    });

    it("accepts it inside a function, and a constant length at file scope", () => {
      expect(errors(inMain("u32 v <- 5;", "v.value_bit_length"))).toEqual([]);
      expect(errors("u32 v <- 5;\nu32 n <- v.type_bit_length;")).toEqual([]);
      expect(errors("u32 v <- 5;\nu32 n <- v.memory_byte_length;")).toEqual([]);
    });
  });

  it("accepts a struct's three lengths (#1535, ADR-058 q7)", () => {
    const decls = "struct S { u32 a; u8 b; }\nS s;";
    for (const p of [
      "type_bit_length",
      "type_byte_length",
      "type_element_count",
    ]) {
      expect(errors(inMain(decls, `s.${p}`))).toEqual([]);
    }
    // a struct holds no characters of memory: only a string does
    expect(errors(inMain(decls, "s.memory_char_count"))).toHaveLength(1);
  });

  it("accepts every property on a type that answers it", () => {
    expect(errors(inMain("u32[4] a;", "a.type_element_count"))).toEqual([]);
    expect(
      errors(inMain('string<8> t <- "hi";', "t.value_char_count")),
    ).toEqual([]);
    expect(errors(inMain("u32 v <- 5;", "v.type_bit_length"))).toEqual([]);
    expect(errors(inMain("u32[4] a;", "a.type_byte_length"))).toEqual([]);
    expect(errors(inMain('string<8> t <- "hi";', "t.type_bit_length"))).toEqual(
      [],
    );
  });

  it("accepts an unsized const string as a string", () => {
    // Its type text is `string`, not `string<N>`. A check keyed on the `<`
    // called it not-a-string and rejected `.value_char_count` on it.
    expect(errors(inMain('string V <- "1.0";', "V.value_char_count"))).toEqual(
      [],
    );
  });

  it("accepts .type_bit_length on an enum and a bitmap, which have widths", () => {
    expect(
      errors(
        inMain(
          "enum Color { RED }\nColor c <- Color.RED;",
          "c.type_bit_length",
        ),
      ),
    ).toEqual([]);
    expect(
      errors(
        inMain("bitmap8 Flags { A, Rest[7] }\nFlags f;", "f.type_byte_length"),
      ),
    ).toEqual([]);
  });

  it("sees an array FIELD as an array -- the dimensions the walk used to drop", () => {
    // `structFields` stores the element type; the shape lives in a second map.
    // Reading only the first made `Sample[10] samples` look scalar, and this
    // rejected `.type_element_count` on it.
    expect(
      errors(
        inMain(
          "struct Sample { u32 t; }\nstruct Batch { Sample[10] samples; }\nBatch b;",
          "b.samples.type_element_count",
        ),
      ),
    ).toEqual([]);
  });

  it("rejects .type_element_count once the array is fully subscripted", () => {
    const found = errors(inMain("u32[4] a;", "a[0].type_element_count"));
    expect(found).toHaveLength(1);
  });

  it("treats `args` specially: only .type_element_count answers", () => {
    const src = (p: string) =>
      `u32 main(string<64>[] args) {\n    u32 n <- args.${p};\n    return n;\n}`;
    expect(errors(src("type_bit_length"))).toHaveLength(1);
    expect(errors(src("type_element_count"))).toEqual([]);
    // a removed name is E0886 there too, whose help names the replacement
    expect(errors(src("element_count")).map((e) => e.code)).toEqual(["E0886"]);
  });

  it("says nothing about a subject it cannot resolve", () => {
    // An undeclared name is E0427's, reported in this same pass before this
    // step. Guessing here would be a second diagnostic for one mistake.
    expect(errors(inMain("", "undeclared.type_element_count"))).toEqual([]);
  });

  // #1760 review: ADR-058 -- a field named like a property is a field
  it("reads a struct's field named like a property as the field", () => {
    const decls =
      "struct Buf {\n    u32 length;\n    u32 size;\n    u32 capacity;\n    u32 bit_length;\n}\nBuf b;";
    for (const field of ["length", "size", "capacity", "bit_length"]) {
      expect(errors(inMain(decls, `b.${field}`))).toEqual([]);
    }
  });

  it("still reads a property a struct declares no field of", () => {
    // The control: the same struct without the field is asked the property
    const decls = "struct Buf {\n    u32 count;\n}\nBuf b;";
    expect(errors(inMain(decls, "b.size")).map((e) => e.code)).toEqual([
      "E0887",
    ]);
    expect(errors(inMain(decls, "b.length")).map((e) => e.code)).toEqual([
      "E0886",
    ]);
  });

  it("does not judge a chain being written, in a function, a scope or a for header (#1991)", () => {
    const writes = [
      "void f() {\n    mut u8 x <- 0;\n    x.length <- 1;\n}",
      "scope S {\n    public void f() {\n        mut u8 x <- 0;\n        x.length <- 1;\n    }\n}",
      "void f() {\n    mut u8 x <- 0;\n    for (u8 i <- 0; i < 2; x.length <- 1) {\n    }\n}",
    ];
    for (const source of writes) expect(errors(source)).toEqual([]);
    // The control: the same chain read is judged
    expect(
      errors("void f() {\n    u8 x <- 0;\n    u8 y <- x.length;\n}").map(
        (e) => e.code,
      ),
    ).toEqual(["E0886"]);
  });

  describe("a C header's struct (#1975)", () => {
    /** `typedef struct { uint32_t a; uint8_t b; } Cfg;` and a pointer holder */
    const headerErrors = (expr: string) => {
      // A header's struct is a declared type, as Stage 2 declares it
      const symbolTable = new SymbolTable();
      const tree = HeaderParser.parseC(
        "typedef struct { uint32_t a; uint8_t b; } Cfg;\n" +
          "typedef struct { int32_t i; char *p; } Odd;\n",
      ).syntax;
      symbolTable.addCSymbols(
        CResolver.resolve(tree!, "shapes.h", symbolTable).symbols,
      );
      const { syntax, context } = testAnalysisContextFor(
        inMain("Cfg c;\nOdd o;", expr),
        { cppMode: false, symbolTable },
      );
      return new LengthPropertyAnalyzer(context).analyze(syntax);
    };

    it("answers its fields' sizes, on the type and on a value", () => {
      for (const expr of [
        "Cfg.type_byte_length",
        "c.type_byte_length",
        "c.a.type_byte_length",
        "Cfg.b.type_bit_length",
        "o.i.type_byte_length",
      ]) {
        expect(headerErrors(expr)).toEqual([]);
      }
    });

    it("has no length for a pointer field, or a struct holding one", () => {
      for (const expr of [
        "o.p.type_byte_length",
        "Odd.type_byte_length",
        "o.type_bit_length",
      ]) {
        const found = headerErrors(expr);
        expect(found.map((e) => e.code)).toEqual(["E0867"]);
        expect(found[0].message).toMatch(/char\*|Odd/);
      }
    });
  });
});
