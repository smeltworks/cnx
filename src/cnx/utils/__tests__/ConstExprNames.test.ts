import { describe, expect, it } from "vitest";
import ConstExprNames from "../ConstExprNames";
import type TConstExpr from "../../types/TConstExpr";

const AT = { line: 1, column: 0, endLine: 1, endColumn: 0 };
const lit: TConstExpr = {
  kind: "literal",
  digits: "1",
  text: "1",
  typeName: null,
};
const name = (...path: string[]): TConstExpr => ({
  kind: "name",
  root: null,
  path,
  at: AT,
});

describe("ConstExprNames", () => {
  it("lists every name an expression reads, in written order", () => {
    const expr: TConstExpr = {
      kind: "ternary",
      condition: name("A"),
      whenTrue: {
        kind: "binary",
        op: "+",
        left: { kind: "unary", op: "-", operand: name("B") },
        right: { kind: "cast", typeName: "u8", operand: name("C"), at: AT },
      },
      whenFalse: lit,
    };

    expect(ConstExprNames.of(expr).map((n) => n.path.join("."))).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("reads no name from a literal or an expression C cannot evaluate", () => {
    expect(ConstExprNames.of(lit)).toEqual([]);
    expect(
      ConstExprNames.of({
        kind: "other",
        what: "call",
        spelling: "f()",
        at: AT,
      }),
    ).toEqual([]);
  });

  it("keeps only bare names", () => {
    const expr: TConstExpr = {
      kind: "binary",
      op: "+",
      left: name("BUF_SIZE"),
      right: name("Scope", "N"),
    };

    expect(ConstExprNames.bare(expr).map((n) => n.path[0])).toEqual([
      "BUF_SIZE",
    ]);
  });
});
