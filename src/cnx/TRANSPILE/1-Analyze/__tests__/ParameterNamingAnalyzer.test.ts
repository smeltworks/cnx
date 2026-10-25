/**
 * Unit tests for ParameterNamingAnalyzer
 * Tests validation of function parameter naming conventions (Issue #227)
 */
import { describe, it, expect } from "vitest";
import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import ParameterNamingAnalyzer from "../ParameterNamingAnalyzer";

/**
 * Helper to parse cnx code and return 1.2's syntax
 */
function parse(source: string) {
  return CnxSourceParser.parse(source).program;
}

describe("ParameterNamingAnalyzer", () => {
  // ========================================================================
  // Reserved Parameter Names
  // ========================================================================

  describe("reserved parameter names", () => {
    it("should detect parameter starting with function name prefix", () => {
      const code = `
        void process(u32 process_data) {
          u32 x <- process_data;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0227");
      expect(errors[0].parameterName).toBe("process_data");
      expect(errors[0].functionName).toBe("process");
    });

    it("should detect parameter exactly matching function name + underscore", () => {
      const code = `
        void init(u32 init_value, u32 init_size) {
          u32 x <- init_value + init_size;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(2);
      expect(errors[0].parameterName).toBe("init_value");
      expect(errors[1].parameterName).toBe("init_size");
    });
  });

  // ========================================================================
  // Valid Parameter Names
  // ========================================================================

  describe("valid parameter names", () => {
    it("should allow parameters not starting with function name prefix", () => {
      const code = `
        void process(u32 data, u32 size) {
          u32 x <- data + size;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should allow parameter that contains but does not start with prefix", () => {
      const code = `
        void calc(u32 data_calc_value) {
          u32 x <- data_calc_value;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      // "data_calc_value" does not start with "calc_"
      expect(errors).toHaveLength(0);
    });

    it("should allow parameter that is function name without underscore", () => {
      const code = `
        void test(u32 test) {
          u32 x <- test;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      // "test" does not start with "test_"
      expect(errors).toHaveLength(0);
    });

    it("should allow similar prefix from different function", () => {
      const code = `
        void process(u32 init_value) {
          u32 x <- init_value;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      // "init_value" does not start with "process_"
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Multiple Functions
  // ========================================================================

  describe("multiple functions", () => {
    it("should check each function independently", () => {
      const code = `
        void foo(u32 foo_x) {
          u32 a <- foo_x;
        }
        void bar(u32 bar_y) {
          u32 b <- bar_y;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(2);
      expect(errors[0].functionName).toBe("foo");
      expect(errors[1].functionName).toBe("bar");
    });

    it("should not cross-check between functions", () => {
      const code = `
        void foo(u32 bar_x) {
          u32 a <- bar_x;
        }
        void bar(u32 foo_y) {
          u32 b <- foo_y;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      // "bar_x" does not start with "foo_", "foo_y" does not start with "bar_"
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Error Details
  // ========================================================================

  describe("error details", () => {
    it("should provide correct error message", () => {
      const code = `
        void setup(u32 setup_config) {
          u32 x <- setup_config;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].message).toContain("Parameter 'setup_config'");
      expect(errors[0].message).toContain(
        "cannot start with function name prefix",
      );
      expect(errors[0].message).toContain("'setup_'");
    });

    it("should provide helpful suggestion", () => {
      const code = `
        void setup(u32 setup_config) {
          u32 x <- setup_config;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("Consider renaming");
      expect(errors[0].helpText).toContain("setup_");
    });

    it("should report correct line and column", () => {
      const code = `void setup(u32 setup_config) {
  u32 x <- setup_config;
}`;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].span.line).toBe(1);
      // Column should point to parameter name
      expect(errors[0].span.column).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Functions Without Parameters
  // ========================================================================

  describe("functions without parameters", () => {
    it("should handle functions with no parameters", () => {
      const code = `
        void noop() {
          u32 x <- 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle single character function name", () => {
      const code = `
        void f(u32 f_value) {
          u32 x <- f_value;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].functionName).toBe("f");
    });

    it("should handle underscore in function name", () => {
      const code = `
        void my_func(u32 my_func_data) {
          u32 x <- my_func_data;
        }
      `;
      const tree = parse(code);
      const analyzer = new ParameterNamingAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].functionName).toBe("my_func");
      expect(errors[0].parameterName).toBe("my_func_data");
    });
  });
});
