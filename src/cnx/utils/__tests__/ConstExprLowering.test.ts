import { describe, expect, it } from "vitest";
import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import ConstExprLowering from "../ConstExprLowering";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import type TConstExpr from "../../types/TConstExpr";
import ConstExprShape from "../__testUtils__/ConstExprShape";

/** The expression `source` lowers to, written as a const's initializer */
function lowerOf(source: string): TConstExpr {
  const tree = CnxSourceParser.parse(`const u32 Q <- ${source};\n`).tree;
  const expression = tree.declaration()[0].variableDeclaration()?.expression();
  if (!expression) throw new Error(`no expression in: ${source}`);
  return ConstExprLowering.lower(SyntaxLowering.expression(expression));
}

describe("ConstExprLowering", () => {
  it.each<[string, string]>([
    ["1 + 2", "(1 + 2)"],
    ["1 + 2 + 3", "((1 + 2) + 3)"],
    ["1 - -1", "(1 - -1)"],
    ["0x10 + 1", "(16 + 1)"],
    ["0b101", "5"],
    // #1728: a leading-zero literal has no value until #1728 says what it is
    ["010", "<leadingZero 010>"],
    // ADR-044: no octal literal, suffixed or not -- this one read as 10
    ["010u8", "<leadingZero 010u8>"],
    ["00", "<leadingZero 00>"],
    ["0", "0"],
    ["0x010", "16"],
    ["9u8", "9:u8"],
    ["0xFFu16", "255:u16"],
    ["0b11i8", "3:i8"],
    ["18446744073709551615u64", "18446744073709551615:u64"],
    ["true", "1:bool"],
    ["false", "0:bool"],
    ["(LOCAL) * 2", "(LOCAL * 2)"],
    ["(u32)EColor.COUNT + 1", "((u32)EColor.COUNT + 1)"],
    ["this.N", "this.N"],
    ["global.S.N", "global.S.N"],
    ["src.type_element_count", "src.type_element_count"],
    ["(A < B) ? 1 : 2", "((A < B) ? 1 : 2)"],
    ["a << 2 | b & c", "((a << 2) | (b & c))"],
    ["A = B && C != D || !E", "(((A = B) && (C != D)) || !E)"],
    ["~0", "~0"],
    ["10 / 3 % 2", "((10 / 3) % 2)"],
    ["pick()", "<call pick()>"],
    ["arr[0]", "<subscript arr[0]>"],
    // ADR-058: a length property is the same for every element, so before
    // one a subscript is a step into the element, whatever its index
    ["m[0].type_element_count", "m[].type_element_count"],
    ["m[i][j].type_bit_length", "m[][].type_bit_length"],
    ["m[0].data", "<subscript m[0].data>"],
    ["m[0, 4].type_element_count", "<subscript m[0, 4].type_element_count>"],
    ["pick().type_element_count", "<call pick().type_element_count>"],
    // #1863 review: its text joined tokens (`word--1`); no value, spelt as written
    ["sizeof(word - -1)", "<sizeofExpression sizeof(word - -1)>"],
    ["1.5", "<float 1.5>"],
    ['"s"', '<string "s">'],
    ["'c'", "<character 'c'>"],
    ["&x", "<address &x>"],
  ])("%s lowers to %s", (source, expected) => {
    expect(ConstExprShape.of(lowerOf(source))).toBe(expected);
  });

  it("records where a name is written, which is where it binds", () => {
    const lowered = lowerOf("1 + LIMIT");
    expect(lowered.kind === "binary" && lowered.right).toEqual({
      kind: "name",
      root: null,
      path: ["LIMIT"],
      at: { line: 1, column: 19, endLine: 1, endColumn: 24 },
    });
  });

  it("is plain data: it survives a JSON round trip unchanged (#1298)", () => {
    const lowered = lowerOf(
      "(u32)EColor.COUNT + 0xFFFFFFFFFFFFFFFFu64 * u8.type_byte_length",
    );
    expect(JSON.parse(JSON.stringify(lowered))).toEqual(lowered);
  });

  // The editor's symbol collection lowers a tree with parse errors
  it.each<[string, string]>([
    ["a[", "<member a[>"],
    ["(u8)", "(u8)"],
  ])(
    "lowers %s, which the parser recovered from, as %s",
    (source, expected) => {
      expect(ConstExprShape.of(lowerOf(source))).toBe(expected);
    },
  );
});
