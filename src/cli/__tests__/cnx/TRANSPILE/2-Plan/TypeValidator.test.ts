/**
 * Comprehensive unit tests for TypeValidator
 * Tests all validation methods for 100% coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createMockSymbols from "../../../../../cnx/types/__testUtils__/codeGenSymbolsHelpers";
import TranspileState from "../../../../../cnx/TRANSPILE/TranspileState";
import type ICodeGenSymbols from "../../../../../cnx/types/ICodeGenSymbols";
import type ICallbackTypeInfo from "../../../../../cnx/types/ICallbackTypeInfo";
import type TParameterInfo from "../../../../../cnx/types/TParameterInfo";
import TypeValidator from "../../../../../cnx/TRANSPILE/2-Plan/TypeValidator";
import enterScope from "../../../../../cnx/TRANSPILE/__tests__/enterScope";
import testAnalysisContextFor from "../1-Analyze/testAnalysisContextFor";

// ========================================================================
// Test Helpers - Mock Symbols
// ========================================================================
// ========================================================================
// Test Helpers - Setup State
// ========================================================================

interface SetupStateOptions {
  symbols?: ICodeGenSymbols;
  callbackTypes?: Map<string, ICallbackTypeInfo>;
  knownFunctions?: Set<string>;
  currentScopePath?: string | null;
  scopeMembers?: Map<string, Set<string>>;
  currentParameters?: Map<string, TParameterInfo>;
}

function setupState(options: SetupStateOptions = {}): void {
  state = new TranspileState();
  if (options.symbols) {
    state.symbols = options.symbols;
  } else {
    state.symbols = createMockSymbols();
  }
  if (options.callbackTypes) {
    for (const [k, v] of options.callbackTypes) {
      state.callbackTypes.set(k, v);
    }
  }
  if (options.knownFunctions) {
    state.knownFunctions = options.knownFunctions;
  }
  if (options.currentScopePath !== undefined) {
    enterScope(state, options.currentScopePath);
  }
  if (options.scopeMembers) {
    for (const [scope, members] of options.scopeMembers) {
      state.setScopeMembers(scope, members);
    }
  }
  if (options.currentParameters) {
    state.currentParameters = options.currentParameters;
  }
}

// ========================================================================
// Test Helpers - Mock Parser Contexts
// ========================================================================

// ANTLR pattern: method() returns array, method(i) returns element at index i

// #1322: `createMockExpression` went with the bitmap-literal describe, its
// only caller.

// #1322: `createMockStatement` and `createMockBlock` built statements for the
// suites above, which moved to pass 2.1 with the rules they tested. The switch
// mock builders -- `createMockSwitchStatement`, `createMockCaseLabel`,
// `createMockDefaultCase`, `createMockSwitchCase` -- went the same way.

// ========================================================================
// Tests - Include Validation (ADR-010)
// ========================================================================

let state = new TranspileState();

describe("TypeValidator", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Tests - Include Validation (ADR-010) -- relocated to pass 2.1 (#1322)
  // ========================================================================

  // The `validateIncludeNotImplementationFile` and
  // `validateIncludeNoCnxAlternative` describes stood here, 20 cases pinned to
  // two throws that reported `1:0`. They move to
  // `1-Analyze/__tests__/IncludeDirectiveAnalyzer.test.ts`, where they parse a
  // real directive instead of being handed its text and a line NUMBER -- which
  // is what made the position defect invisible to them.

  // ========================================================================
  // Tests - Bitmap Field Validation (ADR-034)
  // ========================================================================

  // #1322: the `validateBitmapFieldLiteral` describe stood here and is deleted
  // with the method. ADR-034's literal-overflow rule is E0881 in pass 2.1,
  // covered by `1-Analyze/__tests__/BitmapAccessAnalyzer.test.ts` and the
  // `tests/adr-034/` fixtures.

  // ========================================================================
  // Tests - Array Bounds Validation (ADR-036)
  // ========================================================================

  // #1322: the `callbackSignaturesMatch` and `validateCallbackAssignment`
  // describes stood here and are deleted with the methods. ADR-029's rules are
  // E0879/E0880 in pass 2.1, covered by
  // `1-Analyze/__tests__/CallbackAssignmentAnalyzer.test.ts` and the
  // `tests/adr-029/` fixtures. Deleted rather than emptied: a test that calls
  // a method and asserts nothing is the shape of a guard that cannot fail.

  describe("resolveBareIdentifier - outside scope coverage", () => {
    // #1668 review: render always runs against a program, so these bind the
    // names as the walk does -- declared in real source, asked at file scope
    const SOURCE = `enum State {
    IDLE
}
struct Point {
    u8 x;
}
register GpioPort {
    0x00 rw u32 DATA,
}
GpioPort GPIO(0x40000000);
u32 after <- 1;`;

    it.each([
      ["an enum", "State"],
      ["a struct", "Point"],
      ["a register", "GPIO"],
    ])("returns null for %s identifier when outside scope", (_what, name) => {
      const { context } = testAnalysisContextFor(SOURCE, { cppMode: false });
      setupState({ symbols: context.symbols, currentScopePath: "" });
      state.program = context.program;
      state.sourcePath = context.sourceFile;
      const result = TypeValidator.resolveBareIdentifier(
        name,
        { line: 10, column: 0 },
        () => false,
        state,
      );
      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // Integer Assignment Validation (ADR-024)
  // ========================================================================

  // #1322: the `validateIntegerAssignment` suite that stood here is gone with the method. ADR-024's
  // rules are E0868/E0869 in pass 2.1, covered by
  // `1-Analyze/__tests__/IntegerConversionAnalyzer.test.ts` against real source
  // rather than a text API.
});
