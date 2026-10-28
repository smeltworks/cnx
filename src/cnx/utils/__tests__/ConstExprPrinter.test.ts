import { describe, expect, it } from "vitest";
import ConstExprPrinter from "../ConstExprPrinter";
import type TConstExpr from "../../types/TConstExpr";
import type IConstantEnvironment from "../types/IConstantEnvironment";
import CNX_TO_C_TYPE_MAP from "../constants/TypeMappings";
import QualifiedCName from "../QualifiedCName";

const AT = { line: 1, column: 0, endLine: 1, endColumn: 0 };
const lit = (digits: string): TConstExpr => ({
  kind: "literal",
  digits,
  text: digits,
  typeName: null,
});
const name = (n: string): TConstExpr => ({
  kind: "name",
  root: null,
  path: [n],
  at: AT,
});
const bin = (
  op: Extract<TConstExpr, { kind: "binary" }>["op"],
  left: TConstExpr,
  right: TConstExpr,
): TConstExpr => ({ kind: "binary", op, left, right });

/** BUF_SIZE is a header macro; LOCAL a cnx const C cannot see */
const ENV: IConstantEnvironment = {
  valueOf: (n) => {
    if (n.path[0] === "LOCAL")
      return { kind: "value", value: 8n, typeName: "u8" };
    if (n.path[0] === "Cfg") {
      return {
        kind: "foreign",
        spelling: n.path.join("."),
        why: "target",
        c: "((uint32_t)sizeof(Cfg))",
      };
    }
    return { kind: "foreign", spelling: n.path[0], why: "header" };
  },
  // The printer writes what the environment names; ConstantNames.cTypeName
  // is the rule (ConstantNames.test.ts)
  isTypeName: () => true,
  cTypeName: (t) => CNX_TO_C_TYPE_MAP[t] ?? QualifiedCName.fromSourceName(t),
};

describe("ConstExprPrinter (#1175)", () => {
  it.each<[string, TConstExpr, string]>([
    ["a value is its number", bin("+", lit("1"), lit("2")), "3"],
    [
      "a memory size is C's sizeof, never its cnx name (ADR-058)",
      bin(
        "+",
        {
          kind: "name",
          root: null,
          path: ["Cfg", "memory_byte_length"],
          at: AT,
        },
        lit("1"),
      ),
      "(((uint32_t)sizeof(Cfg))) + 1",
    ],
    [
      "a macro stays for C",
      bin("+", name("BUF_SIZE"), lit("1")),
      "BUF_SIZE + 1",
    ],
    [
      "a cnx const is written as its value, never its name",
      bin("*", name("BUF_SIZE"), name("LOCAL")),
      "BUF_SIZE * 8",
    ],
    [
      "a negative value is parenthesized, so no tokens can join",
      bin("-", name("BUF_SIZE"), { kind: "unary", op: "-", operand: lit("1") }),
      "BUF_SIZE - (-1)",
    ],
    [
      "a nested operation is parenthesized",
      bin("*", bin("+", name("BUF_SIZE"), lit("1")), lit("2")),
      "(BUF_SIZE + 1) * 2",
    ],
    [
      "cnx's `=` is C's `==`",
      {
        kind: "ternary",
        condition: bin("=", name("BUF_SIZE"), lit("4")),
        whenTrue: lit("1"),
        whenFalse: lit("2"),
      },
      "(BUF_SIZE == 4) ? 1 : 2",
    ],
    [
      "a cast is to the C type",
      { kind: "cast", typeName: "u32", operand: name("BUF_SIZE"), at: AT },
      "(uint32_t)BUF_SIZE",
    ],
  ])("%s", (_label, expr, expected) => {
    expect(ConstExprPrinter.toC(expr, ENV)).toBe(expected);
  });

  it("refuses an expression C cannot evaluate either: 2.1 rejects it first", () => {
    const call: TConstExpr = {
      kind: "other",
      what: "call",
      spelling: "f()",
      at: AT,
    };
    expect(() => ConstExprPrinter.toC(call, ENV)).toThrow(
      "only an expression C can evaluate is printed",
    );
  });
});
