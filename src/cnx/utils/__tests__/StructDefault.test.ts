/**
 * Unit tests for StructDefault -- #1283 / #1570 / #1565: which fields of a
 * struct ADR-029 gives a non-zero default.
 */
import { describe, it, expect } from "vitest";
import StructDefault from "../StructDefault";
import type IStructDefaultFacts from "../../types/IStructDefaultFacts";

function facts(
  structs: Record<string, Record<string, string>>,
  callbacks: string[] = ["onTick"],
): IStructDefaultFacts {
  return {
    structFields: new Map(
      Object.entries(structs).map(([name, fields]) => [
        name,
        new Map(Object.entries(fields)),
      ]),
    ),
    isCallbackType: (typeName) => callbacks.includes(typeName),
    enumZeroOf: (typeName) => (typeName === "Mode" ? "Mode__IDLE" : null),
  };
}

describe("StructDefault", () => {
  it("gives a callback field its function", () => {
    const f = facts({ Ticker: { handler: "onTick", count: "u32" } });

    expect(StructDefault.fieldsOf("Ticker", f)).toEqual([
      {
        fieldName: "handler",
        value: { kind: "callback", functionName: "onTick" },
      },
    ]);
  });

  it("gives a nested struct field its struct's default (#1570)", () => {
    const f = facts({
      Outer: { inner: "Inner", plain: "Plain" },
      Inner: { handler: "onTick" },
      Plain: { v: "u8" },
    });

    expect(StructDefault.fieldsOf("Outer", f)).toEqual([
      {
        fieldName: "inner",
        value: { kind: "struct", structName: "Inner" },
      },
    ]);
  });

  it("does not depend on declaration order (#1570)", () => {
    const innerFirst = facts({
      Inner: { handler: "onTick" },
      Outer: { inner: "Inner" },
    });
    const outerFirst = facts({
      Outer: { inner: "Inner" },
      Inner: { handler: "onTick" },
    });

    expect(StructDefault.fieldsOf("Outer", outerFirst)).toEqual(
      StructDefault.fieldsOf("Outer", innerFirst),
    );
  });

  it("has no default for an all-zero struct or a non-struct", () => {
    const f = facts({ Plain: { v: "u8" } });

    expect(StructDefault.hasDefault("Plain", f)).toBe(false);
    expect(StructDefault.hasDefault("u32", f)).toBe(false);
  });
  describe("factsOf (#1283 review: one builder for every reader)", () => {
    it("reads the struct table and the cnx functions", () => {
      const structFields = new Map([
        ["Ticker", new Map([["handler", "onTick"]])],
      ]);
      const f = StructDefault.factsOf({
        structFields,
        functionReturnTypes: new Map([["onTick", "u32"]]),
        knownEnums: new Set(["Mode"]),
        enumMembers: new Map([["Mode", new Map([["IDLE", 0]])]]),
        memberCNames: new Map([["Mode", new Map([["IDLE", "Mode__IDLE"]])]]),
      });

      expect(f.structFields).toBe(structFields);
      expect(f.isCallbackType("onTick")).toBe(true);
      expect(f.isCallbackType("Ticker")).toBe(false);
      expect(f.enumZeroOf("Mode")).toBe("Mode__IDLE");
      expect(f.enumZeroOf("Ticker")).toBeNull();
    });
  });

  describe("spelledElement", () => {
    const f = facts({
      Ticker: { handler: "onTick" },
      Plain: { v: "u8" },
      EnumHolder: { m: "Mode" },
    });

    it.each([
      [{ kind: "struct", name: "onTick" }, "onTick"],
      [{ kind: "struct", name: "Ticker" }, "Ticker"],
      [
        {
          kind: "array",
          elementType: { kind: "struct", name: "Ticker" },
          dimensions: [2],
        },
        "Ticker",
      ],
      [{ kind: "enum", name: "Mode" }, "Mode"],
      [{ kind: "struct", name: "EnumHolder" }, "EnumHolder"],
      [{ kind: "struct", name: "Plain" }, null],
      [{ kind: "primitive", primitive: "u8" }, null],
    ] as const)("%j spells %s", (type, expected) => {
      expect(StructDefault.spelledElement(type, f)).toBe(expected);
    });
  });

  it("gives an enum field its zero enumerator, at any depth (#1971)", () => {
    const f = facts({
      Inner: { m: "Mode", v: "u8" },
      Holder: { inner: "Inner" },
    });

    expect(StructDefault.fieldsOf("Inner", f)).toEqual([
      { fieldName: "m", value: { kind: "enum", enumerator: "Mode__IDLE" } },
    ]);
  });
});
