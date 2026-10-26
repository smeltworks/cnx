/**
 * Unit tests for QualifiedCName
 * ADR-063 / Issue #1117: single source of truth for the qualified-name separator
 */
import { describe, it, expect } from "vitest";
import QualifiedCName from "../QualifiedCName";

describe("QualifiedCName", () => {
  describe("join", () => {
    it("joins scope and member", () => {
      expect(QualifiedCName.fromSourceName(["Motor", "init"])).toBe(
        "Motor__init",
      );
    });

    it("joins three components (scoped enum member)", () => {
      expect(QualifiedCName.fromSourceName(["Motor", "State", "IDLE"])).toBe(
        "Motor__State__IDLE",
      );
    });

    it("returns the bare name for a global symbol", () => {
      expect(QualifiedCName.fromSourceName(["", "main"])).toBe("main");
      expect(QualifiedCName.fromSourceName([undefined, "main"])).toBe("main");
      expect(QualifiedCName.fromSourceName([null, "main"])).toBe("main");
    });

    it("expands a dotted source path into separate components", () => {
      expect(QualifiedCName.fromSourceName(["Outer.Inner", "deepFunc"])).toBe(
        "Outer__Inner__deepFunc",
      );
    });

    it("preserves single underscores inside a component", () => {
      expect(QualifiedCName.fromSourceName(["Timer", "tick_count"])).toBe(
        "Timer__tick_count",
      );
    });

    it("drops empty components rather than emitting a stray separator", () => {
      expect(QualifiedCName.fromSourceName(["A", "", "b"])).toBe("A__b");
    });

    it.each([
      ["leading dot", ".State", "State"],
      ["trailing dot", "Motor.", "Motor"],
      ["doubled dot", "Motor..State", "Motor__State"],
    ])(
      "drops empty segments inside a dotted path (%s)",
      (_label, input, expected) => {
        // A malformed path must not emit a stray separator — that would produce
        // a name with a run of underscores and break the injectivity guarantee.
        expect(QualifiedCName.fromSourceName([input])).toBe(expected);
      },
    );
  });

  describe("split", () => {
    it("is the inverse of join", () => {
      const parts = ["Motor", "State", "IDLE"];
      expect(
        QualifiedCName.split(QualifiedCName.fromSourceName([...parts])),
      ).toEqual(parts);
    });
  });

  describe("isQualified", () => {
    it("is true for a scope-qualified name", () => {
      expect(QualifiedCName.isQualified("Motor__init")).toBe(true);
    });

    it("is false for a bare identifier", () => {
      expect(QualifiedCName.isQualified("main")).toBe(false);
    });
  });

  describe("isInScope", () => {
    it("recognizes a member of the given scope", () => {
      expect(QualifiedCName.isInScope("Motor__init", "Motor")).toBe(true);
    });

    it("rejects a member of a different scope", () => {
      expect(QualifiedCName.isInScope("Pump_init", "Motor")).toBe(false);
    });

    it("handles a dotted scope path", () => {
      expect(QualifiedCName.isInScope("Outer__Inner__fn", "Outer.Inner")).toBe(
        true,
      );
    });

    it("returns false for a null or empty scope", () => {
      // Preserves the previous `startsWith(null + "__")` behavior at call sites
      expect(QualifiedCName.isInScope("Motor__init", null)).toBe(false);
      expect(QualifiedCName.isInScope("Motor__init", undefined)).toBe(false);
      expect(QualifiedCName.isInScope("Motor__init", "")).toBe(false);
    });
  });

  describe("toCppQualified", () => {
    it("re-qualifies for C++ namespace syntax", () => {
      expect(
        QualifiedCName.toCppQualified("SeaDash__Parse__Result", "::"),
      ).toBe("SeaDash::Parse::Result");
    });

    it("leaves single underscores inside a component alone", () => {
      // The old blanket replaceAll("_", "::") would have mangled this
      expect(QualifiedCName.toCppQualified("Timer__tick_count", "::")).toBe(
        "Timer::tick_count",
      );
    });
  });

  describe("injectivity (ADR-063)", () => {
    // The property the whole ADR exists to establish: distinct component lists
    // must never produce the same C identifier, given ADR-063-conformant input.
    it("separates the #1117 scope-vs-scope collision", () => {
      // scope A_B { c }  vs  scope A { B_c } — identical under a naive join
      const first = QualifiedCName.fromSourceName(["A_B", "c"]);
      const second = QualifiedCName.fromSourceName(["A", "B_c"]);

      expect(first).toBe("A_B__c");
      expect(second).toBe("A__B_c");
      expect(first).not.toBe(second);
    });

    it("separates a global from a scope member of the same spelling", () => {
      // u8 Reg_flags  vs  scope Reg { u8 flags }
      const global = "Reg_flags";
      const member = QualifiedCName.fromSourceName(["Reg", "flags"]);

      expect(member).toBe("Reg__flags");
      expect(member).not.toBe(global);
    });

    it("cannot produce a name that a plain identifier could spell", () => {
      // A qualified name always contains the separator, and ADR-063 forbids that
      // sequence in any identifier, so the two namespaces cannot intersect.
      expect(QualifiedCName.fromSourceName(["Reg", "flags"])).toContain(
        QualifiedCName.SEPARATOR,
      );
    });

    it("maps distinct component lists to distinct names", () => {
      const cases: string[][] = [
        ["A_B", "c"],
        ["A", "B_c"],
        ["A", "B", "c"],
        ["A_B_c"],
      ];
      const generated = cases.map((c) => QualifiedCName.fromSourceName([...c]));

      expect(new Set(generated).size).toBe(cases.length);
    });
  });
});
