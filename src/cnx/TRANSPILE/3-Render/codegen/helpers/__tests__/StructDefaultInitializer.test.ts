/**
 * Unit tests for StructDefaultInitializer -- #1283: the one spelling of a
 * struct's ADR-029 default, for declarations and for `<Struct>_init()`.
 */
import { describe, it, expect } from "vitest";
import StructDefaultInitializer from "../StructDefaultInitializer";
import type IStructDefaultRenderContext from "../../types/IStructDefaultRenderContext";

function ctx(cppMode: boolean): IStructDefaultRenderContext {
  return {
    structFields: new Map([
      [
        "Ticker",
        new Map([
          ["handler", "onTick"],
          ["count", "u32"],
          ["mode", "Mode"],
        ]),
      ],
      [
        "Outer",
        new Map([
          ["handlers", "onTick"],
          ["inner", "Ticker"],
        ]),
      ],
      ["Plain", new Map([["v", "u8"]])],
      ["Sized", new Map([["handlers", "onTick"]])],
    ]),
    fieldElementCounts: (structName, fieldName) => {
      if (structName === "Outer" && fieldName === "handlers") return [2];
      if (structName === "Sized") return [null];
      return [];
    },
    isCallbackField: (_structName, fieldName) =>
      ["handler", "handlers"].includes(fieldName),
    cppMode,
    enumZeroOf: (typeName) => (typeName === "Mode" ? "Mode__IDLE" : null),
  };
}

describe("StructDefaultInitializer", () => {
  it("is null for a struct whose default is all zero", () => {
    expect(
      StructDefaultInitializer.render("Plain", false, [], ctx(false)),
    ).toBeNull();
  });

  it("names only the non-zero fields by designator in C", () => {
    expect(
      StructDefaultInitializer.render("Ticker", false, [], ctx(false)),
    ).toBe("{ .handler = onTick, .mode = Mode__IDLE }");
  });

  it("spells every field in order in C++, zero fields as {}", () => {
    expect(
      StructDefaultInitializer.render("Ticker", false, [], ctx(true)),
    ).toBe("{ onTick, {}, Mode__IDLE }");
  });

  it("fills every element of a callback array and nests structs", () => {
    // #1565 / #1570
    expect(
      StructDefaultInitializer.render("Outer", false, [], ctx(false)),
    ).toBe(
      "{ .handlers = { onTick, onTick }, .inner = { .handler = onTick, .mode = Mode__IDLE } }",
    );
  });

  it("repeats the default over every element of a declared array", () => {
    expect(
      StructDefaultInitializer.render("Ticker", false, [2, 1], ctx(true)),
    ).toBe(
      "{ { { onTick, {}, Mode__IDLE } }, { { onTick, {}, Mode__IDLE } } }",
    );
  });

  it("asserts 2.1 rejected an array size it cannot count (E0359)", () => {
    expect(() =>
      StructDefaultInitializer.render("Sized", false, [], ctx(false)),
    ).toThrow("E0359");
  });
});
