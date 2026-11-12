import { describe, it, expect } from "vitest";
import ScanfFormat from "../ScanfFormat";
import type TExpression from "../../types/syntax/TExpression";

const span = { line: 1, column: 0, endLine: 1, endColumn: 0 };

const literal = (text: string): TExpression =>
  ({
    kind: "literal",
    literalKind: "string",
    text,
    written: text,
    span,
  }) as unknown as TExpression;

const name = (n: string): TExpression =>
  ({ kind: "identifier", name: n, written: n, span }) as unknown as TExpression;

/** The argument indexes `sscanf("...", format, a, b, c, d)` writes */
const written = (format: string): number[] => {
  const writes = ScanfFormat.writesOf("sscanf", [
    literal('"7"'),
    literal(`"${format}"`),
    name("a"),
    name("b"),
    name("c"),
    name("d"),
  ]);
  if (writes.kind !== "literal") throw new Error(writes.kind);
  return [...writes.written];
};

describe("ScanfFormat.writesOf (#2117)", () => {
  it.each([
    ["one conversion", "%d", [2]],
    ["two conversions", "%d %u", [2, 3]],
    ["text around them", "x=%d, y=%d;", [2, 3]],
    ["a width and a length modifier", "%4hhu%lld%Lf", [2, 3, 4]],
    ["`%%`, which fills nothing", "%d%%%d", [2, 3]],
    ["an assignment-suppressed conversion", "%*d %d", [2]],
    ["a scanset", "%[a-z] %d", [2, 3]],
    ["a scanset whose first member is `]`", "%[]x] %d", [2, 3]],
    ["a negated scanset whose first member is `]`", "%[^]x] %d", [2, 3]],
    ["`%n`, which writes a count", "%d%n", [2, 3]],
    ["a string conversion", "%15s", [2]],
    ["no conversion", "plain", []],
    ["a trailing `%`", "%d %", [2]],
  ])("%s", (_label, format, expected) => {
    expect(written(format)).toEqual(expected);
  });

  it.each([
    ["scanf", 0, [1]],
    ["wscanf", 0, [1]],
    ["fscanf", 1, [2]],
    ["fwscanf", 1, [2]],
    ["sscanf", 1, [2]],
    ["swscanf", 1, [2]],
  ])("reads %s's format at argument %i", (callee, at, expected) => {
    const args = [name("s"), name("s"), name("v")];
    args[at] = literal('"%d"');
    const writes = ScanfFormat.writesOf(callee, args);
    expect(
      writes.kind === "literal" ? [...writes.written] : writes.kind,
    ).toEqual(expected);
  });

  it("is a format-not-literal for a format that is not a string literal", () => {
    const format = name("format");
    expect(
      ScanfFormat.writesOf("sscanf", [literal('"7"'), format, name("a")]),
    ).toEqual({ kind: "format-not-literal", format });
  });

  it("is not-scanf for any other function, printf included", () => {
    expect(
      ScanfFormat.writesOf("printf", [literal('"%d"'), name("a")]),
    ).toEqual({
      kind: "not-scanf",
    });
  });
});
