import { describe, expect, it } from "vitest";
import renderRegisterLayout from "../RegisterLayoutGenerator";
import type IPlannedRegisterLayoutMember from "../../../types/IPlannedRegisterLayoutMember";

function member(
  overrides: Partial<IPlannedRegisterLayoutMember> &
    Pick<IPlannedRegisterLayoutMember, "name" | "offset">,
): IPlannedRegisterLayoutMember {
  return {
    cType: "uint32_t",
    access: "rw",
    bytes: 4n,
    union: null,
    ...overrides,
  };
}

describe("renderRegisterLayout (ADR-072)", () => {
  it("pads a gap with a reserved byte array and keeps declared order by offset", () => {
    expect(
      renderRegisterLayout({
        name: "GpioPort",
        members: [
          member({ name: "ISR", offset: 0x18n, access: "w1c" }),
          member({ name: "DR", offset: 0x00n }),
        ],
      }),
    ).toBe(
      [
        "typedef struct GpioPort {",
        "    volatile uint32_t DR;",
        "    uint8_t RESERVED__0x04[20];",
        "    volatile uint32_t ISR;",
        "} GpioPort;",
        "",
      ].join("\n"),
    );
  });

  it("writes an offset group as its members' one union", () => {
    expect(
      renderRegisterLayout({
        name: "Uart",
        members: [
          member({
            name: "RBR",
            offset: 0n,
            cType: "uint8_t",
            bytes: 1n,
            access: "ro",
            union: "AT__0x00",
          }),
          member({
            name: "THR",
            offset: 0n,
            cType: "uint8_t",
            bytes: 1n,
            access: "wo",
            union: "AT__0x00",
          }),
          member({
            name: "LSR",
            offset: 5n,
            cType: "uint8_t",
            bytes: 1n,
            access: "ro",
          }),
        ],
      }),
    ).toBe(
      [
        "typedef struct Uart {",
        "    union {",
        "        volatile const uint8_t RBR;",
        "        volatile uint8_t THR;",
        "    } AT__0x00;",
        "    uint8_t RESERVED__0x01[4];",
        "    volatile const uint8_t LSR;",
        "} Uart;",
        "",
      ].join("\n"),
    );
  });

  it("starts the next gap after a group's widest member", () => {
    const out = renderRegisterLayout({
      name: "Mixed",
      members: [
        member({ name: "W", offset: 0n, union: "AT__0x00" }),
        member({
          name: "B",
          offset: 0n,
          cType: "uint8_t",
          bytes: 1n,
          union: "AT__0x00",
        }),
        member({ name: "N", offset: 8n }),
      ],
    });
    expect(out).toContain("    uint8_t RESERVED__0x04[4];");
  });
});
