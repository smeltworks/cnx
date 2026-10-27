import { describe, it, expect } from "vitest";
import BaseIdentifierBuilder from "../BaseIdentifierBuilder";

/** The C name 3-Declare gives a member of `scope` (#2116). */
const memberOf =
  (scope: string) =>
  (name: string): string =>
    `${scope}__${name}`;

describe("BaseIdentifierBuilder", () => {
  describe("build", () => {
    it("should return identifier unchanged for global prefix", () => {
      const result = BaseIdentifierBuilder.build(
        "counter",
        true,
        false,
        memberOf(""),
      );

      expect(result).toEqual({
        result: "counter",
        firstId: "counter",
      });
    });

    it("should prefix with scope for this prefix", () => {
      const result = BaseIdentifierBuilder.build(
        "speed",
        false,
        true,
        memberOf("Motor"),
      );

      expect(result).toEqual({
        result: "Motor__speed",
        firstId: "speed",
      });
    });

    // #1322: the `this` outside a scope guard this asserted moved to pass 2.1 as
    // E0431, where it carries a real position -- codegen reported it as `1:0`
    // from four identical throws. Codegen is never reached with an empty
    // `currentScopePath` now, because 2.1 halts the pipeline first, so this test
    // drove a state production cannot produce.
    //
    // The rule is covered by `1-Analyze/__tests__/ThisOutsideScopeAnalyzer.test.ts`
    // and by `tests/adr-016/this-outside-scope-error`, which asserts the real
    // line and column and carries in-scope negative controls.

    it("should return identifier unchanged for bare identifier", () => {
      const result = BaseIdentifierBuilder.build(
        "myVar",
        false,
        false,
        memberOf(""),
      );

      expect(result).toEqual({
        result: "myVar",
        firstId: "myVar",
      });
    });

    it("should return identifier unchanged for bare identifier with scope context", () => {
      // Even with a current scope, a bare identifier is not prefixed
      const result = BaseIdentifierBuilder.build(
        "localVar",
        false,
        false,
        memberOf("Motor"),
      );

      expect(result).toEqual({
        result: "localVar",
        firstId: "localVar",
      });
    });

    it("should handle complex scope names", () => {
      const result = BaseIdentifierBuilder.build(
        "value",
        false,
        true,
        memberOf("GPIO_Controller"),
      );

      expect(result).toEqual({
        result: "GPIO_Controller__value",
        firstId: "value",
      });
    });
  });
});
