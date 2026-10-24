/**
 * Return-Path Analyzer
 * ADR-067 / Issue #1040: reject a non-void function that can reach the end of
 * its body without returning a value (undefined behavior in C).
 *
 * The analysis is intentionally strict and conservative (sound): it never
 * accepts a function that might fall through, and it does not attempt to prove
 * that loops are infinite or that a switch over an enum is exhaustive. Where it
 * cannot prove a return, an explicit `return <value>` is required.
 *
 * cnx has no break/continue (ADR-026), so loop bodies have no early
 * structural exits to reason about.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IFunctionDeclarationSyntax from "../../types/syntax/IFunctionDeclarationSyntax";
import type TStatement from "../../types/syntax/TStatement";
import IReturnPathError from "./types/IReturnPathError";

/**
 * Does executing this statement guarantee that the enclosing function returns a
 * value before control passes beyond it? Each child is read by its role in the
 * lowered statement (#2003).
 */
function statementDefinitelyReturns(statement: TStatement): boolean {
  switch (statement.kind) {
    case "return":
      // A bare `return;` (no expression) returns no value, so it does not
      // satisfy a non-void function.
      return statement.value !== null;
    case "if":
      // Only with an `else`, and both branches returning. `else if` chains
      // recurse through the else branch.
      return (
        statement.whenFalse !== null &&
        statementDefinitelyReturns(statement.whenTrue) &&
        statementDefinitelyReturns(statement.whenFalse)
      );
    case "switch":
      // Only with a `default`, and every case and the default returning.
      return (
        statement.defaultCase !== null &&
        statement.cases.every((switchCase) =>
          statementsDefinitelyReturn(switchCase.body.statements),
        ) &&
        statementsDefinitelyReturn(statement.defaultCase.body.statements)
      );
    case "doWhile":
      // The body always executes at least once.
      return statementsDefinitelyReturn(statement.body.statements);
    case "forever":
      // ADR-068: a `forever` loop is divergent — cnx has no break/continue
      // (ADR-026), so control never passes beyond it. It is therefore a
      // terminal path, like an unconditional return, and the function never
      // falls through here. This is the shared "divergence" primitive ADR-069
      // (#849) reuses.
      //
      // `forever` is void-only (E0705, enforced in codegen). Marking it
      // terminal here keeps a non-void function containing a `forever` loop
      // from emitting a misleading E0704 ("must return a value") instead of
      // the precise E0705.
      return true;
    case "block":
      return statementsDefinitelyReturn(statement.statements);
    case "critical":
      return statementsDefinitelyReturn(statement.body.statements);
    // The body of a `while` or `for` may not execute; the rest hold no
    // statement and are not a return.
    case "while":
    case "for":
    case "variableDeclaration":
    case "constructorDeclaration":
    case "assignment":
    case "expression":
    case "missing":
      return false;
    default: {
      const unplaced: never = statement;
      return unplaced;
    }
  }
}

/**
 * A block guarantees a return if and only if any of its statements does:
 * statements after an unconditional return are unreachable.
 */
function statementsDefinitelyReturn(
  statements: readonly TStatement[],
): boolean {
  return statements.some(statementDefinitelyReturns);
}

/** Every function the file declares, top-level and scope members alike */
function functionsOf(program: IProgramSyntax): IFunctionDeclarationSyntax[] {
  const functions: IFunctionDeclarationSyntax[] = [];
  for (const { declaration } of program.members) {
    if (declaration.kind === "function") functions.push(declaration);
  }
  return functions;
}

/**
 * Analyzer for missing return paths (ADR-067).
 */
class ReturnPathAnalyzer {
  private errors: IReturnPathError[] = [];

  public analyze(program: IProgramSyntax): IReturnPathError[] {
    this.errors = [];
    for (const fn of functionsOf(program)) {
      // Void functions are allowed to fall off the end.
      if (fn.returnType.kind === "void") continue;
      if (statementsDefinitelyReturn(fn.body.statements)) continue;
      this.addError(fn.name, fn.nameSpan.line, fn.nameSpan.column);
    }
    return this.errors;
  }

  public addError(functionName: string, line: number, column: number): void {
    this.errors.push({
      code: "E0704",
      functionName,
      line,
      column,
      message: `Non-void function '${functionName}' must return a value on all paths`,
      helpText:
        "Add an explicit 'return <value>;' so every control-flow path returns a value",
    });
  }
}

export default ReturnPathAnalyzer;
