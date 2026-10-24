/**
 * Boolean Operand Analyzer
 *
 * Detects arithmetic, bitwise, shift and relational operators applied to an
 * essentially Boolean operand.
 *
 * MISRA C:2012 Rule 10.1: "Operands shall not be of an inappropriate essential
 * type." An essentially Boolean operand is permitted only for the logical
 * operators (&&, ||, !), for equality (=, !=), and as a controlling expression.
 * It is not a number: `flag + 1` relies on Boolean-to-integer promotion, and
 * `a / b` on two bools is an unguarded division by zero whenever `b` is false
 * (Issue #1183) -- a risk carried by the TYPE, so the literal-divisor check in
 * DivisionByZeroAnalyzer (E0800) can never see it.
 *
 * `a - b` is the other trap: `false - true` is -1, which stores back into a
 * bool as `true`, so subtracting from a false flag sets it.
 *
 * Equality is deliberately NOT checked: cnx requires conditions to be
 * explicit comparisons, so `if (flag = true)` is the idiomatic test and must
 * stay legal. `!flag` likewise remains the way to negate.
 *
 * This is the same rule E0805 enforces for signed shift operands, and the
 * sibling of E0806 (compound assignment to a bool, Issue #1145) on the
 * assignment side.
 *
 * Whether an operand is Boolean is the one operand typer's answer (#1668),
 * the same fact E0810 reads, so the two codes cannot disagree about which
 * operands they share; `admitsBoolean` is where E0810 defers to this rule.
 */

import IBooleanOperandError from "./types/IBooleanOperandError";
import OperandTyper from "../../utils/OperandTyper";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import type TExpression from "../../types/syntax/TExpression";
import type TBinaryOperatorLevel from "./types/TBinaryOperatorLevel";

/**
 * Reports essentially Boolean operands of guarded operators.
 */
class BooleanOperandCheck {
  constructor(
    private readonly analyzer: BooleanOperandAnalyzer,
    private readonly context: IAnalysisContext,
  ) {}

  /**
   * Whether an operand is essentially Boolean.
   *
   * Every case defers to the one operand typer, so a bool reads the same
   * however it is spelled: a declaration (`flag`, `this.flag`, `sensor.ready`,
   * `outer.inner.ready`, `flags[0]`), a literal, `!x`, or a comparison or
   * logical result (`a && b`, `a = b`, `n < 5`) that no declaration names.
   *
   * An ARITHMETIC child is deliberately not Boolean and needs no case here:
   * `a + b` inside `(a + b) * c` reports at its own level. A Boolean child is
   * the opposite -- it is well-formed alone, so the parent operator is the only
   * place its misuse can be reported (Issue #1183 review).
   */
  private isBooleanOperand(expr: TExpression): boolean {
    return OperandTyper.isBoolean(OperandTyper.typeOf(expr, this.context));
  }

  /**
   * MISRA C:2012 Rule 10.1 on the assignment side.
   *
   * A compound assignment applies an arithmetic or bitwise operator that the
   * expression grammar never expresses as a level, so neither the operator
   * levels nor a target-only check sees both halves. Both are checked here:
   * a bool TARGET (E0806) and a bool right-hand side (E0807). Before this,
   * `n +<- flag` was accepted while the identical `n <- n + flag` was rejected.
   */
  public checkAssignment(site: IAssignmentSyntax): void {
    if (site.operator === "<-") return;

    if (
      OperandTyper.isBoolean(
        OperandTyper.typeOfTarget(site.target, this.context),
      )
    ) {
      this.analyzer.addCompoundAssignmentError(
        site.target.span.line,
        site.target.span.column,
        site.target.written,
      );
      return;
    }

    if (this.isBooleanOperand(site.value)) {
      this.analyzer.addError(
        site.value.span.line,
        site.value.span.column,
        site.operator,
      );
    }
  }

  /**
   * Report one error per guarded operator whose left or right operand is
   * essentially Boolean. `operators[i]` joins operand `i` to `i + 1`.
   *
   * Reported once per operator rather than once per operand: `flag / other` is
   * a single mistake, and naming both operands would double every diagnostic.
   */
  public checkLevel(level: TBinaryExpression): void {
    level.operators.forEach((operator, i) => {
      const left = level.operands[i];
      const right = level.operands[i + 1];
      const leftIsBoolean = this.isBooleanOperand(left);
      if (!leftIsBoolean && !this.isBooleanOperand(right)) return;

      const offending = leftIsBoolean ? left : right;
      this.analyzer.addError(
        offending.span.line,
        offending.span.column,
        operator,
      );
    });
  }

  // Prefix `-` and `~` are arithmetic/bitwise; `!` is the correct negation.
  public checkUnary(expr: TExpression): void {
    if (expr.kind !== "unary") return;
    if (expr.operator !== "-" && expr.operator !== "~") return;
    if (this.isBooleanOperand(expr.operand)) {
      this.analyzer.addError(expr.span.line, expr.span.column, expr.operator);
    }
  }
}

/**
 * Analyzer that detects essentially Boolean operands of arithmetic, bitwise,
 * shift and relational operators.
 */
class BooleanOperandAnalyzer {
  private errors: IBooleanOperandError[] = [];

  /** #1456: handed in rather than read off shared state. */
  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(private readonly context: IAnalysisContext) {}

  /**
   * MISRA C:2012 Rule 10.1: whether an operator level may take an essentially
   * Boolean operand. Only equality may -- comparing a flag is how cnx tests
   * it. Every other level, and every compound assignment, is this rule's:
   * E0807, or E0806 for a bool target. E0810 asks, so that a Boolean mix is
   * one defect reported under one code (#1668).
   */
  static admitsBoolean(level: TBinaryOperatorLevel | "compound"): boolean {
    return level === "equality";
  }

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(program: IProgramSyntax): IBooleanOperandError[] {
    this.errors = [];
    const check = new BooleanOperandCheck(this, this.context);

    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part)) {
          BooleanOperandAnalyzer.checkExpression(check, expr);
        }
      }
      for (const site of StatementNodes.assignments(member.declaration)) {
        check.checkAssignment(site);
      }
    }

    return this.errors;
  }

  /** `!` on a number, or a bool at a level that takes numbers */
  private static checkExpression(
    check: BooleanOperandCheck,
    expr: TExpression,
  ): void {
    check.checkUnary(expr);
    if (expr.kind !== "binary") return;
    if (expr.level === "or" || expr.level === "and") return;
    if (BooleanOperandAnalyzer.admitsBoolean(expr.level)) return;
    check.checkLevel(expr);
  }

  /**
   * Add a Boolean-operand error.
   */
  public addError(line: number, column: number, operator: string): void {
    this.errors.push({
      code: "E0807",
      line,
      column,
      message: `Operator '${operator}' is not valid on a bool operand`,
      helpText:
        "MISRA C:2012 Rule 10.1: a bool is not a number. Use the logical operators " +
        "(&&, ||, !) to combine flags, or '=' / '!=' to compare them.",
    });
  }

  /**
   * Add a compound-assignment-to-bool error, naming the target as written so
   * the suggested fix is code that can be pasted back (Issue #1183 review:
   * `flags[0] +<- true` used to suggest `flags <- !flags`, which does not
   * compile).
   */
  public addCompoundAssignmentError(
    line: number,
    column: number,
    target: string,
  ): void {
    this.errors.push({
      code: "E0806",
      line,
      column,
      message: `Compound assignment is not valid on bool '${target}' - only '<-' is`,
      helpText: `MISRA C:2012 Rule 10.1: a bool is not a number. To flip it, use '${target} <- !${target}'.`,
    });
  }
}

export default BooleanOperandAnalyzer;
