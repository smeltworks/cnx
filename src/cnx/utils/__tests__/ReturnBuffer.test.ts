/**
 * #1209: which return types fill a caller's buffer, and the C each is
 * written as -- the parameter a function takes and the temporary a call fills.
 */
import { describe, it, expect } from "vitest";
import ReturnBuffer from "../ReturnBuffer";
import type TType from "../../types/TType";
import type IStructKeywordFacts from "../types/IStructKeywordFacts";

const u8: TType = { kind: "primitive", primitive: "u8" };
const label: TType = { kind: "string", capacity: 16 };
const bytes: TType = { kind: "array", elementType: u8, dimensions: [4] };
const names: TType = { kind: "array", elementType: label, dimensions: [2] };
const point: TType = { kind: "struct", name: "Point" };
const points: TType = { kind: "array", elementType: point, dimensions: [2] };

/** #834: `Point` is a C tag with no typedef */
const facts: IStructKeywordFacts = {
  checkNeedsStructKeyword: (name) => name === "Point",
};

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
    expect(ReturnBuffer.parameterFor(u8, facts)).toBeNull();
    expect(ReturnBuffer.temporaryFor(u8, "cnx_tmp0", "{0}", facts)).toBeNull();
  });

  it.each([
    [label, "char cnx_return[17]"],
    [bytes, "uint8_t cnx_return[4]"],
    [names, "char cnx_return[2][17]"],
    [points, "struct Point cnx_return[2]"],
  ])("passes the buffer ahead of the declared parameters", (type, written) => {
    expect(ReturnBuffer.parameterFor(type, facts)).toBe(written);
  });

  it.each([
    [label, "{0}", "char cnx_tmp0[17] = {0};"],
    [bytes, "{0}", "uint8_t cnx_tmp0[4] = {0};"],
    [bytes, "{}", "uint8_t cnx_tmp0[4] = {};"],
    [points, "{0}", "struct Point cnx_tmp0[2] = {0};"],
  ])(
    "gives a call a temporary of the buffer's shape, zeroed as the file's language writes it",
    (type, zero, written) => {
      expect(ReturnBuffer.temporaryFor(type, "cnx_tmp0", zero, facts)).toBe(
        written,
      );
    },
  );
});
