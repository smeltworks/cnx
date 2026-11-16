import { describe, it, expect } from "vitest";
import generateCriticalStatement from "../CriticalGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import TestGeneratorState from "../../__tests__/testGeneratorState";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * #1445: the generator takes `{ blockCode, line }`, so there is no node to
 * fake. `createMockBlockContext` / `createMockCriticalContext` and the
 * `as unknown as Parser.CriticalStatementContext` cast went with them -- the
 * block's code is passed in directly instead of being fetched back out of the
 * orchestrator.
 */
function critical(blockCode: string) {
  return { blockCode };
}

/** CriticalGenerator does not use input (_input parameter). */
function createMockInput(): IGeneratorInput {
  return {
    symbols: null,
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    knownScopes: new Set<string>(),
    constValues: new Map(),
    callbackTypes: new Map(),
    program: null,
  } as unknown as IGeneratorInput;
}

/** CriticalGenerator does not use state (_state parameter). */
function createMockState(): IGeneratorState {
  return TestGeneratorState.create({ inFunctionBody: true });
}

/** CriticalGenerator no longer uses the orchestrator at all. */
function createMockOrchestrator(): IOrchestrator {
  return {} as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("CriticalGenerator", () => {
  const input = createMockInput();
  const state = createMockState();
  const orchestrator = createMockOrchestrator();

  describe("basic critical section generation", () => {
    it("generates PRIMASK save/restore wrapper with block contents", () => {
      const result = generateCriticalStatement(
        critical("{\n    counter <- counter + 1;\n}"),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("uint32_t __primask = __cnx_get_PRIMASK()");
      expect(result.code).toContain("__cnx_disable_irq()");
      expect(result.code).toContain("counter <- counter + 1;");
      expect(result.code).toContain("__cnx_set_PRIMASK(__primask)");
    });

    it("strips outer braces from block code", () => {
      const result = generateCriticalStatement(
        critical("{\n    x = 1;\n    y = 2;\n}"),
        input,
        state,
        orchestrator,
      );

      // Should not have double braces
      expect(result.code).not.toContain("{\n{");
      expect(result.code).not.toContain("}\n}");
      // Should have the inner content
      expect(result.code).toContain("x = 1;");
      expect(result.code).toContain("y = 2;");
    });

    it("generates correct wrapper structure", () => {
      const result = generateCriticalStatement(
        critical("{\n    operation();\n}"),
        input,
        state,
        orchestrator,
      );

      // Check the exact structure: opening brace, PRIMASK save, disable, content, restore, closing brace
      const lines = result.code.split("\n");
      expect(lines[0]).toBe("{");
      expect(lines[1]).toContain("__primask = __cnx_get_PRIMASK()");
      expect(lines[2]).toContain("__cnx_disable_irq()");
      expect(lines[3]).toContain("operation()");
      expect(lines[4]).toContain("__cnx_set_PRIMASK(__primask)");
      expect(lines[5]).toBe("}");
    });
  });

  // #1322: `CriticalGenerator` no longer validates. E0853 is authored in pass
  // 2.1, so by the time this generator runs the program is already known legal
  // -- and the check reaches every statement the grammar can nest, including
  // `switch`, which the recursion it replaced did not descend into.
  // Covered by `1-Analyze/__tests__/CriticalSectionAnalyzer.test.ts`.

  // #1445: the "calls generateBlock with the block context" test is gone with
  // the delegation it asserted -- the CALLER renders the block now. That path
  // is covered end-to-end by the 14 `.expected.*` files asserting
  // `__cnx_get_PRIMASK`, so no assertion was dropped without a home.

  describe("effects", () => {
    it("asks for no include: 2.2 required the IRQ wrappers (#1991)", () => {
      const result = generateCriticalStatement(
        critical("{\n    x <- 1;\n}"),
        input,
        state,
        orchestrator,
      );

      expect(result.effects).toEqual([]);
    });

    it("uses __cnx_ prefixed functions (avoids macro collisions)", () => {
      const result = generateCriticalStatement(
        critical("{\n    x <- 1;\n}"),
        input,
        state,
        orchestrator,
      );

      // ADR-050: Use __cnx_ prefixed wrappers to avoid collision with platform headers
      expect(result.code).toContain("__cnx_get_PRIMASK");
      expect(result.code).toContain("__cnx_disable_irq");
      expect(result.code).toContain("__cnx_set_PRIMASK");
      // Should NOT use bare CMSIS names
      expect(result.code).not.toMatch(/[^_]get_PRIMASK/);
      expect(result.code).not.toMatch(/[^_]disable_irq/);
      expect(result.code).not.toMatch(/[^_]set_PRIMASK/);
    });
  });

  describe("block content handling", () => {
    it("handles empty block", () => {
      const result = generateCriticalStatement(
        critical("{\n}"),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("__cnx_get_PRIMASK");
      expect(result.code).toContain("__cnx_set_PRIMASK");
    });

    it("handles block with multiple statements", () => {
      const result = generateCriticalStatement(
        critical("{\n    a = 1;\n    b = 2;\n    c = 3;\n}"),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("a = 1;");
      expect(result.code).toContain("b = 2;");
      expect(result.code).toContain("c = 3;");
    });

    it("preserves indentation of inner block content", () => {
      const result = generateCriticalStatement(
        critical("{\n    if (x) {\n        y = 1;\n    }\n}"),
        input,
        state,
        orchestrator,
      );

      // The inner content should be preserved with its structure
      expect(result.code).toContain("if (x)");
      expect(result.code).toContain("y = 1;");
    });
  });
});
