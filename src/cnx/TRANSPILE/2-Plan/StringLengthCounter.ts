/**
 * StringLengthCounter - Counts .value_char_count accesses on string variables
 *
 * Issue #644: Extracted from CodeGenerator to reduce code duplication.
 * Used for strlen caching optimization - when a string's .value_char_count is accessed
 * multiple times, we cache the strlen result in a temp variable.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 * Updated for ADR-058: .length replaced with .value_char_count
 */

import type TExpression from "../../types/syntax/TExpression";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import type TBlockSyntax from "../../types/syntax/TBlockSyntax";
import type TStatement from "../../types/syntax/TStatement";
import type TranspileState from "../TranspileState";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import AssignmentTarget from "../../utils/AssignmentTarget";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ExpressionShape from "../../utils/ExpressionShape";
import LengthProperty from "../../utils/LengthProperty";
import OperandTyper from "../../utils/OperandTyper";
import StatementNodes from "../../utils/StatementNodes";
import type TEssentialCategory from "../../types/TEssentialCategory";

/** The categories of a scalar that holds no characters */
const SCALAR_CATEGORIES: ReadonlySet<TEssentialCategory> = new Set([
  "signed",
  "unsigned",
  "floating",
  "boolean",
  "enum",
]);

/**
 * Counts .value_char_count accesses on string variables in an expression tree.
 * This enables strlen caching optimization.
 */
class StringLengthCounter {
  /**
   * Count .value_char_count accesses in an expression.
   */
  static countExpression(
    expr: TExpression,
    state: TranspileState,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    StringLengthCounter.walkExpression(expr, counts, state);
    return counts;
  }

  /**
   * Count .value_char_count accesses in a block, adding to existing counts.
   */
  static countBlockInto(
    block: Pick<TBlockSyntax, "statements">,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    for (const stmt of block.statements) {
      StringLengthCounter.walkStatement(stmt, counts, state);
    }
  }

  /**
   * Issue #1958: drop each counted string the region may write, so a length
   * read after the write measures the string as written. A string is written
   * by an assignment to it, nested ones included, and by a call it is passed
   * to. One that is not a local is also written by any call, since the callee
   * can reach it, and by a write to another non-local that may change a
   * string's characters, since the two may name the same string (a parameter
   * bound to a global).
   */
  static dropWrittenIn(
    region: readonly TStatement[],
    counts: Map<string, number>,
    at: ISourcePosition,
    state: TranspileState,
  ): void {
    const writes = StatementNodes.assignmentsIn(region).map((assignment) => ({
      target: assignment.target,
      parts: AssignmentTarget.parts(assignment.target),
    }));
    const assigned = new Set(writes.map(({ parts }) => parts.identifier));
    const writesNonLocalString = writes.some(
      ({ target, parts }) =>
        (parts.root !== null ||
          (parts.identifier !== null &&
            !StringLengthCounter.isLocal(
              parts.identifier,
              parts.position,
              state,
            ))) &&
        StringLengthCounter.mayWriteString(target, state),
    );
    const calls = DeclarationParts.statements(region)
      .flatMap(ExpressionNodes.of)
      .flatMap((node) => (node.kind === "postfix" ? node.ops : []))
      .flatMap((op) => (op.kind === "call" ? [op] : []));
    const passed = new Set(
      calls.flatMap((call) => call.arguments.map(ExpressionShape.rootName)),
    );
    for (const name of [...counts.keys()]) {
      if (
        assigned.has(name) ||
        passed.has(name) ||
        ((calls.length > 0 || writesNonLocalString) &&
          !StringLengthCounter.isLocal(name, at, state))
      ) {
        counts.delete(name);
      }
    }
  }

  /**
   * Whether a write may change a string's characters: anything but a write
   * to a scalar number, bool or enum, and anything the typer cannot type.
   */
  private static mayWriteString(
    target: TExpression,
    state: TranspileState,
  ): boolean {
    const written = OperandTyper.typeOfTarget(target, state.typingContext());
    return (
      written === null ||
      written.dimensions.length > 0 ||
      !SCALAR_CATEGORIES.has(written.category)
    );
  }

  /** A local declared in the function body, which no callee can name */
  private static isLocal(
    name: string,
    at: ISourcePosition,
    state: TranspileState,
  ): boolean {
    const binding = state.bindingAt(null, name, at);
    return (
      binding?.kind === "local" && binding.declaration.kind !== "parameter"
    );
  }

  /**
   * Walk an expression, counting `.value_char_count` reads on string identifiers.
   * Only identifier-rooted chains count, and only their subscript indexes are
   * searched further; call arguments are not.
   */
  private static walkExpression(
    expr: TExpression,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    switch (expr.kind) {
      case "ternary":
        StringLengthCounter.walkExpression(expr.condition, counts, state);
        StringLengthCounter.walkExpression(expr.whenTrue, counts, state);
        StringLengthCounter.walkExpression(expr.whenFalse, counts, state);
        return;
      case "binary":
        for (const operand of expr.operands) {
          StringLengthCounter.walkExpression(operand, counts, state);
        }
        return;
      case "unary":
        StringLengthCounter.walkExpression(expr.operand, counts, state);
        return;
      case "parenthesized":
        StringLengthCounter.walkExpression(expr.expression, counts, state);
        return;
      case "postfix":
        StringLengthCounter.walkPostfix(expr, counts, state);
        return;
      default:
        return;
    }
  }

  /**
   * #1650: only `name.value_char_count` counts -- the length of the variable itself,
   * the operand the cache measures. `names[0].value_char_count` measures an element,
   * which a cache of `names` cannot serve.
   */
  private static walkPostfix(
    expr: TExpressionOf<"postfix">,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    const primary = expr.primary;
    if (primary.kind === "parenthesized") {
      StringLengthCounter.walkExpression(primary.expression, counts, state);
      return;
    }
    if (primary.kind !== "identifier") return;
    const [first] = expr.ops;
    if (first?.kind === "member" && LengthProperty.readsStringNow(first.name)) {
      StringLengthCounter.countLengthRead(primary.name, expr, counts, state);
    }
    for (const op of expr.ops) {
      if (op.kind === "subscript") {
        for (const index of op.indexes) {
          StringLengthCounter.walkExpression(index, counts, state);
        }
      }
    }
  }

  private static countLengthRead(
    name: string,
    expr: TExpression,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    const typeInfo = state.declarationTypeInfo(null, name, {
      line: expr.span.line,
      column: expr.span.column,
    });
    if (typeInfo?.isString) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  /** The index expressions an assignment target subscripts with */
  private static walkTargetIndexes(
    target: TExpression,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    if (target.kind !== "postfix") {
      return;
    }
    for (const op of target.ops) {
      if (op.kind === "subscript") {
        for (const index of op.indexes) {
          StringLengthCounter.walkExpression(index, counts, state);
        }
      }
    }
  }

  /**
   * Walk a statement, counting .value_char_count accesses.
   */
  private static walkStatement(
    statement: TStatement,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    switch (statement.kind) {
      case "assignment":
        StringLengthCounter.walkTargetIndexes(statement.target, counts, state);
        StringLengthCounter.walkExpression(statement.value, counts, state);
        return;
      case "expression":
        StringLengthCounter.walkExpression(statement.expression, counts, state);
        return;
      case "variableDeclaration":
        if (statement.initializer) {
          StringLengthCounter.walkExpression(
            statement.initializer,
            counts,
            state,
          );
        }
        return;
      case "block":
        StringLengthCounter.countBlockInto(statement, counts, state);
        return;
      default:
        return;
    }
  }
}

export default StringLengthCounter;
