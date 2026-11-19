import { describe, expect, it } from "vitest";
import RegisterAddress from "../RegisterAddress";

describe("RegisterAddress", () => {
  it("renders an address as upper-case hex", () => {
    expect(RegisterAddress.render(0x401b8000n)).toBe("0x401B8000");
  });

  it("pads an offset to two digits", () => {
    expect(RegisterAddress.render(0n)).toBe("0x00");
    expect(RegisterAddress.render(0x8n)).toBe("0x08");
  });

  it("keeps a 64-bit address exact", () => {
    expect(RegisterAddress.render(0xffffffff00000000n)).toBe(
      "0xFFFFFFFF00000000",
    );
  });
});
