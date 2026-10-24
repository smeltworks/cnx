/**
 * Unit tests for IBaseAnalysisError interface.
 * Tests that concrete error objects properly satisfy the base interface.
 */

import { describe, expect, it } from "vitest";
import IBaseAnalysisError from "../IBaseAnalysisError";
import IFloatModuloError from "../IFloatModuloError";
import IDivisionByZeroError from "../IDivisionByZeroError";
import IFunctionCallError from "../IFunctionCallError";
import INullCheckError from "../INullCheckError";
import IInitializationError from "../IInitializationError";
import IParameterNamingError from "../IParameterNamingError";
import IStructFieldError from "../IStructFieldError";

describe("IBaseAnalysisError", () => {
  describe("interface extension", () => {
    it("allows IFloatModuloError to be used as base error", () => {
      const error: IFloatModuloError = {
        code: "E0804",
        span: { line: 10, column: 5, endLine: 10, endColumn: 5 },
        message: "Modulo operator not supported for floating-point types",
      };

      // Should be assignable to base type
      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0804");
      expect(baseError.span.line).toBe(10);
      expect(baseError.span.column).toBe(5);
      expect(baseError.message).toBe(
        "Modulo operator not supported for floating-point types",
      );
    });

    it("allows IDivisionByZeroError to be used as base error", () => {
      const error: IDivisionByZeroError = {
        code: "E0800",
        operator: "/",
        span: { line: 20, column: 10, endLine: 20, endColumn: 10 },
        message: "Division by zero",
        helpText: "Use safe_div for runtime safety",
      };

      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0800");
      expect(baseError.helpText).toBe("Use safe_div for runtime safety");
    });

    it("allows IFunctionCallError to be used as base error", () => {
      const error: IFunctionCallError = {
        code: "E0422",
        functionName: "undefinedFunc",
        span: { line: 15, column: 3, endLine: 15, endColumn: 3 },
        message: "Function 'undefinedFunc' is not defined",
      };

      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0422");
      expect(baseError.message).toBe("Function 'undefinedFunc' is not defined");
    });

    it("allows INullCheckError to be used as base error", () => {
      const error: INullCheckError = {
        code: "E0901",
        functionName: "fopen",
        span: { line: 30, column: 12, endLine: 30, endColumn: 12 },
        message: "C library function can return NULL",
        helpText: "Check for NULL before use",
      };

      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0901");
    });

    it("allows IInitializationError to be used as base error", () => {
      const error: IInitializationError = {
        code: "E0381",
        variable: "x",
        span: { line: 5, column: 8, endLine: 5, endColumn: 8 },
        declaration: { name: "x", line: 3, column: 4 },
        mayBeUninitialized: false,
        message: "use of uninitialized variable 'x'",
      };

      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0381");
    });

    it("allows IParameterNamingError to be used as base error", () => {
      const error: IParameterNamingError = {
        code: "E0227",
        parameterName: "foo_bar",
        functionName: "foo",
        span: { line: 10, column: 15, endLine: 10, endColumn: 15 },
        message: "Parameter 'foo_bar' conflicts with function name",
      };

      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0227");
    });

    it("allows IStructFieldError to be used as base error", () => {
      const error: IStructFieldError = {
        code: "E0355",
        structName: "MyStruct",
        fieldName: "type",
        span: { line: 12, column: 6, endLine: 12, endColumn: 6 },
        message: "Reserved field name 'type'",
      };

      const baseError: IBaseAnalysisError = error;
      expect(baseError.code).toBe("E0355");
    });
  });

  describe("helpText optional field", () => {
    it("allows errors without helpText", () => {
      const error: IBaseAnalysisError = {
        code: "E0000",
        span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
        message: "Test error",
      };

      expect(error.helpText).toBeUndefined();
    });

    it("allows errors with helpText", () => {
      const error: IBaseAnalysisError = {
        code: "E0000",
        span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
        message: "Test error",
        helpText: "Here is how to fix it",
      };

      expect(error.helpText).toBe("Here is how to fix it");
    });
  });

  describe("generic error handling", () => {
    it("can process mixed error types in a single array", () => {
      const errors: IBaseAnalysisError[] = [
        {
          code: "E0804",
          span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          message: "Float modulo error",
        } as IFloatModuloError,
        {
          code: "E0800",
          operator: "/",
          span: { line: 2, column: 5, endLine: 2, endColumn: 5 },
          message: "Division by zero",
        } as IDivisionByZeroError,
        {
          code: "E0422",
          functionName: "test",
          span: { line: 3, column: 10, endLine: 3, endColumn: 10 },
          message: "Undefined function",
        } as IFunctionCallError,
      ];

      expect(errors).toHaveLength(3);
      expect(errors.every((e) => typeof e.code === "string")).toBe(true);
      expect(errors.every((e) => typeof e.span.line === "number")).toBe(true);
      expect(errors.every((e) => typeof e.span.column === "number")).toBe(true);
      expect(errors.every((e) => typeof e.message === "string")).toBe(true);
    });
  });
});
