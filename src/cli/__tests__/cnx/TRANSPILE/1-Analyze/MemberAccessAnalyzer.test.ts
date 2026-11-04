import { describe, expect, it } from "vitest";

import MemberAccessAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/MemberAccessAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1805: a `.name` on a value whose type has no members -- E0927. Only a
 * struct, a bitmap, a scope, a register or a header struct or union has
 * members; anything else answers only its length properties.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new MemberAccessAnalyzer(context).analyze(syntax);
};

const DECLS = `struct Point { u32 x; u8 y; }
bitmap8 Flags { a, b, c, d, e, f, g, h }
enum Mode { OFF, ON }
scope Motor {
    public u32 get() { return 7; }
}`;

const inMain = (locals: string, expr: string): string =>
  `${DECLS}\nu32 main() {\n    ${locals}\n    u32 n <- ${expr};\n    return n;\n}`;

describe("MemberAccessAnalyzer", () => {
  it("accepts the members of a type that has them, and length properties", () => {
    for (const [locals, expr] of [
      ["Point p <- {x: 1, y: 2};", "p.x"],
      ["Flags f <- 0;", "f.a ? 1 : 0"],
      ["", "Motor.get()"],
      ["u8 Motor <- 1;", "global.Motor.get()"],
      ["u32 v <- 5;", "v.value_bit_length"],
      ['string<16> s <- "hi";', "s.value_char_count"],
      ["u8[4] a <- [1, 2, 3, 4];", "a.type_element_count"],
    ]) {
      expect(errors(inMain(locals, expr))).toEqual([]);
    }
  });

  it("rejects a member of a value whose type has none", () => {
    for (const [locals, expr, message] of [
      [
        "u8 Motor <- 1;",
        "Motor.get()",
        "'Motor' is a u8 and has no member 'get'",
      ],
      ["u32 v <- 5;", "v.bar", "'v' is a u32 and has no member 'bar'"],
      ["f32 r <- 1.5;", "r.bar", "'r' is a f32 and has no member 'bar'"],
      ["bool b <- true;", "b.bar", "'b' is a bool and has no member 'bar'"],
      ["Mode m <- Mode.ON;", "m.bar", "'m' is a Mode and has no member 'bar'"],
      [
        'string<16> s <- "hi";',
        "s.foo",
        "'s' is a string<16> and has no member 'foo'",
      ],
      [
        "u8[4] a <- [1, 2, 3, 4];",
        "a.foo",
        "'a' is a u8[4] and has no member 'foo'",
      ],
      [
        "Point p <- {x: 1, y: 2};",
        "p.x.bar",
        "'p.x' is a u32 and has no member 'bar'",
      ],
    ]) {
      const found = errors(inMain(locals, expr));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0927");
      expect(found[0].message).toBe(message);
      expect(found[0].span.line).toBe(9);
    }
  });

  it("binds a parameter named like a scope as the parameter", () => {
    const source = `${DECLS}\nu32 read(u8 Motor) {\n    return Motor.get();\n}`;
    expect(errors(source).map((e) => e.message)).toEqual([
      "'Motor' is a u8 and has no member 'get'",
    ]);
  });
});
