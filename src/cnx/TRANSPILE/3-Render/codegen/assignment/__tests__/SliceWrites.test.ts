import { describe, it, expect } from "vitest";
import SliceWrites from "../SliceWrites";
import type TranspileState from "../../../../TranspileState";

function stateWithTemps(): TranspileState {
  let next = 0;
  return {
    getNextTempVarName: () => `cnx_tmp${next++}`,
  } as unknown as TranspileState;
}

describe("SliceWrites", () => {
  it("splits an integer into a string's characters through uint8_t (MISRA 10.8)", () => {
    const writes = SliceWrites.render({
      element: SliceWrites.STRING_ELEMENT,
      source: {
        cType: "uint16_t",
        bytes: 2,
        unsignedCType: "uint16_t",
        isComposite: false,
      },
      value: "data",
      lengthValue: 2,
      elementCount: 2,
      state: stateWithTemps(),
      at: (k) => `str[${5 + k}]`,
    });
    expect(writes.slice(1)).toEqual([
      "const uint16_t cnx_tmp0 = (uint16_t)(data);",
      "str[5] = (char)(uint8_t)(cnx_tmp0);",
      "str[6] = (char)(uint8_t)(cnx_tmp0 >> 8U);",
    ]);
    expect(writes[0]).toContain("Rule 21.15");
  });

  it("writes one character from the value itself, with no temp or citation", () => {
    const writes = SliceWrites.render({
      element: SliceWrites.STRING_ELEMENT,
      source: {
        cType: "uint8_t",
        bytes: 1,
        unsignedCType: "uint8_t",
        isComposite: false,
      },
      value: "65",
      lengthValue: 1,
      elementCount: 1,
      state: stateWithTemps(),
      at: () => "s[i]",
    });
    expect(writes).toEqual(["s[i] = (char)(uint8_t)(65);"]);
  });
});
