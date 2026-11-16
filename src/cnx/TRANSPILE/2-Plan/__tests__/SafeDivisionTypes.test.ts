import { describe, expect, it } from "vitest";
import OverflowHelper from "../OverflowHelper";
import SafeDivisionTypes from "../SafeDivisionTypes";

// ADR-051 / #2415: 2.2 decides a safe helper's C types once; 2.3 reads them
describe("SafeDivisionTypes.planned", () => {
  it("takes an unsigned divisor in the wider type, compared against the maximum", () => {
    const helper = SafeDivisionTypes.planned(
      "cnx_safe_div_u8",
      "div",
      "u8",
      null,
    );
    expect(helper.operandType).toBe("uint8_t");
    expect(helper.divisorType).toBe("uint32_t");
    expect(helper.divisorLimit).toBe("UINT8_MAX");
    expect(SafeDivisionTypes.cTypesOf(helper)).toEqual([
      "bool",
      "uint8_t",
      "uint32_t",
    ]);
  });

  it("compares nothing when the divisor is already the type's own width", () => {
    const helper = SafeDivisionTypes.planned(
      "cnx_safe_mod_u64",
      "mod",
      "u64",
      null,
    );
    expect(helper.divisorType).toBe("uint64_t");
    expect(helper.divisorLimit).toBeNull();
  });

  it("passes a signed divisor whole to its ADR-044 helper", () => {
    const inner = OverflowHelper.of("clamp", "/", "i8", null, false);
    const helper = SafeDivisionTypes.planned(
      "cnx_safe_div_i8",
      "div",
      "i8",
      inner,
    );
    expect(helper.inner).toBe("cnx_clamp_div_i8");
    expect(helper.divisorType).toBe(inner?.types.widerType);
    expect(helper.divisorLimit).toBeNull();
  });
});
