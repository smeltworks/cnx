import { describe, expect, it } from "vitest";
import renderRegisterLayoutAsserts from "../RegisterLayoutAssertGenerator";
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

describe("renderRegisterLayoutAsserts (ADR-072)", () => {
  it("asserts a lone member's offset and width", () => {
    expect(
      renderRegisterLayoutAsserts(
        {
          name: "GpioPort",
          members: [member({ name: "ISR", offset: 0x18n })],
        },
        "_Static_assert",
      ),
    ).toBe(
      [
        "/* ADR-072: GpioPort must sit at the offsets and widths its register declares */",
        '_Static_assert(offsetof(GpioPort, ISR) == 0x18U, "GpioPort.ISR is at 0x18");',
        '_Static_assert(sizeof(((GpioPort*)0)->ISR) == 4U, "GpioPort.ISR is 4 byte(s)");',
        "",
      ].join("\n"),
    );
  });

  it("asserts an offset group's union once and each member's width through it", () => {
    expect(
      renderRegisterLayoutAsserts(
        {
          name: "Uart",
          members: [
            member({ name: "RBR", offset: 0n, bytes: 1n, union: "AT__0x00" }),
            member({ name: "THR", offset: 0n, bytes: 1n, union: "AT__0x00" }),
          ],
        },
        "static_assert",
      ),
    ).toBe(
      [
        "/* ADR-072: Uart must sit at the offsets and widths its register declares */",
        'static_assert(offsetof(Uart, AT__0x00) == 0x00U, "Uart.AT__0x00 is at 0x00");',
        'static_assert(sizeof(((Uart*)0)->AT__0x00.RBR) == 1U, "Uart.RBR is 1 byte(s)");',
        'static_assert(sizeof(((Uart*)0)->AT__0x00.THR) == 1U, "Uart.THR is 1 byte(s)");',
        "",
      ].join("\n"),
    );
  });
});
