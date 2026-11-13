import { readFileSync } from "node:fs";
import type IOperandType from "../../../types/IOperandType";
import type TSubscriptKind from "../../../types/TSubscriptKind";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import AssignmentClassifier from "../AssignmentClassifier";
import AssignmentKind from "../../../types/AssignmentKind";
import AssignmentHandlerRegistry from "../../3-Render/codegen/assignment/index";
import IAssignmentContext from "../types/IAssignmentContext";
import TranspileState from "../../TranspileState";
import TTypeInfo from "../../../types/TTypeInfo";
import enterScope from "../../__tests__/enterScope";
import HandlerTestUtils from "../../3-Render/codegen/assignment/handlers/__tests__/handlerTestUtils";
import installMockSymbols from "../../__tests__/installMockSymbols";
import type ICodeGenSymbols from "../../../types/ICodeGenSymbols";

// ========================================================================
// Test Helpers
// ========================================================================

/** Classify `ctx` as 2.3 does: with 2.2's decisions on it, made on the typed target */
function classify(ctx: IAssignmentContext): AssignmentKind {
  return AssignmentClassifier.classify(
    HandlerTestUtils.withPlannedBitmapField(state, ctx),
  );
}

/** Declare `name`'s type for this case's target binding (#1668) */
function declare(name: string, info: TTypeInfo): void {
  HandlerTestUtils.declareTypes(state, [[name, info]]);
}

/**
 * Create a minimal mock context for testing classification.
 */
function createMockContext(
  state: TranspileState,
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Compute resolvedBaseIdentifier from resolvedTarget if not explicitly provided
  const resolvedTarget = overrides.resolvedTarget ?? "x";
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? resolvedTarget.split(/[[.]/)[0];

  const ctx = {
    state,
    renderTarget: () => resolvedTarget,
    bitmapField: null,
    atomic: null,
    analyzeTargetForBitAccess: () =>
      ({
        isBitAccess: false,
      }) as IAssignmentContext["analyzeTargetForBitAccess"] extends () => infer R
        ? R
        : never,
    targetLine: 1,
    hasValue: false,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    valueHasFloatingOperand: () => false,
    foldValue: () => undefined,
    identifiers: ["x"],
    subscriptCount: 0,
    renderSubscript: () => "0",
    foldSubscript: () => undefined,
    postfixOps: [],
    hasThis: false,
    hasGlobal: false,
    scopePath: "",
    hasMemberAccess: false,
    hasArrayAccess: false,
    postfixOpsCount: 0,
    cnxOp: "<-",
    cOp: "=",
    isCompound: false,
    generatedValue: "5",
    resolvedTarget,
    resolvedBaseIdentifier,
    memberAccessDepth: 0,
    subscriptDepth: 0,
    lastSubscriptExprCount: 1, // default: 1 expression (array element, single bit)
    isSimpleIdentifier: true,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    plannedWholeArray: null,
    ...overrides,
  } as IAssignmentContext;
  // #1668 (C7): what the target writes, as the binder would bind it
  const target = overrides.target ?? HandlerTestUtils.targetOf(state, ctx);
  const plannedOverflow =
    overrides.plannedOverflow === undefined
      ? HandlerTestUtils.plannedClampOf(ctx, target)
      : overrides.plannedOverflow;
  return withPlannedCopy({ ...ctx, target, plannedOverflow }, overrides);
}

/**
 * #1731 review: 2.2's string-copy decision is the case's input -- the typer
 * makes it (`OperandTyper.stringCopyCapacity`), as 2.1's E0715 does
 */
function withPlannedCopy(
  ctx: IAssignmentContext,
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  return {
    ...ctx,
    plannedStringCapacity: overrides.plannedStringCapacity ?? null,
  };
}

/**
 * #1668 (C12): the typer's step for a target's final subscript, which is what
 * the classifier reads for a subscript's kind -- the case's INPUT, the way a
 * declared type is, not a re-derivation of it.
 */
function typedLast(
  ctx: IAssignmentContext,
  subscript: TSubscriptKind,
  typeName = "u8",
): IAssignmentContext {
  const before: IOperandType = {
    typeName,
    cType: null,
    dimensions: [],
    category: typeName.startsWith("i") ? "signed" : "unsigned",
    bitWidth: Number.parseInt(typeName.slice(1), 10),
    stringCapacity: null,
    enumTypeName: null,
    bitmapTypeName: null,
    overflow: null,
    hasSideEffect: false,
    form: { kind: "declared" },
    binding: null,
  };
  return {
    ...ctx,
    target: {
      ...ctx.target,
      last: {
        before,
        subscript,
        after: null,
        property: null,
        callee: null,
        beforeNamesType: false,
        beforeIsBitField: false,
        fieldBits: null,
        beforeRegisterMember: null,
        beforeRegister: null,
        registerMember: null,
        member: null,
      },
    },
  };
}

/**
 * #2185: the typer's step for a register member's bit -- which member the
 * prefix is, is the typer's answer, the case's INPUT
 */
function registerStep(
  ctx: IAssignmentContext,
  member: string,
  subscript: "bit_single" | "bit_range",
): IAssignmentContext {
  const typed = typedLast(ctx, subscript);
  return {
    ...typed,
    target: {
      ...typed.target,
      last: { ...typed.target.last!, beforeRegisterMember: member },
    },
  };
}

/**
 * #1737: the typer's final step for a struct-field target -- what the write
 * lands in (`after`): the field, or the element its subscript selects; and
 * what the step reads from (`before`). The case's INPUT, as `typedLast`'s is.
 */
function typedStep(
  ctx: IAssignmentContext,
  step: { before?: IOperandType; after?: IOperandType },
  subscript: TSubscriptKind | null = null,
  member: string | null = null,
): IAssignmentContext {
  return withPlannedCopy({
    ...ctx,
    target: {
      ...ctx.target,
      last: {
        before: step.before ?? null,
        subscript,
        after: step.after ?? null,
        property: null,
        callee: null,
        beforeNamesType: false,
        beforeIsBitField: false,
        fieldBits: null,
        beforeRegisterMember: null,
        beforeRegister: null,
        registerMember: null,
        member,
      },
    },
  });
}

/**
 * Create a minimal mock type info.
 */
function createTypeInfo(overrides: Partial<TTypeInfo> = {}): TTypeInfo {
  return {
    baseType: "u32",
    bitWidth: 32,
    isArray: false,
    isConst: false,
    ...overrides,
  };
}

/**
 * Installs a complete mock symbol world with `overrides`, in `state.symbols`
 * and the matching `state.symbolTable` entries.
 */
function setupSymbols(overrides: Partial<ICodeGenSymbols> = {}): void {
  installMockSymbols(state, overrides);
}

// ========================================================================
// SIMPLE Assignment
// ========================================================================
/**
 * #1934: the scope 2.3 Render has entered on the state, deliberately not the
 * one a case's `scopePath` names. The classifier takes the scope from the
 * assignment, so a classifier reading the state instead fails these cases.
 */
const RENDER_SCOPE = "Elsewhere";

let state = new TranspileState();

describe("AssignmentClassifier - SIMPLE", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("classifies simple identifier assignment", () => {
    const ctx = createMockContext(state, {
      identifiers: ["x"],
      isSimpleIdentifier: true,
    });

    expect(classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });

  it("classifies unknown pattern as SIMPLE fallback", () => {
    const ctx = createMockContext(state, {
      identifiers: ["unknown"],
      hasMemberAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

// ========================================================================
// Bitmap Field Assignments
// ========================================================================
describe("AssignmentClassifier - Bitmap Fields", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  /** `<spelling>.<field> <- v`, with the typer's last step reading `before` */
  const fieldOf = (
    identifiers: string[],
    before: IOperandType,
    overrides: Partial<IAssignmentContext> = {},
  ): IAssignmentContext =>
    typedStep(
      createMockContext(state, {
        identifiers,
        hasMemberAccess: true,
        isSimpleIdentifier: false,
        postfixOps: [{ kind: "member", name: identifiers.at(-1)! }],
        ...overrides,
      }),
      { before },
      null,
      identifiers.at(-1)!,
    );
  const bitmapOperand = (dimensions: number[] = []): IOperandType => ({
    ...HandlerTestUtils.operandOf("StatusFlags", false, false),
    bitmapTypeName: "StatusFlags",
    dimensions,
  });

  // #1749: one rule for every spelling of the prefix -- the typer says the
  // last step is a field of a bitmap value
  it.each([
    ["flags.Running", ["flags", "Running"], {}],
    ["flags.Mode", ["flags", "Mode"], {}],
    ["device.flags.Running", ["device", "flags", "Running"], {}],
    [
      "gss[1].fl.Mode",
      ["gss", "fl", "Mode"],
      { hasArrayAccess: true, subscriptCount: 1 },
    ],
    [
      "Sc.ps.fls[1].Running",
      ["Sc", "ps", "fls", "Running"],
      { hasArrayAccess: true, subscriptCount: 1 },
    ],
    ["this.fl.Mode", ["fl", "Mode"], { hasThis: true, scopePath: "Sc" }],
  ] as const)("classifies %s as BITMAP_FIELD", (_, identifiers, overrides) => {
    const bitmapFields = new Map([
      [
        "StatusFlags",
        new Map([
          ["Running", { offset: 0, width: 1 }],
          ["Mode", { offset: 4, width: 4 }],
        ]),
      ],
    ]);
    setupSymbols({ bitmapFields });

    expect(
      classify(fieldOf([...identifiers], bitmapOperand(), overrides)),
    ).toBe(AssignmentKind.BITMAP_FIELD);
  });

  // ADR-034: the classifier routes on 2.2's planned field, not on its own
  // reading of the step -- a typed bitmap step 2.2 planned no field for is no field
  it("routes on the field 2.2 planned, not on a re-reading of the step", () => {
    setupSymbols({
      bitmapFields: new Map([
        ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
      ]),
    });
    const ctx = fieldOf(["flags", "Running"], bitmapOperand());

    expect(
      AssignmentClassifier.classify({ ...ctx, bitmapField: null }),
    ).not.toBe(AssignmentKind.BITMAP_FIELD);
  });

  it("does not classify a field the bitmap does not have", () => {
    setupSymbols({
      bitmapFields: new Map([
        ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
      ]),
    });

    expect(classify(fieldOf(["flags", "Missing"], bitmapOperand()))).not.toBe(
      AssignmentKind.BITMAP_FIELD,
    );
  });

  it("does not classify a field of a bitmap array that names no element", () => {
    setupSymbols({
      bitmapFields: new Map([
        ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
      ]),
    });

    expect(
      classify(fieldOf(["flags", "Running"], bitmapOperand([2]))),
    ).not.toBe(AssignmentKind.BITMAP_FIELD);
  });

  it("does not classify a bitmap's subscript as a field", () => {
    setupSymbols({
      bitmapFields: new Map([
        ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
      ]),
    });
    // The typer's last step is the subscript, which reads no field
    const ctx = typedStep(
      createMockContext(state, {
        identifiers: ["flags", "Running"],
        hasMemberAccess: true,
        isSimpleIdentifier: false,
        postfixOps: [
          { kind: "member", name: "Running" },
          {
            kind: "subscript",
            indexCount: 1,
            renderIndexes: () => ["0"],
            foldWidth: () => undefined,
          },
        ],
      }),
      { before: bitmapOperand() },
      "bit_single",
    );

    expect(classify(ctx)).not.toBe(AssignmentKind.BITMAP_FIELD);
  });

  /** A field of a register member, as the typer names the member (#2158) */
  const registerFieldOf = (
    identifiers: string[],
    member: string,
    overrides: Partial<IAssignmentContext> = {},
  ): IAssignmentContext => {
    const ctx = fieldOf(
      identifiers,
      { ...bitmapOperand(), bitmapTypeName: "ControlBits" },
      overrides,
    );
    return {
      ...ctx,
      target: {
        ...ctx.target,
        last: { ...ctx.target.last!, beforeRegisterMember: member },
      },
    };
  };

  const controlBits = new Map([
    ["ControlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
  ]);

  // ADR-004: the register keeps its own write. Which member the prefix is,
  // under each spelling, is the typer's answer (OperandTyper.chainOf's tests)
  it("classifies a field of the member the typer names as REGISTER_MEMBER_BITMAP_FIELD", () => {
    setupSymbols({ bitmapFields: controlBits });

    expect(
      classify(
        registerFieldOf(["PWM", "FLAGS", "Enable"], "Drive__PWM__FLAGS", {
          scopePath: "Drive",
        }),
      ),
    ).toBe(AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD);
  });

  // #2158: the spelling does not decide. `MOTOR` spells a known register, but
  // a step the typer names no member for is a bitmap value's field.
  it("does not classify a field as a register member's by its spelling", () => {
    setupSymbols({
      bitmapFields: controlBits,
      knownRegisters: new Set(["MOTOR"]),
      knownBitmaps: new Set(["ControlBits"]),
      registerMemberCTypes: new Map([["MOTOR__CTRL", "ControlBits"]]),
    });

    expect(
      classify(
        fieldOf(["MOTOR", "CTRL", "Enable"], {
          ...bitmapOperand(),
          bitmapTypeName: "ControlBits",
        }),
      ),
    ).toBe(AssignmentKind.BITMAP_FIELD);
  });

  it("does not classify a register member's unknown field", () => {
    setupSymbols({
      bitmapFields: new Map([
        ["ControlBits", new Map([["Enable", { offset: 0, width: 1 }]])],
      ]),
      knownBitmaps: new Set(["ControlBits"]),
      registerMemberCTypes: new Map([["MOTOR__CTRL", "ControlBits"]]),
    });

    expect(
      classify(registerFieldOf(["MOTOR", "CTRL", "Missing"], "MOTOR__CTRL")),
    ).not.toBe(AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD);
  });
});

// ========================================================================
// Integer Bit Access
// ========================================================================
describe("AssignmentClassifier - Integer Bit Access", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("classifies single bit access on integer", () => {
    declare("flags", createTypeInfo({ baseType: "u8" }));

    const ctx = typedLast(
      createMockContext(state, {
        identifiers: ["flags"],
        subscriptCount: 1, // Mock subscript
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      }),
      "bit_single",
    );

    expect(classify(ctx)).toBe(AssignmentKind.INTEGER_BIT);
  });

  it("classifies bit range access on integer", () => {
    declare("flags", createTypeInfo({ baseType: "u32" }));

    const ctx = typedLast(
      createMockContext(state, {
        identifiers: ["flags"],
        subscriptCount: 2,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
        lastSubscriptExprCount: 2, // bit range has 2 expressions [start, width]
      }),
      "bit_range",
      "u32",
    );

    expect(classify(ctx)).toBe(AssignmentKind.INTEGER_BIT_RANGE);
  });
});

// ========================================================================
// Array Assignments
// ========================================================================
describe("AssignmentClassifier - Array Access", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("classifies simple array element", () => {
    declare(
      "arr",
      createTypeInfo({
        isArray: true,
        arrayDimensions: [10],
      }),
    );

    // #1668 (C12): the typer types every subscript; this is its answer
    const ctx = typedLast(
      createMockContext(state, {
        identifiers: ["arr"],
        subscriptCount: 1,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      }),
      "array_element",
    );

    expect(classify(ctx)).toBe(AssignmentKind.ARRAY_ELEMENT);
  });

  it("classifies a whole array given its list (#1782)", () => {
    const ctx = createMockContext(state, {
      identifiers: ["buffer"],
      plannedWholeArray: {
        elementCType: "uint8_t",
        dimensions: [4],
        fromList: true,
        fromArray: false,
        groupedSource: false,
        volatileTarget: false,
      },
    });
    expect(AssignmentClassifier.classify(ctx)).toBe(AssignmentKind.WHOLE_ARRAY);
  });

  it("classifies array slice", () => {
    declare(
      "buffer",
      createTypeInfo({
        isArray: true,
        arrayDimensions: [100],
      }),
    );

    // #1668 (C12): the typer types every subscript; this is its answer
    const ctx = typedLast(
      createMockContext(state, {
        identifiers: ["buffer"],
        subscriptCount: 2,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
        lastSubscriptExprCount: 2, // slice has 2 expressions [start, length]
      }),
      "array_slice",
    );

    expect(classify(ctx)).toBe(AssignmentKind.ARRAY_SLICE);
  });
});

// ========================================================================
// String Assignments
// ========================================================================
describe("AssignmentClassifier - String Assignments", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("routes a write 2.2 planned as one string<N> to STRING_COPY", () => {
    declare(
      "name",
      createTypeInfo({
        baseType: "string<32>",
        isString: true,
        stringCapacity: 32,
      }),
    );

    const planned = createMockContext(state, {
      identifiers: ["name"],
      isSimpleIdentifier: true,
      plannedStringCapacity: 32,
    });
    expect(AssignmentClassifier.classify(planned)).toBe(
      AssignmentKind.STRING_COPY,
    );

    // Control: what 2.2 did not plan as a copy is not one, whatever the type
    const unplanned = createMockContext(state, {
      identifiers: ["name"],
      isSimpleIdentifier: true,
    });
    expect(AssignmentClassifier.classify(unplanned)).not.toBe(
      AssignmentKind.STRING_COPY,
    );
  });
});

// ========================================================================
// Special Compound Assignments
// ========================================================================
describe("AssignmentClassifier - Special Compound", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("classifies atomic RMW", () => {
    declare(
      "counter",
      createTypeInfo({
        baseType: "u32",
        isAtomic: true,
      }),
    );

    const ctx = createMockContext(state, {
      identifiers: ["counter"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
      atomic: {
        form: "ldrex-strex",
        typeName: "u32",
        cType: "uint32_t",
        bits: 32,
        operandCType: "uint32_t",
        exclusive: {
          ldrex: "__LDREXW",
          strex: "__STREXW",
          pointee: "uint32_t",
        },
      },
      cnxOp: "+<-",
    });

    expect(classify(ctx)).toBe(AssignmentKind.ATOMIC_RMW);
  });

  it("classifies overflow clamp", () => {
    declare(
      "saturated",
      createTypeInfo({
        baseType: "u8",
        overflowBehavior: "clamp",
      }),
    );

    const ctx = createMockContext(state, {
      identifiers: ["saturated"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
      cnxOp: "+<-",
    });

    expect(classify(ctx)).toBe(AssignmentKind.OVERFLOW_HELPER);
  });

  it("clamps what the typer says the target writes (#1731 review)", () => {
    // 2.2 hands `overflowOfWrite` the typer's written type, the same one the
    // string copy reads -- a whole array and an untyped target write no
    // integer the clamp can saturate
    const u8 = {
      ...HandlerTestUtils.operandOf("u8", true, false),
      overflow: "clamp" as const,
    };
    const overflowHelperOf = (written: IOperandType | null) =>
      AssignmentClassifier.overflowOfWrite(
        written,
        "+<-",
        () => false,
        null,
        false,
      );

    expect(overflowHelperOf(u8)).toEqual({
      name: "cnx_clamp_add_u8",
      behavior: "clamp",
      operation: "add",
      cnxType: "u8",
    });
    expect(overflowHelperOf({ ...u8, dimensions: [4] })).toBeNull();
    expect(overflowHelperOf({ ...u8, overflow: "wrap" })).toBeNull();
    expect(overflowHelperOf(null)).toBeNull();
  });

  it("does not classify float as overflow clamp", () => {
    declare(
      "value",
      createTypeInfo({
        baseType: "f32",
        overflowBehavior: "clamp",
      }),
    );

    const ctx = createMockContext(state, {
      identifiers: ["value"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "+=",
      cnxOp: "+<-",
    });

    // Floats use native arithmetic, so not OVERFLOW_HELPER
    expect(classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });

  // #1668: `y *<- 2.5` is `y <- y * 2.5`. With a floating operand it is not
  // integer arithmetic, so it must not reach an integer clamp helper.
  it("does not classify a floating value as overflow clamp", () => {
    declare(
      "scaled",
      createTypeInfo({ baseType: "u32", overflowBehavior: "clamp" }),
    );

    const ctx = createMockContext(state, {
      identifiers: ["scaled"],
      isSimpleIdentifier: true,
      isCompound: true,
      cOp: "*=",
      cnxOp: "*<-",
      valueHasFloatingOperand: () => true,
    });

    expect(classify(ctx)).toBe(AssignmentKind.SIMPLE);
  });
});

describe("AssignmentClassifier.compoundOverflow (#1668)", () => {
  it.each([
    ["clamp u32 +<-", "u32", "clamp", "+<-", false, "add"],
    ["clamp i8 -<-", "i8", "clamp", "-<-", false, "sub"],
    ["clamp u16 *<-", "u16", "clamp", "*<-", false, "mul"],
    ["a floating value", "u32", "clamp", "*<-", true, null],
    ["a wrap target", "u32", "wrap", "+<-", false, null],
    ["a float target", "f32", "clamp", "+<-", false, null],
    ["division, which has no helper", "u32", "clamp", "/<-", false, null],
    ["a bitwise operator", "u32", "clamp", "&<-", false, null],
  ])("%s", (_label, baseType, overflowBehavior, cnxOp, floating, expected) => {
    const typeInfo = createTypeInfo({
      baseType,
      overflowBehavior: overflowBehavior as "clamp" | "wrap",
    });
    const ctx = createMockContext(new TranspileState(), {
      cnxOp,
      valueHasFloatingOperand: () => floating,
      target: {
        root: null,
        rootTypeInfo: typeInfo,
        typeInfo,
        last: undefined,
      },
    });

    expect(AssignmentClassifier.compoundOverflow(ctx)?.operation ?? null).toBe(
      expected,
    );
  });
});

// ========================================================================
// Global/This Prefix Patterns
// ========================================================================
describe("AssignmentClassifier - Prefix Patterns", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  it("classifies global.member", () => {
    const knownScopes = new Set(["Counter"]);
    setupSymbols({ knownScopes });

    const ctx = createMockContext(state, {
      identifiers: ["Counter", "value"],
      hasGlobal: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.GLOBAL_MEMBER);
  });

  // Issue #1115: `global.arr[i]` classifies as the general ARRAY_ELEMENT, the
  // same as bare `arr[i]` and `this.arr[i]`. The retired GLOBAL_ARRAY kind
  // bypassed SubscriptClassifier and emitted the raw subscript chain.
  it("classifies global.arr[i] as ARRAY_ELEMENT", () => {
    setupSymbols();

    // #1668 (C12): the typer types every subscript; this is its answer
    const ctx = typedLast(
      createMockContext(state, {
        identifiers: ["arr"],
        subscriptCount: 1,
        hasGlobal: true,
        hasArrayAccess: true,
        postfixOpsCount: 1,
        isSimpleIdentifier: false,
      }),
      "array_element",
    );

    expect(classify(ctx)).toBe(AssignmentKind.ARRAY_ELEMENT);
  });

  it("classifies this.member", () => {
    setupSymbols();
    enterScope(state, RENDER_SCOPE);

    const ctx = createMockContext(state, {
      scopePath: "Counter",
      identifiers: ["count"],
      hasThis: true,
      postfixOpsCount: 1,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.THIS_MEMBER);
  });

  it("classifies this.arr[i]", () => {
    setupSymbols();
    enterScope(state, RENDER_SCOPE);

    // #1668 (C12): the typer types every subscript; this is its answer
    const ctx = typedLast(
      createMockContext(state, {
        scopePath: "Buffer",
        identifiers: ["data"],
        subscriptCount: 1,
        hasThis: true,
        hasArrayAccess: true,
        postfixOpsCount: 1,
        isSimpleIdentifier: false,
      }),
      "array_element",
    );

    expect(classify(ctx)).toBe(AssignmentKind.ARRAY_ELEMENT);
  });

  // Issue #954 / #1115: scope variable bit access classifies as the general
  // INTEGER_BIT / INTEGER_BIT_RANGE kinds -- `resolvedBaseIdentifier` already
  // carries the scope prefix, so no `this.`-specific kind is needed.
  it("classifies this.flags[3] as INTEGER_BIT for integer type", () => {
    setupSymbols();
    enterScope(state, RENDER_SCOPE);
    // Register Sensor_flags as a non-array integer type
    declare(
      "Sensor__flags",
      createTypeInfo({ baseType: "u8", isArray: false }),
    );

    const ctx = typedLast(
      createMockContext(state, {
        scopePath: "Sensor",
        identifiers: ["flags"],
        subscriptCount: 1,
        hasThis: true,
        hasArrayAccess: true,
        postfixOpsCount: 1,
        isSimpleIdentifier: false,
        lastSubscriptExprCount: 1, // single bit
      }),
      "bit_single",
    );

    expect(classify(ctx)).toBe(AssignmentKind.INTEGER_BIT);
  });

  it("classifies this.value[0, 8] as INTEGER_BIT_RANGE for integer type", () => {
    setupSymbols();
    enterScope(state, RENDER_SCOPE);
    // Register Sensor_value as a non-array integer type
    declare(
      "Sensor__value",
      createTypeInfo({ baseType: "u16", isArray: false }),
    );

    const ctx = typedLast(
      createMockContext(state, {
        scopePath: "Sensor",
        identifiers: ["value"],
        subscriptCount: 2,
        hasThis: true,
        hasArrayAccess: true,
        postfixOpsCount: 1,
        isSimpleIdentifier: false,
        lastSubscriptExprCount: 2, // bit range
      }),
      "bit_range",
      "u16",
    );

    expect(classify(ctx)).toBe(AssignmentKind.INTEGER_BIT_RANGE);
  });

  it("classifies this.data[i] as ARRAY_ELEMENT for array type", () => {
    setupSymbols();
    enterScope(state, RENDER_SCOPE);
    // Register Buffer_data as an array type
    declare(
      "Buffer__data",
      createTypeInfo({ baseType: "u8", isArray: true, arrayDimensions: [10] }),
    );

    // #1668 (C12): the typer types every subscript; this is its answer
    const ctx = typedLast(
      createMockContext(state, {
        scopePath: "Buffer",
        identifiers: ["data"],
        subscriptCount: 1,
        hasThis: true,
        hasArrayAccess: true,
        postfixOpsCount: 1,
        isSimpleIdentifier: false,
        lastSubscriptExprCount: 1,
      }),
      "array_element",
    );

    expect(classify(ctx)).toBe(AssignmentKind.ARRAY_ELEMENT);
  });
});

// ========================================================================
// Register Bit Access
// ========================================================================
describe("AssignmentClassifier - Register Bit Access", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  it("classifies register single bit", () => {
    const knownRegisters = new Set(["GPIO7"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext(state, {
      identifiers: ["GPIO7", "DR_SET"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(registerStep(ctx, "GPIO7__DR_SET", "bit_single"))).toBe(
      AssignmentKind.REGISTER_BIT,
    );
  });

  it("classifies register bit range", () => {
    const knownRegisters = new Set(["GPIO7"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext(state, {
      identifiers: ["GPIO7", "DR_SET"],
      subscriptCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(registerStep(ctx, "GPIO7__DR_SET", "bit_range"))).toBe(
      AssignmentKind.REGISTER_BIT_RANGE,
    );
  });

  it("classifies scoped register bit", () => {
    const knownScopes = new Set(["Teensy4"]);
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    setupSymbols({ knownScopes, knownRegisters });
    enterScope(state, RENDER_SCOPE);

    const ctx = createMockContext(state, {
      scopePath: "Teensy4",
      identifiers: ["GPIO7", "DR_SET"],
      subscriptCount: 1,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 2,
      isSimpleIdentifier: false,
    });

    expect(
      classify(registerStep(ctx, "Teensy4__GPIO7__DR_SET", "bit_single")),
    ).toBe(AssignmentKind.REGISTER_BIT);
  });
});

// ========================================================================
// Multi-dim Array with Bit Indexing
// ========================================================================
describe("AssignmentClassifier - Multi-dim Array Bit Indexing", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("classifies matrix[i][j][bit] as ARRAY_ELEMENT_BIT", () => {
    declare(
      "matrix",
      createTypeInfo({
        baseType: "u32",
        isArray: true,
        arrayDimensions: [4, 4],
      }),
    );

    const ctx = createMockContext(state, {
      identifiers: ["matrix"],
      subscriptCount: 3,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.ARRAY_ELEMENT_BIT);
  });

  it("classifies matrix[i][j] as MULTI_DIM_ARRAY_ELEMENT", () => {
    declare(
      "matrix",
      createTypeInfo({
        baseType: "u32",
        isArray: true,
        arrayDimensions: [4, 4],
      }),
    );

    const ctx = createMockContext(state, {
      identifiers: ["matrix"],
      subscriptCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.MULTI_DIM_ARRAY_ELEMENT);
  });
});

// ========================================================================
// Scoped Register Bit Range via This Prefix
// ========================================================================
describe("AssignmentClassifier - Scoped Register Bit Range", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  it("classifies this.reg[start, width] as REGISTER_BIT_RANGE", () => {
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    setupSymbols({ knownRegisters });
    enterScope(state, RENDER_SCOPE);

    const ctx = createMockContext(state, {
      scopePath: "Teensy4",
      identifiers: ["GPIO7", "ICR1"],
      subscriptCount: 2,
      hasThis: true,
      hasArrayAccess: true,
      postfixOpsCount: 3,
      postfixOps: [
        // #1445: the plan says "this is a bit range" directly. The node mock
        // said it as `COMMA: () => ({})`, which is the same claim spelled as a
        // token that happens to be present.
        {
          kind: "subscript",
          indexCount: 2,
          renderIndexes: () => ["0", "1"],
          foldWidth: () => undefined,
        } as IAssignmentContext["postfixOps"][0],
      ],
      isSimpleIdentifier: false,
    });

    expect(
      classify(registerStep(ctx, "Teensy4__GPIO7__ICR1", "bit_range")),
    ).toBe(AssignmentKind.REGISTER_BIT_RANGE);
  });
});

// ========================================================================
// Register Bit Access via classifyMemberWithSubscript (non-scoped, 2+ ids)
// ========================================================================
describe("AssignmentClassifier - Register Bit via MemberWithSubscript", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  it("classifies REG.MEMBER[bit] as REGISTER_BIT (non-this, non-global)", () => {
    const knownRegisters = new Set(["TIMER"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext(state, {
      identifiers: ["TIMER", "CTRL"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(registerStep(ctx, "TIMER__CTRL", "bit_single"))).toBe(
      AssignmentKind.REGISTER_BIT,
    );
  });

  it("classifies REG.MEMBER[start, width] as REGISTER_BIT_RANGE (non-this)", () => {
    const knownRegisters = new Set(["TIMER"]);
    setupSymbols({ knownRegisters });

    const ctx = createMockContext(state, {
      identifiers: ["TIMER", "CTRL"],
      subscriptCount: 2,
      // A bit range is ONE op carrying TWO expressions, so both counts are 2.
      // This was left at the default 1 — a state no real bit range produces —
      // which is why the test passed while `PORT.Set[8, 8]` emitted
      // `PORT__Set.Set` in the actual transpiler (#1244).
      lastSubscriptExprCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(registerStep(ctx, "TIMER__CTRL", "bit_range"))).toBe(
      AssignmentKind.REGISTER_BIT_RANGE,
    );
  });

  it("classifies Scope.REG.MEMBER[bit] as REGISTER_BIT via memberWithSubscript", () => {
    const knownScopes = new Set(["Teensy4"]);
    const knownRegisters = new Set(["Teensy4__GPIO7"]);
    setupSymbols({ knownScopes, knownRegisters });

    const ctx = createMockContext(state, {
      identifiers: ["Teensy4", "GPIO7", "DR_SET"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(
      classify(registerStep(ctx, "Teensy4__GPIO7__DR_SET", "bit_single")),
    ).toBe(AssignmentKind.REGISTER_BIT);
  });
});

// ========================================================================
// Bare `Scope.` subscript targets (#1244, #1116)
//
// The `global.` prefix is a grammar token, not an identifier, so
// `global.Scope.member[i]` and the bare `Scope.member[i]` reach the classifier
// with identical `identifiers` and must classify identically. Before #1244 the
// bare spelling had no scope-resolution step: the struct-chain branch claimed
// every bit range before the register or the variable was recognized.
// ========================================================================
describe("AssignmentClassifier - Bare Scope-Qualified Subscripts", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  const scopedRegisterCases: ReadonlyArray<
    readonly [string, number, number, AssignmentKind]
  > = [
    ["single bit", 1, 1, AssignmentKind.REGISTER_BIT],
    ["bit range", 2, 2, AssignmentKind.REGISTER_BIT_RANGE],
  ];

  it.each(scopedRegisterCases)(
    "classifies Scope.REG.MEMBER[%s] without a global. prefix",
    (_label, subscriptCount, lastSubscriptExprCount, expected) => {
      setupSymbols({
        knownScopes: new Set(["Hw"]),
        knownRegisters: new Set(["Hw__GPIO"]),
      });

      const ctx = createMockContext(state, {
        identifiers: ["Hw", "GPIO", "Mode"],
        subscriptCount,
        lastSubscriptExprCount,
        hasMemberAccess: true,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      });

      const subscript =
        expected === AssignmentKind.REGISTER_BIT_RANGE
          ? "bit_range"
          : "bit_single";
      expect(classify(registerStep(ctx, "Hw__GPIO__Mode", subscript))).toBe(
        expected,
      );
    },
  );

  // #1668 (C12): each row's subscript kind is the typer's answer, the
  // classifier's input; the counts say whether an element was indexed first
  const u8Array = createTypeInfo({
    baseType: "u8",
    bitWidth: 8,
    isArray: true,
    arrayDimensions: [16],
  });
  const scopeVariableCases: ReadonlyArray<
    readonly [string, TTypeInfo, number, number, TSubscriptKind, AssignmentKind]
  > = [
    [
      "bit range on a scalar",
      createTypeInfo({ baseType: "u8", bitWidth: 8 }),
      2,
      2,
      "bit_range",
      AssignmentKind.INTEGER_BIT_RANGE,
    ],
    [
      "bit on an array element",
      u8Array,
      2,
      1,
      "bit_single",
      AssignmentKind.ARRAY_ELEMENT_BIT,
    ],
    [
      "bit range on an array element (it was read as a slice)",
      u8Array,
      3,
      2,
      "bit_range",
      AssignmentKind.ARRAY_ELEMENT_BIT_RANGE,
    ],
    [
      "slice on an array",
      u8Array,
      2,
      2,
      "array_slice",
      AssignmentKind.ARRAY_SLICE,
    ],
  ];

  it.each(scopeVariableCases)(
    "routes Scope.member[...] to the shared subscript decision: %s",
    (
      _label,
      typeInfo,
      subscriptCount,
      lastSubscriptExprCount,
      kind,
      expected,
    ) => {
      setupSymbols({ knownScopes: new Set(["Other"]) });
      declare("Other__member", typeInfo);

      const ctx = typedLast(
        createMockContext(state, {
          identifiers: ["Other", "member"],
          subscriptCount,
          lastSubscriptExprCount,
          hasMemberAccess: true,
          hasArrayAccess: true,
          isSimpleIdentifier: false,
        }),
        kind,
      );

      expect(classify(ctx)).toBe(expected);
    },
  );

  it("leaves a non-register Scope.a.b chain to the struct-chain branch", () => {
    setupSymbols({ knownScopes: new Set(["Other"]) });

    const ctx = createMockContext(state, {
      identifiers: ["Other", "config", "field"],
      subscriptCount: 1,
      lastSubscriptExprCount: 2,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.STRUCT_CHAIN_BIT_RANGE);
  });

  // ADR-057 resolves a bare name local -> scope -> global. A variable of that
  // name at ANY tier wins, so the target stays a struct chain rather than being
  // read as the same-named scope. The tiers are keyed differently — a global
  // under its bare name, a scope member as `Scope__name` — so covering only one
  // of them leaves the other free to regress, which is exactly what happened.
  const adr057ShadowCases: ReadonlyArray<
    readonly [string, string | null, string]
  > = [
    ["a global", null, "Other"],
    ["a scope member", "Reg", "Reg__Other"],
  ];

  it.each(adr057ShadowCases)(
    "keeps %s named like a scope as a struct chain (ADR-057)",
    (_label, currentScopePath, typeInfoKey) => {
      setupSymbols({ knownScopes: new Set(["Other"]) });
      enterScope(state, currentScopePath);
      declare(typeInfoKey, createTypeInfo({ baseType: "Point", bitWidth: 0 }));

      const ctx = createMockContext(state, {
        scopePath: currentScopePath ?? "",
        identifiers: ["Other", "member"],
        subscriptCount: 1,
        lastSubscriptExprCount: 2,
        hasMemberAccess: true,
        hasArrayAccess: true,
        isSimpleIdentifier: false,
      });

      expect(classify(ctx)).toBe(AssignmentKind.STRUCT_CHAIN_BIT_RANGE);
    },
  );
});

// ========================================================================
// Member Chain
// ========================================================================
describe("AssignmentClassifier - Member Chain", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  it("classifies complex member chain as MEMBER_CHAIN", () => {
    const knownStructs = new Set(["Config"]);
    const structFields = new Map([["Config", new Map([["items", "Item"]])]]);
    setupSymbols({ knownStructs, structFields });
    declare("config", createTypeInfo({ baseType: "Config" }));

    const ctx = createMockContext(state, {
      identifiers: ["config", "items"],
      subscriptCount: 1,
      hasMemberAccess: true,
      hasArrayAccess: true,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.MEMBER_CHAIN);
  });
});

// ========================================================================
// Kinds the classifier could produce with no test naming them (#1450)
//
// `codegen-decomposition.md` commits twice to "classification tests cover all
// 25 kinds explicitly" -- once as a Testing Strategy target, once as a
// Mitigation for the risk it names, "priority order bugs if new kinds added
// incorrectly". The corpus had grown to 31 kinds while 25 were named here, so
// the count still read as met. A guard that passes by coincidence is the one
// nothing ever prompts anyone to look at.
//
// `this.member` string writes were the sharpest of the five: the kind whose
// registry key, unguarded, emitted a 55-byte out-of-bounds `strncpy` bound
// (`tests/string-assignment/string-assign-scope-this-shared-name.test.cnx`).
// The classifier half of that hole had no test either.
// ========================================================================
describe("AssignmentClassifier - previously unnamed kinds", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  it("classifies global.<struct>.<field>[i] as GLOBAL_ARRAY", () => {
    // #1115: with ONE identifier `global.x[i]` means what `x[i]` means and is
    // delegated. The chain form is what still reaches GLOBAL_ARRAY, because the
    // subscript applies to the field rather than to `config`.
    setupSymbols({ knownStructs: new Set(["Config"]) });
    declare("config", createTypeInfo({ baseType: "Config" }));

    const ctx = createMockContext(state, {
      identifiers: ["config", "items"],
      subscriptCount: 1,
      hasGlobal: true,
      hasMemberAccess: true,
      hasArrayAccess: true,
      memberAccessDepth: 1,
      // The `global.` dispatch is gated on postfixOpsCount > 0 -- `.items` and
      // `[0]` are the two ops. With the mock's default of 0 this context falls
      // through to MEMBER_CHAIN, which is exactly what it did on the first run.
      postfixOpsCount: 2,
      isSimpleIdentifier: false,
    });

    expect(classify(ctx)).toBe(AssignmentKind.GLOBAL_ARRAY);
  });
});

// ========================================================================
// The obligation, gated rather than remembered (#1450)
//
// `codegen-decomposition.md` requires that classification tests name every
// kind. That was hand-maintained, and it drifted: 25 of 31 kinds were named,
// while the obligation's own wording said "all 25 kinds" -- so the count read
// as met and nothing prompted anyone to look.
//
// Closing that by hand restores the property once. This asserts it, so the
// next kind added cannot land without a test. CLAUDE.md's argument for
// `scripts/__tests__/layer-rules.test.ts` is the same one: derive the claim
// instead of writing it down.
// ========================================================================
describe("AssignmentKind coverage is derived, not asserted", () => {
  /** Every declared kind name, without the reverse numeric mappings. */
  function declaredKinds(): string[] {
    return Object.keys(AssignmentKind).filter((k) => Number.isNaN(Number(k)));
  }

  // What this catches and what it does not: it matches a MENTION of
  // `AssignmentKind.X` anywhere in this file, a comment included. So it stops a
  // kind being added with no test -- the accidental drift that actually
  // happened -- and it would not stop someone writing a bare mention to quiet
  // it. That is a deliberate act, not a thing anyone does by not noticing, and
  // a stricter match (insisting on an `expect(...).toBe(...)` shape) would be
  // brittle against the kinds asserted through a variable.
  it("names every AssignmentKind somewhere in this file", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const named = new Set(
      [...source.matchAll(/AssignmentKind\.([A-Z_0-9]+)/g)].map((m) => m[1]),
    );

    const missing = declaredKinds().filter((kind) => !named.has(kind));
    expect(missing).toEqual([]);
  });

  it("gives every AssignmentKind a registered handler", () => {
    // `getHandler` throws lazily, only for a kind something actually
    // dispatches. A kind registered by nobody is invisible until a user
    // program reaches it, so ask for all of them here.
    const unregistered = declaredKinds().filter((kind) => {
      try {
        AssignmentHandlerRegistry.getHandler(
          AssignmentKind[kind as keyof typeof AssignmentKind],
        );
        return false;
      } catch {
        return true;
      }
    });

    expect(unregistered).toEqual([]);
  });
});
