/**
 * #1209: which return types fill a caller's buffer, and the C each is
 * written as -- the parameter a function takes and the temporary a call fills.
 */
import { describe, it, expect } from "vitest";
import ReturnBuffer from "../ReturnBuffer";
import type TType from "../../types/TType";

const u8: TType = { kind: "primitive", primitive: "u8" };
const label: TType = { kind: "string", capacity: 16 };
const bytes: TType = { kind: "array", elementType: u8, dimensions: [4] };
const names: TType = { kind: "array", elementType: label, dimensions: [2] };

describe("ReturnBuffer (#1209)", () => {
  it.each([
    ["a string<16>", label, "[17]"],
    ["a u8[4]", bytes, "[4]"],
    ["a string<16>[2]", names, "[2][17]"],
  ])("gives %s a buffer of %s", (_label, type, dimensions) => {
    expect(ReturnBuffer.dimensionsOf(type)).toBe(dimensions);
  });

  it("returns a scalar by value", () => {
    expect(ReturnBuffer.dimensionsOf(u8)).toBeNull();
    expect(ReturnBuffer.parameterFor(u8)).toBeNull();
    expect(ReturnBuffer.temporaryFor(u8, "cnx_tmp0")).toBeNull();
  });

  it.each([
    [label, "char cnx_return[17]"],
    [bytes, "uint8_t cnx_return[4]"],
    [names, "char cnx_return[2][17]"],
  ])("passes the buffer ahead of the declared parameters", (type, written) => {
    expect(ReturnBuffer.parameterFor(type)).toBe(written);
  });

  it.each([
    [label, "char cnx_tmp0[17] = {0};"],
    [bytes, "uint8_t cnx_tmp0[4] = {0};"],
  ])(
    "gives a call a zero-filled temporary of the buffer's shape",
    (type, written) => {
      expect(ReturnBuffer.temporaryFor(type, "cnx_tmp0")).toBe(written);
    },
  );
});
