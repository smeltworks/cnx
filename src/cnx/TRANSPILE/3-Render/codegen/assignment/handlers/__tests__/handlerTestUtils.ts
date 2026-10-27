/**
 * Shared test utilities for assignment handler tests.
 * Provides common mock setup functions to reduce duplication.
 */

import TestSymbolTable from "../../../../../__tests__/TestSymbolTable";
import { vi } from "vitest";
import createMockSymbols from "../../../../../../types/__testUtils__/codeGenSymbolsHelpers";
import TranspileState from "../../../../../TranspileState";
import type ICodeGenApi from "../../../../../types/ICodeGenApi";
import type ICodeGenSymbols from "../../../../../../types/ICodeGenSymbols";
import type TTypeInfo from "../../../../../../types/TTypeInfo";
import type IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import type IChainBase from "../../../../../../types/IChainBase";
import type IChainStep from "../../../../../../types/IChainStep";
import type IOperandType from "../../../../../../types/IOperandType";
import ScopeUtils from "../../../../../../utils/ScopeUtils";
import QualifiedCName from "../../../../../../utils/QualifiedCName";
import TYPE_WIDTH from "../../../../../../types/TYPE_WIDTH";
import TypeCheckUtils from "../../../../../../utils/TypeCheckUtils";
import AssignmentClassifier from "../../../../../2-Plan/AssignmentClassifier";
import BitmapFieldStep from "../../../../../../utils/BitmapFieldStep";

/**
 * Set up mock symbols on state.
 * Provides comprehensive defaults that can be overridden.
 * Issue #831: Also registers struct fields in SymbolTable for single source of truth.
 */
function setupMockSymbols(
  state: TranspileState,
  overrides: Partial<ICodeGenSymbols> = {},
): void {
  state.symbols = {
    ...createMockSymbols(),
    ...overrides,
  };

  // Also register struct fields in SymbolTable (single source of truth)
  if (overrides.structFields) {
    const table = TestSymbolTable.of(state);
    for (const [structName, fields] of overrides.structFields) {
      for (const [fieldName, fieldType] of fields) {
        table.addStructField(structName, fieldName, fieldType);
      }
    }
  }
}

/**
 * The node-taking operations these tests stand in for.
 *
 * #1652: these four used to be declared on `ICodeGenApi` as `ctx: unknown`, and
 * that file said why -- naming the type would have put the production contract
 * in the `parse-tree-confined-to-parser` population. So the contract pretended
 * not to hold a parse node while holding one, and the gate read clean.
 *
 * They had **no production caller**. Declared here instead, where a parse node
 * is honest: `__tests__/` is excluded from that population on purpose, because
 * a fixture builds a tree because that is what it is testing.
 */
interface ITestPlanner {
  generateExpression(ctx: unknown): string;
  generateAssignmentTarget(ctx: unknown): string;
  tryEvaluateConstant(ctx: unknown): number | undefined;
  analyzeMemberChainForBitAccess(ctx: unknown): { isBitAccess: boolean };
}

/**
 * The mock the current test installed, reached DIRECTLY.
 *
 * #1652: the helpers used to route back through
 * `state.requireGenerator()`, which is what kept the four members alive
 * on the production interface. A test holding its own mock needs no production
 * contract to hand it back.
 */
let installed: (ICodeGenApi & ITestPlanner) | null = null;

function planner(): ITestPlanner {
  if (!installed) {
    throw new Error("call HandlerTestUtils.setupMockGenerator(state) first");
  }
  return installed;
}

/**
 * Set up mock generator on state.
 * Common generator methods are pre-mocked with sensible defaults.
 */
function setupMockGenerator(
  state: TranspileState,
  overrides: Record<string, unknown> = {},
): void {
  installed = {
    // No `state` member: #1452 put one on `ICodeGenApi` and nothing read it, so
    // it was deleted (it also closed an import cycle). A handler reaches the
    // state through `IAssignmentContext.state`. Installing it here anyway would
    // be a mock of a member the interface does not have, kept alive by the
    // `as unknown as` cast below.
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi
      .fn()
      .mockImplementation((ctx) => ctx?.mockValue ?? "0"),
    tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
    analyzeMemberChainForBitAccess: vi
      .fn()
      .mockReturnValue({ isBitAccess: false }),
    generateFloatBitWrite: vi.fn().mockReturnValue(null),
    generateAtomicRMW: vi.fn().mockReturnValue("atomic_rmw_result"),
    isKnownScope: vi.fn().mockReturnValue(false),
    isKnownStruct: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as ICodeGenApi & ITestPlanner;

  // Only the members production actually reaches through this door.
  state.generator = installed;
}

/**
 * The subscript accessors an `IAssignmentContext` carries, bound to the mocked
 * generator.
 *
 * #1445: the context used to hand the handlers a node, which they passed to
 * `planner().generateExpression(...)`. It hands them a
 * render now, so the cases keep their stand-in nodes -- the default mock reads
 * `mockValue` off one, and several cases override `generateExpression` or
 * `tryEvaluateConstant` outright -- and this routes through the same mock in
 * the same order.
 */
function subscriptsOf(nodes: readonly unknown[]): {
  subscriptCount: number;
  renderSubscript: (index: number) => string;
  foldSubscript: (index: number) => number | undefined;
} {
  return {
    subscriptCount: nodes.length,
    renderSubscript: (index) => planner().generateExpression(nodes[index]),
    foldSubscript: (index) => planner().tryEvaluateConstant(nodes[index]),
  };
}

/**
 * Create a TTypeInfo with sensible defaults.
 * Only override the fields you care about in tests.
 */
function createTypeInfo(overrides: Partial<TTypeInfo> = {}): TTypeInfo {
  const baseType = overrides.baseType ?? "u32";
  return {
    baseType,
    bitWidth: overrides.bitWidth ?? TYPE_WIDTH[baseType] ?? 32,
    isArray: overrides.isArray ?? false,
    isConst: overrides.isConst ?? false,
    ...overrides,
  };
}

/**
 * Set up TranspileState type registry with typed entries.
 * Entries only need to specify the fields relevant to the test.
 * Uses setVariableTypeInfo to properly populate the registry.
 */
/**
 * #1668 (C7): what each case declares, by the name a target spells it with.
 *
 * Handlers and the classifier read the target's binding (`ctx.target`), not
 * a registry, so `targetOf` builds that binding the way the binder does.
 * Keyed by the state, so a case's fresh state starts with nothing declared.
 */
const declarations = new WeakMap<TranspileState, Map<string, TTypeInfo>>();

function declareTypes(
  state: TranspileState,
  entries: Array<[string, Partial<TTypeInfo>]>,
): void {
  const declared = declarations.get(state) ?? new Map<string, TTypeInfo>();
  declarations.set(state, declared);
  for (const [name, partial] of entries) {
    declared.set(name, createTypeInfo(partial));
  }
}

/**
 * The binding a target's spelling gets: `this.` names the scope member,
 * `global.` the bare name, and a bare name the member, then the global. A root
 * with no type is a scope name, whose `Scope.member` writes the member.
 */
function targetOf(
  state: TranspileState,
  ctx: Pick<
    IAssignmentContext,
    | "identifiers"
    | "resolvedBaseIdentifier"
    | "hasThis"
    | "hasGlobal"
    | "scopePath"
  >,
): IChainBase {
  const declared = declarations.get(state) ?? new Map<string, TTypeInfo>();
  const ids = ctx.identifiers;
  const member = declared.get(ScopeUtils.qualifyInScope(ids[0], ctx.scopePath));
  let rootTypeInfo: TTypeInfo | undefined;
  if (ctx.hasThis) rootTypeInfo = member;
  else if (ctx.hasGlobal) rootTypeInfo = declared.get(ids[0]);
  else rootTypeInfo = member ?? declared.get(ids[0]);
  const typeInfo =
    rootTypeInfo ??
    declared.get(QualifiedCName.fromSourceName(ids.slice(0, 2).join("."))) ??
    declared.get(ctx.resolvedBaseIdentifier);
  // #1668 (C12): no typer ran, so no step; a case that classifies a
  // subscript passes the typer's answer as `target.last` itself
  return { root: null, rootTypeInfo, typeInfo, last: undefined };
}

/** A declared scalar's operand type, as the typer gives it */
function operandOf(
  typeName: string,
  integer: boolean,
  signed: boolean,
): IOperandType {
  let category: IOperandType["category"] = "none";
  if (integer) category = signed ? "signed" : "unsigned";
  else if (typeName.startsWith("f")) category = "floating";
  return {
    typeName,
    cType: null,
    dimensions: [],
    category,
    bitWidth: integer ? TYPE_WIDTH[typeName] : null,
    stringCapacity: null,
    enumTypeName: null,
    bitmapTypeName: null,
    overflow: null,
    hasSideEffect: false,
    form: { kind: "declared" },
    binding: null,
  };
}

/**
 * #1731 review: what the typer says a target writes -- its last step's type,
 * or with no step the variable's. No typer runs here, so a case's declared
 * TTypeInfo stands in for the variable's operand type.
 */
function writtenOf(target: IChainBase): IOperandType | null {
  if (target.last !== undefined) return target.last.after;
  const info = target.typeInfo;
  if (info === undefined) return null;
  const integer = TypeCheckUtils.isInteger(info.baseType);
  return {
    ...operandOf(
      info.baseType,
      integer,
      integer && TypeCheckUtils.isSigned(info.baseType),
    ),
    dimensions: info.arrayDimensions ?? [],
    overflow: info.overflowBehavior ?? null,
  };
}

/** #1991: 2.2's clamp decision for a case, made by the call 2.2 makes */
function plannedClampOf(
  ctx: Pick<IAssignmentContext, "cnxOp" | "valueHasFloatingOperand">,
  target: IChainBase,
): { operation: string; cnxType: string } | null {
  return AssignmentClassifier.clampOfWrite(
    writtenOf(target),
    ctx.cnxOp,
    ctx.valueHasFloatingOperand,
  );
}

/**
 * #1668 review: what a bit write reads off its context, built from a case's
 * flattened subscripts -- the last `lastIndexCount` of them are the bit's --
 * or from the ops a case gives itself. The final op, the target without it
 * (the value whose bits are written), and the typer's step for that value,
 * typed from what the case declared.
 */
function bitWriteOf(
  ctx: Pick<
    IAssignmentContext,
    | "subscriptCount"
    | "renderSubscript"
    | "resolvedBaseIdentifier"
    | "postfixOps"
  >,
  lastIndexCount: 1 | 2,
  declared: TTypeInfo | undefined,
): {
  postfixOps: IAssignmentContext["postfixOps"];
  renderBitTarget: () => string;
  last: IChainStep;
} {
  const leading = ctx.subscriptCount - lastIndexCount;
  const ops: IAssignmentContext["postfixOps"] =
    ctx.postfixOps.length > 0
      ? ctx.postfixOps
      : [
          ...Array.from({ length: leading }, (_, index) => ({
            kind: "subscript" as const,
            indexCount: 1,
            renderIndexes: () => [ctx.renderSubscript(index)],
            foldWidth: () => undefined,
          })),
          {
            kind: "subscript" as const,
            indexCount: lastIndexCount,
            renderIndexes: () =>
              Array.from({ length: lastIndexCount }, (_, i) =>
                ctx.renderSubscript(leading + i),
              ),
            foldWidth: () => undefined,
          },
        ];
  const baseType = declared?.baseType ?? null;
  const signed = baseType !== null && /^i\d/.test(baseType);
  const integer = baseType !== null && /^[ui]\d+$/.test(baseType);
  return {
    postfixOps: ops,
    renderBitTarget: () =>
      ctx.resolvedBaseIdentifier +
      ops
        .slice(0, -1)
        .map((op) =>
          op.kind === "member"
            ? `.${op.name}`
            : `[${op.renderIndexes().join("][")}]`,
        )
        .join(""),
    last: {
      before: baseType === null ? null : operandOf(baseType, integer, signed),
      subscript: lastIndexCount === 2 ? "bit_range" : "bit_single",
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
  };
}

/**
 * ADR-034: `ctx` with 2.2's bitmap-field decision, made by the call 2.2 makes
 * on the target's final step -- after a case has typed that step
 */
function withPlannedBitmapField(
  state: TranspileState,
  ctx: IAssignmentContext,
): IAssignmentContext {
  return {
    ...ctx,
    bitmapField: BitmapFieldStep.fieldOf(
      ctx.target.last,
      state.symbols!.bitmapFields,
    ),
  };
}

export default class HandlerTestUtils {
  static readonly withPlannedBitmapField = withPlannedBitmapField;
  static readonly bitWriteOf = bitWriteOf;
  static readonly operandOf = operandOf;
  static readonly plannedClampOf = plannedClampOf;
  static readonly setupMockSymbols = setupMockSymbols;
  static readonly setupMockGenerator = setupMockGenerator;
  static readonly subscriptsOf = subscriptsOf;
  static readonly planner = planner;
  static readonly declareTypes = declareTypes;
  static readonly targetOf = targetOf;
}
