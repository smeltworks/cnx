/**
 * Unit tests for PostfixExpressionGenerator
 *
 * Tests postfix expression generation including:
 * - Member access (obj.field)
 * - Array subscripts (arr[i])
 * - Bit access (value[3] or value[0, 8])
 * - Function calls (func())
 * - Property access (.length, .capacity, .size)
 */

import type IPlannedFloatBits from "../../../../../2-Plan/types/IPlannedFloatBits";
import type IPlannedArgument from "../../../../../2-Plan/types/IPlannedArgument";
import SymbolTable from "../../../../../../PARSE/3-Declare/SymbolTable";
import type IProgram from "../../../../../../types/IProgram";
import type IChainBase from "../../../../../../types/IChainBase";
import type IOperandType from "../../../../../../types/IOperandType";
import type IChainStep from "../../../../../../types/IChainStep";
import type TSubscriptKind from "../../../../../../types/TSubscriptKind";
import { describe, it, expect, vi, beforeEach } from "vitest";
import generatePostfixExpression from "../PostfixExpressionGenerator";
import type IPlannedPostfix from "../../../types/IPlannedPostfix";
import type TPlannedPostfixOp from "../../../types/TPlannedPostfixOp";
import type IGeneratorInput from "../../IGeneratorInput";
import type IGeneratorState from "../../IGeneratorState";
import type IOrchestrator from "../../IOrchestrator";
import type ICodeGenSymbols from "../../../../../../types/ICodeGenSymbols";
import type TTypeInfo from "../../../../../../types/TTypeInfo";
import type TParameterInfo from "../../../../../../types/TParameterInfo";
import * as Parser from "../../../../../../PARSE/2-Parse/grammar/CnxParser";
import TranspileState from "../../../../../TranspileState";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import createMockSymbols from "../../../../../../types/__testUtils__/codeGenSymbolsHelpers";
import PROPERTY_NAMES from "../../../../../../utils/constants/PROPERTY_NAMES";

// ========================================================================
// Test Helpers - Mock Symbols
// ========================================================================

// ========================================================================
// Test Helpers - Mock Input
// ========================================================================

/**
 * The two planner operations this file stands in for.
 *
 * #1445 box 3: both were declared on `IOrchestrator` and called by **no
 * production generator** -- `PostfixExpressionGenerator` takes `renderPrimary`
 * and `foldWidth` as thunks and never asks the orchestrator for either. They
 * were interface surface this test kept alive, and declaring them locally is
 * what lets `IOrchestrator` shed its last parse types.
 */
interface IPostfixPlannerStub {
  generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string;
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined;
}

let sharedState = new TranspileState();

/** Each case's declared variables -- see `createMockInput` */
let declaredTypes: ReadonlyMap<string, TTypeInfo> = new Map();

function createMockInput(overrides?: {
  symbols?: ICodeGenSymbols;
  typeRegistry?: Map<string, TTypeInfo>;
}): IGeneratorInput {
  // #1668 (C7): the generator reads each chain's bound base off its plan,
  // which `runPostfix` derives from this map
  declaredTypes = overrides?.typeRegistry ?? new Map<string, TTypeInfo>();

  return {
    symbolTable: null,
    symbols: overrides?.symbols ?? createMockSymbols(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    knownScopes: new Set<string>(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    program: null,
  } as IGeneratorInput;
}

// ========================================================================
// Test Helpers - Mock State
// ========================================================================

function createMockState(overrides?: {
  currentScopePath?: string;
  currentParameters?: Map<string, TParameterInfo>;
  scopeMembers?: Map<string, Set<string>>;
  mainArgsName?: string | null;
  lengthCache?: Map<string, string> | null;
  inFunctionBody?: boolean;
}): IGeneratorState {
  // Mapped explicitly rather than spread: this factory's `inFunctionBody`
  // default is true, and an override object carrying an explicit `undefined`
  // would otherwise silently reinstate the shared default of false.
  return TestGeneratorState.create({
    currentScopePath: overrides?.currentScopePath ?? "",
    inFunctionBody: overrides?.inFunctionBody ?? true,
    currentParameters: overrides?.currentParameters ?? new Map(),
    scopeMembers: overrides?.scopeMembers ?? new Map(),
    mainArgsName: overrides?.mainArgsName ?? null,
    lengthCache: overrides?.lengthCache ?? null,
  });
}

// ========================================================================
// Test Helpers - Mock Orchestrator
// ========================================================================

function createMockOrchestrator(overrides?: {
  generatePrimaryExpr?: (ctx: Parser.PrimaryExpressionContext) => string;
  generateExpression?: (ctx: Parser.ExpressionContext) => string;
  generateFunctionArg?: (
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ) => string;
  isKnownStruct?: (name: string) => boolean;
  isKnownScope?: (name: string) => boolean;
  isCppScopeSymbol?: (name: string) => boolean;
  tryEvaluateConstant?: (ctx: unknown) => number | undefined;
  hasFloatBitShadow?: (name: string) => boolean;
  registerFloatBitShadow?: (name: string) => void;
  addPendingTempDeclaration?: (decl: string) => void;
  isFloatShadowCurrent?: (name: string) => boolean;
  markFloatShadowCurrent?: (name: string) => void;
}): IOrchestrator & IPostfixPlannerStub {
  return {
    // #1452: the generator reads render state off its orchestrator.
    state: sharedState,
    getInput: vi.fn(),
    getState: vi.fn(),
    applyEffects: vi.fn(),
    getIndent: vi.fn(() => ""),
    generateExpression:
      overrides?.generateExpression ?? vi.fn((ctx) => ctx.getText()),
    generateExpressionWithExpectedType: vi.fn(),
    generateType: vi.fn(),
    generateUnaryExpr: vi.fn(),
    generatePostfixExpr: vi.fn(),
    generateOrExpr: vi.fn(),
    isKnownStruct: overrides?.isKnownStruct ?? vi.fn(() => false),
    isFloatType: vi.fn(),
    isIntegerType: vi.fn(),
    isCnxFunction: vi.fn(),
    getTypeName: vi.fn(),
    tryEvaluateConstant: overrides?.tryEvaluateConstant ?? vi.fn(),
    getZeroInitializer: vi.fn(),
    getExpressionEnumType: vi.fn(),
    isStringExpression: vi.fn(),
    // #1445: the call generator takes planned arguments, and the orchestrator
    // is where they are built -- this is its only dispatcher. Mirrors what
    // `CodeGenerator.planCallArguments` does against this file's mock nodes.
    planCallArguments: vi.fn(
      (ctx: { expression: () => { getText: () => string }[] } | null) =>
        ctx?.expression().map((expression) => ({
          simpleIdentifier: expression.getText(),
          render: () => expression.getText(),
          renderByReference: () => `&${expression.getText()}`,
        })) ?? null,
    ),
    getSimpleIdentifier: vi.fn(),
    generateFunctionArg: overrides?.generateFunctionArg ?? vi.fn(),
    isConstValue: vi.fn(),
    getKnownEnums: vi.fn(() => new Set()),
    // #1428: as `CodeGenerator.isCppMode()` does -- the walk's state holds the
    // run's mode; a test sets `sharedState.cppMode`, never a fallback here.
    isCppMode: vi.fn(() => sharedState.cppMode),
    isCppEnumClass: vi.fn(),
    getExpressionType: vi.fn(),
    isParameterPassByValue: vi.fn(),
    generateBlock: vi.fn(),
    generateStatement: vi.fn(),
    flushPendingTempDeclarations: vi.fn(() => ""),
    indent: vi.fn((text) => text),
    generateAssignmentTarget: vi.fn(),
    generateArrayDimensions: vi.fn(),
    generateArrayDimension: vi.fn(),
    countStringLengthAccesses: vi.fn(),
    countBlockLengthAccesses: vi.fn(),
    setupLengthCache: vi.fn(),
    clearLengthCache: vi.fn(),
    generateParameterList: vi.fn(),
    getStringLiteralLength: vi.fn(),
    getStringConcatOperands: vi.fn(),
    getSubstringOperands: vi.fn(),
    getStringExprCapacity: vi.fn(),
    setParameters: vi.fn(),
    clearParameters: vi.fn(),
    setCurrentScope: vi.fn(),
    setCurrentFunctionName: vi.fn(),
    enterFunctionBody: vi.fn(),
    exitFunctionBody: vi.fn(),
    isMainFunctionWithArgs: vi.fn(),
    generatePrimaryExpr:
      overrides?.generatePrimaryExpr ?? vi.fn((ctx) => ctx.getText()),
    isKnownScope: overrides?.isKnownScope ?? vi.fn(() => false),
    isCppScopeSymbol: overrides?.isCppScopeSymbol ?? vi.fn(() => false),
    addPendingTempDeclaration: overrides?.addPendingTempDeclaration ?? vi.fn(),
    registerFloatBitShadow: overrides?.registerFloatBitShadow ?? vi.fn(),
    markFloatShadowCurrent: overrides?.markFloatShadowCurrent ?? vi.fn(),
    hasFloatBitShadow: overrides?.hasFloatBitShadow ?? vi.fn(() => false),
    isFloatShadowCurrent: overrides?.isFloatShadowCurrent ?? vi.fn(() => false),
  } as unknown as IOrchestrator & IPostfixPlannerStub;
}

// ========================================================================
// Test Helpers - Plans
// ========================================================================
//
// #1445 box 3: the generator takes `IPlannedPostfix` now, so these build plans
// where they used to build fake parse nodes. The SIGNATURES are unchanged on
// purpose -- an op is still described by an identifier, a list of index
// expressions or an argument list -- so every case below still reads as the
// expression it is about.

/** A stand-in for an index expression: all the generator ever needed was text. */
function createMockExpression(text: string): { getText: () => string } {
  return { getText: () => text };
}

/**
 * #1668 (C12): an operand as the one operand typer reports it, for a case
 * that hands render the typer's answer about a member
 */
function typed(
  typeName: string,
  extra: Partial<IOperandType> = {},
): IOperandType {
  return {
    typeName,
    cType: null,
    dimensions: [],
    category: "none",
    bitWidth: null,
    stringCapacity: null,
    enumTypeName: null,
    bitmapTypeName: null,
    overflow: null,
    hasSideEffect: false,
    form: { kind: "declared" },
    binding: null,
    ...extra,
  };
}

/** The typer's step for a member read from `before`, giving `after` */
function memberStep(
  before: IOperandType | null,
  after: IOperandType | null,
  property: string | null = null,
) {
  return {
    before,
    subscript: null,
    after,
    property,
    callee: null,
    beforeNamesType: false,
    beforeIsBitField: false,
    fieldBits: null,
    beforeRegisterMember: null,
    beforeRegister: null,
    registerMember: null,
    member: null,
  };
}

function createMockPostfixOp(options?: {
  identifier?: string;
  /** #1668 (C12): the typer's step for a member, as render now reads it */
  step?: IChainStep;
  /** #1994: the chain head's `rootOp` -- the member on the root */
  appliesToRoot?: boolean;
  /** #1668: the typer's kind for a subscript; the unknown-type default */
  typedAs?: TSubscriptKind;
  expressions?: { getText: () => string }[];
  argumentList?: { expression: () => { getText: () => string }[] } | null;
  /** The type of the value a call op calls -- `peek` for `h.onPeek(...)`. */
  calleeType?: string;
  plannedArgument?: IPlannedArgument;
  /** 2.2's decision for a float bit range read (ADR-007) */
  floatBits?: IPlannedFloatBits;
}): TPlannedPostfixOp {
  if (options?.identifier) {
    return {
      kind: "member",
      name: options.identifier,
      appliesToRoot: options.appliesToRoot ?? false,
      step: options.step ?? null,
      narrowing: null,
    };
  }

  const expressions = options?.expressions ?? [];
  if (expressions.length > 0) {
    return {
      kind: "subscript",
      indexCount: expressions.length,
      renderIndexes: () => expressions.map((expr) => expr.getText()),
      // Rebound by `runPostfix` to the orchestrator's `tryEvaluateConstant`,
      // which is where these cases configure the Issue #1094 fold.
      foldWidth: () => undefined,
      typedAs:
        options?.typedAs ??
        (expressions.length === 2 ? "bit_range" : "array_element"),
      widthText: expressions[expressions.length - 1]?.getText(),
      floatBits: options?.floatBits ?? null,
      step: null,
      narrowing: null,
    } as TPlannedPostfixOp & { widthText?: string };
  }

  return {
    kind: "call",
    line: 1,
    calleeType: () => options?.calleeType ?? null,
    // Mirrors what `CodeGenerator.planCallArguments` does, against this file's
    // argument-list stand-in. It lived on the mock orchestrator until the
    // generator stopped asking for it.
    planArguments: () =>
      options?.argumentList?.expression().map((expression) => ({
        simpleIdentifier: expression.getText(),
        parameter: undefined,
        render: () => expression.getText(),
        renderByReference: () => `&${expression.getText()}`,
        planned: options?.plannedArgument ?? {
          passing: { param: undefined, mode: "c" as const },
          form: null,
          cForm: "as-written" as const,
          enumCast: null,
        },
      })) ?? null,
    safeDivisionHelper: null,
  };
}

/** A plan, plus the primary text `runPostfix` renders through the orchestrator. */
interface IMockPostfixPlan extends Omit<
  IPlannedPostfix,
  "base" | "rootParameter"
> {
  readonly primaryText: string;
  /** #1668: the bound base, when a case's chain is not a named primary's */
  readonly base?: IChainBase;
}

function createMockPostfixExpressionContext(
  rootIdentifier: string | undefined,
  ops: TPlannedPostfixOp[],
): IMockPostfixPlan {
  const primaryText = rootIdentifier ?? "expr";

  return {
    primaryText,
    rootIdentifier,
    renderPrimary: () => primaryText,
    ops,
  };
}

/**
 * Run the generator, routing the primary through the orchestrator.
 *
 * The plan carries `renderPrimary`, but most cases below configure what the
 * primary renders as via `createMockOrchestrator({ generatePrimaryExpr })` --
 * so the binding happens here rather than at eighty-two call sites.
 */

/**
 * #1668 review: a declared type as the typer gives it -- what a property of
 * the root measures. A string's C buffer is its own, not a dimension.
 */
function operandOfDeclared(info: TTypeInfo): IOperandType {
  const dimensions = [...(info.arrayDimensions ?? [])];
  if (info.isString) {
    return typed(`string<${info.stringCapacity ?? 0}>`, {
      dimensions: dimensions.slice(0, -1),
      stringCapacity: info.stringCapacity ?? null,
    });
  }
  // The category the typer gives a cnx primitive (#1760 review: a bit
  // range reads its width from it)
  let category: IOperandType["category"] = "none";
  if (/^u\d+$/.test(info.baseType)) category = "unsigned";
  else if (/^i\d+$/.test(info.baseType)) category = "signed";
  else if (/^f\d+$/.test(info.baseType)) category = "floating";
  // a cnx enum, as the typer types one (OperandTyper.namedFacts)
  if (info.isEnum) {
    return typed(info.baseType, {
      dimensions,
      category: "enum",
      enumTypeName: info.baseType,
    });
  }
  return typed(info.baseType, {
    dimensions,
    bitWidth: info.bitWidth || null,
    category,
  });
}

/**
 * #1668 review: each property op's step, as the typer would give it -- the
 * value the chain has reached: the root, a member step's result, an array's
 * element. Cases that describe a member give its step; this carries it on.
 */
function withPropertySteps(
  ops: readonly TPlannedPostfixOp[],
  root: TTypeInfo | undefined,
  rootedAt: string | undefined,
): TPlannedPostfixOp[] {
  let current: IOperandType | null = root ? operandOfDeclared(root) : null;
  // A `this.`/`global.` root consumes its first `.name`, which the typer
  // gives no step: a member lookup, never a property (#212)
  const consumed = rootedAt === "this" || rootedAt === "global" ? 0 : -1;
  return ops.map((op, index) => {
    if (op.kind === "member") {
      if (op.step !== null) {
        current = op.step.after;
        return op;
      }
      if (index !== consumed && PROPERTY_NAMES.has(op.name)) {
        // The typer's answer for these cases: the name reads the property.
        // A root the case does not type is measured as unknown, which is
        // what the render invariants below are asked about
        return { ...op, step: memberStep(current, null, op.name) };
      }
      current = null;
      return op;
    }
    if (op.kind === "subscript") {
      // The typer steps every subscript: what it applies to is the value
      // the chain has reached (#1760 review: a bit range reads its width here)
      const before = current;
      current =
        op.typedAs === "array_element" &&
        current !== null &&
        current.dimensions.length > 0
          ? { ...current, dimensions: current.dimensions.slice(1) }
          : null;
      return op.step !== null
        ? op
        : {
            ...op,
            step: {
              before,
              subscript: op.typedAs,
              after: current,
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
          };
    }
    current = null;
    return op;
  });
}

function runPostfix(
  plan: IMockPostfixPlan,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator & IPostfixPlannerStub,
) {
  // The chain's bound base, as the walker plans it: a named primary binds
  // itself, both as the root and as the variable its leading part reaches
  const declared = plan.rootIdentifier
    ? declaredTypes.get(plan.rootIdentifier)
    : undefined;
  return generatePostfixExpression(
    {
      ...plan,
      rootParameter: plan.rootIdentifier
        ? state.currentParameters.get(plan.rootIdentifier)
        : undefined,
      base: plan.base ?? {
        root: null,
        rootTypeInfo: declared,
        typeInfo: declared,
        last: undefined,
      },
      renderPrimary: () =>
        orchestrator.generatePrimaryExpr({
          getText: () => plan.primaryText,
        } as unknown as Parser.PrimaryExpressionContext),
      // Issue #1094's fold is configured per case as the orchestrator's
      // `tryEvaluateConstant`, so it is bound here for the same reason the
      // primary is.
      ops: withPropertySteps(plan.ops, declared, plan.rootIdentifier).map(
        (op) => {
          if (op.kind !== "subscript") return op;
          const widthText = (op as { widthText?: string }).widthText ?? "";
          return {
            ...op,
            foldWidth: () =>
              orchestrator.tryEvaluateConstant({
                getText: () => widthText,
              } as unknown as Parser.ExpressionContext),
          };
        },
      ),
    },
    input,
    state,
    orchestrator,
  );
}

// ========================================================================
// Tests
// ========================================================================

describe("PostfixExpressionGenerator", () => {
  // Reset TranspileState before each test to avoid state pollution
  beforeEach(() => {
    sharedState = new TranspileState();
    // Render runs against a program (#1668); `this.member` asks it whether
    // the member is a private const (#1739)
    sharedState.program = {
      // the C name 3-Declare gives a scope member (#2116)
      memberOf: (scopePath: string, name: string) => ({
        fullyQualifiedCName: `${scopePath}__${name}`,
      }),
      symbolTable: () => new SymbolTable(),
      symbolByCName: () => undefined,
      settledConstOf: () => null,
    } as unknown as IProgram;
    sharedState.symbols = createMockSymbols();
    sharedState.sourcePath = "test.cnx";
  });

  describe("basic expression generation", () => {
    it("generates simple identifier", () => {
      const ctx = createMockPostfixExpressionContext("x", []);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "x",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("x");
      expect(result.effects).toHaveLength(0);
    });

    /**
     * ADR-006: a struct parameter used as a whole value is the struct it
     * points at -- `(*point)` in C, the reference itself in C++.
     *
     * ADR-030 / #1722: an opaque handle is registered struct-like too, since
     * its type is a typedef'd struct, but its value IS the pointer, so it is
     * never dereferenced. The C++ rows are the reason this went unseen: there
     * the struct row renders the bare name as well, so the two only differ in C.
     * An array of handles is the array itself (#996): it rendered `(*arr)`.
     *
     * Issue #895: a callback-promoted parameter is a pointer in C++ too, so
     * its whole value is `(*f)` there -- the row that rendered `f`, a `Full*`
     * where a `Full` belongs, while its member access already said `f->`.
     *
     * An array of COMPLETE structs is the array itself, too: `CPoint pts[2]`
     * is already the pointer C passes an array as, and `(*pts)` is its first
     * element. Passed whole to a C function it became `&(*pts)`.
     */
    it.each<[string, string, string, Partial<TParameterInfo>, boolean, string]>(
      [
        ["struct parameter in C", "point", "Point", {}, false, "(*point)"],
        ["struct parameter in C++", "point", "Point", {}, true, "point"],
        [
          "opaque handle in C",
          "dev",
          "Dev",
          { isOpaqueHandle: true },
          false,
          "dev",
        ],
        [
          "opaque handle in C++",
          "dev",
          "Dev",
          { isOpaqueHandle: true },
          true,
          "dev",
        ],
        [
          "array of opaque handles in C",
          "arr",
          "Dev",
          { isOpaqueHandle: true, isArray: true },
          false,
          "arr",
        ],
        [
          "array of complete structs in C",
          "pts",
          "CPoint",
          { isArray: true },
          false,
          "pts",
        ],
        [
          "array of complete structs in C++",
          "pts",
          "CPoint",
          { isArray: true },
          true,
          "pts",
        ],
        [
          "callback-promoted struct parameter in C",
          "f",
          "Full",
          { forcePointerSemantics: true },
          false,
          "(*f)",
        ],
        [
          "callback-promoted struct parameter in C++",
          "f",
          "Full",
          { forcePointerSemantics: true },
          true,
          "(*f)",
        ],
      ],
    )(
      "renders a whole-value %s",
      (_label, name, baseType, overrides, cppMode, expected) => {
        const params = new Map<string, TParameterInfo>([
          [
            name,
            {
              name,
              baseType,
              isArray: false,
              isStruct: true,
              isConst: false,
              isCallback: false,
              isString: false,
              ...overrides,
            },
          ],
        ]);
        const ctx = createMockPostfixExpressionContext(name, []);
        const input = createMockInput();
        const state = createMockState({ currentParameters: params });
        sharedState.cppMode = cppMode;
        const orchestrator = createMockOrchestrator({
          generatePrimaryExpr: () => name,
        });

        const result = runPostfix(ctx, input, state, orchestrator);
        expect(result.code).toBe(expected);
      },
    );
  });

  describe("global prefix handling (ADR-016)", () => {
    it("strips __GLOBAL_PREFIX__ and uses member name", () => {
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "counter" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("counter");
    });

    it("global.x still reaches the global when a local shadows it (ADR-057)", () => {
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "counter" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
      });

      // The shadowing local is emitted under a qualified C name, so the bare
      // spelling here still denotes the global. This used to throw; rejecting
      // it made a language guarantee unusable rather than fixing the codegen.
      const result = runPostfix(ctx, input, state, orchestrator);

      expect(result.code).toBe("counter");
    });

    it("sets struct type for global struct variable", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "config",
          {
            baseType: "Config",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "config" }),
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
        isKnownStruct: (name) => name === "Config",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("config.value");
    });
  });

  describe("this.member handling (ADR-016)", () => {
    it("resolves this.length when length is a scope member", () => {
      const scopeMembers = new Map([["Motor", new Set(["length", "speed"])]]);
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput();
      const state = createMockState({
        currentScopePath: "Motor",
        scopeMembers,
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor__length");
    });

    // #1322: the `this` outside a scope guard this asserted moved to pass 2.1 as
    // E0431, where it carries a real position -- codegen reported it as `1:0`
    // from four identical throws. Codegen is never reached with an empty
    // `currentScopePath` now, because 2.1 halts the pipeline first, so this test
    // drove a state production cannot produce.
    //
    // The rule is covered by `1-Analyze/__tests__/ThisOutsideScopeAnalyzer.test.ts`
    // and by `tests/adr-016/this-outside-scope-error`, which asserts the real
    // line and column and carries in-scope negative controls.

    it("resolves this.member to scope-prefixed name", () => {
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "speed" }),
      ]);
      const symbols = createMockSymbols();
      const input = createMockInput({ symbols });
      const state = createMockState({
        currentScopePath: "Motor",
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor__speed");
    });

    it("resolves this.member to the program's settled const value", () => {
      // #1739: the value 1.4 settled, not the initializer's text
      const constSymbol = {
        kind: "variable",
        fullyQualifiedCName: "Motor__MAX_SPEED",
        scopePath: "Motor",
        visibility: "private",
        isConst: true,
        isArray: false,
        type: { kind: "primitive", primitive: "u32" },
        initialValue: "LIMIT * 2",
        initialValueExpr: { kind: "binary" },
      };
      const program = {
        // the C name 3-Declare gives a scope member (#2116)
        memberOf: (scopePath: string, name: string) => ({
          fullyQualifiedCName: `${scopePath}__${name}`,
        }),
        symbolTable: () => new SymbolTable(),
        symbolByCName: (cName: string) =>
          cName === "Motor__MAX_SPEED" ? constSymbol : undefined,
        settledConstOf: (cName: string) =>
          cName === "Motor__MAX_SPEED"
            ? { kind: "value", digits: "100", typeName: "u32" }
            : null,
      } as unknown as IProgram;
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "MAX_SPEED" }),
      ]);
      sharedState.program = program;
      const input = createMockInput();
      const state = createMockState({
        currentScopePath: "Motor",
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // A literal of the const's u32 type, so the MISRA 7.2 U is on it
      expect(result.code).toBe("100U");
    });

    it("resolves this.member to struct type when member is a struct", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Motor_config",
          {
            baseType: "MotorConfig",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols();
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "config" }),
        createMockPostfixOp({ identifier: "speed" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState({
        currentScopePath: "Motor",
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
        isKnownStruct: (name) => name === "MotorConfig",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor__config.speed");
    });

    it("resolves this.member without struct type when not a known struct", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Motor__value",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols();
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState({
        currentScopePath: "Motor",
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
        isKnownStruct: () => false,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor__value");
    });

    it("resolves this.member when member is a known enum", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Motor__State"]),
      });
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "State" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState({
        currentScopePath: "Motor",
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor__State");
    });
  });

  // Note: .length property tests removed (ADR-058)
  // .length is deprecated - use explicit properties instead:
  // .type_bit_length, .type_byte_length, .type_element_count, .value_char_count

  describe(".length property deprecation", () => {
    it("throws deprecation error for .length property access", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0886 rejects this in pass 2.1",
      );
    });
  });

  describe(".capacity property", () => {
    it("returns string capacity", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "capacity" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("64");
    });
  });

  describe(".size property", () => {
    it("returns capacity + 1 for string", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "size" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("65");
    });
  });

  describe("struct member .capacity and .size", () => {
    it("returns capacity for struct member string via alice.name.capacity", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "alice",
          {
            baseType: "Person",
            bitWidth: 0,
            isArray: false,
            isConst: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("alice", [
        createMockPostfixOp({
          identifier: "name",
          step: memberStep(
            typed("Person"),
            typed("string<64>", { stringCapacity: 64 }),
          ),
        }),
        createMockPostfixOp({ identifier: "capacity" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "alice",
        isKnownStruct: (name) => name === "Person",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("64");
    });

    it("returns size for struct member string via alice.name.size", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "alice",
          {
            baseType: "Person",
            bitWidth: 0,
            isArray: false,
            isConst: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("alice", [
        createMockPostfixOp({
          identifier: "name",
          step: memberStep(
            typed("Person"),
            typed("string<64>", { stringCapacity: 64 }),
          ),
        }),
        createMockPostfixOp({ identifier: "size" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "alice",
        isKnownStruct: (name) => name === "Person",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("65");
    });
  });

  describe("bitmap field access", () => {
    it("generates bitmap field read", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([
          ["Status", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "status",
          {
            baseType: "Status",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isBitmap: true,
            bitmapTypeName: "Status",
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("status", [
        createMockPostfixOp({ identifier: "Running" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "status",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((status >> 0) & 1)");
    });

    it("asserts the invariant for an unknown bitmap field", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([["Status", new Map()]]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "status",
          {
            baseType: "Status",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isBitmap: true,
            bitmapTypeName: "Status",
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("status", [
        createMockPostfixOp({ identifier: "Unknown" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "status",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0882 rejects this in pass 2.1",
      );
    });
  });

  describe("scope member access", () => {
    it("generates cross-scope function call", () => {
      const ctx = createMockPostfixExpressionContext("LED", [
        createMockPostfixOp({ identifier: "on" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "LED",
        isKnownScope: (name) => name === "LED",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("LED__on");
    });

    it("uses :: separator for C++ mode", () => {
      const ctx = createMockPostfixExpressionContext("LED", [
        createMockPostfixOp({ identifier: "on" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "LED",
        isKnownScope: (name) => name === "LED",
        isCppScopeSymbol: () => true,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("LED::on");
    });
  });

  describe("enum member access", () => {
    it("generates enum member access", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
        memberCNames: new Map([["Color", new Map([["Red", "Color__Red"]])]]),
      });
      const ctx = createMockPostfixExpressionContext("Color", [
        createMockPostfixOp({ identifier: "Red" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Color",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Color__Red");
    });

    it("allows enum access without global prefix when no naming conflict", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
        memberCNames: new Map([["Color", new Map([["Red", "Color__Red"]])]]),
      });
      const ctx = createMockPostfixExpressionContext("Color", [
        createMockPostfixOp({ identifier: "Red" }),
      ]);
      const input = createMockInput({ symbols });
      const scopeMembers = new Map([["Motor", new Set(["speed"])]]);
      const state = createMockState({
        currentScopePath: "Motor",
        scopeMembers,
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Color",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Color__Red");
    });
  });

  describe("register member access", () => {
    it("generates register member access", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
        memberCNames: new Map([["GPIO", new Map([["PIN0", "GPIO__PIN0"]])]]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "PIN0" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("GPIO__PIN0");
    });

    it("allows register access without global prefix when no naming conflict", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
        memberCNames: new Map([["GPIO", new Map([["PIN0", "GPIO__PIN0"]])]]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "PIN0" }),
      ]);
      const input = createMockInput({ symbols });
      const scopeMembers = new Map([["Motor", new Set(["speed"])]]);
      const state = createMockState({
        currentScopePath: "Motor",
        scopeMembers,
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("GPIO__PIN0");
    });
  });

  describe("struct parameter access", () => {
    it("uses -> for struct parameter member access in C mode", () => {
      const params = new Map<string, TParameterInfo>([
        [
          "point",
          {
            name: "point",
            baseType: "Point",
            isArray: false,
            isStruct: true,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("point", [
        createMockPostfixOp({ identifier: "x", appliesToRoot: true }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      sharedState.cppMode = false;
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "point",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("point->x");
    });

    it("uses . for struct parameter member access in C++ mode", () => {
      const params = new Map<string, TParameterInfo>([
        [
          "point",
          {
            name: "point",
            baseType: "Point",
            isArray: false,
            isStruct: true,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("point", [
        createMockPostfixOp({ identifier: "x" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      sharedState.cppMode = true;
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "point",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("point.x");
    });
  });

  describe("array subscript access", () => {
    it("generates array index access", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [10],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ expressions: [createMockExpression("5")] }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
        generateExpression: () => "5",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("arr[5]");
    });

    it("generates bit access for integer type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("3")],
          typedAs: "bit_single",
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: () => "3",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val >> 3) & 1)");
    });

    it("generates register bit access", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
        generateExpression: () => "0",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // Optimization: no shift when index is 0
      expect(result.code).toBe("((GPIO) & 1)");
    });

    it("asserts the invariant for bracket indexing on a bitmap type", () => {
      // #1322: ADR-034's rule is E0883 in pass 2.1; the invariant is what
      // remains. It keys on the member's type being a KNOWN bitmap, so the
      // mock now declares one -- a register member typed by a bitmap the
      // symbols do not carry is a different fault, and conflating the two is
      // how the old check ended up unable to see a bitmap variable at all.
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
        knownBitmaps: new Set(["CtrlBits"]),
        registerMemberCTypes: new Map([["GPIO__CTRL", "CtrlBits"]]),
        memberCNames: new Map([["GPIO", new Map([["CTRL", "GPIO__CTRL"]])]]),
        bitmapFields: new Map([
          ["CtrlBits", new Map([["ENABLE", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "CTRL" }),
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
        generateExpression: () => "0",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0883 rejects this in pass 2.1",
      );
    });
  });

  describe("bit range access", () => {
    it("generates bit range extraction", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("4"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val >> 4) & 0xFFU)");
    });

    it("optimizes bit range at position 0", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val) & 0xFFU)");
    });

    // Issue #1094: a const/macro width must be resolved to its numeric value (with
    // a "U" suffix to match the literal path) before mask generation, instead of
    // being passed through as the identifier — otherwise the mask falls back to a
    // runtime ((1U << W) - 1) that is UB at full width.
    it("resolves a const width to a precomputed mask (#1094)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [
            createMockExpression("0"),
            createMockExpression("WIDTH"),
          ],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
        tryEvaluateConstant: () => 32,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // Width resolved to 32 (not the identifier "WIDTH"), so the mask is a literal
      expect(result.code).toBe("((val) & 0xFFFFFFFFU)");
    });

    it("computes a run-time width's mask in the operand's width (#1094, #1668)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("0"), createMockExpression("n")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
        tryEvaluateConstant: () => undefined,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // `1U << n` is 16 bits wide where int is, so a u32's mask is computed in 32
      expect(result.code).toBe("((val) & (((uint32_t)1U << n) - 1U))");
    });

    it("writes a u64 operand's const-width mask as a 64-bit literal (#1094)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          { baseType: "u64", bitWidth: 64, isArray: false, isConst: false },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [
            createMockExpression("0"),
            createMockExpression("WIDTH"),
          ],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
        tryEvaluateConstant: () => 40,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // Never a 32-bit shift: the 40 ones are written out
      expect(result.code).toBe("((val) & 0xFFFFFFFFFFU)");
    });
  });

  describe("float bit indexing", () => {
    it("generates float bit range with union-based type punning", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "f",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("f", [
        createMockPostfixOp({
          floatBits: { floatType: "f32", shared: true },
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: true });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "f",
        generateExpression: (ctx) => ctx.getText(),
        hasFloatBitShadow: () => false,
        isFloatShadowCurrent: () => false,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // Uses union member .u for bit access, not memcpy
      expect(result.code).toContain("__bits_f.u");
      expect(result.code).not.toContain("memcpy");
    });

    it("throws for float bit indexing at global scope", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "f",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("f", [
        createMockPostfixOp({
          floatBits: { floatType: "f32", shared: true },
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: false });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "f",
        generateExpression: (ctx) => ctx.getText(),
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0888 rejects this in pass 2.1",
      );
    });

    it("uses union member when shadow is current (no re-assignment)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "f",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("f", [
        createMockPostfixOp({
          floatBits: { floatType: "f32", shared: true },
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: true });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "f",
        generateExpression: (ctx) => ctx.getText(),
        hasFloatBitShadow: () => true,
        isFloatShadowCurrent: () => true,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).not.toContain("memcpy");
      // Uses union member .u for bit access
      expect(result.code).toBe("(__bits_f.u & 0xFFU)");
    });

    // Issue #1094: the float branch must resolve a const width too.
    it("resolves a const width for f64 bit indexing (#1094)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "d",
          { baseType: "f64", bitWidth: 64, isArray: false, isConst: false },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("d", [
        createMockPostfixOp({
          floatBits: { floatType: "f64", shared: true },
          expressions: [
            createMockExpression("0"),
            createMockExpression("WIDTH"),
          ],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: true });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "d",
        generateExpression: (ctx) => ctx.getText(),
        tryEvaluateConstant: () => 64,
        hasFloatBitShadow: () => true,
        isFloatShadowCurrent: () => true,
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("(__bits_d.u & 0xFFFFFFFFFFFFFFFFU)");
    });
  });

  describe("function call", () => {
    it("generates function call", () => {
      const ctx = createMockPostfixExpressionContext("foo", [
        createMockPostfixOp({
          argumentList: {
            expression: () => [createMockExpression("1")],
          } as unknown as Parser.ArgumentListContext,
        }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "foo",
        generateExpression: () => "1",
        generateFunctionArg: () => "1",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toContain("foo");
    });

    /**
     * ADR-029: a value of a callback type is called with that type's
     * parameters -- here `peek`'s, whose struct parameter takes the argument
     * by reference. 2.2 decides that (#1991); 2.3 writes the argument the way
     * 2.2 planned it.
     */
    it.each<[string, string | undefined, "c" | "reference", string]>([
      ["a callback-typed field", "peek", "reference", "h.onPeek(&p)"],
      ["an untyped callee", undefined, "c", "h.onPeek(p)"],
    ])(
      "calls %s with the parameters its type names",
      (_l, calleeType, mode, code) => {
        const ctx = createMockPostfixExpressionContext("h", [
          createMockPostfixOp({ identifier: "onPeek" }),
          createMockPostfixOp({
            argumentList: {
              expression: () => [createMockExpression("p")],
            } as unknown as Parser.ArgumentListContext,
            calleeType,
            plannedArgument: {
              passing: {
                param:
                  mode === "c"
                    ? undefined
                    : { baseType: "Point", isConst: true },
                mode,
              },
              form: mode === "c" ? null : { kind: "identifier" },
              cForm: mode === "c" ? "as-written" : null,
              enumCast: null,
            },
          }),
        ]);
        const input = {
          ...createMockInput(),
          functionSignatures: new Map([
            [
              "peek",
              {
                name: "peek",
                parameters: [
                  {
                    name: "p",
                    baseType: "Point",
                    isConst: false,
                    isArray: false,
                  },
                ],
              },
            ],
          ]),
          callbackTypes: new Map([
            [
              "peek",
              {
                functionName: "peek",
                returnType: "uint32_t",
                parameters: [],
                typedefName: "peek_fp",
              },
            ],
          ]),
        } as IGeneratorInput;
        const orchestrator = Object.assign(
          createMockOrchestrator({ generatePrimaryExpr: () => "h" }),
          {
            isCnxFunction: vi.fn((name: string) => name === "peek"),
            isKnownStruct: vi.fn(() => true),
          },
        );

        const result = runPostfix(ctx, input, createMockState(), orchestrator);
        expect(result.code).toBe(code);
      },
    );
  });

  describe("non-array parameter subscript (Issue #579)", () => {
    it("uses parameter name directly for non-array param with subscript", () => {
      // Issue #579: Non-array parameters become pointers in C (ADR-006)
      // so buf[i] should be array access, not bit access
      const params = new Map<string, TParameterInfo>([
        [
          "buf",
          {
            name: "buf",
            baseType: "u8",
            isArray: false,
            isStruct: false,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("buf", [
        createMockPostfixOp({ expressions: [createMockExpression("3")] }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      const orchestrator = createMockOrchestrator({
        generateExpression: () => "3",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      // Non-array parameters use array access (they become pointers in C)
      expect(result.code).toBe("buf[3]");
    });

    it("uses bit access for scalar variable (not parameter) with subscript", () => {
      // Scalar variables that are NOT parameters should use bit access
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
            // Note: no isParameter flag
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("3")],
          typedAs: "bit_single",
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: () => "3",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val >> 3) & 1)");
    });
  });

  describe("C++ scope symbols (Issue #516)", () => {
    it("uses :: separator when primary is C++ scope symbol", () => {
      const ctx = createMockPostfixExpressionContext("std", [
        createMockPostfixOp({ identifier: "cout" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "std",
        isCppScopeSymbol: (name) => name === "std",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("std::cout");
    });

    // #1695: a call's result is a value, not a namespace path
    it("joins a member of a namespace call's result with .", () => {
      const ctx = createMockPostfixExpressionContext("Dev", [
        createMockPostfixOp({ identifier: "read" }),
        createMockPostfixOp({ argumentList: { expression: () => [] } }),
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Dev",
        isCppScopeSymbol: (name) => name === "Dev",
      });

      const result = runPostfix(
        ctx,
        createMockInput(),
        createMockState(),
        orchestrator,
      );
      expect(result.code).toBe("Dev::read().value");
    });

    // #1695: `::` continues through a nested namespace and ends at its variable
    it("joins a member of a namespace variable with .", () => {
      const ctx = createMockPostfixExpressionContext("Dev", [
        createMockPostfixOp({ identifier: "Inner" }),
        createMockPostfixOp({ identifier: "cfg" }),
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Dev",
        isCppScopeSymbol: (name) => name === "Dev" || name === "Dev::Inner",
      });

      const result = runPostfix(
        ctx,
        createMockInput(),
        createMockState(),
        orchestrator,
      );
      expect(result.code).toBe("Dev::Inner::cfg.value");
    });
  });

  describe("global access edge cases", () => {
    it("uses :: when a global member is a C++ scope symbol", () => {
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "std" }),
        createMockPostfixOp({ identifier: "cout" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
        isCppScopeSymbol: (name) => name === "std",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("std::cout");
    });

    it("sets isRegisterChain when global member is a register", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
        memberCNames: new Map([["GPIO", new Map([["PIN0", "GPIO__PIN0"]])]]),
      });
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "GPIO" }),
        createMockPostfixOp({ identifier: "PIN0" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("GPIO__PIN0");
    });
  });

  describe("this.length as scope member", () => {
    // #1322: the `this` outside a scope guard this asserted moved to pass 2.1 as
    // E0431, where it carries a real position -- codegen reported it as `1:0`
    // from four identical throws. Codegen is never reached with an empty
    // `currentScopePath` now, because 2.1 halts the pipeline first, so this test
    // drove a state production cannot produce.
    //
    // The rule is covered by `1-Analyze/__tests__/ThisOutsideScopeAnalyzer.test.ts`
    // and by `tests/adr-016/this-outside-scope-error`, which asserts the real
    // line and column and carries in-scope negative controls.

    it("resolves this.length to scope member when length is a struct type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Motor__length",
          {
            baseType: "LengthConfig",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const scopeMembers = new Map([["Motor", new Set(["length", "speed"])]]);
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "length" }),
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({
        currentScopePath: "Motor",
        scopeMembers,
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
        isKnownStruct: (name) => name === "LengthConfig",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor__length.value");
    });
  });

  describe("register member with bitmap type", () => {
    it("generates bitmap field access on register member", () => {
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["CtrlBits"]),
        registerMemberCTypes: new Map([["MOTOR__CTRL", "CtrlBits"]]),
        bitmapFields: new Map([
          ["CtrlBits", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockPostfixExpressionContext("MOTOR__CTRL", [
        createMockPostfixOp({ identifier: "Running" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "MOTOR__CTRL",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((MOTOR__CTRL >> 0) & 1)");
    });

    it("asserts the invariant for an unknown field on a register bitmap member", () => {
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["CtrlBits"]),
        registerMemberCTypes: new Map([["MOTOR__CTRL", "CtrlBits"]]),
        bitmapFields: new Map([["CtrlBits", new Map()]]),
      });
      const ctx = createMockPostfixExpressionContext("MOTOR__CTRL", [
        createMockPostfixOp({ identifier: "Unknown" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "MOTOR__CTRL",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0882 rejects this in pass 2.1",
      );
    });
  });

  describe("struct member with bitmap type", () => {
    it("generates bitmap field access on struct member", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([
          ["StatusBits", new Map([["Active", { offset: 0, width: 1 }]])],
        ]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "device",
          {
            baseType: "Device",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("device", [
        createMockPostfixOp({
          identifier: "flags",
          step: memberStep(
            typed("Device"),
            typed("StatusBits", { bitmapTypeName: "StatusBits" }),
          ),
        }),
        createMockPostfixOp({
          identifier: "Active",
          step: memberStep(
            typed("StatusBits", { bitmapTypeName: "StatusBits" }),
            null,
          ),
        }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "device",
        isKnownStruct: (name) => name === "Device",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("((device.flags >> 0) & 1)");
    });

    it("asserts the invariant for an unknown bitmap field on a struct member", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([["StatusBits", new Map()]]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "device",
          {
            baseType: "Device",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("device", [
        createMockPostfixOp({
          identifier: "flags",
          step: memberStep(
            typed("Device"),
            typed("StatusBits", { bitmapTypeName: "StatusBits" }),
          ),
        }),
        createMockPostfixOp({
          identifier: "Unknown",
          step: memberStep(
            typed("StatusBits", { bitmapTypeName: "StatusBits" }),
            null,
          ),
        }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "device",
        isKnownStruct: (name) => name === "Device",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0882 rejects this in pass 2.1",
      );
    });
  });

  describe("multi-dimensional array access", () => {
    it("tracks remaining dimensions through subscripts", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "matrix",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [3, 4],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("matrix", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
        createMockPostfixOp({ expressions: [createMockExpression("1")] }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "matrix",
        generateExpression: (ctx) => ctx.getText(),
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("matrix[0][1]");
    });
  });

  // ========================================================================
  // ADR-058: Explicit Length Properties
  // ========================================================================

  describe(".type_bit_length property (ADR-058)", () => {
    it("returns bit width for integer type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("32");
    });

    it("returns the fewest bits that hold every member for an enum type", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "color",
          {
            baseType: "Color",
            bitWidth: 32,
            isArray: false,
            isConst: false,
            isEnum: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("color", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "color",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("2");
    });

    it("returns total bits for array type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [16],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("512"); // 16 * 32 = 512
    });

    it("returns buffer bits for string type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("512"); // (64 + 1) * 8 = 520
    });
  });

  describe(".type_byte_length property (ADR-058)", () => {
    it("returns byte size for integer type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "type_byte_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("4"); // 32 / 8 = 4
    });

    it("returns total bytes for array type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [16],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "type_byte_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("64"); // 16 * 4 = 64
    });

    it("returns buffer bytes for string type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "type_byte_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("64"); // the 64 chars, no terminator
    });
  });

  describe(".type_element_count property (ADR-058)", () => {
    it("returns element count for array type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [16],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("16");
    });

    it("returns argc for main args", () => {
      const ctx = createMockPostfixExpressionContext("args", [
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ mainArgsName: "args" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "args",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("argc");
    });

    it("throws error for non-array type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0867 rejects this in pass 2.1",
      );
    });
  });

  describe(".value_char_count property (ADR-058)", () => {
    it("returns strlen for string type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "value_char_count" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("strlen(str)");
    });

    it("throws error for a float, which prints in more than one way", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "value_char_count" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        ".value_char_count is not available on the float 'f32'",
      );
    });

    it("throws error for args", () => {
      const ctx = createMockPostfixExpressionContext("args", [
        createMockPostfixOp({ identifier: "value_char_count" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ mainArgsName: "args" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "args",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        ".value_char_count is not available on 'args'",
      );
    });
  });

  describe("explicit length edge cases (ADR-058)", () => {
    // #1760 review: this returned a literal 0 behind a comment naming the
    // dimension; the product is now C's to fold, in uint32_t
    it.each([
      ["type_bit_length", ["BUFFER_SIZE"], "((uint32_t)(BUFFER_SIZE) * 32U)"],
      ["type_byte_length", ["BUFFER_SIZE"], "((uint32_t)(BUFFER_SIZE) * 4U)"],
      ["type_bit_length", [2, "N"], "((uint32_t)2U * (N) * 32U)"],
    ])(
      "returns the C product for .%s of an array sized %j",
      (property, dimensions, expected) => {
        const typeRegistry = new Map<string, TTypeInfo>([
          [
            "arr",
            {
              baseType: "u32",
              bitWidth: 32,
              isArray: true,
              arrayDimensions: dimensions as unknown as number[], // C macros
              isConst: false,
            },
          ],
        ]);
        const ctx = createMockPostfixExpressionContext("arr", [
          createMockPostfixOp({ identifier: property as string }),
        ]);
        const input = createMockInput({ typeRegistry });
        const state = createMockState();
        const orchestrator = createMockOrchestrator({
          generatePrimaryExpr: () => "arr",
        });

        const result = runPostfix(ctx, input, state, orchestrator);
        expect(result.code).toBe(expected);
      },
    );

    it("returns C macro name for element_count with dynamic dimension", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: ["BUFFER_SIZE" as unknown as number], // C macro
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("BUFFER_SIZE");
    });

    it("throws error for bit_length on args", () => {
      const ctx = createMockPostfixExpressionContext("args", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ mainArgsName: "args" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "args",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        ".type_bit_length is not available on 'args'",
      );
    });

    it("throws error for byte_length on args", () => {
      const ctx = createMockPostfixExpressionContext("args", [
        createMockPostfixOp({ identifier: "type_byte_length" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ mainArgsName: "args" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "args",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        ".type_byte_length is not available on 'args'",
      );
    });

    it.each([
      ["throws error for unknown type type_bit_length", "type_bit_length"],
      ["throws error for unknown type type_byte_length", "type_byte_length"],
      [
        "throws error for unknown type type_element_count",
        "type_element_count",
      ],
    ])("%s", (_label, expected) => {
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: expected }),
      ]);
      const input = createMockInput({ typeRegistry: new Map() });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      // #1668 review: a subject the typer cannot type is E0867's in 2.1
      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0867 rejects this in pass 2.1",
      );
    });

    it("throws error for string without capacity", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            // No stringCapacity set
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "unknown capacity",
      );
    });

    it("handles struct field bit_length for string member", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "obj",
          {
            baseType: "MyStruct",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols({
        knownStructs: new Set(["MyStruct"]),
        knownScopes: new Set<string>(),
      });
      const ctx = createMockPostfixExpressionContext("obj", [
        createMockPostfixOp({
          identifier: "name",
          step: memberStep(
            typed("MyStruct"),
            typed("string<32>", { stringCapacity: 32 }),
          ),
        }),
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "obj",
        isKnownStruct: (name) => name === "MyStruct",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("256"); // (32 + 1) * 8 = 264
    });

    it("handles struct field byte_length", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "obj",
          {
            baseType: "MyStruct",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols({
        knownStructs: new Set(["MyStruct"]),
        knownScopes: new Set<string>(),
      });
      const ctx = createMockPostfixExpressionContext("obj", [
        createMockPostfixOp({
          identifier: "value",
          step: memberStep(typed("MyStruct"), typed("u16")),
        }),
        createMockPostfixOp({ identifier: "type_byte_length" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "obj",
        isKnownStruct: (name) => name === "MyStruct",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("2"); // 16 / 8 = 2
    });

    it("handles struct field element_count for array member", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "obj",
          {
            baseType: "MyStruct",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols({
        knownStructs: new Set(["MyStruct"]),
        knownScopes: new Set<string>(),
      });
      const ctx = createMockPostfixExpressionContext("obj", [
        createMockPostfixOp({
          identifier: "data",
          step: memberStep(
            typed("MyStruct"),
            typed("u8", { dimensions: [64] }),
          ),
        }),
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "obj",
        isKnownStruct: (name) => name === "MyStruct",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("64");
    });

    it("throws for struct field element_count on non-array member", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "obj",
          {
            baseType: "MyStruct",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols({
        knownStructs: new Set(["MyStruct"]),
        knownScopes: new Set<string>(),
      });
      const ctx = createMockPostfixExpressionContext("obj", [
        createMockPostfixOp({ identifier: "value" }),
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "obj",
        isKnownStruct: (name) => name === "MyStruct",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0867 rejects this in pass 2.1",
      );
    });

    it("handles struct field char_count for string member", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "obj",
          {
            baseType: "MyStruct",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols({
        knownStructs: new Set(["MyStruct"]),
        knownScopes: new Set<string>(),
      });
      const ctx = createMockPostfixExpressionContext("obj", [
        createMockPostfixOp({
          identifier: "name",
          step: memberStep(
            typed("MyStruct"),
            typed("string<32>", { stringCapacity: 32 }),
          ),
        }),
        createMockPostfixOp({ identifier: "value_char_count" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "obj",
        isKnownStruct: (name) => name === "MyStruct",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("strlen(obj.name)");
    });

    it("throws for struct field char_count on non-string member", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "obj",
          {
            baseType: "MyStruct",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols({
        knownStructs: new Set(["MyStruct"]),
        knownScopes: new Set<string>(),
      });
      const ctx = createMockPostfixExpressionContext("obj", [
        createMockPostfixOp({ identifier: "value" }),
        createMockPostfixOp({ identifier: "value_char_count" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "obj",
        isKnownStruct: (name) => name === "MyStruct",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0867 rejects this in pass 2.1",
      );
    });

    it("throws error for unknown type char_count", () => {
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "value_char_count" }),
      ]);
      const input = createMockInput({ typeRegistry: new Map() });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      // #1668 review: a subject the typer cannot type is E0867's in 2.1
      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0867 rejects this in pass 2.1",
      );
    });

    it("throws error for array with unknown dimensions for element_count", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [], // Empty dimensions
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "type_element_count" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "E0867 rejects this in pass 2.1",
      );
    });

    // #1668 review: this case used to declare an array with no dimensions,
    // which the typer cannot represent -- an unresolved dimension keeps its
    // text (the dynamic-dimension cases above). What it measures instead:
    it("measures a string array's whole storage (ADR-058)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "names",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: [3, 9],
            isConst: false,
            isString: true,
            stringCapacity: 8,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("names", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "names",
      });

      // Three elements of (8 + 1) x 8 bits: one element's was the old answer
      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("192");
    });

    it("handles enum array bit_length", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
        enumMembers: new Map([
          [
            "Color",
            new Map([
              ["Red", 0],
              ["Green", 1],
              ["Blue", 2],
            ]),
          ],
        ]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "colors",
          {
            baseType: "Color",
            bitWidth: 0, // Not set, should infer from isEnum
            isArray: true,
            arrayDimensions: [4],
            isConst: false,
            isEnum: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("colors", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "colors",
      });

      const result = runPostfix(ctx, input, state, orchestrator);
      expect(result.code).toBe("8"); // 4 * 2: three members need 2 bits
    });

    it("throws error for unsupported element type in array", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "void", // Unsupported type
            bitWidth: 0,
            isArray: true,
            arrayDimensions: [4],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "type_bit_length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      expect(() => runPostfix(ctx, input, state, orchestrator)).toThrow(
        "unsupported type 'void'",
      );
    });
  });
});
