/**
 * Unit tests for the ADR-025 switch generator.
 *
 * #1445 box 3: the generator takes `IPlannedSwitch`, so these build plans
 * rather than six-accessor mock contexts cast `as unknown as`.
 *
 * Three describes folded into one. `generateCaseLabel`, `generateSwitchCase`
 * and `generateDefaultCase` were exported only so a test could reach them with
 * a context; label rendering is an internal pure function of the plan now, and
 * every assertion they made is made here through the one entry point -- which
 * is a stronger test, because it also pins where the label lands.
 */
import { describe, it, expect, vi } from "vitest";
import generateSwitch from "../SwitchGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import type IPlannedSwitch from "../../../types/IPlannedSwitch";
import type IPlannedSwitchCase from "../../../types/IPlannedSwitchCase";
import type TPlannedCaseLabel from "../../../types/TPlannedCaseLabel";
import createMockSymbols from "../../../../../../types/__testUtils__/codeGenSymbolsHelpers";

// ========================================================================
// Test Helpers
// ========================================================================

/** A case with the given labels and body statements. */
function switchCase(
  labels: TPlannedCaseLabel[],
  statements: string[] = [],
): IPlannedSwitchCase {
  return { labels, renderBody: () => statements };
}

/** A planned switch, with a single case unless more are given. */
function planned(
  overrides: Partial<IPlannedSwitch> & { cases?: IPlannedSwitchCase[] } = {},
): IPlannedSwitch {
  return {
    subject: "state",
    subjectEnumType: undefined,
    cases: [],
    renderDefaultBody: null,
    ...overrides,
  };
}

/** Create minimal mock input. */
function createMockInput(options?: {
  enumMembers?: Map<string, Map<string, number>>;
}): IGeneratorInput {
  const enumMembers = options?.enumMembers ?? new Map();
  return {
    symbols: createMockSymbols({
      enumMembers,
      // what 3-Declare names each member (ADR-017)
      memberCNames: new Map(
        [...enumMembers].map(([enumName, members]) => [
          enumName,
          new Map([...members.keys()].map((m) => [m, `${enumName}__${m}`])),
        ]),
      ),
      knownEnums: new Set(enumMembers.keys()),
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

function createMockState(): IGeneratorState {
  return TestGeneratorState.create({ inFunctionBody: true });
}

/**
 * The generator reaches the orchestrator for one thing now: `indent`. The
 * subject and the enum type arrive on the plan, and the statements arrive
 * from the case's own thunk.
 */
function createMockOrchestrator(): IOrchestrator {
  return {
    indent: vi.fn((text: string) => `    ${text}`),
  } as unknown as IOrchestrator;
}

/** Run the generator on a plan. */
function generate(switchPlan: IPlannedSwitch, input = createMockInput()) {
  return generateSwitch(
    switchPlan,
    input,
    createMockState(),
    createMockOrchestrator(),
  );
}

/** The rendered text of a switch whose single case carries one label. */
function labelOf(label: TPlannedCaseLabel, input = createMockInput()): string {
  const result = generate(planned({ cases: [switchCase([label])] }), input);
  const line = result.code
    .split("\n")
    .find((candidate) => candidate.includes("case "));
  return (
    line
      ?.trim()
      .replace(/^case /, "")
      .replace(/: \{$/, "") ?? ""
  );
}

// ========================================================================
// Tests
// ========================================================================

describe("SwitchGenerator", () => {
  describe("case labels", () => {
    it.each<[string, TPlannedCaseLabel, string]>([
      [
        "a qualified label, as the C name it names",
        { kind: "qualified", cName: "State__IDLE" },
        "State__IDLE",
      ],
      [
        "a scope's enum member, as the C name it names",
        { kind: "qualified", cName: "Motor__State__RUNNING" },
        "Motor__State__RUNNING",
      ],
      [
        "a plain identifier (a const)",
        { kind: "identifier", name: "MAX_VALUE", resolved: null },
        "MAX_VALUE",
      ],
      [
        "a rooted const, as the planner wrote it",
        { kind: "rooted", code: "3U" },
        "3U",
      ],
      [
        "a positive integer",
        { kind: "numeric", text: "42", negative: false },
        "42",
      ],
      [
        "a negative integer",
        { kind: "numeric", text: "5", negative: true },
        "-5",
      ],
      ["zero", { kind: "numeric", text: "0", negative: false }, "0"],
      [
        "a hex literal",
        { kind: "numeric", text: "0xFF", negative: false },
        "0xFF",
      ],
      [
        "a negative hex literal",
        { kind: "numeric", text: "0x10", negative: true },
        "-0x10",
      ],
      [
        "a binary literal, as hex",
        { kind: "binary", text: "0b1010", negative: false },
        "0xA",
      ],
      [
        "a negative binary literal, as negative hex",
        { kind: "binary", text: "0b1111", negative: true },
        "-0xF",
      ],
      ["a char literal", { kind: "char", text: "'A'" }, "'A'"],
      [
        "an escape-sequence char literal",
        { kind: "char", text: "'\\n'" },
        "'\\n'",
      ],
      // The grammar admits nothing else today; the fall-through is preserved.
      ["an unrecognized label, as empty", { kind: "none" }, ""],
    ])("renders %s", (_label, planned_, expected) => {
      expect(labelOf(planned_)).toBe(expected);
    });

    it("adds a ULL suffix above the 32-bit range (Issue #114)", () => {
      // 2^32, which exceeds 0xFFFFFFFF
      const rendered = labelOf({
        kind: "binary",
        text: "0b100000000000000000000000000000000",
        negative: false,
      });

      expect(rendered).toContain("ULL");
      expect(rendered).toBe("0x100000000ULL");
    });

    it("does not add ULL within the 32-bit range", () => {
      const rendered = labelOf({
        kind: "binary",
        text: "0b11111111111111111111111111111111",
        negative: false,
      });

      expect(rendered).not.toContain("ULL");
      expect(rendered).toBe("0xFFFFFFFF");
    });

    it("resolves an unqualified enum member with its type prefix (Issue #471)", () => {
      const input = createMockInput({
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["IDLE", 0],
              ["RUNNING", 1],
            ]),
          ],
        ]),
      });

      const result = generate(
        planned({
          subjectEnumType: "State",
          cases: [
            switchCase([{ kind: "identifier", name: "IDLE", resolved: null }]),
          ],
        }),
        input,
      );

      expect(result.code).toContain("case State__IDLE: {");
    });

    it("leaves an identifier the enum does not declare alone", () => {
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });

      const result = generate(
        planned({
          subjectEnumType: "State",
          cases: [
            switchCase([
              { kind: "identifier", name: "MAX_VALUE", resolved: null },
            ]),
          ],
        }),
        input,
      );

      expect(result.code).toContain("case MAX_VALUE: {");
    });
  });

  describe("cases", () => {
    it("generates a single case with a block", () => {
      const result = generate(
        planned({
          cases: [
            switchCase(
              [{ kind: "numeric", text: "1", negative: false }],
              ["x = 1;"],
            ),
          ],
        }),
      );

      expect(result.code).toContain("case 1: {");
      expect(result.code).toContain("x = 1;");
      expect(result.code).toContain("break;");
      expect(result.code).toContain("}");
    });

    it("expands || into fall-through labels, the last opening the block", () => {
      const result = generate(
        planned({
          cases: [
            switchCase(
              [
                { kind: "numeric", text: "1", negative: false },
                { kind: "numeric", text: "2", negative: false },
                { kind: "numeric", text: "3", negative: false },
              ],
              ["handle();"],
            ),
          ],
        }),
      );

      // The first two fall through -- no block.
      expect(result.code).toContain("case 1:\n");
      expect(result.code).toContain("case 2:\n");
      // The last one carries the block.
      expect(result.code).toContain("case 3: {");
      expect(result.code).toContain("handle();");
      expect(result.code).toContain("break;");
    });

    it("handles an empty block", () => {
      const result = generate(
        planned({
          cases: [
            switchCase([{ kind: "numeric", text: "0", negative: false }]),
          ],
        }),
      );

      expect(result.code).toContain("case 0: {");
      expect(result.code).toContain("break;");
      expect(result.code).toContain("}");
    });

    it("generates multiple statements in a block, in order", () => {
      const result = generate(
        planned({
          cases: [
            switchCase(
              [{ kind: "numeric", text: "5", negative: false }],
              ["a = 1;", "b = 2;", "c = 3;"],
            ),
          ],
        }),
      );

      expect(result.code).toContain("a = 1;");
      expect(result.code).toContain("b = 2;");
      expect(result.code).toContain("c = 3;");
      expect(result.code.indexOf("a = 1;")).toBeLessThan(
        result.code.indexOf("b = 2;"),
      );
    });

    /** A statement that renders to nothing contributes no line. */
    it("drops a statement that renders empty", () => {
      const result = generate(
        planned({
          cases: [
            switchCase(
              [{ kind: "numeric", text: "1", negative: false }],
              ["a = 1;", "", "b = 2;"],
            ),
          ],
        }),
      );

      const lines = result.code.split("\n");
      const opened = lines.indexOf("    case 1: {");
      const broke = lines.indexOf("        break;");

      // Exactly the two non-empty statements sit between the label and the
      // break -- the empty one contributes no line at all, not a blank one.
      expect(lines.slice(opened + 1, broke)).toEqual([
        "        a = 1;",
        "        b = 2;",
      ]);
    });
  });

  describe("default (Issue #855, MISRA C:2012 Rule 16.4)", () => {
    it("renders the source's default when it declares one", () => {
      const result = generate(
        planned({
          cases: [
            switchCase([{ kind: "numeric", text: "1", negative: false }]),
          ],
          renderDefaultBody: () => ["error();"],
        }),
      );

      expect(result.code).toContain("default: {");
      expect(result.code).toContain("error();");
      expect(result.code).toContain("break;");
    });

    it("emits an empty default when the source declares none", () => {
      const result = generate(
        planned({
          cases: [
            switchCase([{ kind: "numeric", text: "1", negative: false }]),
          ],
        }),
      );

      expect(result.code).toContain("default: {");
      expect(result.code).toContain("break;");
    });
  });

  describe("the statement as a whole", () => {
    it("opens on the subject and closes", () => {
      const result = generate(
        planned({
          subject: "value",
          cases: [
            switchCase([{ kind: "numeric", text: "1", negative: false }]),
          ],
        }),
      );

      expect(result.code).toContain("switch (value) {");
      expect(result.code).toContain("case 1: {");
      expect(result.code.endsWith("}")).toBe(true);
    });

    it("renders every case, in order", () => {
      const result = generate(
        planned({
          cases: [
            switchCase([{ kind: "numeric", text: "0", negative: false }]),
            switchCase([{ kind: "numeric", text: "1", negative: false }]),
          ],
        }),
      );

      expect(result.code).toContain("case 0: {");
      expect(result.code).toContain("case 1: {");
      expect(result.code.indexOf("case 0:")).toBeLessThan(
        result.code.indexOf("case 1:"),
      );
    });

    it("returns empty effects", () => {
      expect(generate(planned()).effects).toEqual([]);
    });
  });
});
