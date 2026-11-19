/**
 * Unit tests for BitAccessHandlers.
 * Tests integer bit access assignment handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import bitAccessHandlers from "../BitAccessHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";

/**
 * Create mock context for testing.
 */
function createMockContext(
  // `exprCount`: what the builder lowers the final op to -- 2 for a range
  overrides: Partial<IAssignmentContext> & { readonly exprCount?: 1 | 2 } = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["flags"];
  const resolvedTarget = overrides.resolvedTarget ?? `${identifiers[0]}[3]`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  const ctx = {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([{ mockValue: "3" } as never]),
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
    hasMemberAccess: false,
    hasArrayAccess: true,
    postfixOpsCount: 1,
    memberAccessDepth: 0,
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
    ...overrides,
  } as IAssignmentContext;
  // #1668 (C7): what the target writes, as the binder would bind it
  const target = overrides.target ?? HandlerTestUtils.targetOf(state, ctx);
  // #1668 review: the final op, the target without it and the typer's step
  const bits = HandlerTestUtils.bitWriteOf(
    ctx,
    overrides.exprCount ?? 1,
    target.typeInfo,
  );
  return {
    ...ctx,
    postfixOps: bits.postfixOps,
    renderBitTarget: overrides.renderBitTarget ?? bits.renderBitTarget,
    target: { ...target, last: target.last ?? bits.last },
  };
}

let state = new TranspileState();

describe("BitAccessHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected bit access kinds", () => {
      const kinds = bitAccessHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.INTEGER_BIT);
      expect(kinds).toContain(AssignmentKind.INTEGER_BIT_RANGE);
      expect(kinds).toContain(AssignmentKind.ARRAY_ELEMENT_BIT);
      expect(kinds).toContain(AssignmentKind.ARRAY_ELEMENT_BIT_RANGE);
      expect(kinds).toContain(AssignmentKind.STRUCT_CHAIN_BIT_RANGE);
    });

    it("exports exactly 5 handlers", () => {
      // Issue #1115: THIS_BIT / THIS_BIT_RANGE retired -- `this.` bit access now
      // classifies as INTEGER_BIT / INTEGER_BIT_RANGE, which these handlers serve.
      // #1668 (C12): ARRAY_ELEMENT_BIT_RANGE is the fifth.
      expect(bitAccessHandlers).toHaveLength(5);
    });
  });

  describe("handleIntegerBit (INTEGER_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.INTEGER_BIT,
      )?.[1];

    it("generates single bit read-modify-write", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "u32" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      // #1668: a u32 shifts in 32 bits, since `unsigned int` may be 16
      expect(result).toBe(
        "flags = (flags & ~((uint32_t)1U << 3)) | ((uint32_t)1U << 3);",
      );
    });

    it("shifts in 64 bits for 64-bit types", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "u64" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("32"),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "32" } as never]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("~((uint64_t)1U << 32)");
    });

    it("shifts in unsigned 64 bits for signed 64-bit types", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "i64" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("bit"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toContain("~((uint64_t)1U << bit)");
    });

    it("converts true to 1", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "u8" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        generatedValue: "true",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("| (1U << 0)");
    });

    it("converts false to 0", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "u8" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        generatedValue: "false",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("| (0U << 0)");
    });

    it("delegates to float bit write for float types", () => {
      HandlerTestUtils.declareTypes(state, [["f", { baseType: "f32" }]]);
      const generateFloatBitWrite = vi
        .fn()
        .mockReturnValue("float_bit_write_result");
      HandlerTestUtils.setupMockGenerator(state, {
        generateFloatBitWrite,
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const ctx = createMockContext({
        floatBits: { floatType: "f32", shared: true },
        identifiers: ["f"],
      });

      const result = getHandler()!(ctx);

      expect(generateFloatBitWrite).toHaveBeenCalled();
      expect(result).toBe("float_bit_write_result");
    });

    // #1322: compound assignment on a bit index, bit range, slice, bitmap field
    // or string is E0857 in pass 2.1 -- one decision where `output/` had six
    // throws with four messages, and `validateNotCompound` defined twice verbatim.
    // The pipeline halts before these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.
  });

  describe("handleIntegerBitRange (INTEGER_BIT_RANGE)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.INTEGER_BIT_RANGE,
      )?.[1];

    it("generates bit range read-modify-write", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "u32" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("4"),
      });
      const ctx = createMockContext({
        exprCount: 2,
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "4" } as never,
        ]),
        generatedValue: "5",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
    });

    it("uses correct mask for bit range", () => {
      HandlerTestUtils.declareTypes(state, [["data", { baseType: "u16" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("4")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        exprCount: 2,
        identifiers: ["data"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "4" } as never,
          { mockValue: "8" } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // For constant width, BitUtils generates hex mask
      expect(result).toContain("0xFFU");
      expect(result).toContain("<< 4");
    });

    it("shifts a 64-bit bit range's mask in 64 bits", () => {
      HandlerTestUtils.declareTypes(state, [["flags", { baseType: "u64" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("32")
          .mockReturnValueOnce("16"),
      });
      const ctx = createMockContext({
        exprCount: 2,
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "32" } as never,
          { mockValue: "16" } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe(
        "flags = (flags & ~((uint64_t)0xFFFFU << 32)) | ((value & (uint64_t)0xFFFFU) << 32);",
      );
    });

    it("delegates to float bit write for float types", () => {
      HandlerTestUtils.declareTypes(state, [["f", { baseType: "f32" }]]);
      const generateFloatBitWrite = vi
        .fn()
        .mockReturnValue("float_range_write_result");
      HandlerTestUtils.setupMockGenerator(state, {
        generateFloatBitWrite,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        floatBits: { floatType: "f32", shared: true },
        exprCount: 2,
        identifiers: ["f"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "8" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      // The typer's float type, and a variable: its shadow union
      expect(generateFloatBitWrite).toHaveBeenCalledWith({
        target: "f",
        floatType: "f32",
        bitIndex: "0",
        width: { text: "8", folded: undefined },
        value: "true",
        isVariable: true,
        atomic: null,
      });
      expect(result).toBe("float_range_write_result");
    });
  });

  // #1760 review: the written value's category decides, once, for every kind
  describe("writeBits by the value it writes", () => {
    const handlerOf = (kind: AssignmentKind) =>
      bitAccessHandlers.find(([k]) => k === kind)?.[1];

    it("writes a float element through a union of its own", () => {
      HandlerTestUtils.declareTypes(state, [["fa", { baseType: "f32" }]]);
      const generateFloatBitWrite = vi.fn().mockReturnValue("element_write");
      HandlerTestUtils.setupMockGenerator(state, {
        generateFloatBitWrite,
        // The element's index renders first, with the base, then the bit's
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("1")
          .mockReturnValueOnce("31"),
      });
      const ctx = createMockContext({
        floatBits: { floatType: "f32", shared: false },
        identifiers: ["fa"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "1" } as never,
          { mockValue: "31" } as never,
        ]),
      });

      const result = handlerOf(AssignmentKind.ARRAY_ELEMENT_BIT)!(ctx);

      // Not a variable: the element has no name to key a shadow by
      expect(generateFloatBitWrite).toHaveBeenCalledWith({
        target: "fa[1]",
        floatType: "f32",
        bitIndex: "31",
        width: null,
        value: "true",
        isVariable: false,
        atomic: null,
      });
      expect(result).toBe("element_write");
    });

    it("writes an integer of unfixed width in uintmax_t, cast back to its header type", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const base = createMockContext({ identifiers: ["hf"] });
      const ctx: IAssignmentContext = {
        ...base,
        target: {
          ...base.target,
          last: {
            before: {
              ...HandlerTestUtils.operandOf("i32", true, true),
              typeName: null,
              cType: "int_fast16_t",
              bitWidth: null,
            },
            subscript: "bit_range",
            after: HandlerTestUtils.oneBit(),
            property: null,
            callee: null,
            beforeNamesType: false,
            beforeIsBitField: false,
            fieldBits: null,
            beforeRegisterMember: null,
            beforeRegister: null,
            register: null,
            registerMember: null,
            member: null,
          },
        },
      };

      const result = handlerOf(AssignmentKind.INTEGER_BIT)!(ctx);

      expect(result).toBe(
        "hf = (int_fast16_t)((hf & ~((uintmax_t)1U << 3)) | ((uintmax_t)1U << 3));",
      );
    });
  });

  describe("handleArrayElementBitRange (ARRAY_ELEMENT_BIT_RANGE)", () => {
    // #1668 (C12): the subscripts are flattened -- the element's indices,
    // then the range's start and width
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.ARRAY_ELEMENT_BIT_RANGE,
      )?.[1];

    it.each([
      ["a 1-D array's element", ["i"], "row[i]"],
      ["a 2-D array's element", ["i", "j"], "row[i][j]"],
    ])("writes the range into %s", (_label, indices, element) => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockImplementation((e: { mockValue: string }) => e.mockValue),
      });
      const ctx = createMockContext({
        exprCount: 2,
        identifiers: ["row"],
        generatedValue: "6",
        ...HandlerTestUtils.subscriptsOf(
          [...indices, "0", "4"].map((mockValue) => ({ mockValue }) as never),
        ),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain(`${element} = `);
      expect(result).toContain(`(${element} & ~(`);
      expect(result).toContain("<< 0");
    });
  });

  describe("handleArrayElementBit (ARRAY_ELEMENT_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.ARRAY_ELEMENT_BIT,
      )?.[1];

    it("generates array element bit assignment for 1D array", () => {
      HandlerTestUtils.declareTypes(state, [
        ["arr", { baseType: "u32", arrayDimensions: [10] }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["arr"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "i" } as never,
          { mockValue: "BIT" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("arr[i] =");
      expect(result).toContain("& ~((uint32_t)1U << BIT)");
    });

    it("generates array element bit assignment for 2D array", () => {
      HandlerTestUtils.declareTypes(state, [
        ["matrix", { baseType: "u16", arrayDimensions: [10, 10] }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("j")
          .mockReturnValueOnce("FIELD_BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "i" } as never,
          { mockValue: "j" } as never,
          { mockValue: "FIELD_BIT" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("matrix[i][j] =");
      expect(result).toContain("& ~(1U << FIELD_BIT)");
    });

    it("shifts a 64-bit array element's bit in 64 bits", () => {
      HandlerTestUtils.declareTypes(state, [
        ["arr", { baseType: "u64", arrayDimensions: [5] }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("40"),
      });
      const ctx = createMockContext({
        identifiers: ["arr"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "40" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("~((uint64_t)1U << 40)");
    });

    it("writes the element's bit when no cnx declaration gives the array's dimensions", () => {
      // #1668 review: a C header's array (`extern uint8_t bytes[4]`) has none.
      // The handler asserted the root's cnx dimensions and was an
      // internal error on `bytes[1][3] <- true`.
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("1")
          .mockReturnValueOnce("3"),
      });
      const ctx = createMockContext({
        identifiers: ["bytes"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "1" } as never,
          { mockValue: "3" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("bytes[1] =");
      expect(result).toContain("& ~(1U << 3)");
    });
  });

  describe("handleStructChainBitRange (STRUCT_CHAIN_BIT_RANGE)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.STRUCT_CHAIN_BIT_RANGE,
      )?.[1];

    it("generates bit range write through struct chain", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0") // array index
          .mockReturnValueOnce("0") // bit range start
          .mockReturnValueOnce("4"), // bit range width
      });

      // The planned chain for devices[0].control[0, 4]. #1445: each op states
      // its kind, where the node mock said it by which accessor returned null.
      // The renders still route through the mocked generator above, in the
      // same order, so the `mockReturnValueOnce` chain reads unchanged.
      const mockPostfixOps = [
        {
          kind: "subscript" as const,
          renderIndexes: () => [
            HandlerTestUtils.planner().generateExpression(null as never),
          ],
        },
        { kind: "member" as const, name: "control" },
        {
          kind: "subscript" as const,
          renderIndexes: () => [
            HandlerTestUtils.planner().generateExpression(null as never),
            HandlerTestUtils.planner().generateExpression(null as never),
          ],
          foldWidth: () => undefined,
        },
      ];

      const ctx = createMockContext({
        identifiers: ["devices", "control"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "0" } as never,
          { mockValue: "4" } as never,
        ]),
        postfixOps: mockPostfixOps as never,
        generatedValue: "15",
        hasMemberAccess: true,
        hasArrayAccess: true,
        exprCount: 2,
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("devices[0].control =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
      expect(result).toContain("15");
    });
  });
});
