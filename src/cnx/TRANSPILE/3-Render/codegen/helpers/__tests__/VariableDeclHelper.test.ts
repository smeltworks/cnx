/**
 * Unit tests for VariableDeclHelper
 *
 * Issue #792: Tests for extracted variable declaration logic.
 *
 * #1445 box 3: this module renders a plan now, so the cases that used to parse
 * real source and hand it over behind four callback interfaces are plan
 * literals. What moved OUT of this file moved with the code: the tree-reading
 * half is `CodeGenerator.plan*`, and its cases live in
 * `CodeGenerator.coverage.test.ts` where they run against real declarations.
 *
 * What is asserted here is assembly -- where the dimensions go, which branch
 * completes the declaration itself, the MISRA Rule 10.3 cast, and the C++
 * assignment queue.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import VariableDeclHelper from "../VariableDeclHelper";
import TranspileState from "../../../../TranspileState";
import IPlannedArrayDeclaration from "../../types/IPlannedArrayDeclaration";
import TPlannedVariableDecl from "../../types/TPlannedVariableDecl";
import TPlannedVariableInitializer from "../../types/TPlannedVariableInitializer";

let state = new TranspileState();

/**
 * An initializer render that sets the array-init bookkeeping, the way a real
 * one does. `ArrayInitHelper.processArrayInit` resets that tracking, renders,
 * and then reads it back -- so a thunk that only returns a string is not an
 * array initializer as far as the helper is concerned, and the whole branch is
 * skipped.
 */
function arrayInitRender(elementCount: number, value = "{1, 2}") {
  return () => {
    state.lastArrayInitCount = elementCount;
    state.lastArrayFillValue = undefined;
    return value;
  };
}

function arrayPlan(
  overrides: Partial<IPlannedArrayDeclaration> = {},
): IPlannedArrayDeclaration {
  return {
    isArray: false,
    hasEmptyDimension: false,
    hasEmptyArrayTypeDimension: false,
    declaredSize: null,
    arrayTypeDimensions: "",
    renderCStyleDimensions: () => "",
    init: null,
    ...overrides,
  };
}

describe("VariableDeclHelper", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  describe("renderArrayDeclaration", () => {
    it("reports not-an-array and leaves the declaration alone", () => {
      const result = VariableDeclHelper.renderArrayDeclaration(
        arrayPlan(),
        "x",
        "uint8_t x",
        state,
      );

      expect(result).toEqual({
        handled: false,
        code: "",
        decl: "uint8_t x",
        isArray: false,
      });
    });

    it("appends the type's dimensions then the trailing ones", () => {
      const result = VariableDeclHelper.renderArrayDeclaration(
        arrayPlan({
          isArray: true,
          arrayTypeDimensions: "[10]",
          renderCStyleDimensions: () => "[2]",
        }),
        "arr",
        "uint8_t arr",
        state,
      );

      expect(result.handled).toBe(false);
      expect(result.isArray).toBe(true);
      expect(result.decl).toBe("uint8_t arr[10][2]");
    });

    // ADR-057: a local that shadows a file-scope name is emitted under a
    // distinct name. The declaration carries the EMITTED name it was handed;
    // the source name is for diagnostics only. The test above cannot tell the
    // two apart, because it passes the same name for both.
    it("declares the array under its emitted name, not its source name", () => {
      const result = VariableDeclHelper.renderArrayDeclaration(
        arrayPlan({ isArray: true, arrayTypeDimensions: "[4]" }),
        "arr",
        "uint8_t main__arr",
        state,
      );

      expect(result.decl).toBe("uint8_t main__arr[4]");
    });

    it("completes the declaration itself when the initializer is processed", () => {
      const result = VariableDeclHelper.renderArrayDeclaration(
        arrayPlan({
          isArray: true,
          declaredSize: 2,
          arrayTypeDimensions: "[2]",
          init: {
            renderExpression: arrayInitRender(2),
            renderDimensions: () => "",
          },
        }),
        "arr",
        "uint8_t arr",
        state,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe("uint8_t arr[2] = {1, 2};");
    });

    // ADR-035 size inference fills an empty dimension in the TYPE, so the
    // inferred suffix already carries it and the declared dimensions must not
    // be prepended a second time.
    it("does not prepend the type's dimensions when the empty one was inferred", () => {
      const result = VariableDeclHelper.renderArrayDeclaration(
        arrayPlan({
          isArray: true,
          hasEmptyDimension: true,
          hasEmptyArrayTypeDimension: true,
          arrayTypeDimensions: "[]",
          // #1664 box 3: the size 1.3 counted, which the plan now carries
          declaredSize: 2,
          init: {
            renderExpression: arrayInitRender(2),
            renderDimensions: () => "",
          },
        }),
        "arr",
        "uint8_t arr",
        state,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe("uint8_t arr[2] = {1, 2};");
    });
  });

  describe("renderVariableInitializer", () => {
    // #1534: the C++ class's fields are the declaration's own, written after
    it("constructs a C++ class object for the cppClass arm", () => {
      const renderFill = vi.fn(() => ["unused"]);

      expect(
        VariableDeclHelper.renderVariableInitializer(
          { kind: "cppClass", renderFill },
          "CppTestClass obj",
          false,
          state,
        ),
      ).toBe("CppTestClass obj = {}");
      expect(renderFill).not.toHaveBeenCalled();
    });

    it("renders the zero initializer for the ADR-015 arm", () => {
      const plan: TPlannedVariableInitializer = {
        kind: "zero",
        render: (isArray) => (isArray ? "{0}" : "0"),
      };

      expect(
        VariableDeclHelper.renderVariableInitializer(
          plan,
          "uint8_t x",
          false,
          state,
        ),
      ).toBe("uint8_t x = 0");
      expect(
        VariableDeclHelper.renderVariableInitializer(
          plan,
          "uint8_t x[2]",
          true,
          state,
        ),
      ).toBe("uint8_t x[2] = {0}");
    });

    it("renders an expression initializer", () => {
      expect(
        VariableDeclHelper.renderVariableInitializer(
          {
            kind: "expression",
            renderTypeName: () => "u8",
            renderExpression: () => "42",
            resolveExpressionType: () => "u8",
          },
          "uint8_t x",
          false,
          state,
        ),
      ).toBe("uint8_t x = 42");
    });

    // Issue #872: 2.2 plans the declared type as the value's expected type
    // (#1991), so the helper sets none of its own.
    it("renders the expression without setting an expected type itself", () => {
      let seen: string | null = "notRead";
      const state = new TranspileState();

      VariableDeclHelper.renderVariableInitializer(
        {
          kind: "expression",
          renderTypeName: () => "u32",
          renderExpression: () => {
            seen = state.expectedType;
            return "1";
          },
          resolveExpressionType: () => "u32",
        },
        "uint32_t x",
        false,
        state,
      );

      expect(seen).toBeNull();
    });

    // MISRA 10.3: the question is what the expression TURNED OUT to be, so it
    // is asked after the render rather than before.
    it("asks for the expression's type after rendering it", () => {
      const order: string[] = [];

      VariableDeclHelper.renderVariableInitializer(
        {
          kind: "expression",
          renderTypeName: () => "f32",
          renderExpression: () => {
            order.push("render");
            return "n";
          },
          resolveExpressionType: () => {
            order.push("resolve");
            return "u8";
          },
        },
        "float x",
        false,
        state,
      );

      expect(order).toEqual(["render", "resolve"]);
    });

    it("adds the MISRA 10.3 cast for an int to float conversion", () => {
      const result = VariableDeclHelper.renderVariableInitializer(
        {
          kind: "expression",
          renderTypeName: () => "f32",
          renderExpression: () => "n",
          resolveExpressionType: () => "u8",
        },
        "decl",
        false,
        state,
      );

      expect(result).toContain("(float)");
    });

    // #1800: a float reaches an integer only through a cast, so pass 2.1
    // rejects the implicit form (E0891) and render never sees it
    it("asserts it never renders a float to int conversion", () => {
      expect(() =>
        VariableDeclHelper.renderVariableInitializer(
          {
            kind: "expression",
            renderTypeName: () => "u8",
            renderExpression: () => "n",
            resolveExpressionType: () => "f32",
          },
          "decl",
          false,
          state,
        ),
      ).toThrow(/E0891/);
    });

    it("adds no cast when both sides are the same category", () => {
      expect(
        VariableDeclHelper.renderVariableInitializer(
          {
            kind: "expression",
            renderTypeName: () => "u32",
            renderExpression: () => "n",
            resolveExpressionType: () => "u8",
          },
          "uint32_t x",
          false,
          state,
        ),
      ).toBe("uint32_t x = n");
    });
  });

  describe("renderVariableDecl", () => {
    it("renders the constructor arm (Issue #375)", () => {
      const plan: TPlannedVariableDecl = {
        kind: "constructor",
        type: "MAX31856",
        emittedName: "thermo",
        args: ["pinConst"],
      };

      expect(VariableDeclHelper.renderVariableDecl(plan, state)).toBe(
        "MAX31856 thermo(pinConst);",
      );
    });

    it("renders the plain arm with its modifier prefix and emitted name", () => {
      const plan: TPlannedVariableDecl = {
        kind: "plain",
        sourceName: "x",
        emittedName: "main__x",
        modifierPrefix: "const ",
        type: "uint8_t",
        array: arrayPlan(),
        initializer: { kind: "zero", render: () => "0" },
      };

      expect(VariableDeclHelper.renderVariableDecl(plan, state)).toBe(
        "const uint8_t main__x = 0;",
      );
    });

    // #1534: the fill names the EMITTED object, the one the declaration made
    it("fills a C++ class object by its emitted name after declaring it", () => {
      const plan: TPlannedVariableDecl = {
        kind: "plain",
        sourceName: "obj",
        emittedName: "main__obj",
        modifierPrefix: "",
        type: "CppTestClass",
        array: arrayPlan(),
        initializer: {
          kind: "cppClass",
          renderFill: (target) => [`${target}.value = 9;`],
        },
      };

      expect(VariableDeclHelper.renderVariableDecl(plan, state)).toBe(
        "CppTestClass main__obj = {};\nmain__obj.value = 9;",
      );
    });

    // The array half can finish the declaration on its own, and when it does
    // the initializer must not be rendered a second time.
    it("stops at the array arm when it completed the declaration", () => {
      const renderExpression = vi.fn(() => "unused");
      const plan: TPlannedVariableDecl = {
        kind: "plain",
        sourceName: "arr",
        emittedName: "arr",
        modifierPrefix: "",
        type: "uint8_t",
        array: arrayPlan({
          isArray: true,
          declaredSize: 2,
          arrayTypeDimensions: "[2]",
          init: {
            renderExpression: arrayInitRender(2),
            renderDimensions: () => "",
          },
        }),
        initializer: {
          kind: "expression",
          renderTypeName: () => "u8",
          renderExpression,
          resolveExpressionType: () => "u8",
        },
      };

      expect(VariableDeclHelper.renderVariableDecl(plan, state)).toBe(
        "uint8_t arr[2] = {1, 2};",
      );
      expect(renderExpression).not.toHaveBeenCalled();
    });
  });
});
