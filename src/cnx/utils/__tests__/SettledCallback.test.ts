import { describe, expect, it } from "vitest";
import SettledCallback from "../SettledCallback";
import TTypeUtils from "../TTypeUtils";
import type TType from "../../types/TType";
import type IProgram from "../../types/IProgram";

const tick = TTypeUtils.createCallback("tick");
const u32: TType = { kind: "primitive", primitive: "u32" } as TType;

function programWith(
  fields: ReadonlyMap<string, TType>,
): Pick<IProgram, "symbolByCName"> {
  const struct = {
    kind: "struct",
    fields: new Map([...fields].map(([name, type]) => [name, { type }])),
  };
  return {
    symbolByCName: (name: string) =>
      (name === "Ticker" ? struct : undefined) as never,
  };
}

describe("SettledCallback (#1984)", () => {
  it("reads a callback, or an array of one, off the settled type", () => {
    expect(SettledCallback.isType(tick)).toBe(true);
    expect(
      SettledCallback.isType({
        kind: "array",
        elementType: tick,
        dimensions: [2],
      } as TType),
    ).toBe(true);
    expect(SettledCallback.isType(u32)).toBe(false);
    // a struct named like a function is still a struct: the kind decides
    expect(SettledCallback.isType({ kind: "struct", name: "tick" })).toBe(
      false,
    );
  });

  it("collects each struct's callback fields and skips the rest", () => {
    const program = programWith(
      new Map([
        ["onTick", tick],
        ["count", u32],
      ]),
    );
    const fields = SettledCallback.fieldsOf(
      program,
      new Map([
        [
          "Ticker",
          new Map([
            ["onTick", "tick"],
            ["count", "u32"],
          ]),
        ],
        ["Other", new Map([["onTick", "tick"]])],
      ]),
    );
    expect([...(fields.get("Ticker") ?? [])]).toEqual(["onTick"]);
    expect(fields.has("Other")).toBe(false);
  });
});
