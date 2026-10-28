/**
 * Unit tests for InitializationAnalyzer
 * Issue #503: Tests for C++ class initialization handling
 */

import TestSymbolTable from "../../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it, beforeEach } from "vitest";
import { CnxLexer } from "../../../../../cnx/PARSE/2-Parse/grammar/CnxLexer";
import { CnxParser } from "../../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import InitializationAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/InitializationAnalyzer";
import ProgramLowering from "../../../../../cnx/PARSE/2-Parse/ProgramLowering";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import TranspileState from "../../../../../cnx/TRANSPILE/TranspileState";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import Program from "../../../../../cnx/PARSE/4-Resolve/Program";
import type IProgram from "../../../../../cnx/types/IProgram";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * Parse cnx source code into an AST
 */
function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CnxLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CnxParser(tokenStream);
  return parser.program();
}

let state = new TranspileState();

/** #2004: the analyzer binds through the program 1.4 built from `code` */
function contextFor(
  code: string,
  symbolTable: SymbolTable = TestSymbolTable.of(state),
) {
  return testAnalysisContextFor(code, { cppMode: false, symbolTable }).context;
}

describe("InitializationAnalyzer", () => {
  // Reset TranspileState before each test
  beforeEach(() => {
    state = new TranspileState();
    TestSymbolTable.install(state);
  });

  // ========================================================================
  // Issue #503: C++ Class Initialization
  // ========================================================================

  describe("C++ class initialization (Issue #503)", () => {
    it("should not flag C++ class variables as uninitialized", () => {
      const code = `
        void main() {
          CppMessage msg;
          u16 pgn <- msg.pgn;
        }
      `;
      const tree = parse(code);

      // Set up TranspileState with C++ class
      TestSymbolTable.of(state).addCppSymbol({
        name: "CppMessage",
        unqualifiedName: "CppMessage",
        kind: "class",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "CppMessage.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
      });
      // Add the field so the analyzer knows about it
      TestSymbolTable.of(state).addStructField("CppMessage", "pgn", "u16");

      // Build external struct fields from symbol table
      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });

      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Should have NO errors - C++ class is initialized by constructor
      expect(errors).toHaveLength(0);
    });

    it("should still flag cnx structs as uninitialized", () => {
      const code = `
        struct MyStruct {
          u16 value;
        }
        void main() {
          MyStruct s;
          u16 v <- s.value;
        }
      `;
      const tree = parse(code);

      // No C++ symbols in symbol table - MyStruct is a cnx struct
      const symbolTable = new SymbolTable();

      const analyzer = new InitializationAnalyzer(
        contextFor(code, symbolTable),
      );
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // SHOULD have an error - cnx struct is NOT initialized
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("value");
    });

    it("should not flag C++ struct variables as uninitialized", () => {
      const code = `
        void main() {
          CppStruct data;
          u32 val <- data.value;
        }
      `;
      const tree = parse(code);

      // Set up TranspileState with C++ struct (not class)
      TestSymbolTable.of(state).addCppSymbol({
        name: "CppStruct",
        unqualifiedName: "CppStruct",
        kind: "struct",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "types.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
      });
      TestSymbolTable.of(state).addStructField("CppStruct", "value", "u32");

      // Build external struct fields from symbol table
      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });

      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Should have NO errors - C++ structs also have default constructors
      expect(errors).toHaveLength(0);
    });

    it("should still flag C struct variables as uninitialized", () => {
      const code = `
        void main() {
          CStruct data;
          u32 val <- data.value;
        }
      `;
      const tree = parse(code);

      // Set up TranspileState with C struct (not C++)
      TestSymbolTable.of(state).addCSymbol({
        name: "CStruct",
        kind: "struct",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "types.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        isUnion: false,
      });
      TestSymbolTable.of(state).addStructField("CStruct", "value", "u32");

      // Build external struct fields from symbol table (as pipeline does)
      state.program = Program.build([], {
        cppMode: false,
        headerStructFields: state.symbolTable.getAllStructFields(),
      });

      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // SHOULD have an error - C structs don't have constructors
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
    });

    it("should work without symbol table (backward compatibility)", () => {
      const code = `
        struct LocalStruct {
          u16 field;
        }
        void main() {
          LocalStruct s;
          u16 f <- s.field;
        }
      `;
      const tree = parse(code);

      // No symbol table passed - should still work
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Should have an error for uninitialized local struct
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
    });
  });

  // ========================================================================
  // Basic Initialization Checks
  // ========================================================================

  describe("basic initialization", () => {
    it("should not flag initialized variables", () => {
      const code = `
        void main() {
          u32 x <- 5;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should flag uninitialized primitive variables", () => {
      const code = `
        void main() {
          u32 x;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("x");
    });

    it("should not flag global variables (zero-initialized)", () => {
      const code = `
        u32 globalVar;
        void main() {
          u32 x <- globalVar;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should not flag function parameters", () => {
      const code = `
        void process(u32 param) {
          u32 x <- param;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Control Flow: if/else Branch Analysis
  // ========================================================================

  describe("control flow - if/else branches", () => {
    it("should keep initialization when both if and else branches initialize", () => {
      const code = `
        void main() {
          u32 x;
          bool cond <- true;
          if (cond) {
            x <- 5;
          } else {
            x <- 10;
          }
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Both branches initialize x, so using x after if-else is safe
      expect(errors).toHaveLength(0);
    });

    it("should flag possibly uninitialized after if-without-else", () => {
      const code = `
        void main() {
          u32 x;
          bool cond <- true;
          if (cond) {
            x <- 5;
          }
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Without else, x might not be initialized
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("x");
    });
  });

  // ========================================================================
  // Control Flow: Deterministic For Loops
  // ========================================================================

  describe("control flow - deterministic for loops", () => {
    it("should preserve initialization in deterministic for loop", () => {
      const code = `
        void main() {
          mut u32 sum;
          for (mut u32 i <- 0; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 result <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Deterministic for-loop (0 to 4) will definitely run
      // so sum is guaranteed initialized
      expect(errors).toHaveLength(0);
    });

    it("should merge struct field state through deterministic for loop", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          mut Point p;
          p.x <- 1;
          for (mut u32 i <- 0; i < 3; i <- i + 1) {
            p.y <- i;
          }
          u32 a <- p.x;
          u32 b <- p.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // p.x initialized before loop, p.y initialized in deterministic loop
      // mergeInitializationState merges p.x from beforeState
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Write Context Tracking
  // ========================================================================

  describe("write context tracking", () => {
    it("should not flag assignment target as uninitialized use", () => {
      const code = `
        void main() {
          mut u32 x;
          x <- 5;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // x is assigned (write context) then read - no error
      expect(errors).toHaveLength(0);
    });
  });

  // #1991: each place the walk of 1.2's syntax reads, in the order it runs
  describe("every position 1.2 records", () => {
    const found = (code: string) =>
      new InitializationAnalyzer(contextFor(code))
        .analyze(ProgramLowering.program(parse(code), null))
        .map((e) => [e.code, e.variable, e.span.line]);

    it("reads a do-while's condition after its body", () => {
      expect(
        found(
          `void main() {\n  mut u32 x;\n  do {\n    x <- 1;\n  } while (x < 3);\n}`,
        ),
      ).toEqual([]);
    });

    it("counts a global as initialized", () => {
      expect(found(`u32 g;\nvoid main() {\n  u32 y <- g;\n}`)).toEqual([]);
    });

    it("counts a write through a subscript for the whole variable", () => {
      expect(
        found(
          `struct P {\n  u8 x;\n  u8 y;\n}\nvoid main() {\n  mut P p;\n  p.x[0] <- true;\n  u8 v <- p.y;\n}`,
        ),
      ).toEqual([]);
    });

    it("does not read an array for its .length", () => {
      expect(
        found(`void main() {\n  u8 arr[4];\n  u32 n <- arr.length;\n}`),
      ).toEqual([]);
    });

    it("does not read an array for an element's .length", () => {
      expect(
        found(`void main() {\n  u8 grid[2][3];\n  u32 n <- grid[0].length;\n}`),
      ).toEqual([]);
    });

    it("reads an assignment target's subscript", () => {
      expect(
        found(`void main() {\n  u8 x <- 0;\n  u8 i;\n  x[i] <- true;\n}`),
      ).toEqual([["E0381", "i", 4]]);
    });

    it("reads a for loop's update", () => {
      expect(
        found(
          `void main() {\n  u32 n;\n  for (u32 i <- 0; i < 3; i <- i + n) {\n  }\n}`,
        ),
      ).toEqual([["E0381", "n", 3]]);
    });

    it("reads a for loop's declaring init", () => {
      expect(
        found(
          `void main() {\n  u32 n;\n  for (u32 i <- n; i < 3; i +<- 1) {\n  }\n}`,
        ),
      ).toEqual([["E0381", "n", 3]]);
    });

    it("reads a for loop's assigning init", () => {
      expect(
        found(
          `void main() {\n  u32 n;\n  u32 i <- 0;\n  for (i <- n; i < 3; i +<- 1) {\n  }\n}`,
        ),
      ).toEqual([["E0381", "n", 4]]);
    });

    it("reads a scope member's initializer", () => {
      expect(found(`scope S {\n  u8 count;\n  u8 limit <- count;\n}`)).toEqual([
        ["E0381", "count", 3],
      ]);
    });

    it("reads inside a parenthesized primary with ops", () => {
      expect(
        found(`void main() {\n  u8 x;\n  bool b <- (x + 1)[0];\n}`),
      ).toEqual([["E0381", "x", 3]]);
    });

    it("reads a subscript's index", () => {
      expect(
        found(
          `void main() {\n  u8 arr[4];\n  u8 i;\n  arr[0] <- 1;\n  u8 v <- arr[i];\n}`,
        ),
      ).toEqual([["E0381", "i", 5]]);
    });

    it("reads an else branch", () => {
      expect(
        found(
          `void main() {\n  u8 x;\n  if (true) {\n  } else {\n    u8 y <- x;\n  }\n}`,
        ),
      ).toEqual([["E0381", "x", 5]]);
    });
  });

  describe("bindings (#2004)", () => {
    it("fails loudly when 1.4 frames no declaration for a function-body local", () => {
      const code = `
        void process() {
          u32 x <- 1;
        }
      `;
      const real = contextFor(code);
      const program: IProgram = Object.create(real.program, {
        lexicalFrameAt: {
          value: (
            sourceFile: string,
            at: { line: number; column: number },
          ) => ({
            ...real.program.lexicalFrameAt(sourceFile, at),
            declarations: [],
          }),
        },
      });
      const context = { ...real, program };
      expect(() =>
        new InitializationAnalyzer(context).analyze(
          ProgramLowering.program(parse(code), null),
        ),
      ).toThrow("1.4 frames every declaration in a function body ('x')");
    });
  });

  describe("parameters", () => {
    it("treats a parameter as initialized by its caller", () => {
      const code = `
        void process(u32 param1) {
          u32 x <- param1;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group A: Struct Field Tracking
  // ========================================================================

  describe("struct field tracking", () => {
    it("should track struct field-by-field initialization", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          mut Point p;
          p.x <- 10;
          p.y <- 20;
          u32 a <- p.x;
          u32 b <- p.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should flag uninitialized struct field read", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point p;
          p.x <- 10;
          u32 a <- p.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("p.y");
    });

    it("should recognize struct parameter fields as initialized", () => {
      const code = `
        struct Config {
          u32 timeout;
          u32 retries;
        }
        void process(Config cfg) {
          u32 t <- cfg.timeout;
          u32 r <- cfg.retries;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should mark all fields initialized on whole struct assignment", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point a <- {x: 1, y: 2};
          mut Point b;
          b <- a;
          u32 v <- b.x;
          u32 w <- b.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should detect partially initialized struct (not all fields assigned)", () => {
      const code = `
        struct Vec3 {
          u32 x;
          u32 y;
          u32 z;
        }
        void main() {
          Vec3 v;
          v.x <- 1;
          v.y <- 2;
          u32 val <- v.z;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("v.z");
    });
  });

  // ========================================================================
  // Group B: Array Element Assignment
  // ========================================================================

  describe("array element assignment", () => {
    it("should track initialization through array element assignment", () => {
      const code = `
        void main() {
          u32 arr[3] <- [0, 0, 0];
          arr[0] <- 10;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group C: While Loop
  // ========================================================================

  describe("control flow - while loop", () => {
    it("should conservatively treat while loop as possibly not executing", () => {
      const code = `
        void main() {
          u32 x;
          u32 count <- 0;
          while (count < 5) {
            x <- 5;
            count <- count + 1;
          }
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("x");
    });
  });

  // ========================================================================
  // Group D: For Loop Variants (isDeterministicForLoop)
  // ========================================================================

  describe("control flow - non-deterministic for loops", () => {
    it("should flag non-deterministic for loop with non-zero init", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 1; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should handle deterministic for loop with pre-declared variable (forAssignment)", () => {
      const code = `
        void main() {
          mut u32 sum;
          mut u32 i <- 0;
          for (i <- 0; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // forAssignment path: i already initialized, loop is deterministic (0 < 4)
      expect(errors).toHaveLength(0);
    });

    it("should flag non-deterministic for loop with non-< condition", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 0; i != 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should flag non-deterministic for loop with zero bound", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 0; i < 0; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // bound is 0, so loop never runs — non-deterministic
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should flag non-deterministic forAssignment with non-zero init", () => {
      const code = `
        void main() {
          u32 sum;
          u32 i <- 0;
          for (i <- 1; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // forAssignment with non-zero init is non-deterministic, sum may not be set
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });
  });

  // ========================================================================
  // Group E: Function Call Arguments
  // ========================================================================

  describe("function call arguments", () => {
    it("should mark variables passed as function arguments as initialized", () => {
      const code = `
        void fill(mut u32 result) {
          result <- 42;
        }
        void main() {
          mut u32 x;
          fill(x);
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should skip struct member init check inside function call arguments", () => {
      const code = `
        struct Point {
          u32 x;
        }
        void consume(u32 val) { }
        void main() {
          Point p;
          consume(p.x);
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group F: .length on Non-String Type
  // ========================================================================

  describe(".length on non-string type", () => {
    it("should not flag .length access on array type", () => {
      const code = `
        void main() {
          u32 arr[5] <- [1, 2, 3, 4, 5];
          u32 len <- arr.length;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  describe("ADR-058 length properties (#1867)", () => {
    it("does not read a never-written field's value for its length", () => {
      const code = `
        struct Pair { u32 a; u8[4] b; }
        void main() {
          Pair p;
          u32 n <- p.a.type_byte_length + p.b.type_element_count + p.b.type_bit_length;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("still reads the field's value without a length property", () => {
      const code = `
        struct Pair { u32 a; u8[4] b; }
        void main() {
          Pair p;
          u32 n <- p.a;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors.map((e) => e.code)).toEqual(["E0381"]);
    });
  });

  // ========================================================================
  // Group G: String Type Properties
  // ========================================================================

  describe("string type properties", () => {
    it("should flag .length on uninitialized string", () => {
      const code = `
        void main() {
          string<32> s;
          u32 len <- s.length;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("s");
    });

    it("should not flag .length on initialized string", () => {
      const code = `
        void main() {
          string<32> s <- "hello";
          u32 len <- s.length;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group H: Global Scope with Scopes
  // ========================================================================

  describe("global scope with scopes", () => {
    it("should handle scope member variables as globally initialized", () => {
      const code = `
        scope LED {
          mut u32 brightness;
          public void on() {
            brightness <- 100;
          }
        }
        void main() {
          LED.on();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should handle scope member variable with user type", () => {
      const code = `
        struct Config {
          u32 timeout;
        }
        scope System {
          mut Config settings;
          public void init() {
            settings.timeout <- 100;
          }
        }
        void main() {
          System.init();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should handle global struct-typed variable", () => {
      const code = `
        struct Config {
          u32 timeout;
        }
        Config globalConfig;
        void main() {
          u32 t <- globalConfig.timeout;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group I: Compound Assignment (Issue #1012)
  // ========================================================================

  describe("compound assignment (Issue #1012)", () => {
    it("should flag compound assignment on uninitialized variable", () => {
      const code = `
        void main() {
          u32 sum;
          sum +<- 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should not flag compound assignment on initialized variable", () => {
      const code = `
        void main() {
          mut u32 sum <- 0;
          sum +<- 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should flag compound assignment on uninitialized struct field", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point p;
          p.x +<- 10;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("p.x");
    });

    it("should not flag compound assignment on initialized struct field", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          mut Point p <- {x: 10, y: 20};
          p.x +<- 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should flag all compound operators on uninitialized variable", () => {
      const operators = [
        "+<-",
        "-<-",
        "*<-",
        "/<-",
        "%<-",
        "&<-",
        "|<-",
        "^<-",
        "<<<-",
        ">><-",
      ];

      for (const op of operators) {
        const code = `
          void main() {
            u32 x;
            x ${op} 1;
          }
        `;
        const tree = parse(code);
        const analyzer = new InitializationAnalyzer(contextFor(code));
        const errors = analyzer.analyze(ProgramLowering.program(tree, null));

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].code).toBe("E0381");
        expect(errors[0].variable).toBe("x");
      }
    });

    it("should not flag simple assignment on uninitialized variable", () => {
      const code = `
        void main() {
          mut u32 x;
          x <- 5;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Simple assignment initializes the variable, so no error
      expect(errors).toHaveLength(0);
    });

    it("should flag compound assignment on array element with uninitialized array", () => {
      const code = `
        void main() {
          u32[4] arr;
          arr[0] +<- 5;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // Array is uninitialized, reading arr[0] for compound assignment is an error
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("arr");
    });

    it("should not flag compound assignment on array element with initialized array", () => {
      const code = `
        void main() {
          mut u32[4] arr <- [1, 2, 3, 4];
          arr[0] +<- 5;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group J: C++ Non-Struct Symbol
  // ========================================================================

  describe("C++ non-struct symbol", () => {
    it("should not treat C++ enum as auto-initialized", () => {
      const code = `
        void main() {
          CppEnum e;
          u32 val <- e;
        }
      `;
      const tree = parse(code);

      const symbolTable = new SymbolTable();
      symbolTable.addCppSymbol({
        name: "CppEnum",
        unqualifiedName: "CppEnum",
        kind: "enum",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "types.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
      });

      const analyzer = new InitializationAnalyzer(
        contextFor(code, symbolTable),
      );
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // C++ enums don't have constructors - should flag as uninitialized
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("e");
    });
  });

  // ========================================================================
  // Issue #1019: Scope Member Initialization
  // ========================================================================

  describe("scope member initialization (Issue #1019)", () => {
    it("should allow reading scope member with inline initializer", () => {
      const code = `
        scope S {
          u32 value <- 42;
          public u32 get() { return value; }
        }
        void main() {
          u32 v <- S.get();
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      expect(errors).toHaveLength(0);
    });

    it("should allow reading scope member assigned in another function", () => {
      const code = `
        scope S {
          mut u32 value;
          public void init() { value <- 10; }
          public u32 get() { return value; }
        }
        void main() {
          S.init();
          u32 v <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // value is assigned in init(), so get() can read it
      expect(errors).toHaveLength(0);
    });

    it("should flag uninitialized scope member read", () => {
      const code = `
        scope S {
          u32 value;
          public u32 get() { return value; }
        }
        void main() {
          u32 v <- S.get();
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // value is never assigned - should error
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("value");
    });

    it("should detect assignment in do-while body", () => {
      const code = `
        scope S {
          mut u32 count;
          public void init() {
            mut u32 i <- 0;
            do {
              count <- i;
              i <- i + 1;
            } while (i < 1);
          }
          public u32 get() { return count; }
        }
        void main() {
          S.init();
          u32 c <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // count is assigned inside do-while in init()
      expect(errors).toHaveLength(0);
    });

    it("should detect assignment in if statement", () => {
      const code = `
        scope S {
          mut u32 value;
          public void set(bool flag) {
            if (flag = true) {
              value <- 1;
            }
          }
          public u32 get() { return value; }
        }
        void main() {
          S.set(true);
          u32 v <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // value is assigned in if branch
      expect(errors).toHaveLength(0);
    });

    it("should detect assignment in for loop", () => {
      const code = `
        scope S {
          mut u32 total;
          public void calc() {
            for (mut u32 i <- 0; i < 5; i <- i + 1) {
              total <- i;
            }
          }
          public u32 get() { return total; }
        }
        void main() {
          S.calc();
          u32 t <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // total is assigned in for loop
      expect(errors).toHaveLength(0);
    });

    it("should detect assignment via this.member", () => {
      const code = `
        scope S {
          mut u32 data;
          public void set() { this.data <- 100; }
          public u32 get() { return data; }
        }
        void main() {
          S.set();
          u32 d <- S.get();
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer(contextFor(code));
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // data is assigned via this.data
      expect(errors).toHaveLength(0);
    });

    it("should detect assignment in switch case", () => {
      const code = `
        scope S {
          mut u32 result;
          public void choose(u32 opt) {
            switch (opt) {
              case 1 { result <- 10; }
              case 2 { result <- 20; }
            }
          }
          public u32 get() { return result; }
        }
        void main() {
          S.choose(1);
          u32 r <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // result is assigned in switch cases
      expect(errors).toHaveLength(0);
    });

    it("should detect assignment in while loop", () => {
      const code = `
        scope S {
          mut u32 counter;
          public void loop() {
            mut u32 i <- 0;
            while (i < 3) {
              counter <- i;
              i <- i + 1;
            }
          }
          public u32 get() { return counter; }
        }
        void main() {
          S.loop();
          u32 c <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // counter is assigned in while loop
      expect(errors).toHaveLength(0);
    });

    it("should detect assignment in switch default case", () => {
      const code = `
        scope S {
          mut u32 result;
          public void choose(u32 opt) {
            switch (opt) {
              case 1 { result <- 10; }
              default { result <- 99; }
            }
          }
          public u32 get() { return result; }
        }
        void main() {
          S.choose(5);
          u32 r <- S.get();
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new InitializationAnalyzer(context);
      const errors = analyzer.analyze(ProgramLowering.program(tree, null));

      // result is assigned in default case
      expect(errors).toHaveLength(0);
    });
  });
  // ========================================================================
  // #1283 review: ADR-029 defaults, read from the resolved program
  // ========================================================================

  describe("ADR-029 defaults are not initialization (#1283, #1980)", () => {
    const errorsOf = (code: string) => {
      const { syntax, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      return new InitializationAnalyzer(context).analyze(syntax);
    };

    const STAGE = `
      u32 tickDefault() { return 10; }
      scope Pump {
        public struct Stage {
          tickDefault handler;
          u32 count;
        }
        public u32 run() {
          ARRAY
          return 0;
        }
      }
    `;

    it.each([
      ["this.Stage[2] stages;", "this. element type"],
      ["Stage[2] stages;", "bare scope-nested element type"],
      ["Stage stages[2];", "C-style dimension"],
    ])(
      "flags a callback read from an array of a scope-nested struct before assignment (%s, %s)",
      (array) => {
        const code = STAGE.replace(
          "ARRAY",
          `${array}\n          u32 r <- stages[1].handler();`,
        );
        expect(errorsOf(code).map((e) => [e.code, e.variable])).toEqual([
          ["E0381", "stages"],
        ]);
      },
    );

    const HOLDER = `
      u32 tickDefault() { return 10; }
      struct Ticker {
        tickDefault handler;
        u32 count;
      }
      struct Holder {
        Ticker inner;
        u32 total;
      }
      u32 main() {
        Holder h;
        READ
        return 0;
      }
    `;

    it("flags a callback inside a nested struct field before assignment (E0381)", () => {
      const code = HOLDER.replace("READ", "u32 r <- h.inner.handler();");
      expect(errorsOf(code).map((e) => [e.code, e.variable])).toEqual([
        ["E0381", "h.inner"],
      ]);
    });

    it("flags a non-callback field inside a nested struct field (E0381)", () => {
      const errors = errorsOf(
        HOLDER.replace("READ", "u32 c <- h.inner.count;"),
      );
      expect(errors.map((e) => [e.code, e.variable])).toEqual([
        ["E0381", "h.inner"],
      ]);
    });

    it("flags a nested struct read whole before assignment, though its default covers every field (E0381)", () => {
      const code = `
        u32 tickDefault() { return 10; }
        struct Inner { tickDefault handler; }
        struct Outer { Inner inner; u32 total; }
        u32 main() {
          Outer o;
          Inner copy <- o.inner;
          return 0;
        }
      `;
      expect(errorsOf(code).map((e) => [e.code, e.variable])).toEqual([
        ["E0381", "o.inner"],
      ]);
    });
  });
});
