import { describe, it, expect } from "vitest";
import generateEnum from "../EnumGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import createMockSymbols from "../../../../../../types/__testUtils__/codeGenSymbolsHelpers";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create minimal mock input with enum members.
 */
function createMockInput(
  enumName: string,
  members: Map<string, number>,
): IGeneratorInput {
  return {
    symbols: createMockSymbols({
      enumMembers: new Map([[enumName, members]]),
      // what 3-Declare names each member (ADR-017)
      memberCNames: new Map([
        [
          enumName,
          new Map([...members.keys()].map((m) => [m, `${enumName}__${m}`])),
        ],
      ]),
      knownEnums: new Set([enumName]),
    }),
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    program: null,
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 */
function createMockState(currentScopePath = ""): IGeneratorState {
  return TestGeneratorState.create({ currentScopePath });
}

/**
 * Create minimal mock orchestrator.
 * EnumGenerator doesn't use any orchestrator methods.
 */
function createMockOrchestrator(): IOrchestrator {
  return {} as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("EnumGenerator", () => {
  describe("basic enum generation", () => {
    it("generates typedef enum with sequential values", () => {
      const members = new Map([
        ["IDLE", 0],
        ["RUNNING", 1],
        ["ERROR", 2],
      ]);
      const input = createMockInput("State", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum("State", input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    State__IDLE = 0,
    State__RUNNING = 1,
    State__ERROR = 2
} State;
`,
      );
      expect(result.effects).toEqual([]);
    });

    it("generates typedef enum with explicit values", () => {
      const members = new Map([
        ["OK", 0],
        ["WARNING", 100],
        ["CRITICAL", 255],
      ]);
      const input = createMockInput("Severity", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum("Severity", input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    Severity__OK = 0,
    Severity__WARNING = 100,
    Severity__CRITICAL = 255
} Severity;
`,
      );
    });

    it("generates single-member enum", () => {
      const members = new Map([["ONLY", 42]]);
      const input = createMockInput("Single", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum("Single", input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    Single__ONLY = 42
} Single;
`,
      );
    });
  });

  describe("scoped enum generation (ADR-016)", () => {
    it("renders a scope's enum by the C name 3-Declare gave it", () => {
      const members = new Map([
        ["LOW", 0],
        ["HIGH", 1],
      ]);
      // Note: The enum name in symbols already includes scope prefix
      const input = createMockInput("Motor__Level", members);
      const state = createMockState("Motor");
      const orchestrator = createMockOrchestrator();

      const result = generateEnum("Motor__Level", input, state, orchestrator);

      expect(result.code).toBe(
        `typedef enum {
    Motor__Level__LOW = 0,
    Motor__Level__HIGH = 1
} Motor__Level;
`,
      );
    });
  });

  describe("error handling", () => {
    it("throws error when enum not found in registry", () => {
      const input = createMockInput("DifferentEnum", new Map());
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      expect(() => generateEnum("Unknown", input, state, orchestrator)).toThrow(
        "was collected by the resolver, so its qualified name is in enumMembers",
      );
    });
  });

  describe("effects", () => {
    it("returns empty effects array", () => {
      const members = new Map([["A", 0]]);
      const input = createMockInput("Test", members);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateEnum("Test", input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });
});
