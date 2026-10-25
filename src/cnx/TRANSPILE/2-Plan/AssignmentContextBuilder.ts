/**
 * Builder for IAssignmentContext (ADR-065).
 *
 * Extracts all context from an assignment statement parse tree needed for
 * classification and code generation.
 *
 * ## The context carries no parse nodes (#1445 box 3)
 *
 * It used to carry five: the statement, the target, the value, the subscript
 * expressions and the postfix operations. Every consumer of those five asked a
 * bounded set of questions -- render this target, analyze it for bit access,
 * what type is the value, fold this subscript, how many subscripts are there --
 * so the context carries the answers and the renders, and the walk stays here.
 *
 * That also fixes an under-measurement. `parse-tree-sites` counts
 * modules that NAME a parse type, so the four handler files that read
 * `ctx.valueCtx` and `ctx.subscripts[0]` off this interface -- parse contexts
 * until #1950, plain `TExpression`s since -- held parse trees
 * without ever being counted -- the contract was acting as an unsanctioned
 * carrier. They hold no nodes now, and the two modules that did name types are
 * out of the population for real rather than by spelling.
 */
import AssignmentTarget from "../../utils/AssignmentTarget";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import type IChainStep from "../../types/IChainStep";
import IAssignmentContext from "./types/IAssignmentContext";
import IBitAccessAnalysis from "../../types/IBitAccessAnalysis";
import TPlannedTargetOp from "../../types/TPlannedTargetOp";
import type IChainBase from "../../types/IChainBase";
import type TranspileState from "../TranspileState";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import OperandTyper from "../../utils/OperandTyper";
import BitUtils from "../../utils/BitUtils";

/**
 * Dependencies for building context.
 */
interface IContextBuilderDeps extends Pick<
  IAssignmentContext,
  | "floatBits"
  | "bitmapField"
  | "atomic"
  | "plannedClamp"
  | "plannedSliceSource"
  | "plannedStringCapacity"
  | "plannedStringParts"
  | "plannedWholeArray"
  | "plannedCompoundCast"
  | "plannedRegisterAccess"
> {
  /** #1668: what the target writes, bound where it was typed */
  readonly target: IChainBase;

  /**
   * 2.3 Render's per-file working state (#1452 box 4), carried onto the built
   * context so the handlers that receive it have a channel to the same
   * instance rather than reaching for a mutable static.
   */
  readonly state: TranspileState;

  /**
   * The value expression, already generated.
   *
   * Takes no argument: `CodeGenerator.generateAssignment` renders the
   * right-hand side and passes the result, so this must not render it a
   * second time.
   */
  generatedValue(): string;

  /**
   * Generate the fully-resolved assignment target with scope prefixes, or
   * its first `opCount` postfix operations
   */
  generateAssignmentTarget(target: TExpression, opCount?: number): string;

  /** ADR-034: analyze the target's member chain for bit access */
  analyzeMemberChainForBitAccess(
    target: TExpression,
    lastStep: IChainStep | undefined,
  ): IBitAccessAnalysis;

  /** Generate a subscript expression */
  generateExpression(expr: TExpression): string;

  /** Fold an expression to a compile-time constant */
  tryEvaluateConstant(expr: TExpression): number | undefined;

  /** The written value's compile-time value, for a bit write to fold */
  foldWrittenValue(expr: TExpression): number | undefined;

  /** The value expression's essential type */
  expressionType(expr: TExpression): string | null;

  /** The value expression's integer type */
  integerExpressionType(expr: TExpression): string | null;

  /** #1668: whether any operand of the value expression is floating */
  hasFloatingOperand(expr: TExpression): boolean;

  /**
   * ADR-001's assignment operator mapping, injected rather than imported.
   *
   * This module moved to 2.2 Plan (#1445 box 3) and `AssignmentOperatorMapper`
   * did not: it is the one place a cnx operator BECOMES its C form, which
   * is text, and `2-2-plan-reads-no-later-pass` is `error` and `reachable`. It
   * arrives through the deps the same way the seven render thunks above do --
   * that is what this interface has always been for, not a new indirection
   * invented to satisfy the rule.
   */
  toCOperator(cnxOp: string, line: number | undefined): string;
}

/**
 * Result from extracting identifiers and subscripts from assignment target.
 */
interface ITargetExtraction {
  identifiers: string[];
  subscripts: TExpression[];
  ops: TPlannedTargetOp[];
  hasMemberAccess: boolean;
  hasArrayAccess: boolean;
  /** Number of expressions in the last subscript operation */
  lastSubscriptExprCount: number;
}

/**
 * Extract the base identifier from a resolved target string.
 * Removes subscripts ([...]) from the resolved target.
 * Examples:
 *   "ArrayBug_data[0]" -> "ArrayBug_data"
 *   "matrix[i][j]" -> "matrix"
 *   "item.field" -> "item"
 *   "Motor_speed" -> "Motor_speed"
 */
function extractResolvedBaseIdentifier(resolvedTarget: string): string {
  // Assumes resolvedTarget always starts with a valid identifier (not empty or starting with [ . ->)
  // as generated by generateAssignmentTarget()
  const bracketIndex = resolvedTarget.indexOf("[");
  const dotIndex = resolvedTarget.indexOf(".");
  const arrowIndex = resolvedTarget.indexOf("->");

  // Find the earliest terminator
  let endIndex = resolvedTarget.length;
  if (bracketIndex !== -1 && bracketIndex < endIndex) {
    endIndex = bracketIndex;
  }
  if (dotIndex !== -1 && dotIndex < endIndex) {
    endIndex = dotIndex;
  }
  if (arrowIndex !== -1 && arrowIndex < endIndex) {
    endIndex = arrowIndex;
  }

  return resolvedTarget.substring(0, endIndex);
}

/**
 * Extract base identifier from assignment target.
 * With unified grammar, all patterns use IDENTIFIER postfixTargetOp*.
 */
function extractBaseIdentifier(identifier: string | null): ITargetExtraction {
  const identifiers: string[] = [];

  // All patterns now have a base IDENTIFIER
  if (identifier !== null) {
    identifiers.push(identifier);
  }

  return {
    identifiers,
    subscripts: [],
    ops: [],
    hasMemberAccess: false,
    hasArrayAccess: false,
    lastSubscriptExprCount: 0,
  };
}

/**
 * Process postfix operations and update extraction result.
 * SonarCloud S3776: Extracted from buildAssignmentContext().
 */
function processPostfixOps(
  postfixOps: readonly TPostfixOpSyntax[],
  extraction: ITargetExtraction,
  deps: IContextBuilderDeps,
): void {
  for (const op of postfixOps) {
    if (op.kind === "member") {
      const name = op.name;
      extraction.identifiers.push(name);
      extraction.hasMemberAccess = true;
      extraction.ops.push({ kind: "member", name });
    } else {
      const exprs = op.kind === "subscript" ? op.indexes : [];
      for (const expr of exprs) {
        extraction.subscripts.push(expr);
      }
      extraction.hasArrayAccess = true;
      // Track the expression count of the last subscript operation
      extraction.lastSubscriptExprCount = exprs.length;
      extraction.ops.push({
        kind: "subscript",
        indexCount: exprs.length,
        // A thunk: most chains are not bit accesses, and the walk that reads
        // these decides that from `CodeGenState` alone. Generating an index up
        // front would queue a pending temp for every chain it then rejects.
        renderIndexes: () => exprs.map((expr) => deps.generateExpression(expr)),
        foldWidth: () =>
          exprs.length === 2 ? deps.tryEvaluateConstant(exprs[1]) : undefined,
      });
    }
  }
}

/**
 * Build an IAssignmentContext from a parse tree.
 *
 * #1647: any assignment site -- a statement, or a `for` header's init or
 * update -- so the header is classified and handled exactly as a statement is.
 * SonarCloud S3776: Refactored to use helper functions.
 */
function buildAssignmentContext(
  site: IAssignmentSyntax,
  deps: IContextBuilderDeps,
): IAssignmentContext {
  const targetExpr = site.target;
  const parts = AssignmentTarget.parts(targetExpr);
  const valueExpr = site.value;

  // Extract operator info
  const cnxOp = site.operator;
  const cOp = deps.toCOperator(cnxOp, site.operatorSpan.line);
  const isCompound = cOp !== "=";

  const generatedValue = deps.generatedValue();

  // Generate fully-resolved target (with scope prefixes)
  const resolvedTarget = deps.generateAssignmentTarget(targetExpr);

  // Extract resolved base identifier for type lookups
  // Removes subscripts ([...]) and member access (. or ->) from the end
  const resolvedBaseIdentifier = extractResolvedBaseIdentifier(resolvedTarget);

  // Extract target info
  const hasGlobal = parts.root === "global";
  const hasThis = parts.root === "this";
  const postfixOps = parts.ops;

  // Extract base identifier and process postfix operations
  const extraction = extractBaseIdentifier(parts.identifier);
  processPostfixOps(postfixOps, extraction, deps);

  const {
    identifiers,
    subscripts,
    ops,
    hasMemberAccess,
    hasArrayAccess,
    lastSubscriptExprCount,
  } = extraction;

  // #2251: a bit of a bitmap field is a bit of the bitmap, at the field's
  // offset -- the field's prefix is the target, and its start index shifts
  const fieldBits = deps.target.last?.fieldBits ?? null;
  const bitStart = subscripts.length - lastSubscriptExprCount;
  const renderSubscript = (index: number): string => {
    const text = deps.generateExpression(subscripts[index]);
    if (fieldBits === null || index !== bitStart) return text;
    return BitUtils.shiftedIndex(
      text,
      deps.tryEvaluateConstant(subscripts[index]),
      fieldBits.offset,
    );
  };
  const foldSubscript = (index: number): number | undefined => {
    const folded = deps.tryEvaluateConstant(subscripts[index]);
    if (fieldBits === null || index !== bitStart || folded === undefined) {
      return folded;
    }
    return folded + fieldBits.offset;
  };
  const lastOp = ops.at(-1);
  const targetOps =
    fieldBits === null || lastOp?.kind !== "subscript"
      ? ops
      : [
          ...ops.slice(0, -1),
          {
            ...lastOp,
            renderIndexes: () =>
              lastOp
                .renderIndexes()
                .map((text, at) =>
                  at === 0 ? renderSubscript(bitStart) : text,
                ),
          },
        ];

  // Compute derived properties
  const memberAccessDepth = identifiers.length - 1;
  const subscriptDepth = subscripts.length;

  const isSimpleIdentifier =
    !hasGlobal &&
    !hasThis &&
    !hasMemberAccess &&
    !hasArrayAccess &&
    identifiers.length === 1;

  const isSimpleThisAccess = hasThis && postfixOps.length === 0;

  const isSimpleGlobalAccess = hasGlobal && postfixOps.length === 0;

  return {
    state: deps.state,
    renderTarget: () => deps.generateAssignmentTarget(targetExpr),
    renderBitTarget: () =>
      deps.generateAssignmentTarget(
        targetExpr,
        postfixOps.length - (fieldBits === null ? 1 : 2),
      ),
    analyzeTargetForBitAccess: () =>
      deps.analyzeMemberChainForBitAccess(targetExpr, deps.target.last),
    targetLine: targetExpr.span.line,
    floatBits: deps.floatBits,
    bitmapField: deps.bitmapField,
    atomic: deps.atomic,
    plannedClamp: deps.plannedClamp,
    plannedSliceSource: deps.plannedSliceSource,
    plannedStringCapacity: deps.plannedStringCapacity,
    plannedStringParts: deps.plannedStringParts,
    plannedWholeArray: deps.plannedWholeArray,
    plannedCompoundCast: deps.plannedCompoundCast,
    plannedRegisterAccess: deps.plannedRegisterAccess,
    hasValue: valueExpr.kind !== "missing",
    valueExpressionType: () => deps.expressionType(valueExpr),
    valueIntegerType: () => deps.integerExpressionType(valueExpr),
    valueHasFloatingOperand: () =>
      valueExpr.kind !== "missing" && deps.hasFloatingOperand(valueExpr),
    foldValue: () => deps.foldWrittenValue(valueExpr),
    identifiers,
    subscriptCount: subscripts.length,
    renderSubscript,
    renderExpression: (expr) => deps.generateExpression(expr),
    foldSubscript,
    postfixOps: targetOps,
    hasThis,
    hasGlobal,
    scopePath: OperandTyper.scopePathAt(
      { line: targetExpr.span.line, column: targetExpr.span.column },
      deps.state.typingContext(),
    ),
    hasMemberAccess,
    hasArrayAccess,
    postfixOpsCount: postfixOps.length,
    cnxOp,
    cOp,
    isCompound,
    generatedValue,
    resolvedTarget,
    resolvedBaseIdentifier,
    target: deps.target,
    memberAccessDepth,
    subscriptDepth,
    lastSubscriptExprCount,
    isSimpleIdentifier,
    isSimpleThisAccess,
    isSimpleGlobalAccess,
    targetIndexHasSideEffect: subscripts.some((expr) =>
      OperandTyper.hasSideEffect(expr, deps.state.typingContext()),
    ),
  };
}

export default buildAssignmentContext;
