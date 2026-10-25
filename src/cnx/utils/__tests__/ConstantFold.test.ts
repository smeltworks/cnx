import { describe, expect, it } from "vitest";
import ConstantFold from "../ConstantFold";
import UNRESOLVED_DIMENSION from "../../types/UNRESOLVED_DIMENSION";
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

/** BUF_SIZE is a header macro; every other name has no value */
const ENV: IConstantEnvironment = {
  valueOf: (n): TConstResult =>
    n.path[0] === "BUF_SIZE"
      ? { kind: "foreign", spelling: "BUF_SIZE", why: "header" }
      : { kind: "notConstant", reason: "variable", spelling: "n", at: AT },
  isTypeName: () => true,
  cTypeName: (t) => t,
};

const PLUS_ONE = (operand: TConstExpr): TConstExpr => ({
  kind: "binary",
  op: "+",
  left: operand,
  right: lit("1"),
});

describe("ConstantFold.settled -- the one decision the .c and the .h write (#1175)", () => {
  it("is a dimension's value", () => {
    expect(ConstantFold.settled(PLUS_ONE(lit("7")), ENV)).toBe(8);
  });

  it("is a value past what a number holds exactly as its digits, not a rounded number", () => {
    expect(ConstantFold.settled(lit("18446744073709551615", "u64"), ENV)).toBe(
      "18446744073709551615",
    );
  });

  it("is the C written from the structure for a dimension only C can evaluate", () => {
    expect(ConstantFold.settled(PLUS_ONE(name("BUF_SIZE")), ENV)).toBe(
      "BUF_SIZE + 1",
    );
  });

  it("is null for a dimension with no value, which 2.1 reports", () => {
    expect(ConstantFold.settled(PLUS_ONE(name("n")), ENV)).toBeNull();
  });
});

describe("ConstantFold.dimension -- settled, as a symbol records it", () => {
  it("records no value as UNRESOLVED_DIMENSION", () => {
    expect(ConstantFold.dimension(name("n"), ENV)).toBe(UNRESOLVED_DIMENSION);
  });

  it("records a value as settled decides it", () => {
    expect(ConstantFold.dimension(PLUS_ONE(lit("7")), ENV)).toBe(8);
  });
});
