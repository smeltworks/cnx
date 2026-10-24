/**
 * Unit tests for OperatorOperandAnalyzer: E0804, % on a float
 * Tests detection of modulo operator with floating-point types
 */
import { describe, it, expect } from "vitest";
import OperatorOperandAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/OperatorOperandAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

describe("OperatorOperandAnalyzer -- % on a float (E0804)", () => {
  // ========================================================================
  // Float Variable Detection
  // ========================================================================

  describe("float variable modulo", () => {
    it("should detect modulo with f32 left operand", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
      expect(errors[0].message).toContain("Modulo operator not supported");
    });

    it("should detect modulo with f64 left operand", () => {
      const code = `
        void main() {
          f64 x <- 10.5;
          f64 result <- x % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });

    it("should detect modulo with float right operand", () => {
      const code = `
        void main() {
          f32 y <- 3.0;
          u32 result <- 10 % y;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });

    it("should detect modulo with both float operands", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 y <- 3.0;
          f32 result <- x % y;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });
  });

  // ========================================================================
  // Float Literal Detection
  // ========================================================================

  describe("float literal modulo", () => {
    it("should detect modulo with float literal left operand", () => {
      const code = `
        void main() {
          f32 result <- 10.5 % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });

    it("should detect modulo with float literal right operand", () => {
      const code = `
        void main() {
          f32 result <- 10 % 3.5;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });
  });

  // ========================================================================
  // Function Parameters
  // ========================================================================

  describe("function parameters", () => {
    it("should detect modulo with f32 parameter", () => {
      const code = `
        void compute(f32 value) {
          f32 result <- value % 2;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });

    it("should detect modulo with f64 parameter", () => {
      const code = `
        void compute(f64 value) {
          f64 result <- value % 2;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0804");
    });
  });

  // ========================================================================
  // Valid Integer Modulo
  // ========================================================================

  describe("valid integer modulo", () => {
    it("should not flag modulo between integers", () => {
      const code = `
        void main() {
          u32 x <- 10;
          u32 y <- 3;
          u32 result <- x % y;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not flag modulo with integer literals", () => {
      const code = `
        void main() {
          u32 result <- 10 % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not flag modulo with various integer types", () => {
      const code = `
        void main() {
          i32 a <- 10;
          u64 b <- 3;
          i64 result <- a % b;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Other Float Operations (Should Not Flag)
  // ========================================================================

  describe("other float operations", () => {
    it("should not flag float addition", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x + 3.0;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not flag float subtraction", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x - 3.0;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not flag float multiplication", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x * 3.0;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not flag float division", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x / 3.0;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Error Details
  // ========================================================================

  describe("error details", () => {
    it("should provide fmod() help text", () => {
      const code = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors[0].helpText).toContain("fmod()");
    });

    it("should report correct line number", () => {
      const code = `void main() {
  f32 x <- 10.5;
  f32 result <- x % 3;
}`;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors[0].line).toBe(3);
    });
  });

  // ========================================================================
  // Multiple Errors
  // ========================================================================

  describe("multiple errors", () => {
    it("should detect multiple float modulo operations", () => {
      const code = `
        void main() {
          f32 a <- 10.5;
          f32 b <- a % 3;
          f64 c <- 20.5;
          f64 d <- c % 4;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(2);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should handle program with no modulo operations", () => {
      const code = `
        void main() {
          f32 x <- 5.0 + 3.0;
          f32 y <- 10.0 - 2.0;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not flag modulo with complex parenthesized expression", () => {
      const code = `
        void main() {
          u32 a <- 10;
          u32 b <- 3;
          u32 result <- a % (b + 1);
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      // Integer operands with parenthesized expression: isFloatOperand
      // falls through to return false (neither float literal nor float identifier)
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Non-Float Parameter and Unary Prefix Operands
  // ========================================================================

  describe("non-float parameter and unary operands", () => {
    it("should not flag modulo with non-float parameter type", () => {
      const code = `
        void compute(u32 value) {
          u32 r <- value % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not detect float in negated modulo operand", () => {
      const code = `
        void main() {
          i32 x <- 5;
          i32 result <- -x % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should not detect float in bitwise-not modulo operand", () => {
      const code = `
        void main() {
          u32 x <- 5;
          u32 result <- ~x % 3;
        }
      `;
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new OperatorOperandAnalyzer(context);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });
});
