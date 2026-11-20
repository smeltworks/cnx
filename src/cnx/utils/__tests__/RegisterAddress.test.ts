import { describe, expect, it } from "vitest";
import RegisterAddress from "../RegisterAddress";

describe("RegisterAddress", () => {
  it("renders an address as upper-case unsigned hex (MISRA C:2012 Rule 7.2)", () => {
    expect(RegisterAddress.render(0x401b8000n)).toBe("0x401B8000U");
  });

  it("pads an offset to two digits", () => {
    expect(RegisterAddress.render(0n)).toBe("0x00U");
    expect(RegisterAddress.render(0x8n)).toBe("0x08U");
  });

  it("keeps a 64-bit address exact", () => {
    expect(RegisterAddress.render(0xffffffff00000000n)).toBe(
      "0xFFFFFFFF00000000U",
    );
  });
  it("spells an address for a diagnostic without C's suffix", () => {
    expect(RegisterAddress.hex(0x10000000bn)).toBe("0x10000000B");
  });
});
