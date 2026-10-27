import type IBitmapFieldLayout from "../../../../../../types/IBitmapFieldLayout";
import { describe, it, expect } from "vitest";
import generateBitmap from "../BitmapGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import createMockSymbols from "../../../../../../types/__testUtils__/codeGenSymbolsHelpers";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create minimal mock input with bitmap info.
 */
function createMockInput(
  bitmapName: string,
  backingType: string,
  fields?: Map<string, IBitmapFieldLayout>,
): IGeneratorInput {
  return {
    symbols: createMockSymbols({
      bitmapBackingType: new Map([[bitmapName, backingType]]),
      bitmapFields: fields ? new Map([[bitmapName, fields]]) : new Map(),
      knownBitmaps: new Set([bitmapName]),
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
 * BitmapGenerator doesn't use any orchestrator methods.
 */
function createMockOrchestrator(): IOrchestrator {
  return {} as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("BitmapGenerator", () => {
  describe("basic bitmap generation", () => {
    it("generates typedef for bitmap8", () => {
      const input = createMockInput("Flags", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("Flags", input, state, orchestrator);

      expect(result.code).toContain("/* Bitmap: Flags */");
      expect(result.code).toContain("typedef uint8_t Flags;");
    });

    it("generates typedef for bitmap16", () => {
      const input = createMockInput("StatusWord", "uint16_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("StatusWord", input, state, orchestrator);

      expect(result.code).toContain("typedef uint16_t StatusWord;");
    });

    it("generates typedef for bitmap32", () => {
      const input = createMockInput("Config", "uint32_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("Config", input, state, orchestrator);

      expect(result.code).toContain("typedef uint32_t Config;");
    });
  });

  describe("field documentation", () => {
    it("generates field comments for single-bit fields", () => {
      const fields = new Map<string, IBitmapFieldLayout>([
        ["Running", { offset: 0, width: 1 }],
        ["Direction", { offset: 1, width: 1 }],
      ]);
      const input = createMockInput("MotorFlags", "uint8_t", fields);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("MotorFlags", input, state, orchestrator);

      expect(result.code).toContain("/* Fields:");
      expect(result.code).toContain(" *   Running: bit 0 (1 bit)");
      expect(result.code).toContain(" *   Direction: bit 1 (1 bit)");
      expect(result.code).toContain(" */");
    });

    it("generates field comments for multi-bit fields", () => {
      const fields = new Map<string, IBitmapFieldLayout>([
        ["Mode", { offset: 0, width: 3 }],
        ["Reserved", { offset: 3, width: 5 }],
      ]);
      const input = createMockInput("Control", "uint8_t", fields);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("Control", input, state, orchestrator);

      expect(result.code).toContain(" *   Mode: bits 0-2 (3 bits)");
      expect(result.code).toContain(" *   Reserved: bits 3-7 (5 bits)");
    });

    it("generates bitmap without field comments when no fields defined", () => {
      const input = createMockInput("Empty", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("Empty", input, state, orchestrator);

      expect(result.code).not.toContain("/* Fields:");
      expect(result.code).toContain("/* Bitmap: Empty */");
      expect(result.code).toContain("typedef uint8_t Empty;");
    });
  });

  describe("scoped bitmap generation (ADR-016)", () => {
    it("renders a scope's bitmap by the C name 3-Declare gave it", () => {
      const fields = new Map<string, IBitmapFieldLayout>([
        ["Active", { offset: 0, width: 1 }],
      ]);
      // Note: The bitmap name in symbols already includes scope prefix
      const input = createMockInput("Driver__Status", "uint8_t", fields);
      const state = createMockState("Driver");
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap(
        "Driver__Status",
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("/* Bitmap: Driver__Status */");
      expect(result.code).toContain("typedef uint8_t Driver__Status;");
    });
  });

  describe("effects", () => {
    it("reports no C type: 2.2 planned the backing type's header (#1991)", () => {
      const input = createMockInput("Test", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("Test", input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("throws error when bitmap not found in registry", () => {
      const input = createMockInput("DifferentBitmap", "uint8_t");
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      expect(() =>
        generateBitmap("Unknown", input, state, orchestrator),
      ).toThrow(
        "was collected by the resolver, so its qualified name is in bitmapBackingType",
      );
    });
  });

  describe("complete output format", () => {
    it("generates complete bitmap with all sections", () => {
      const fields = new Map<string, IBitmapFieldLayout>([
        ["Enabled", { offset: 0, width: 1 }],
        ["Priority", { offset: 1, width: 3 }],
        ["Channel", { offset: 4, width: 4 }],
      ]);
      const input = createMockInput("TaskConfig", "uint8_t", fields);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateBitmap("TaskConfig", input, state, orchestrator);

      expect(result.code).toBe(
        `/* Bitmap: TaskConfig */
/* Fields:
 *   Enabled: bit 0 (1 bit)
 *   Priority: bits 1-3 (3 bits)
 *   Channel: bits 4-7 (4 bits)
 */
typedef uint8_t TaskConfig;
`,
      );
    });
  });
});
