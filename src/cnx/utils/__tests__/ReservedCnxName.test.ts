import { describe, it, expect } from "vitest";
import ReservedCnxName from "../ReservedCnxName";

describe("ReservedCnxName", () => {
  describe("isReserved", () => {
    it("rejects an identifier carrying the prefix", () => {
      expect(ReservedCnxName.isReserved("cnx_counter")).toBe(true);
    });

    // ADR-063 part 2: the comparison is case-insensitive because include guards
    // are uppercase by C convention while identifiers are not, so one rule has
    // to cover both spellings.
    it("is case-insensitive", () => {
      expect(ReservedCnxName.isReserved("CNX_LIMIT")).toBe(true);
      expect(ReservedCnxName.isReserved("Cnx_state")).toBe(true);
      expect(ReservedCnxName.isReserved("cNx_state")).toBe(true);
    });

    // Prefix-only: a prefix is all that is needed to keep the namespaces
    // disjoint, so that is all the rule constrains. A substring check here
    // would reject legal user code.
    it("allows the sequence anywhere but the start", () => {
      expect(ReservedCnxName.isReserved("my_cnx_buffer")).toBe(false);
      expect(ReservedCnxName.isReserved("buffer_cnx")).toBe(false);
    });

    it("allows an identifier that merely starts with the letters", () => {
      expect(ReservedCnxName.isReserved("cnxState")).toBe(false);
      expect(ReservedCnxName.isReserved("cnx")).toBe(false);
    });

    it("allows ordinary identifiers", () => {
      expect(ReservedCnxName.isReserved("tick_count")).toBe(false);
      expect(ReservedCnxName.isReserved("_handler")).toBe(false);
      expect(ReservedCnxName.isReserved("")).toBe(false);
    });
  });

  describe("name builders", () => {
    it("builds temporaries carrying the prefix", () => {
      expect(ReservedCnxName.temporary(0)).toBe("cnx_tmp0");
      expect(ReservedCnxName.temporary(17)).toBe("cnx_tmp17");
    });

    it("builds strlen caches carrying the prefix", () => {
      expect(ReservedCnxName.stringLengthCache("message")).toBe(
        "cnx_len_message",
      );
    });

    it("builds clamp helpers carrying the prefix", () => {
      expect(ReservedCnxName.overflowHelper("clamp", "add", "u8")).toBe(
        "cnx_clamp_add_u8",
      );
      expect(ReservedCnxName.overflowHelper("clamp", "mul", "i32")).toBe(
        "cnx_clamp_mul_i32",
      );
    });

    // The point of the module: every family it builds must land inside the
    // namespace the analyzer reserves. Issue #1131 is exactly what happens when
    // one of them does not.
    it("produces names that isReserved recognizes", () => {
      const generated = [
        ReservedCnxName.temporary(3),
        ReservedCnxName.stringLengthCache("msg"),
        ReservedCnxName.overflowHelper("clamp", "sub", "u16"),
      ];

      for (const name of generated) {
        expect(ReservedCnxName.isReserved(name)).toBe(true);
      }
    });

    // Regression guard for the shape #1131 produced: two families drawing from
    // one counter must not be able to spell the same name differently.
    it("gives distinct counters distinct temporaries", () => {
      expect(ReservedCnxName.temporary(0)).not.toBe(
        ReservedCnxName.temporary(1),
      );
    });
  });
});
