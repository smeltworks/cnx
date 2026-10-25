/**
 * Unit tests for ArrayIndexTypeAnalyzer
 * Tests detection of signed/float types used as array and bit subscript indexes (ADR-054)
 */
import { describe, it, expect } from "vitest";
import ArrayIndexTypeAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ArrayIndexTypeAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

describe("ArrayIndexTypeAnalyzer", () => {
  // ========================================================================
  // Allowed types (0 errors expected)
  // ========================================================================

  describe("allowed unsigned types", () => {
    it("should allow u8 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { mut u8[10] arr; u8 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow u16 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { mut u8[10] arr; u16 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow u32 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { mut u8[10] arr; u32 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow u64 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { mut u8[10] arr; u64 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow bool variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { mut u8[2] arr; bool idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow integer literal as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { mut u8[10] arr; arr[3] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow enum member as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        enum EColor { RED, GREEN, BLUE, COUNT }
        void main() { mut u8[4] arr; arr[EColor.RED] <- 1; }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow enum-typed variable as array index (Issue #949)", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        enum EColor { RED, GREEN, BLUE, COUNT }
        void getValue(EColor color) {
          mut u8[4] arr;
          arr[color] <- 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow enum-typed parameter as array index (Issue #949)", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        enum EState { IDLE, RUNNING, STOPPED }
        mut u32[3] stateCounts;
        void incrementState(EState state) {
          stateCounts[state] <- stateCounts[state] + 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow unsigned for-loop variable as index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          mut u8[10] arr;
          for (mut u32 i <- 0; i < 10; i <- i + 1) {
            arr[i] <- 0;
          }
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow unsigned function parameter as index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void setElement(mut u8[10] arr, u32 idx) {
          arr[idx] <- 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Rejected signed types (E0850)
  // ========================================================================

  describe("rejected signed types", () => {
    it("should reject i8 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u8[10] arr; i8 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i8");
      expect(errors[0].message).toContain("unsigned integer type");
      expect(errors[0].message).toContain("i8");
    });

    it("should reject i16 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u8[10] arr; i16 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i16");
    });

    it("should reject i32 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u8[10] arr; i32 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject i64 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u8[10] arr; i64 idx <- 0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i64");
    });

    it("should reject signed for-loop variable as index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          for (i32 i <- 0; i < 10; i <- i + 1) {
            arr[i] <- 0;
          }
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject signed function parameter as index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void setElement(u8[10] arr, i32 idx) {
          arr[idx] <- 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });
  });

  // ========================================================================
  // Rejected float types (E0851)
  // ========================================================================

  describe("rejected float types", () => {
    it("should reject f32 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u8[10] arr; f32 idx <- 0.0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
      expect(errors[0].actualType).toBe("f32");
      expect(errors[0].message).toContain("unsigned integer type");
      expect(errors[0].message).toContain("f32");
    });

    it("should reject f64 variable as array index", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u8[10] arr; f64 idx <- 0.0; arr[idx] <- 1; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
      expect(errors[0].actualType).toBe("f64");
    });
  });

  // ========================================================================
  // Bit indexing (same rules apply)
  // ========================================================================

  describe("bit indexing", () => {
    it("should reject signed type for single bit access", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u32 flags <- 0; i32 bit <- 0; u8 val <- flags[bit]; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject signed type for bit range start", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u32 flags <- 0; i32 start <- 0; u8 val <- flags[start, 4]; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should reject signed type for bit range width", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u32 flags <- 0; i32 width <- 4; u8 val <- flags[0, width]; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should allow unsigned type for bit access", () => {
      const { syntax, context } = testAnalysisContextFor(
        `void main() { u32 flags <- 0; u8 bit <- 0; u8 val <- flags[bit]; }`,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Complex expressions (arithmetic, parenthesized)
  // ========================================================================

  describe("complex expressions", () => {
    it("should reject arr[x + 1] where x is i32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          i32 x <- 2;
          arr[x + 1] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject arr[(x)] where x is i32 (parenthesized)", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          i32 x <- 2;
          arr[(x)] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject arr[x * 2 + y] where x is i32, y is u32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          i32 x <- 1;
          u32 y <- 0;
          arr[x * 2 + y] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should allow arr[x + 1] where x is u32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          mut u8[10] arr;
          u32 x <- 2;
          arr[x + 1] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should reject float literal in arithmetic", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          arr[1 + 2.0] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
    });
  });

  // ========================================================================
  // Declared-symbol type resolution (the program 1.4 built)
  // ========================================================================

  describe("state-based type resolution", () => {
    it("should reject arr[config.value] where Config.value is i32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        struct Config { i32 value; }
        void main() {
          u8[10] arr;
          Config config;
          arr[config.value] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should allow arr[config.index] where Config.index is u32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        struct Config { u32 index; }
        void main() {
          u8[10] arr;
          Config config;
          arr[config.index] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should reject arr[getIndex()] where getIndex returns i32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        i32 getIndex() { return 0; }
        void main() {
          u8[10] arr;
          arr[getIndex()] <- 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should allow arr[getIndex()] where getIndex returns u32", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        u32 getIndex() { return 0; }
        void main() {
          mut u8[10] arr;
          arr[getIndex()] <- 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    // The route is `context.symbols.knownEnums`; 2.1 cannot reach the state.
    it("should allow arr[EColor.RED] for a known enum member", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        enum EColor { RED, GREEN, BLUE }
        void main() {
          mut u8[4] arr;
          arr[EColor.RED] <- 1;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should pass through a call it cannot type", () => {
      // #1668: the callee is declared nowhere, so nothing types its result.
      // An unresolved name is another diagnostic's to report (E0427), not
      // this one's to guess at. (This used an EMPTY program to stand in for
      // an unresolvable callee; a program that does not hold the file is
      // refused now, as a caller error.)
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          arr[mystery()] <- 1;
        }
      `,
        { cppMode: false },
      );
      const errors = new ArrayIndexTypeAnalyzer(context).analyze(syntax);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe("edge cases", () => {
    it("should report multiple errors in same function", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          i32 a <- 0;
          i32 b <- 1;
          arr[a] <- 1;
          arr[b] <- 2;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe("E0850");
      expect(errors[1].code).toBe("E0850");
    });
  });

  // ========================================================================
  // Nested array subscript (Issue #950)
  // ========================================================================

  describe("nested array subscript", () => {
    it("should allow arr[data[i]] where data is u8[8] (Issue #950)", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          mut u8[10] arr;
          u8[8] data <- [0, 0, 3, 0, 0, 0, 0, 0];
          arr[data[2]] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow arr[data[i] - 1] where data is u8[8] (Issue #950)", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          mut u8[10] arr;
          u8[8] data <- [0, 0, 3, 0, 0, 0, 0, 0];
          arr[data[2] - 1] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow nested subscript with const array param (Issue #950)", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void process(u8[8] data) {
          mut u8[10] inputs;
          inputs[data[2] - 1] <- data[1];
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should reject nested subscript when inner array is signed", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          i8[8] data;
          arr[data[2]] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i8");
    });

    it("should allow multi-dimensional array index access", () => {
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          u8[4][4] matrix;
          arr[matrix[1][2]] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should handle constant-dimension arrays (PR #951 review)", () => {
      // Regression test: regex must handle non-numeric dimensions
      // e.g., "u8[DEVICE_COUNT]" should strip to "u8"
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          u8[4] lookup;
          arr[lookup[0]] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should reject unknown type as index with E0852 (branch coverage)", () => {
      // Tests the branch where isKnownEnum returns false for non-enum types
      // This triggers E0852 for types that aren't signed, float, unsigned, or enum
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          u8[10] arr;
          UnknownType x;
          arr[x] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      // No mock symbols - UnknownType is not a known enum
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0852");
      expect(errors[0].actualType).toBe("UnknownType");
    });

    it("should handle struct type in subscript chain (branch coverage)", () => {
      // Tests the branch where array stripping doesn't find brackets
      // Covers the case where strippedType === currentType (not an array)
      const { syntax, context } = testAnalysisContextFor(
        `
        struct Wrapper { u32 idx; }
        void main() {
          u8[10] arr;
          Wrapper w;
          arr[w.idx] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });

    it("should allow bit index from signed integer as array index (branch coverage)", () => {
      // Tests the SIGNED_TYPES branch in resolvePostfixOpType for LBRACKET
      // i32[bit] returns "bool", which is valid for array indexing
      const { syntax, context } = testAnalysisContextFor(
        `
        void main() {
          mut u8[2] arr;
          i32 signedFlags <- 1;
          arr[signedFlags[0]] <- 5;
        }
      `,
        { cppMode: false },
      );
      const analyzer = new ArrayIndexTypeAnalyzer(context);
      const errors = analyzer.analyze(syntax);
      expect(errors).toHaveLength(0);
    });
  });
});

// #1991: read off 1.2's syntax, so a later subscript in the chain and where the
// report lands are asserted directly.
describe("ArrayIndexTypeAnalyzer -- later subscripts", () => {
  it("checks every subscript in a chain, at the index", () => {
    const { syntax, context } = testAnalysisContextFor(
      [
        "u8[2][2] grid;",
        "void f() {",
        "    i8 s <- 1;",
        "    u8 x <- grid[0][s];",
        "}",
      ].join("\n"),
      { cppMode: false },
    );
    const found = new ArrayIndexTypeAnalyzer(context).analyze(syntax);
    expect(found.map((e) => [e.code, e.span.line, e.span.column])).toEqual([
      ["E0850", 4, 20],
    ]);
  });
});
