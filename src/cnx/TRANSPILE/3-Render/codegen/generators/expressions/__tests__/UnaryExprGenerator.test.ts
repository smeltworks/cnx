/**
 * Unit tests for UnaryExprGenerator
 *
 * Tests bitwise NOT (~) MISRA-compliant cast generation:
 * - Unsigned types get cast back to original type (MISRA 10.1/10.3)
 * - Signed types and unresolvable types are unchanged
 * - C++ mode uses static_cast
 *
 * #1445: the generator takes `{ operator, operandCode, complementCast }`, so
 * there is no node to fake and no orchestrator to stand in for the recursion.
 * The operand's type arrives through the thunk, and whether it is unsigned is
 * `TypeCheckUtils`'s real answer (#1668: the mocked `ExpressionTypeResolver`
 * predicate was a copy of it, and is deleted).
 */

import { describe, it, expect, afterEach } from "vitest";
import generateUnaryExpr from "../UnaryExprGenerator";
import type IGeneratorInput from "../../IGeneratorInput";
import type IGeneratorState from "../../IGeneratorState";
import type IOrchestrator from "../../IOrchestrator";
import TranspileState from "../../../../../TranspileState";

// ========================================================================
// Test Helpers
// ========================================================================

const mockInput = {} as IGeneratorInput;
const mockState = {} as IGeneratorState;
const state = new TranspileState();

// #1452: the generator reads the run's C++ mode off the orchestrator's render
// state, for the MISRA 10.1/10.3 cast. That is the only member it touches.
const mockOrchestrator = { state } as unknown as IOrchestrator;

/** The generator's whole input: an operator, the operand's code, 2.2's `~` cast. */
function planned(
  operator: "!" | "-" | "~" | null,
  operandCode: string,
  complementCast: string | null = null,
) {
  return {
    operator,
    operandCode,
    minimum: null,
    complementCast,
  };
}

const run = (
  operator: "!" | "-" | "~" | null,
  operandCode: string,
  complementCast: string | null = null,
) =>
  generateUnaryExpr(
    planned(operator, operandCode, complementCast),
    mockInput,
    mockState,
    mockOrchestrator,
  );

// ========================================================================
// Tests
// ========================================================================

describe("UnaryExprGenerator", () => {
  afterEach(() => {
    state.cppMode = false;
  });

  describe("bitwise NOT on unsigned types", () => {
    it("should cast ~u8 to (uint8_t)~c in C mode", () => {
      const result = run("~", "c", "uint8_t");

      expect(result.code).toBe("(uint8_t)~c");
      expect(result.effects).toEqual([]);
    });

    it("should cast ~u16 to (uint16_t)~c in C mode", () => {
      const result = run("~", "c", "uint16_t");

      expect(result.code).toBe("(uint16_t)~c");
      expect(result.effects).toEqual([]);
    });

    it("should use static_cast in C++ mode", () => {
      state.cppMode = true;

      const result = run("~", "c", "uint8_t");

      expect(result.code).toBe("static_cast<uint8_t>(~c)");
      expect(result.effects).toEqual([]);
    });
  });

  describe("bitwise NOT on signed/unresolvable types", () => {
    it("should not cast ~i8 (signed type)", () => {
      const result = run("~", "c", null);

      expect(result.code).toBe("~c");
      expect(result.effects).toEqual([]);
    });

    it("should not cast when type is unresolvable", () => {
      const result = run("~", "expr", null);

      expect(result.code).toBe("~expr");
      expect(result.effects).toEqual([]);
    });
  });

  describe("other unary operators", () => {
    it.each([
      ["should generate logical NOT unchanged", "!", "flag", "!flag"],
      ["should generate negation unchanged", "-", "x", "-x"],
    ] as const)("%s", (_label, operator, operandCode, expected) => {
      expect(run(operator, operandCode).code).toBe(expected);
    });

    it("returns the operand unchanged when there is no operator", () => {
      // #1445: null covers the base case (operand is a postfix expression) and
      // the grammar-impossible fallback. Both returned the operand before.
      expect(run(null, "someValue").code).toBe("someValue");
    });
  });

  describe("negative minimums (MISRA 10.3)", () => {
    it.each([
      ["int32_t", "2147483648", "(int32_t)INT32_MIN"],
      ["int64_t", "9223372036854775808LL", "(int64_t)INT64_MIN"],
    ] as const)(
      "writes 2.2's %s minimum as its macro, and asks for no include",
      (minimum, operandCode, code) => {
        const result = generateUnaryExpr(
          { ...planned("-", operandCode), minimum },
          mockInput,
          mockState,
          mockOrchestrator,
        );
        expect(result.code).toBe(code);
        expect(result.effects).toEqual([]);
      },
    );

    it("fails when 2.2 did not plan an overflowing literal", () => {
      expect(() => run("-", "2147483648")).toThrow(
        "2.2 planned every negative minimum",
      );
    });

    it("negates any other operand plainly", () => {
      expect(run("-", "(2147483648)")).toEqual({
        code: "-(2147483648)",
        effects: [],
      });
    });
  });
});
