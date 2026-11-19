/**
 * Unit tests for RegisterHandlers.
 * Tests register bit assignment handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import registerHandlers from "../RegisterHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";
import enterScope from "../../../../../__tests__/enterScope";

/**
 * The typer's step for a register member's bit: the member it names and its
 * register (#2185)
 */
function registerTarget(
  member: string,
  register: string,
): IAssignmentContext["target"] {
  return {
    last: {
      before: null,
      subscript: null,
      after: null,
      property: null,
      callee: null,
      beforeNamesType: false,
      beforeIsBitField: false,
      fieldBits: null,
      beforeRegisterMember: member,
      beforeRegister: register,
      registerMember: null,
      member: null,
    },
  } as IAssignmentContext["target"];
}

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["GPIO7", "DR_SET"];
  const resolvedTarget =
    overrides.resolvedTarget ?? `${identifiers.join("__")}[LED_BIT]`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  return {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([{ mockValue: "LED_BIT" } as never]),
    renderExpression: (expr) => expr.written,
    isCompound: false,
    cnxOp: "<-",
    cOp: "=",
    generatedValue: "true",
    // #1445: renders, not nodes -- each delegates to the mocked generator the
    // cases already configure, so a case that overrides
    // `generateAssignmentTarget` or `analyzeMemberChainForBitAccess` still
    // controls what this returns.
    renderTarget: () =>
      HandlerTestUtils.planner().generateAssignmentTarget(null as never),
    analyzeTargetForBitAccess: () =>
      HandlerTestUtils.planner().analyzeMemberChainForBitAccess(null as never),
    targetLine: 1,
    hasValue: true,
    floatBits: null,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    valueHasFloatingOperand: () => false,
    bitmapField: null,
    atomic: null,
    foldValue: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    postfixOps: [],
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: true,
    hasArrayAccess: true,
    postfixOpsCount: 2,
    memberAccessDepth: 1,
    subscriptDepth: 1,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    resolvedTarget,
    resolvedBaseIdentifier,
    // #1452 box 4: a handler reaches 2.3's per-file state through the context
    // it is handed, so the mock context carries the same instance the test
    // set its facts up on.
    state,
    // The typer names the register as the chain's names before the member
    target: registerTarget(
      identifiers.join("__"),
      identifiers.slice(0, -1).join("__"),
    ),
    ...overrides,
  } as IAssignmentContext;
}

let state = new TranspileState();

describe("RegisterHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected register assignment kinds", () => {
      const kinds = registerHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.REGISTER_BIT);
      expect(kinds).toContain(AssignmentKind.REGISTER_BIT_RANGE);
    });

    it("exports exactly 2 handlers", () => {
      expect(registerHandlers).toHaveLength(2);
    });
  });

  describe("handleRegisterBit (REGISTER_BIT)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_BIT,
      )?.[1];

    it("generates read-modify-write for read-write register", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toContain("GPIO7__DR_SET");
      expect(result).toContain("& ~(1U <<");
      expect(result).toContain("LED_BIT");
    });

    it("generates simple write for write-only register", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "wo"]]),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("GPIO7__DR_SET = (1U << LED_BIT);");
    });

    it("throws on write-only register with false value", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "wo"]]),
      });
      const ctx = createMockContext({
        generatedValue: "false",
        foldValue: () => 0,
      });

      expect(() => getHandler()!(ctx)).toThrow("E0872 rejects");
    });

    it("throws on write-only register with 0 value", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "w1s"]]),
      });
      const ctx = createMockContext({
        generatedValue: "0",
        foldValue: () => 0,
      });

      expect(() => getHandler()!(ctx)).toThrow("E0872 rejects");
    });

    // #1322: compound assignment on a bit index, bit range, slice, bitmap field
    // or string is E0857 in pass 2.1 -- one decision where `output/` had six
    // throws with four messages, and `validateNotCompound` defined twice verbatim.
    // The pipeline halts before these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.

    it("handles scoped register prefix correctly", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("5"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        knownScopes: new Set(["Motor"]),
      });
      const ctx = createMockContext({
        identifiers: ["Motor", "GPIO7", "DR_SET"],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor__GPIO7__DR_SET");
    });
  });

  describe("handleRegisterBitRange (REGISTER_BIT_RANGE)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_BIT_RANGE,
      )?.[1];

    it("generates read-modify-write for bit range", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "8" } as never,
        ]),
        generatedValue: "value",
        // 2.2 planned this write as one uint8_t access
        plannedRegisterAccess: "uint8_t",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("GPIO7__DR_SET");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
    });

    it("generates simple write for write-only bit range", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "wo"]]),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "8" } as never,
        ]),
        generatedValue: "value",
        // 2.2 planned this write as one uint8_t access
        plannedRegisterAccess: "uint8_t",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("GPIO7__DR_SET =");
      expect(result).toContain("value");
      expect(result).not.toContain("& ~");
    });

    it("throws on write-only bit range with 0 value", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "w1c"]]),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "8" } as never,
        ]),
        generatedValue: "0",
        foldValue: () => 0,
      });

      expect(() => getHandler()!(ctx)).toThrow("E0872 rejects");
    });

    it("generates MMIO optimization for byte-aligned access", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
        // The value is not a constant; each subscript folds to its mock
        tryEvaluateConstant: vi.fn((node: { mockValue: string } | null) =>
          node === null ? undefined : Number(node.mockValue),
        ),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "wo"]]),
        registerBaseAddresses: new Map([["GPIO7", 0x40000000n]]),
        registerMemberOffsets: new Map([["GPIO7__DR_SET", 0x04n]]),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "8" } as never,
        ]),
        generatedValue: "value",
        // 2.2 planned this write as one uint8_t access
        plannedRegisterAccess: "uint8_t",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("volatile uint8_t*");
      expect(result).toContain("0x40000000");
      expect(result).toContain("0x04");
    });

    it("generates MMIO with byte offset for non-zero start", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("8")
          .mockReturnValueOnce("16"),
        // The value is not a constant; each subscript folds to its mock
        tryEvaluateConstant: vi.fn((node: { mockValue: string } | null) =>
          node === null ? undefined : Number(node.mockValue),
        ),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["GPIO7__DR_SET", "wo"]]),
        registerBaseAddresses: new Map([["GPIO7", 0x40000000n]]),
        registerMemberOffsets: new Map([["GPIO7__DR_SET", 0x04n]]),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "8" } as never,
          { mockValue: "16" } as never,
        ]),
        generatedValue: "value",
        // 2.2 planned this write as one uint16_t access
        plannedRegisterAccess: "uint16_t",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("volatile uint16_t*");
      expect(result).toContain("0x04 + 1");
    });
  });

  describe("handleRegisterBit on a scope's own register (this.GPIO7)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_BIT,
      )?.[1];

    it("generates read-modify-write for scoped register bit", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        target: registerTarget("Motor__GPIO7__DR_SET", "Motor__GPIO7"),
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor__GPIO7__DR_SET");
      expect(result).toContain("& ~(1U <<");
    });

    it("generates simple write for write-only scoped register", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["Motor__GPIO7__DR_SET", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        target: registerTarget("Motor__GPIO7__DR_SET", "Motor__GPIO7"),
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor__GPIO7__DR_SET = (1U << LED_BIT);");
    });

    // #1322a: the `'this' outside a scope` guard this asserted is deleted. It
    // was unreachable -- `this.x <- 5` at file scope is a PARSE error, so the
    // assignment never reaches codegen -- and this test reached it only by
    // calling the handler directly with state production cannot produce. A test
    // that is a dead branch's only caller is what keeps the branch alive.

    it("throws on write-only register with false value", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["Motor__GPIO7__DR_SET", "w1s"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        target: registerTarget("Motor__GPIO7__DR_SET", "Motor__GPIO7"),
        hasThis: true,
        generatedValue: "false",
        foldValue: () => 0,
      });

      expect(() => getHandler()!(ctx)).toThrow("E0872 rejects");
    });
  });

  describe("handleRegisterBitRange on a scope's own register (this.GPIO7)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_BIT_RANGE,
      )?.[1];

    it("generates read-modify-write for scoped register bit range", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("6")
          .mockReturnValueOnce("2"),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        target: registerTarget("Motor__GPIO7__ICR1", "Motor__GPIO7"),
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "6" } as never,
          { mockValue: "2" } as never,
        ]),
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor__GPIO7__ICR1");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 6");
    });

    it("generates simple write for write-only scoped register bit range", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("6")
          .mockReturnValueOnce("2"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["Motor__GPIO7__ICR1", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        target: registerTarget("Motor__GPIO7__ICR1", "Motor__GPIO7"),
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "6" } as never,
          { mockValue: "2" } as never,
        ]),
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor__GPIO7__ICR1 =");
      expect(result).not.toContain("& ~");
    });

    it("generates MMIO optimization for byte-aligned scoped access", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("32"),
        // The value is not a constant; each subscript folds to its mock
        tryEvaluateConstant: vi.fn((node: { mockValue: string } | null) =>
          node === null ? undefined : Number(node.mockValue),
        ),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["Motor__GPIO7__ICR1", "wo"]]),
        registerBaseAddresses: new Map([["Motor__GPIO7", 0x40000000n]]),
        registerMemberOffsets: new Map([["Motor__GPIO7__ICR1", 0x08n]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        target: registerTarget("Motor__GPIO7__ICR1", "Motor__GPIO7"),
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "32" } as never,
        ]),
        hasThis: true,
        generatedValue: "value",
        // 2.2 planned this write as one uint32_t access
        plannedRegisterAccess: "uint32_t",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("volatile uint32_t*");
      expect(result).toContain("0x40000000");
    });

    // #1322a: the `'this' outside a scope` guard this asserted is deleted. It
    // was unreachable -- `this.x <- 5` at file scope is a PARSE error, so the
    // assignment never reaches codegen -- and this test reached it only by
    // calling the handler directly with state production cannot produce. A test
    // that is a dead branch's only caller is what keeps the branch alive.

    it("throws on write-only bit range with 0 value", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("6")
          .mockReturnValueOnce("2"),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerMemberAccess: new Map([["Motor__GPIO7__ICR1", "w1c"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        target: registerTarget("Motor__GPIO7__ICR1", "Motor__GPIO7"),
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "6" } as never,
          { mockValue: "2" } as never,
        ]),
        hasThis: true,
        generatedValue: "0",
        foldValue: () => 0,
      });

      expect(() => getHandler()!(ctx)).toThrow("E0872 rejects");
    });
  });
});
