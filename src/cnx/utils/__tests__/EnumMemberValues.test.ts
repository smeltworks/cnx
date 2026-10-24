import { describe, expect, it } from "vitest";
import EnumMemberValues from "../EnumMemberValues";
import type TConstExpr from "../../types/TConstExpr";
import type TEnumMemberValue from "../../types/TEnumMemberValue";
import type IConstantEnvironment from "../types/IConstantEnvironment";

const AT = { line: 1, column: 0, endLine: 1, endColumn: 0 };
const lit = (digits: string): TConstExpr => ({
  kind: "literal",
  digits,
  text: digits,
  typeName: null,
});
const own = (member: string): TConstExpr => ({
  kind: "name",
  root: null,
  path: ["E", member],
  at: AT,
});
const plus = (left: TConstExpr, right: TConstExpr): TConstExpr => ({
  kind: "binary",
  op: "+",
  left,
  right,
});

/** Members of `E` answer as their own enum's; `FOO` is a const of 3 */
function computed(
  members: ReadonlyArray<{ name: string; valueExpr: TConstExpr | null }>,
): TEnumMemberValue[] {
  const names = members.map((m) => m.name);
  return EnumMemberValues.compute(
    members,
    (index, settled): IConstantEnvironment => ({
      isTypeName: () => true,
      cTypeName: (t) => t,
      valueOf: (name) => {
        if (name.path[0] === "E") {
          return EnumMemberValues.ownMember(
            names,
            index,
            settled,
            name.path[1],
            name.path.join("."),
            name.at,
          );
        }
        return name.path[0] === "FOO"
          ? { kind: "value", value: 3n, typeName: "u32" }
          : {
              kind: "notConstant",
              reason: "variable",
              spelling: name.path[0],
              at: name.at,
            };
      },
    }),
  );
}

function shapes(results: TEnumMemberValue[]): string[] {
  return results.map((r) => {
    if (r.kind === "value") return String(r.value);
    if (r.kind === "notConstant") return `${r.reason}:${r.spelling}`;
    if (r.kind === "outOfRange") return `outOfRange:${r.value}`;
    if (r.kind === "follows") return `follows:${r.member}`;
    return r.kind;
  });
}

describe("EnumMemberValues", () => {
  it("starts at 0 and continues from the member above (ADR-017)", () => {
    expect(
      shapes(
        computed([
          { name: "A", valueExpr: null },
          { name: "B", valueExpr: null },
          { name: "C", valueExpr: lit("10") },
          { name: "D", valueExpr: null },
        ]),
      ),
    ).toEqual(["0", "1", "10", "11"]);
  });

  it("evaluates a value as written, so `1 + 2` is 3 and the next member 4", () => {
    expect(
      shapes(
        computed([
          { name: "A", valueExpr: plus(lit("1"), lit("2")) },
          { name: "B", valueExpr: null },
        ]),
      ),
    ).toEqual(["3", "4"]);
  });

  it("lets a value name a member declared above it, with no cast", () => {
    expect(
      shapes(
        computed([
          { name: "READ", valueExpr: lit("1") },
          { name: "WRITE", valueExpr: lit("2") },
          {
            name: "RW",
            valueExpr: {
              kind: "binary",
              op: "|",
              left: own("READ"),
              right: own("WRITE"),
            },
          },
        ]),
      ),
    ).toEqual(["1", "2", "3"]);
  });

  it("gives the member itself and members below it no value yet", () => {
    expect(
      shapes(
        computed([
          { name: "A", valueExpr: own("B") },
          { name: "B", valueExpr: lit("1") },
          { name: "C", valueExpr: own("C") },
          { name: "D", valueExpr: own("B") },
        ]),
      ),
    ).toEqual(["laterMember:E.B", "1", "selfMember:E.C", "1"]);
  });

  it("marks a member continuing from one without a value, rather than reporting it twice", () => {
    expect(
      shapes(
        computed([
          {
            name: "A",
            valueExpr: { kind: "name", root: null, path: ["limit"], at: AT },
          },
          { name: "B", valueExpr: null },
        ]),
      ),
    ).toEqual(["variable:limit", "follows:A"]);
  });

  it.each<[string, TConstExpr, string]>([
    ["i32's maximum", lit("2147483647"), "2147483647"],
    ["one past it", lit("2147483648"), "outOfRange:2147483648"],
    [
      "a const's value",
      plus({ kind: "name", root: null, path: ["FOO"], at: AT }, lit("1")),
      "4",
    ],
  ])("a member's value is an i32: %s", (_label, valueExpr, expected) => {
    expect(shapes(computed([{ name: "A", valueExpr }]))).toEqual([expected]);
  });

  it("a member continuing past i32's maximum is out of range too", () => {
    expect(
      shapes(
        computed([
          { name: "A", valueExpr: lit("2147483647") },
          { name: "B", valueExpr: null },
        ]),
      ),
    ).toEqual(["2147483647", "outOfRange:2147483648"]);
  });
});
