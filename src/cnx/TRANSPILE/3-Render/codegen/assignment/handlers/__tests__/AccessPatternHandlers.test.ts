/**
 * Unit tests for AccessPatternHandlers.
 * Tests global/this access and member chain handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import accessPatternHandlers from "../AccessPatternHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import type TPlannedTargetOp from "../../../../../../types/TPlannedTargetOp";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";
import enterScope from "../../../../../__tests__/enterScope";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["Counter", "value"];
  const resolvedTarget =
    overrides.resolvedTarget ?? `${identifiers.join("__")}`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  return {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([]),
    isCompound: false,
    cnxOp: "<-",
    cOp: "=",
    generatedValue: "5",
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
    hasGlobal: true,
    hasMemberAccess: true,
    hasArrayAccess: false,
    postfixOpsCount: 1,
    memberAccessDepth: 1,
    subscriptDepth: 0,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    resolvedTarget,
    resolvedBaseIdentifier,
    // #1452 box 4: a handler reaches 2.3's per-file state through the context
    // it is handed, so the mock context carries the same instance the test
    // set its facts up on.
    state,
    ...overrides,
  } as IAssignmentContext;
}

let state = new TranspileState();

describe("AccessPatternHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected access pattern kinds", () => {
      const kinds = accessPatternHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.GLOBAL_MEMBER);
      expect(kinds).toContain(AssignmentKind.GLOBAL_ARRAY);
      expect(kinds).toContain(AssignmentKind.THIS_MEMBER);
      expect(kinds).toContain(AssignmentKind.MEMBER_CHAIN);
    });

    it("exports exactly 4 handlers", () => {
      expect(accessPatternHandlers).toHaveLength(4);
    });

    it("uses same handler for GLOBAL_MEMBER and GLOBAL_ARRAY", () => {
      const globalMemberHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_MEMBER,
      )?.[1];
      const globalArrayHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_ARRAY,
      )?.[1];

      expect(globalMemberHandler).toBe(globalArrayHandler);
    });

    it("registers a handler for THIS_MEMBER", () => {
      // Issue #1115: THIS_ARRAY retired, so THIS_MEMBER is the only `this.`
      // kind this module serves. Subscripted `this.` targets classify as the
      // general array/bit kinds handled elsewhere.
      const thisMemberHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

      expect(thisMemberHandler).toBeDefined();
    });
  });

  describe("handleGlobalAccess (GLOBAL_ARRAY)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_ARRAY,
      )?.[1];

    it("generates standard assignment for global member", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Counter__value"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("Counter__value = 5;");
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Counter__value"),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnxOp: "+<-",
        cOp: "+=",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Counter__value += 5;");
    });
  });

  describe("handleGlobalAccess (GLOBAL_ARRAY)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_MEMBER,
      )?.[1];

    it("generates array element assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Buffer_data[i]"),
      });
      const ctx = createMockContext({
        identifiers: ["Buffer", "data"],
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "i" } as never]),
        hasArrayAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Buffer_data[i] = 5;");
    });
  });

  describe("handleThisAccess (THIS_MEMBER)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

    it("generates scoped member assignment", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor__speed"),
      });
      const ctx = createMockContext({
        identifiers: ["speed"],
        hasThis: true,
        hasGlobal: false,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor__speed = 5;");
    });

    // #1322a: the `'this' outside a scope` guard this asserted is deleted. It
    // was unreachable -- `this.x <- 5` at file scope is a PARSE error, so the
    // assignment never reaches codegen -- and this test reached it only by
    // calling the handler directly with state production cannot produce. A test
    // that is a dead branch's only caller is what keeps the branch alive.

    it("handles compound assignment", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_count"),
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        hasThis: true,
        hasGlobal: false,
        isCompound: true,
        cnxOp: "-<-",
        cOp: "-=",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor_count -= 5;");
    });
  });

  describe("handleThisAccess (THIS_MEMBER)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

    it("generates scoped array element assignment", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_items[0]"),
      });
      const ctx = createMockContext({
        identifiers: ["items"],
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "0" } as never]),
        hasThis: true,
        hasGlobal: false,
        hasArrayAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor_items[0] = 5;");
    });
  });

  describe("handleMemberChain (MEMBER_CHAIN)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.MEMBER_CHAIN,
      )?.[1];

    it("generates standard member chain assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi
          .fn()
          .mockReturnValue("device.config.value"),
        analyzeMemberChainForBitAccess: vi
          .fn()
          .mockReturnValue({ isBitAccess: false }),
      });
      const ctx = createMockContext({
        identifiers: ["device", "config", "value"],
        memberAccessDepth: 2,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("device.config.value = 5;");
    });

    /**
     * #1668 review: a member chain's bit write is `writeBits`, the one every
     * bit handler uses -- the target without its final subscript, and the
     * typer's type for the value it indexes. Given here as the chain's ops.
     */
    const bitWriteContext = (
      root: string,
      ops: readonly TPlannedTargetOp[],
      baseType: string,
      generatedValue: string,
    ): IAssignmentContext => {
      HandlerTestUtils.setupMockGenerator(state, {
        analyzeMemberChainForBitAccess: vi
          .fn()
          .mockReturnValue({ isBitAccess: true }),
      });
      const ctx = createMockContext({
        identifiers: [root],
        resolvedBaseIdentifier: root,
        postfixOps: ops,
        generatedValue,
      });
      const bits = HandlerTestUtils.bitWriteOf(ctx, 1, {
        baseType,
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      return {
        ...ctx,
        renderBitTarget: bits.renderBitTarget,
        target: {
          root: null,
          rootTypeInfo: undefined,
          typeInfo: undefined,
          last: bits.last,
        },
      };
    };
    const index = (text: string): TPlannedTargetOp => ({
      kind: "subscript",
      renderIndexes: () => [text],
      foldWidth: () => undefined,
    });

    it("generates bit access when detected in member chain", () => {
      const ctx = bitWriteContext(
        "grid",
        [index("2"), index("3"), { kind: "member", name: "flags" }, index("0")],
        "u32",
        "true",
      );

      const result = getHandler()!(ctx);

      expect(result).toBe(
        "grid[2][3].flags = (grid[2][3].flags & ~((uint32_t)1U << 0)) | ((uint32_t)1U << 0);",
      );
    });

    it("shifts a 64-bit member's bit in 64 bits", () => {
      const ctx = bitWriteContext(
        "data",
        [{ kind: "member", name: "flags" }, index("bit")],
        "u64",
        "false",
      );

      const result = getHandler()!(ctx);

      expect(result).toContain("~((uint64_t)1U << bit)");
    });

    // #1322: compound assignment on a bit index, bit range, slice, bitmap field
    // or string is E0857 in pass 2.1 -- one decision where `output/` had six
    // throws with four messages, and `validateNotCompound` defined twice verbatim.
    // The pipeline halts before these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.

    it("handles compound assignment for normal member chain", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("obj.field"),
        analyzeMemberChainForBitAccess: vi
          .fn()
          .mockReturnValue({ isBitAccess: false }),
      });
      const ctx = createMockContext({
        identifiers: ["obj", "field"],
        isCompound: true,
        cnxOp: "*<-",
        cOp: "*=",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("obj.field *= 5;");
    });
  });
});
