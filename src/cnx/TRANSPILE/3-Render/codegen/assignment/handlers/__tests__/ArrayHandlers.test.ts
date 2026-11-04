/**
 * Unit tests for ArrayHandlers.
 * Tests array assignment handler functions.
 */

import SliceSource from "../../../../../2-Plan/SliceSource";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Slice codegen reads the source value's type off the context (Issue #1081
// review) — these stand in for it, so slice tests control the source type
// independently of a real parse tree.
const { mockGetExpressionType, mockGetIntegerExpressionType } = vi.hoisted(
  () => ({
    mockGetExpressionType: vi.fn(),
    mockGetIntegerExpressionType: vi.fn(),
  }),
);

import arrayHandlers from "../ArrayHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["arr"];
  const resolvedTarget = overrides.resolvedTarget ?? `${identifiers[0]}[i]`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  const ctx = {
    identifiers,
    // #1445: the context carries renders, not nodes. Each one DELEGATES to the
    // mock the cases below already configure -- `generateExpression`,
    // `tryEvaluateConstant` and the mocked `TypeResolver` -- so a case that
    // says "the second fold returns undefined" still says it, in the same
    // order, without a fake node to hang it on.
    subscriptCount: 1,
    renderSubscript: () =>
      HandlerTestUtils.planner().generateExpression(null as never),
    foldSubscript: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    isCompound: false,
    cnxOp: "<-",
    cOp: "=",
    generatedValue: "value",
    renderTarget: () => resolvedTarget,
    analyzeTargetForBitAccess: () => ({ isBitAccess: false }) as never,
    targetLine: 1,
    // True so slice codegen resolves the source type via the mocked
    // TypeResolver.getExpressionType (Issue #1081 review).
    hasValue: true,
    floatBits: null,
    valueExpressionType: () => mockGetExpressionType(null),
    valueIntegerType: () => mockGetIntegerExpressionType(null),
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
  // #1991: 2.2's slice-source decision, made by the call 2.2 makes, once 2.3
  // has folded the length the way 2.2 did
  const folds: Array<number | undefined> = [];
  return {
    ...ctx,
    target: overrides.target ?? HandlerTestUtils.targetOf(state, ctx),
    foldSubscript: (index) => (folds[index] = ctx.foldSubscript(index)),
    get plannedSliceSource() {
      const length = folds[1];
      return length === undefined
        ? null
        : SliceSource.of(ctx, ctx.identifiers[0], length);
    },
  };
}

let state = new TranspileState();

describe("ArrayHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
    // Default: a source whose direct type is null is also unresolved as a
    // composite. Tests that exercise composite resolution override this.
    mockGetIntegerExpressionType.mockReturnValue(null);
  });

  describe("handler registration", () => {
    it("registers all expected array assignment kinds", () => {
      const kinds = arrayHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.ARRAY_ELEMENT);
      expect(kinds).toContain(AssignmentKind.MULTI_DIM_ARRAY_ELEMENT);
      expect(kinds).toContain(AssignmentKind.ARRAY_SLICE);
    });

    it("exports exactly 3 handlers", () => {
      expect(arrayHandlers).toHaveLength(3);
    });
  });

  describe("handleArrayElement (ARRAY_ELEMENT)", () => {
    const getHandler = () =>
      arrayHandlers.find(
        ([kind]) => kind === AssignmentKind.ARRAY_ELEMENT,
      )?.[1];

    it("generates simple array element assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("i"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("arr[i] = value;");
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnxOp: "+<-",
        cOp: "+=",
        resolvedTarget: "arr[0]",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("arr[0] += value;");
    });

    it("uses correct identifier", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("idx"),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        resolvedTarget: "buffer[idx]",
        resolvedBaseIdentifier: "buffer",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("buffer[idx] = value;");
    });
  });

  describe("handleMultiDimArrayElement (MULTI_DIM_ARRAY_ELEMENT)", () => {
    const getHandler = () =>
      arrayHandlers.find(
        ([kind]) => kind === AssignmentKind.MULTI_DIM_ARRAY_ELEMENT,
      )?.[1];

    it("generates multi-dimensional array access", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("j"),
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "i", start: { line: 1 } } as never,
          { mockValue: "j", start: { line: 1 } } as never,
        ]),
        subscriptDepth: 2,
        resolvedTarget: "matrix[i][j]",
        resolvedBaseIdentifier: "matrix",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("matrix[i][j] = value;");
    });

    it("handles 3D array access", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("x")
          .mockReturnValueOnce("y")
          .mockReturnValueOnce("z"),
      });
      const ctx = createMockContext({
        identifiers: ["cube"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "x", start: { line: 1 } } as never,
          { mockValue: "y", start: { line: 1 } } as never,
          { mockValue: "z", start: { line: 1 } } as never,
        ]),
        subscriptDepth: 3,
        resolvedTarget: "cube[x][y][z]",
        resolvedBaseIdentifier: "cube",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("cube[x][y][z] = value;");
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("1"),
      });
      const ctx = createMockContext({
        identifiers: ["grid"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "1", start: { line: 1 } } as never,
        ]),
        isCompound: true,
        cnxOp: "-<-",
        cOp: "-=",
        resolvedTarget: "grid[0][1]",
        resolvedBaseIdentifier: "grid",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("grid[0][1] -= value;");
    });
  });

  // #1322: the twelve `throws ...` cases below now assert INVARIANTS, not
  // diagnostics. ADR-052's slice rules are E0858-E0861 in pass 2.1, which halts
  // before codegen runs, so a slice reaching this handler has already been
  // checked. The assertion is the safety net for a DIVERGENCE between the two
  // -- 2.1 accepting something this code cannot emit -- and these cases are
  // what prove the net is there. Kept and re-aimed rather than deleted: they were the
  // only coverage of these conditions, and an assertion nothing exercises is
  // the guard-that-cannot-fail shape.
  describe("handleArraySlice (ARRAY_SLICE)", () => {
    const getHandler = () =>
      arrayHandlers.find(([kind]) => kind === AssignmentKind.ARRAY_SLICE)?.[1];

    // Every unrolled slice copy is prefixed with a comment naming the MISRA
    // rule it satisfies and why the codegen looks the way it does (Issue #1081).
    // Mirror production sliceUnrollComment: the rule is cited ONLY when an
    // equivalent memcpy would pass incompatible pointer types.
    const sliceComment = (destCType: string, srcCType: string) =>
      "/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes " +
      `(memcpy would pass incompatible pointer types: ${destCType}* vs ${srcCType}*). */`;

    // Default the source type to a wide unsigned; tests override per case.
    beforeEach(() => mockGetExpressionType.mockReturnValue("u64"));

    // Issue #1081: slice assignment lowers to per-element little-endian writes
    // (no memcpy), keeping MISRA C:2012 Rule 21.15 (compatible memcpy pointers)
    // satisfied because no incompatible pointer punning is emitted.
    it("generates unrolled byte writes for a u8 slice (no memcpy/string.h)", () => {
      mockGetExpressionType.mockReturnValue("u32");
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "source",
      });

      const result = getHandler()!(ctx);

      // The source is materialized into a single unsigned temp so it is read
      // exactly once (Issue #1085 review, Finding 2).
      expect(result).toBe(
        `${sliceComment("uint8_t", "uint32_t")}\n` +
          "const uint32_t cnx_tmp0 = (uint32_t)(source);\n" +
          "buffer[0] = (uint8_t)(cnx_tmp0);\n" +
          "buffer[1] = (uint8_t)(cnx_tmp0 >> 8U);\n" +
          "buffer[2] = (uint8_t)(cnx_tmp0 >> 16U);\n" +
          "buffer[3] = (uint8_t)(cnx_tmp0 >> 24U);",
      );
      // No memcpy, so nothing here needs <string.h>, which 2.2 decides.
    });

    it("writes at element granularity for a u16 slice (offset = element index)", () => {
      mockGetExpressionType.mockReturnValue("u64");
      HandlerTestUtils.declareTypes(state, [
        ["arr16", { arrayDimensions: [16], baseType: "u16", bitWidth: 16 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(8),
      });
      const ctx = createMockContext({
        identifiers: ["arr16"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "8", start: { line: 1 } } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe(
        `${sliceComment("uint16_t", "uint64_t")}\n` +
          "const uint64_t cnx_tmp0 = (uint64_t)(value);\n" +
          "arr16[0] = (uint16_t)(cnx_tmp0);\n" +
          "arr16[1] = (uint16_t)(cnx_tmp0 >> 16U);\n" +
          "arr16[2] = (uint16_t)(cnx_tmp0 >> 32U);\n" +
          "arr16[3] = (uint16_t)(cnx_tmp0 >> 48U);",
      );
    });

    it("omits the rule citation when source and element types match (no 21.15)", () => {
      mockGetExpressionType.mockReturnValue("u32");
      HandlerTestUtils.declareTypes(state, [
        ["arr32", { arrayDimensions: [16], baseType: "u32", bitWidth: 32 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["arr32"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // u32[] <- u32: an equivalent memcpy would be compliant, so no comment.
      expect(result).toBe("arr32[0] = (uint32_t)(value);");
    });

    it("accepts an in-bounds wide-element slice at a non-zero offset (Finding 1)", () => {
      mockGetExpressionType.mockReturnValue("u64");
      HandlerTestUtils.declareTypes(state, [
        ["arr64", { arrayDimensions: [8], baseType: "u64", bitWidth: 64 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(4)
          .mockReturnValueOnce(8),
      });
      const ctx = createMockContext({
        identifiers: ["arr64"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "4", start: { line: 1 } } as never,
          { mockValue: "8", start: { line: 1 } } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // Element span is offset(4) + 1 element = 5 <= capacity 8. The old check
      // compared byte length against element capacity (4 + 8 = 12 > 8) and
      // wrongly rejected this in-bounds slice. Single element → no temp;
      // same-type u64[] <- u64 → no rule citation.
      expect(result).toBe("arr64[4] = (uint64_t)(value);");
    });

    it("names the element span (not bytes) in the out-of-bounds invariant", () => {
      mockGetExpressionType.mockReturnValue("u64");
      HandlerTestUtils.declareTypes(state, [
        ["arr16", { arrayDimensions: [4], baseType: "u16", bitWidth: 16 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(2)
          .mockReturnValueOnce(8),
      });
      const ctx = createMockContext({
        identifiers: ["arr16"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "2", start: { line: 7 } } as never,
          { mockValue: "8", start: { line: 7 } } as never,
        ]),
        generatedValue: "value",
      });

      // offset 2 + (8 bytes / 2) = 6 elements > capacity 4.
      expect(() => getHandler()!(ctx)).toThrow(
        "a slice span fits its buffer -- E0860 rejects offset(2) + 4 against capacity(4)",
      );
    });

    it("casts a signed source to unsigned once in the temp (MISRA 10.1)", () => {
      mockGetExpressionType.mockReturnValue("i32");
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // The signed source is cast to its same-width unsigned type once, in the
      // temp declaration, so every shift on the temp is MISRA Rule 10.1-clean.
      expect(result).toBe(
        `${sliceComment("uint8_t", "int32_t")}\n` +
          "const uint32_t cnx_tmp0 = (uint32_t)(value);\n" +
          "buffer[0] = (uint8_t)(cnx_tmp0);\n" +
          "buffer[1] = (uint8_t)(cnx_tmp0 >> 8U);\n" +
          "buffer[2] = (uint8_t)(cnx_tmp0 >> 16U);\n" +
          "buffer[3] = (uint8_t)(cnx_tmp0 >> 24U);",
      );
    });

    it("uses the signed-element double-cast for a signed destination (MISRA 10.8)", () => {
      mockGetExpressionType.mockReturnValue("i32");
      HandlerTestUtils.declareTypes(state, [
        ["arrI", { arrayDimensions: [16], baseType: "i32", bitWidth: 32 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["arrI"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // i32[] <- i32: same type, so no rule citation; dest cast still applies.
      expect(result).toBe("arrI[0] = (int32_t)(uint32_t)(value);");
    });

    it("sizes the temp to the slice length for an unresolved source type", () => {
      mockGetExpressionType.mockReturnValue(null); // e.g. a computed expression
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "expr",
      });

      const result = getHandler()!(ctx);

      // Unknown source: NO Rule 21.15 citation — we cannot prove the source type
      // is incompatible with the destination element, so asserting "incompatible
      // pointer types" would be false (Issue #1085 review, Finding #1). The temp
      // is still sized to the 4-byte slice length (uint32_t), not the widest
      // type — so the cast does not widen a composite expression like `a + b`
      // (MISRA Rule 10.8), while every shift on the temp stays unsigned (10.1)
      // and in range (Finding 3).
      expect(result).toBe(
        "const uint32_t cnx_tmp0 = (uint32_t)(expr);\n" +
          "buffer[0] = (uint8_t)(cnx_tmp0);\n" +
          "buffer[1] = (uint8_t)(cnx_tmp0 >> 8U);\n" +
          "buffer[2] = (uint8_t)(cnx_tmp0 >> 16U);\n" +
          "buffer[3] = (uint8_t)(cnx_tmp0 >> 24U);",
      );
    });

    it("two-steps a composite signed source so no composite is cast (Rule 10.8)", () => {
      // Direct type unresolved (composite), but resolvable as a signed i32 via
      // Rule 10.4's same-category guarantee. The source must be bound to its
      // own signed type first, then reinterpreted — the unsigned cast lands on
      // the simple temp, never on the `a + b` composite.
      mockGetExpressionType.mockReturnValue(null);
      mockGetIntegerExpressionType.mockReturnValue("i32");
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "a + b",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe(
        "/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes " +
          "(memcpy would pass incompatible pointer types: uint8_t* vs int32_t*). */\n" +
          "const int32_t cnx_tmp0 = a + b;\n" +
          "const uint32_t cnx_tmp1 = (uint32_t)cnx_tmp0;\n" +
          "buffer[0] = (uint8_t)(cnx_tmp1);\n" +
          "buffer[1] = (uint8_t)(cnx_tmp1 >> 8U);\n" +
          "buffer[2] = (uint8_t)(cnx_tmp1 >> 16U);\n" +
          "buffer[3] = (uint8_t)(cnx_tmp1 >> 24U);",
      );
    });

    it("asserts the invariant when slice length is not a multiple of the element size", () => {
      mockGetExpressionType.mockReturnValue("u64");
      HandlerTestUtils.declareTypes(state, [
        ["arr16", { arrayDimensions: [16], baseType: "u16", bitWidth: 16 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(3),
      });
      const ctx = createMockContext({
        identifiers: ["arr16"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 7 } } as never,
          { mockValue: "3", start: { line: 7 } } as never,
        ]),
        generatedValue: "value",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a slice length divides the element size",
      );
    });

    it("asserts the invariant when slice length exceeds the source value width", () => {
      mockGetExpressionType.mockReturnValue("u32"); // 4-byte source
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(8), // copying 8 bytes from a 4-byte value
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 8 } } as never,
          { mockValue: "8", start: { line: 8 } } as never,
        ]),
        generatedValue: "value",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a slice length fits its source width",
      );
    });

    it("asserts the invariant on a non-integer (float) slice source", () => {
      mockGetExpressionType.mockReturnValue("f32");
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 9 } } as never,
          { mockValue: "4", start: { line: 9 } } as never,
        ]),
        generatedValue: "fval",
      });

      expect(() => getHandler()!(ctx)).toThrow("a slice source is an integer");
    });

    it("asserts the invariant on slice assignment into a float array", () => {
      HandlerTestUtils.declareTypes(state, [
        ["arrF", { arrayDimensions: [16], baseType: "f32", bitWidth: 32 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(4),
      });
      const ctx = createMockContext({
        identifiers: ["arrF"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 9 } } as never,
          { mockValue: "4", start: { line: 9 } } as never,
        ]),
        generatedValue: "value",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a sliced array has an integer element type",
      );
    });

    it("rejects a negative literal that does not fit the slice (mirror of the positive overflow check)", () => {
      // A negative literal types as null via getExpressionType (unary minus), but
      // is still a compile-time constant. It must be fit-checked like a positive
      // one: buf[0,1] <- -300 cannot fit a 1-byte slice (-300 < -128) and must be
      // rejected, not silently truncated to (uint8_t)(-300) (Issue #1085 review).
      mockGetExpressionType.mockReturnValue(null);
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0) // offset
          .mockReturnValueOnce(1) // length (1-byte slice)
          .mockReturnValue(-300), // source value (folded; re-read by resolveLiteralSliceSource)
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 7 } } as never,
          { mockValue: "1", start: { line: 7 } } as never,
        ]),
        generatedValue: "-300",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a slice literal fits its byte width -- E0861 rejects -300 in a 1-byte slice",
      );
    });

    it("serializes an in-range negative literal as two's-complement little-endian bytes", () => {
      // -1 fits a 4-byte slice (-2^31 <= -1 < 2^32), so it is accepted and written
      // as 0xFFFFFFFF little-endian. The literal types to the slice width (u32),
      // so an equivalent memcpy would be incompatible -> Rule 21.15 is cited.
      mockGetExpressionType.mockReturnValue(null);
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0) // offset
          .mockReturnValueOnce(4) // length
          .mockReturnValue(-1), // source value
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "4", start: { line: 1 } } as never,
        ]),
        generatedValue: "-1",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe(
        `${sliceComment("uint8_t", "uint32_t")}\n` +
          "const uint32_t cnx_tmp0 = (uint32_t)(-1);\n" +
          "buffer[0] = (uint8_t)(cnx_tmp0);\n" +
          "buffer[1] = (uint8_t)(cnx_tmp0 >> 8U);\n" +
          "buffer[2] = (uint8_t)(cnx_tmp0 >> 16U);\n" +
          "buffer[3] = (uint8_t)(cnx_tmp0 >> 24U);",
      );
    });

    // #1322: compound assignment on a bit index, bit range, slice, bitmap field
    // or string is E0857 in pass 2.1 -- one decision where `output/` had six
    // throws with four messages, and `validateNotCompound` defined twice verbatim.
    // The pipeline halts before these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.

    it("asserts the invariant on multi-dimensional array", () => {
      HandlerTestUtils.declareTypes(state, [
        ["matrix", { arrayDimensions: [10, 10], baseType: "u8" }],
      ]);
      const ctx = createMockContext({
        identifiers: ["matrix"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 5 } } as never,
          { mockValue: "10", start: { line: 5 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a sliced buffer is one-dimensional",
      );
    });

    it("asserts the invariant on non-constant offset", () => {
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "i", start: { line: 3 } } as never,
          { mockValue: "10", start: { line: 3 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a slice offset folds at compile time",
      );
    });

    it("asserts the invariant on non-constant length", () => {
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(undefined),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 3 } } as never,
          { mockValue: "len", start: { line: 3 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a slice length folds at compile time",
      );
    });

    it("asserts the invariant on out of bounds access", () => {
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [50], baseType: "u8", bitWidth: 8 }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(40)
          .mockReturnValueOnce(20),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "40", start: { line: 7 } } as never,
          { mockValue: "20", start: { line: 7 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow("a slice span fits its buffer");
    });

    it("asserts the invariant on negative offset", () => {
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(-1)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "-1", start: { line: 2 } } as never,
          { mockValue: "10", start: { line: 2 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a slice offset is not negative",
      );
    });

    it("asserts the invariant on zero length", () => {
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 2 } } as never,
          { mockValue: "0", start: { line: 2 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow("a slice length is positive");
    });

    it("asserts the invariant on negative length", () => {
      HandlerTestUtils.declareTypes(state, [
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(-5),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 2 } } as never,
          { mockValue: "-5", start: { line: 2 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow("a slice length is positive");
    });

    it("asserts the invariant when buffer size cannot be determined", () => {
      HandlerTestUtils.declareTypes(state, [["unknown", { baseType: "u8" }]]);
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        identifiers: ["unknown"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0", start: { line: 2 } } as never,
          { mockValue: "10", start: { line: 2 } } as never,
        ]),
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "a sliced buffer has a foldable size",
      );
    });
  });
});
