import { describe, it, expect } from "vitest";
import OperandTyper from "../OperandTyper";
import type IOperandType from "../../types/IOperandType";

const typed = (
  dimensions: readonly number[],
  stringCapacity: number | null,
  typeName: string,
): IOperandType =>
  ({ dimensions, stringCapacity, typeName }) as unknown as IOperandType;

describe("OperandTyper.isSizedBuffer (#2117)", () => {
  it.each([
    ["an array", typed([4], null, "u8"), true, true],
    ["a string<N>", typed([], 16, "string<16>"), true, true],
    [
      "an unsized string, main's args[0]",
      typed([], null, "string"),
      false,
      true,
    ],
    ["a scalar", typed([], null, "i32"), false, false],
  ])("%s", (_label, t, sized, decays) => {
    expect(OperandTyper.isSizedBuffer(t)).toBe(sized);
    expect(OperandTyper.decaysToPointer(t)).toBe(decays);
  });

  it("is false for no type", () => {
    expect(OperandTyper.isSizedBuffer(null)).toBe(false);
  });
});
