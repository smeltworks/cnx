import { describe, expect, it } from "vitest";
import ConstantEvaluator from "../ConstantEvaluator";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type IConstantEnvironment from "../types/IConstantEnvironment";

const AT = { line: 1, column: 0, endLine: 1, endColumn: 0 };

function lit(digits: string, typeName: string | null = null): TConstExpr {
  return { kind: "literal", digits, text: digits, typeName };
}
function name(...path: string[]): TConstExpr {
  return { kind: "name", root: null, path, at: AT };
}
function bin(
  op: Extract<TConstExpr, { kind: "binary" }>["op"],
  left: TConstExpr,
  right: TConstExpr,
): TConstExpr {
  return { kind: "binary", op, left, right };
}
function un(
  op: Extract<TConstExpr, { kind: "unary" }>["op"],
  operand: TConstExpr,
): TConstExpr {
  return { kind: "unary", op, operand };
}
function cast(typeName: string, operand: TConstExpr): TConstExpr {
  return { kind: "cast", typeName, operand, at: AT };
}

/** A name table standing in for the binder: what each spelling is worth */
function env(table: Record<string, TConstResult>): IConstantEnvironment {
  return {
    valueOf: (n) =>
      table[n.path.join(".")] ?? {
        kind: "notConstant",
        reason: "unknown",
        spelling: n.path.join("."),
        at: n.at,
      },
    isTypeName: () => true,
    cTypeName: (t) => t,
  };
}
const NONE = env({});
const U8_200: TConstResult = { kind: "value", value: 200n, typeName: "u8" };
const FLT_MAX = 3.4028234663852886e38;

function valueOf(expr: TConstExpr, e = NONE): bigint | string {
  const result = ConstantEvaluator.evaluate(expr, e);
  return result.kind === "value" ? result.value : result.kind;
}

describe("ConstantEvaluator", () => {
  describe("the value is the value the expression has at run time (ADR-044)", () => {
    it.each<[string, TConstExpr, bigint | string]>([
      ["1 + 2", bin("+", lit("1"), lit("2")), 3n],
      [
        "1 - -1 (unary minus, not a decrement)",
        bin("-", lit("1"), un("-", lit("1"))),
        2n,
      ],
      ["1 + 2 + 3", bin("+", bin("+", lit("1"), lit("2")), lit("3")), 6n],
      ["1 << 3", bin("<<", lit("1"), lit("3")), 8n],
      ["0x10 + 1, from digits", bin("+", lit("16"), lit("1")), 17n],
      ["4 * 5", bin("*", lit("4"), lit("5")), 20n],
      ["7 / 2 truncates toward zero", bin("/", lit("7"), lit("2")), 3n],
      [
        "-7 / 2 truncates toward zero",
        bin("/", un("-", lit("7")), lit("2")),
        -3n,
      ],
      [
        "-7 % 2 takes the dividend's sign",
        bin("%", un("-", lit("7")), lit("2")),
        -1n,
      ],
      ["~0 is -1: an untyped literal is an i32", un("~", lit("0")), -1n],
      ["~(u8)0 is 255", un("~", cast("u8", lit("0"))), 255n],
      ["1 | 2 | 4", bin("|", bin("|", lit("1"), lit("2")), lit("4")), 7n],
      ["6 & 3", bin("&", lit("6"), lit("3")), 2n],
      ["6 ^ 3", bin("^", lit("6"), lit("3")), 5n],
      ["16 >> 2", bin(">>", lit("16"), lit("2")), 4n],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr)).toBe(expected);
    });
  });

  describe("an operation happens at its operands' width, and overflow is not a value", () => {
    const withA = env({ A: U8_200 });
    it.each<[string, TConstExpr, bigint | string]>([
      [
        "A + A on a u8 overflows (clamp would give 255)",
        bin("+", name("A"), name("A")),
        "overflow",
      ],
      [
        "(u16)A + (u16)A is 400",
        bin("+", cast("u16", name("A")), cast("u16", name("A"))),
        400n,
      ],
      [
        "A - 201 on a u8 overflows (clamp would give 0)",
        bin("-", name("A"), lit("201")),
        "overflow",
      ],
      [
        "A - 3 on a u8 is 197: the literal takes A's type",
        bin("-", name("A"), lit("3")),
        197n,
      ],
      [
        "(u8)200 + (u8)100 overflows",
        bin("+", cast("u8", lit("200")), cast("u8", lit("100"))),
        "overflow",
      ],
      [
        "a mixed u8 + u16 happens at u16",
        bin("+", name("A"), cast("u16", lit("100"))),
        300n,
      ],
      [
        "literals alone happen at i32: 0x40000000 * 2 overflows",
        bin("*", lit("1073741824"), lit("2")),
        "overflow",
      ],
      ["1 << 31 does not fit i32", bin("<<", lit("1"), lit("31")), "overflow"],
      ["-(u8)1 does not fit u8", un("-", cast("u8", lit("1"))), "overflow"],
      ["(u8)300 does not fit u8", cast("u8", lit("300")), "overflow"],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr, withA)).toBe(expected);
    });

    it("reports the type the arithmetic overflowed at", () => {
      const result = ConstantEvaluator.evaluate(
        bin("+", name("A"), name("A")),
        withA,
      );
      expect(result).toEqual({ kind: "overflow", typeName: "u8" });
    });

    it("keeps an all-literal result untyped, so a later typed operand gives it a type", () => {
      // (1 + 2) + A: the literal sum must not be fixed at i32, or the outer
      // addition would happen at i32 instead of at A's u8
      const result = ConstantEvaluator.evaluate(
        bin("+", bin("+", lit("1"), lit("2")), name("A")),
        withA,
      );
      expect(result).toEqual({ kind: "value", value: 203n, typeName: "u8" });
    });
  });

  describe("what has no value", () => {
    it.each<[string, TConstExpr, string]>([
      ["division by zero", bin("/", lit("1"), lit("0")), "divisionByZero"],
      ["modulo by zero", bin("%", lit("1"), lit("0")), "divisionByZero"],
      [
        "a negative shift amount",
        bin("<<", lit("1"), un("-", lit("1"))),
        "negativeShift",
      ],
      [
        "a right shift of a negative value",
        bin(">>", un("-", lit("8")), lit("1")),
        "negativeShift",
      ],
      ["an unknown name", name("limit"), "unknown"],
    ])("%s", (_label, expr, reason) => {
      const result = ConstantEvaluator.evaluate(expr, NONE);
      expect(result.kind === "notConstant" && result.reason).toBe(reason);
    });

    it("reports the first thing that has no value, with its spelling", () => {
      const expr: TConstExpr = {
        kind: "other",
        what: "call",
        spelling: "pick()",
        at: AT,
      };
      expect(
        ConstantEvaluator.evaluate(bin("+", expr, lit("1")), NONE),
      ).toEqual({
        kind: "notConstant",
        reason: "call",
        spelling: "pick()",
        at: AT,
      });
    });

    it("prefers a missing value to an overflow beside it", () => {
      const withA = env({ A: U8_200 });
      const expr = bin("+", bin("+", name("A"), name("A")), name("limit"));
      expect(valueOf(expr, withA)).toBe("notConstant");
    });
  });

  describe("a name only C knows", () => {
    const withMacro = env({
      BUF_SIZE: { kind: "foreign", spelling: "BUF_SIZE", why: "header" },
    });
    it("makes the whole expression foreign: C evaluates it", () => {
      expect(valueOf(bin("+", name("BUF_SIZE"), lit("1")), withMacro)).toBe(
        "foreign",
      );
    });
    it("a missing value still wins over a foreign name", () => {
      const expr = bin("+", name("BUF_SIZE"), name("limit"));
      expect(valueOf(expr, withMacro)).toBe("notConstant");
    });
  });

  describe("as C, only what is evaluated must be constant (C99 6.6p3)", () => {
    it("a ternary evaluates only the arm it chooses", () => {
      const expr: TConstExpr = {
        kind: "ternary",
        condition: bin("<", lit("1"), lit("2")),
        whenTrue: lit("10"),
        whenFalse: name("limit"),
      };
      expect(valueOf(expr)).toBe(10n);
    });
    it("&& short-circuits", () => {
      expect(
        valueOf(bin("&&", bin("=", lit("1"), lit("2")), name("limit"))),
      ).toBe(0n);
    });
    it("|| short-circuits", () => {
      expect(
        valueOf(bin("||", bin("!=", lit("1"), lit("2")), name("limit"))),
      ).toBe(1n);
    });
  });

  describe("names are the environment's to answer", () => {
    it("asks the environment with the name's whole path", () => {
      const withMember = env({
        "EPerm.READ": { kind: "value", value: 1n, typeName: null },
        "EPerm.WRITE": { kind: "value", value: 2n, typeName: null },
      });
      expect(
        valueOf(
          bin("|", name("EPerm", "READ"), name("EPerm", "WRITE")),
          withMember,
        ),
      ).toBe(3n);
    });
  });

  describe("a literal takes the smallest type that fits its context at compile time (ADR-044)", () => {
    const at = (expr: TConstExpr, context: string | null, e = NONE) => {
      const result = ConstantEvaluator.evaluate(expr, e, context);
      return result.kind === "value" ? result.value : result.kind;
    };

    it.each<[string, TConstExpr, string | null, bigint | string]>([
      // #1863 review: main folded this to 2147483648; at i32 it overflows
      [
        "2147483647 + 1 in an i64",
        bin("+", lit("2147483647"), lit("1")),
        "i64",
        2147483648n,
      ],
      [
        "2147483647 + 1 with no context",
        bin("+", lit("2147483647"), lit("1")),
        null,
        "overflow",
      ],
      [
        "3000000000 + 1 in a u32",
        bin("+", lit("3000000000"), lit("1")),
        "u32",
        3000000001n,
      ],
      ["~0 in a u32", un("~", lit("0")), "u32", 4294967295n],
      ["~0 with no context", un("~", lit("0")), null, -1n],
      ["0 - 1 in a u32", bin("-", lit("0"), lit("1")), "u32", "overflow"],
      // A cast is the context of what it encloses
      [
        "(u64)(1 << 40)",
        cast("u64", bin("<<", lit("1"), lit("40"))),
        null,
        1099511627776n,
      ],
    ])("%s", (_label, expr, context, expected) => {
      expect(at(expr, context)).toBe(expected);
    });

    it("leaves a typed operand at its own width: A + A for u8 A overflows in a u16", () => {
      const withA = env({ A: U8_200 });
      expect(at(bin("+", name("A"), name("A")), "u16", withA)).toBe("overflow");
    });
  });

  describe("a suffixed literal must fit its type (#1863 review)", () => {
    it.each<[string, TConstExpr, bigint | string]>([
      ["300u8", lit("300", "u8"), "overflow"],
      ["255u8", lit("255", "u8"), 255n],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr)).toBe(expected);
    });
  });

  describe("a comparison happens at its operands' type (#1863 review)", () => {
    const withN = env({ N: { kind: "value", value: 5n, typeName: "u32" } });
    it.each<[string, TConstExpr, bigint | string]>([
      // C compares against UINT_MAX there; the value would disagree
      [
        "N > -1 for a u32 N",
        bin(">", name("N"), un("-", lit("1"))),
        "overflow",
      ],
      ["N > 1 for a u32 N", bin(">", name("N"), lit("1")), 1n],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr, withN)).toBe(expected);
    });
  });

  describe("a name only C knows does not make the operand beside it constant (#1863 review)", () => {
    const withMacroAndVar = env({
      MACRO_N: { kind: "foreign", spelling: "MACRO_N", why: "maybeHeader" },
      n: { kind: "notConstant", reason: "parameter", spelling: "n", at: AT },
    });
    const ternary = (whenFalse: TConstExpr): TConstExpr => ({
      kind: "ternary",
      condition: bin(">", name("MACRO_N"), lit("2")),
      whenTrue: lit("4"),
      whenFalse,
    });
    it.each<[string, TConstExpr, string]>([
      ["MACRO_N > 2 ? 4 : n", ternary(name("n")), "notConstant"],
      ["MACRO_N > 2 ? 4 : 1 (control)", ternary(lit("1")), "foreign"],
      ["MACRO_N && n", bin("&&", name("MACRO_N"), name("n")), "notConstant"],
      [
        "MACRO_N && 1 (control)",
        bin("&&", name("MACRO_N"), lit("1")),
        "foreign",
      ],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr, withMacroAndVar)).toBe(expected);
    });
  });

  describe("toNumber", () => {
    it.each<[bigint, number | undefined]>([
      [3n, 3],
      [-1n, -1],
      [9007199254740991n, 9007199254740991],
      [9007199254740992n, undefined],
    ])("%s", (value, expected) => {
      expect(ConstantEvaluator.toNumber(value)).toBe(expected);
    });
  });

  // #1268 review: one zero test for an integer and a float divisor (ADR-051 §4)
  describe("numberValue: an integer or float constant expression's value", () => {
    const at = AT;
    const float = (spelling: string): TConstExpr => ({
      kind: "other",
      what: "float",
      spelling,
      at,
    });
    const F32_TINY = Math.fround(1e-30);
    const F64_TINY = 1e-30;
    const number = (expr: TConstExpr, e = NONE): number | null =>
      ConstantEvaluator.numberValue(expr, e);
    const f32 = (value: number): TConstResult => ({
      kind: "float",
      value: Math.fround(value),
      typeName: "f32",
      spelling: "F",
      at,
    });

    it.each([
      ["an integer the fold answers", bin("-", lit("2"), lit("2")), 0],
      ["a float literal", float("0.0"), 0],
      ["a suffixed float literal", float("0.5f32"), 0.5],
      ["a negated float", un("-", float("1.5")), -1.5],
      ["a float cast of an integer", cast("f32", lit("0")), 0],
      ["a cast to f32 rounds", cast("f32", float("0.1")), Math.fround(0.1)],
      ["a sum", bin("+", float("0.5"), float("0.25")), 0.75],
      ["a difference", bin("-", float("1.0"), float("1.0")), 0],
      ["a product", bin("*", float("2.0"), float("0.5")), 1],
      ["a quotient", bin("/", float("1.0"), float("4.0")), 0.25],
      // C computes f32 op f32 in float (FLT_EVAL_METHOD 0): each is 0.0f
      [
        "f32 arithmetic rounds at f32",
        bin("-", bin("+", float("0.1f32"), float("0.2f32")), float("0.3f32")),
        0,
      ],
      [
        "f32 arithmetic flushes to zero at f32",
        bin("*", float("1e-30f32"), float("1e-30f32")),
        0,
      ],
      [
        "an f64 operand widens the operation",
        bin("*", float("1e-30f32"), float("1e-30")),
        F32_TINY * F64_TINY,
      ],
      [
        "an integer operand converts to the float's type",
        bin("+", lit("1"), float("0.1f32")),
        Math.fround(1 + Math.fround(0.1)),
      ],
      // C converts to f32 once; through double it would round twice
      [
        "an integer past 2^53 converts to f32 once",
        bin(
          "-",
          cast("f32", lit("1152921573326323713", "u64")),
          cast("f32", lit("1152921504606846976", "u64")),
        ),
        2 ** 37,
      ],
      [
        "an integer past 2^53 beside an f32 operand converts once",
        bin(
          "-",
          lit("1152921573326323713", "u64"),
          float("1152921504606846976.0f32"),
        ),
        2 ** 37,
      ],
      [
        "a negative integer past 2^53 converts to f32 once",
        cast("f32", un("-", lit("1152921573326323713", "i64"))),
        -(2 ** 60 + 2 ** 37),
      ],
      [
        "an integer past 2^53 an f32 holds exactly",
        cast("f32", lit("1152921504606846976", "u64")),
        2 ** 60,
      ],
      [
        "an f32 literal just above a midpoint rounds up",
        bin("-", float("1.00000005960464477550f32"), float("1.0f32")),
        2 ** -23,
      ],
      [
        "an f32 literal on a midpoint rounds to even",
        float("1.000000059604644775390625f32"),
        1,
      ],
      [
        "an f32 literal just below a midpoint that ties up rounds down",
        float("1.00000017881393432617187499f32"),
        1 + 2 ** -23,
      ],
      [
        "an f32 literal just below the midpoint past FLT_MAX is FLT_MAX",
        float("340282356779733651637539395458142568448.0f32"),
        FLT_MAX,
      ],
      [
        "an f32 literal on the midpoint below the smallest subnormal is zero",
        float(
          "7.00649232162408535461864791644958065640130970938257885878534141944895541342930300743319094181060791015625e-46f32",
        ),
        0,
      ],
      [
        "an f32 literal just above that midpoint is the smallest subnormal",
        float(
          "7.006492321624085354618647916449580656401309709382578858785341419448955413429303007433190941810607910156251e-46f32",
        ),
        2 ** -149,
      ],
      [
        "an f32 literal just below that midpoint is zero",
        float(
          "7.00649232162408535461864791644958065640130970938257885878534141944895541342930300743319094181060791015624e-46f32",
        ),
        0,
      ],
      [
        "an f32 literal on the midpoint past FLT_MAX is infinity",
        float("340282356779733661637539395458142568448.0f32"),
        Infinity,
      ],
      [
        "an f32 literal just below a midpoint rounds down",
        float("1.0000000596046447753906249999f32"),
        1,
      ],
      [
        "an f32 literal with an exponent, on a midpoint",
        float("1000000059604644775390625e-24f32"),
        1,
      ],
      [
        "an f32 literal with an exponent, above a midpoint",
        float("100000005960464477550e-20f32"),
        1 + 2 ** -23,
      ],
      [
        "an f32 literal just below a midpoint, under 1",
        float("0.50000002980232238769531249f32"),
        0.5,
      ],
      // ADR-024: a float cast to an integer type saturates, else truncates
      ["(u32)0.5 truncates", cast("u32", float("0.5")), 0],
      ["(u32)1.5 truncates", cast("u32", float("1.5")), 1],
      ["(u32)-0.5 is below the minimum", cast("u32", un("-", float("0.5"))), 0],
      ["(u8)300.0 is past the maximum", cast("u8", float("300.0")), 255],
      [
        "(u32)4294967296.0f32 is UINT32_MAX as f32 holds it, so the maximum",
        cast("u32", float("4294967296.0f32")),
        4294967295,
      ],
      [
        "(i8)-200.0 is below the minimum",
        cast("i8", un("-", float("200.0"))),
        -128,
      ],
      ["(i8)-1.5 truncates toward zero", cast("i8", un("-", float("1.5"))), -1],
      ["(bool)0.5 is true", cast("bool", float("0.5")), 1],
      ["!0.0 is true", un("!", float("0.0")), 1],
      ["a float comparison", bin("<", float("0.5"), lit("1")), 1],
      ["a float equality", bin("=", float("0.5"), float("0.25")), 0],
      [
        "a float condition",
        {
          kind: "ternary",
          condition: float("0.0"),
          whenTrue: lit("1"),
          whenFalse: lit("0"),
        } as TConstExpr,
        0,
      ],
      [
        "a float operand of a logical operator",
        bin("&&", float("0.5"), lit("1")),
        1,
      ],
      [
        "the ternary branch its condition picks",
        {
          kind: "ternary",
          condition: bin("=", lit("1"), lit("1")),
          whenTrue: float("0.0"),
          whenFalse: float("1.0"),
        } as TConstExpr,
        0,
      ],
    ])("%s", (_label, expr, expected) => {
      expect(number(expr)).toBe(expected);
    });

    it.each([
      ["a float quotient by zero", bin("/", float("1.0"), float("0.0"))],
      ["a complement of a float", un("~", float("0.0"))],
      [
        "a float operator with no float meaning",
        bin("%", float("1.0"), float("2.0")),
      ],
      [
        "a string",
        { kind: "other", what: "string", spelling: '"0"', at } as TConstExpr,
      ],
      ["a name nothing answers", name("F")],
    ])("%s has no value", (_label, expr) => {
      expect(number(expr)).toBeNull();
    });

    it("a float const is worth its settled value", () => {
      const named = env({ F: f32(0.5) });
      expect(number(bin("-", name("F"), float("0.5f32")), named)).toBe(0);
    });

    it("an integer constant has no float in it", () => {
      expect(valueOf(bin("+", lit("1"), float("0.5")))).toBe("notConstant");
      expect(valueOf(cast("u32", float("1.5")))).toBe(1n);
    });
  });
});

// #1268 review: a cast to a type nothing declares is the undefined type's
// error (E0426), so it has no value; a primitive is always declared
describe("a cast to an undeclared type", () => {
  const undeclared: IConstantEnvironment = { ...NONE, isTypeName: () => false };
  it("has no value", () => {
    expect(
      ConstantEvaluator.numberValue(cast("Nope", lit("0")), undeclared),
    ).toBeNull();
  });
  it("is not asked of a primitive", () => {
    expect(
      ConstantEvaluator.numberValue(cast("u32", lit("0")), undeclared),
    ).toBe(0);
  });
});
