/**
 * Unit tests for runAnalyzers
 * Tests that all analyzers run in sequence with early returns on errors
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import CnxSourceParser from "../../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import runAnalyzers from "../../../../../cnx/TRANSPILE/1-Analyze/runAnalyzers";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "./testAnalysisContextFor";
import type IIncludeContext from "../../../../../cnx/TRANSPILE/1-Analyze/types/IIncludeContext";
import EFileType from "../../../../../cnx/PARSE/1-Discover/types/EFileType";

/**
 * #1322 / #1672: discovery's answer, for a test that has no file.
 *
 * `runAnalyzers` requires 1.1's include resolutions rather than accepting
 * absent ones, so a unit test states them too -- no file on disk, so the one
 * directive these tests write resolves to nothing, and no header has a cnx
 * source. That makes E0504 and E0506 silent here by construction, and it says
 * so, where an optional parameter would have made them silent by omission.
 */
const NO_INCLUDES: IIncludeContext = {
  resolutions: new Map([["#include <string.h>", null]]),
  cnxAlternatives: new Map(),
  kinds: new Map([["#include <string.h>", EFileType.CHeader]]),
};

/**
 * Helper to parse cnx code and return the AST plus its comments.
 *
 * #1445: this used to build its own `CharStream`/lexer/`CommonTokenStream`/
 * parser -- a second spelling of `CnxSourceParser.parse` that had to be kept
 * in step with it by hand, and which left ANTLR's DEFAULT error listeners
 * installed, so an unparsable fixture printed to the console instead of being
 * collected. It calls the real parser now, and takes `comments` off 1.2's
 * artifact because that is what `runAnalyzers` asks for.
 */
function parseWithComments(source: string) {
  const parsed = CnxSourceParser.parse(source);
  return {
    parsed,
    /**
     * #1668: 2.1's context over this source declared and resolved, never an
     * empty stand-in program -- an analyzer asking Program about a file it
     * does not hold is a caller error, and an empty one answered every
     * typing question with "nothing is declared". Program answers by
     * position, so it matches `tree`, parsed from the same text.
     *
     * #1428: a C run, stated -- the analyzers read the mode from the program.
     */
    contextWith: (symbolTable: SymbolTable) =>
      testAnalysisContextFor(source, { symbolTable, cppMode: false }).context,
  };
}

describe("runAnalyzers", () => {
  // ========================================================================
  // Happy Path
  // ========================================================================

  describe("valid code", () => {
    it("should return no errors for valid code", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x <- 5;
          u32 y <- x + 3;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;
      expect(errors).toHaveLength(0);
    });

    it("should return no errors for empty program", () => {
      const { parsed, contextWith } = parseWithComments(``);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Identifier syntax - ADR-063
  // ========================================================================

  describe("identifier syntax", () => {
    // #1991: the spelling of a name is syntax, so 1.2 reports it
    // (IdentifierForm). 2.1 reporting it too would print it twice.
    it("leaves E0201 to 1.2", () => {
      const { parsed, contextWith } = parseWithComments(`u8 value_ <- 1;`);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.map((e) => e.message).join("\n")).not.toContain("E0201");
    });

    it("should accept a leading underscore (ADR-063)", () => {
      const { parsed, contextWith } = parseWithComments(`
        void fn() {
          u8 _local <- 1;
          u8 x <- _local;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Phase 2: Parameter Naming Errors (early return)
  // ========================================================================

  describe("phase 2 - parameter naming", () => {
    it("should return early on parameter naming error", () => {
      const { parsed, contextWith } = parseWithComments(`
        void process(u32 process_data) {
          u32 x <- process_data;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      // Registered WITH formatWithCode, so the code reaches the message
      expect(errors[0].message).toContain("error[E0227]");
      expect(errors[0].message).toContain("process_data");
    });
  });

  // ========================================================================
  // Phase 2: Struct Field Errors (early return)
  // ========================================================================
  // Note: ADR-058 removed all reserved field names (including "length")
  // so there are no struct field naming violations to test.
  // The StructFieldAnalyzer infrastructure remains for future reserved names.

  // ========================================================================
  // Phase 3: Initialization Errors (early return)
  // ========================================================================

  describe("phase 3 - initialization", () => {
    it("should return early on use-before-init error", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x;
          u32 y <- x;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      // InitializationAnalyzer uses E0381 for use-before-init
      expect(errors[0].message).toContain("E0381");
    });
  });

  // ========================================================================
  // Phase 4: Function Call Errors (early return)
  // ========================================================================

  describe("phase 4 - function call", () => {
    it("should return early on call-before-define error", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          helper();
        }
        void helper() {
          u32 x <- 5;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0422");
    });
  });

  // ========================================================================
  // Phase 5: Null Check Errors (early return)
  // ========================================================================

  describe("phase 5 - null check", () => {
    it("should return early on missing null check", () => {
      const { parsed, contextWith } = parseWithComments(`
        #include <string.h>
        void main() {
          cstring str <- "hello";
          strchr(str, 'x');
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0901");
    });
  });

  // ========================================================================
  // Phase 6: Division by Zero Errors (early return)
  // ========================================================================

  describe("phase 6 - division by zero", () => {
    it("should return early on division by zero", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x <- 10 / 0;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0800");
    });
  });

  // ========================================================================
  // Phase 7: Float Modulo Errors (early return)
  // ========================================================================

  describe("phase 7 - float modulo", () => {
    it("should return early on float modulo", () => {
      // #1668: the local's type comes from the real program's frames
      const source = `
        void main() {
          f32 x <- 10.5;
          f32 result <- x % 3;
        }
      `;
      const { parsed } = parseWithComments(source);
      const { context } = testAnalysisContextFor(source, {
        cppMode: false,
      });
      const errors = runAnalyzers(parsed, {
        context,
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0804");
    });
  });

  // ========================================================================
  // Phase 8: Comment Validation
  // ========================================================================

  describe("phase 8 - comment validation", () => {
    it("should return comment errors for nested comment markers", () => {
      // MISRA 3.1: no nested comment start markers inside comments
      const code = "/* outer /* nested */ \nvoid main() { u32 x <- 1; }";
      const { parsed, contextWith } = parseWithComments(code);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("MISRA");
    });
  });

  // ========================================================================
  // Options: TranspileState integration and symbolTable
  // ========================================================================

  describe("options", () => {
    // Read from `context.program.externalStructFields()` since #1447/#1456;
    // the state is not reachable from 2.1.
    it("should read externalStructFields from the program artifact", () => {
      // Code that uses a field from an external struct - externalStructFields
      // are now read from TranspileState
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x <- 5;
        }
      `);

      // The header's struct fields reach 1.4, which builds the program the
      // analyzers read them from
      const headers = new SymbolTable();
      headers.addStructField("ExternalStruct", "field1", "u32");
      headers.addStructField("ExternalStruct", "field2", "u32");

      const errors = runAnalyzers(parsed, {
        context: contextWith(headers),
        includes: NO_INCLUDES,
      }).errors;
      expect(errors).toHaveLength(0);
    });

    it("should pass symbolTable to analyzers", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x <- 5;
        }
      `);

      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "ExternalFunc",
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "external.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
      });

      const errors = runAnalyzers(parsed, {
        context: contextWith(symbolTable),
        includes: NO_INCLUDES,
      }).errors;
      expect(errors).toHaveLength(0);
    });

    it("consults the table the CALLER passed, not shared state", () => {
      // #1456: this used to be "should use state.symbolTable by
      // default" and covered the `options.symbolTable ?? state.symbolTable`
      // fallback, which is gone. Rewritten rather than deleted, because the
      // property worth keeping is that the table actually reaches the
      // analyzers -- only the route changed.
      //
      // The SOURCE has to consult the table, and this one does not: with
      // `void main() { u32 x <- 5; }`, handing every analyzer a fresh empty
      // table instead of the caller's leaves this green, so it asserts the
      // route rather than proving it. The two neighbors above have the same
      // shape. Making it prove the route needs a fact the caller's table
      // carries and the mock `symbols` view does not -- see #1663, which holds
      // the measurement rather than leaving this comment as the only record.
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x <- 5;
        }
      `);

      const caller = new SymbolTable();
      caller.addCppSymbol({
        name: "CppMessage",
        unqualifiedName: "CppMessage",
        kind: "class",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "CppMessage.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
      });
      caller.addStructField("CppMessage", "pgn", "u16");

      const errors = runAnalyzers(parsed, {
        context: contextWith(caller),
        includes: NO_INCLUDES,
      }).errors;
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Error format validation
  // ========================================================================

  describe("error format", () => {
    it("should include line, column, message, and severity on all errors", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x <- 10 / 0;
        }
      `);
      const errors = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      }).errors;

      for (const error of errors) {
        expect(error).toHaveProperty("line");
        expect(error).toHaveProperty("column");
        expect(error).toHaveProperty("message");
        expect(error).toHaveProperty("severity");
        expect(typeof error.line).toBe("number");
        expect(typeof error.column).toBe("number");
        expect(typeof error.message).toBe("string");
        expect(error.severity).toBe("error");
      }
    });
  });

  // #1991: 2.1 walks each file's value positions once, for every step that
  // types a value by where it stands, and hands that walk on to 2.2.
  describe("value positions", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("hands on where each value stands", () => {
      const { parsed, contextWith } = parseWithComments(`u8 g <- 5;`);
      const analysis = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      });
      const declaration = parsed.program.declarations[0].declaration;
      expect(declaration.kind).toBe("variableDeclaration");
      const initializer =
        declaration.kind === "variableDeclaration"
          ? declaration.initializer
          : null;
      expect(analysis.errors).toHaveLength(0);
      expect(
        analysis.valuePositions?.positions.get(initializer!)?.typeText,
      ).toBe("u8");
    });

    it("walks them once, for every step that reads them", () => {
      const walk = vi.spyOn(ValuePositions, "of");
      const { parsed, contextWith } = parseWithComments(`u8 g <- 5;`);
      runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      });
      expect(walk).toHaveBeenCalledTimes(1);
    });

    it("hands on none when an error stopped the analysis", () => {
      const { parsed, contextWith } = parseWithComments(`
        void main() {
          u32 x;
          u32 y <- x;
        }
      `);
      const analysis = runAnalyzers(parsed, {
        context: contextWith(new SymbolTable()),
        includes: NO_INCLUDES,
      });
      expect(analysis.errors.length).toBeGreaterThan(0);
      expect(analysis.valuePositions).toBeNull();
    });
  });
});
