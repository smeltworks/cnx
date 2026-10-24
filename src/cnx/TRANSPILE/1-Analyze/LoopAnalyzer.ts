/**
 * ADR-068 loops and ADR-026 break/continue: E0703, E0705, E0707, E0715.
 *
 * #1322. Four throws in `output/` -- `CodeGenerator` for `break`/`continue`,
 * `ControlFlowGenerator` for `for (;;)` and for `forever` in a non-void
 * function, `TypeValidator` for an always-true literal condition -- three of
 * them reaching the user as `1:0`. Every one is a fact of the parse tree:
 * which keyword was written, whether a `for` header has a condition, what the
 * enclosing function's declared type is, and what two literals compare to.
 *
 * ## The always-true slice is the LITERAL slice, as it was
 *
 * `while (1 = 1)`, `5 > 3`, `true = true`, `1 != 2`: a single comparison of
 * two integer or boolean literals. Named constants, compound conditions,
 * floats, and always-FALSE conditions are #1076's (the full MISRA 14.3 effort)
 * and are deliberately not decided here; this pass moves the rule, it does not
 * widen it. A leading-zero integer (`0777`) is emitted verbatim and read by C
 * as OCTAL, so it is skipped rather than parsed as decimal -- the verdict has
 * to agree with the generated code's value.
 *
 * E0701 (a condition must be a comparison) runs earlier in the same pass and
 * halts, so a condition reaching the always-true check is already a
 * comparison -- the ordering codegen relied on, kept by the step order.
 *
 * ## A header clause is one C expression (E0715, #1647)
 *
 * The init and update render through the statement assignment path, and some
 * forms lower to more than one statement there. `ForHeaderAssignment` decides
 * which; this reports it and the header renderer asserts it. A compound on a
 * string or slice is E0857's, which runs earlier and halts.
 */

import REJECTED_KEYWORDS from "./REJECTED_KEYWORDS";
import SourceOrder from "../../utils/SourceOrder";
import LiteralUtils from "../../utils/LiteralUtils";
import ForHeaderAssignment from "../../utils/ForHeaderAssignment";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ExpressionShape from "../../utils/ExpressionShape";
import StatementNodes from "../../utils/StatementNodes";
import ILoopError from "./types/ILoopError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import type TStatement from "../../types/syntax/TStatement";

const FOREVER_HELP = "write 'forever { ... }' for an intentional infinite loop";

const INIT_HELP = "assign before the loop and leave the init clause empty";

const UPDATE_HELP =
  "assign at the end of the loop body and write it as a while loop";

/** A single comparison of two compile-time literals. */
interface ILiteralComparison {
  readonly operator: string;
  readonly left: number;
  readonly right: number;
}

class LoopCheck {
  private readonly found: ILoopError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): ILoopError[] {
    return this.found;
  }

  /** Every function, a scope's included, with the type it returns */
  public declaration(declaration: TMemberDeclaration): void {
    if (declaration.kind !== "function") return;
    for (const statement of StatementNodes.of(declaration.body.statements)) {
      this.statement(statement, declaration.returnType.text);
    }
  }

  /** E0703: `break;` and `continue;` parse as a bare identifier expression. */
  public checkExpression(expr: TExpression): void {
    if (expr.kind !== "identifier" || !REJECTED_KEYWORDS.has(expr.name)) {
      return;
    }
    this.found.push({
      code: "E0703",
      span: expr.span,
      message: `'${expr.name}' is not supported in cnx - use structured conditions instead`,
      helpText:
        "ADR-026 rejects `break` and `continue`: an early exit hides the loop's real condition. Fold the exit into the loop condition, or split the body into a function that returns.",
    });
  }

  private statement(statement: TStatement, returnType: string): void {
    switch (statement.kind) {
      case "forever":
        // E0705: `forever` never yields a value, so only a void function may hold one.
        if (returnType === "void") return;
        this.found.push({
          code: "E0705",
          span: statement.span,
          message: "forever loop in non-void function",
          helpText:
            "a forever loop never returns a value; make the function return void, or use a while loop with an exit condition",
        });
        return;
      case "for":
        this.forStatement(statement);
        return;
      case "while":
      case "doWhile":
        this.checkAlwaysTrue(statement.condition);
        return;
      default:
        return;
    }
  }

  private forStatement(
    statement: Extract<TStatement, { readonly kind: "for" }>,
  ): void {
    if (statement.init?.kind === "assignment") {
      this.checkHeaderAssignment(statement.init, INIT_HELP);
    }
    if (statement.update !== null) {
      this.checkHeaderAssignment(statement.update, UPDATE_HELP);
    }
    // E0707: `for (;;)` is an infinite loop with the wrong spelling.
    if (statement.condition === null) {
      this.found.push({
        code: "E0707",
        span: statement.span,
        message: "for-loop has no controlling expression (infinite loop)",
        helpText: FOREVER_HELP,
      });
      return;
    }
    this.checkAlwaysTrue(statement.condition);
  }

  /** E0715: the assignment forms ADR-068 keeps out of a header clause */
  private checkHeaderAssignment(site: IAssignmentSyntax, help: string): void {
    const form = ForHeaderAssignment.rejectedForm(site, this.context);
    if (form === null) return;
    this.found.push({
      code: "E0715",
      span: site.span,
      message: `a for-loop header cannot hold this assignment: ${form}`,
      helpText: help,
    });
  }

  /** E0707: an always-true literal comparison as a loop condition. */
  private checkAlwaysTrue(condition: TExpression): void {
    const comparison = LoopCheck.asSingleLiteralComparison(condition);
    if (comparison === null || !LoopCheck.isAlwaysTrue(comparison)) return;
    this.found.push({
      code: "E0707",
      span: condition.span,
      message: `loop condition '${condition.written}' is always true`,
      helpText: FOREVER_HELP,
    });
  }

  /**
   * `expr` as a single comparison of two literal operands -- no `||`/`&&`, no
   * ternary, no chaining -- or null. Anything involving identifiers or floats
   * is left to #1076, and a constant sub-expression -- `1 + 1 = 2`, or a
   * bracketed operand such as `(1) < (2)` -- to #1879.
   *
   * A bare bracketed group is judged by what it holds, as E0701 judges it
   * (#1195): `while ((1 = 1))` is the same always-true loop as `while (1 = 1)`.
   */
  private static asSingleLiteralComparison(
    expr: TExpression,
  ): ILiteralComparison | null {
    const inner = ExpressionShape.unparenthesized(expr);
    if (inner.kind !== "binary" || inner.operands.length !== 2) return null;
    const left = LoopCheck.literalValue(inner.operands[0]);
    const right = LoopCheck.literalValue(inner.operands[1]);
    if (left === null || right === null) return null;
    return { operator: inner.operators[0], left, right };
  }

  /**
   * Strict literal-to-number: integer literals (decimal, hex, binary, with an
   * optional type suffix) and `true`/`false`. Everything else is not
   * compile-time-known here.
   */
  private static literalValue(expr: TExpression): number | null {
    if (expr.written === "true") return 1;
    if (expr.written === "false") return 0;
    return LiteralUtils.integerValue(expr.written);
  }

  private static isAlwaysTrue(comparison: ILiteralComparison): boolean {
    const left = comparison.left;
    const right = comparison.right;
    switch (comparison.operator) {
      case "=":
        return left === right;
      case "!=":
        return left !== right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      default:
        return false;
    }
  }
}

class LoopAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): ILoopError[] {
    const check = new LoopCheck(this.context);
    for (const member of program.members) {
      check.declaration(member.declaration);
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part))
          check.checkExpression(expr);
      }
    }
    // Read off 1.2's syntax (#1991); reported in source order
    return check.errors().sort(SourceOrder.bySpan);
  }
}

export default LoopAnalyzer;
