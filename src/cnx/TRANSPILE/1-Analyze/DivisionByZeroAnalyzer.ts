/**
 * Division By Zero Analyzer
 * Detects division and modulo by zero at compile time (ADR-051)
 *
 * A divisor that is a compile-time constant zero, integer or float (§1, §4):
 * a literal (`0`, `0.0f32`), a const (`ZERO`, `this.ZERO`, `Scope.ZERO`) or
 * a constant expression (`2 - 2`, `-0.0`, `(f32)0`), by the one constant
 * fold, so a name means the declaration ADR-057 names wherever the division
 * is written -- a statement, a member or file initializer, an array dimension,
 * an enum member's value (#1664 box 7, #1268). A compound `/<-` or `%<-`
 * divides by its value the same way (#1770).
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type ISourceSpan from "../../types/ISourceSpan";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import type TStatement from "../../types/syntax/TStatement";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import CompoundOperator from "../../utils/CompoundOperator";
import SourceOrder from "../../utils/SourceOrder";
import IDivisionByZeroError from "./types/IDivisionByZeroError";
import OperandTyper from "../../utils/OperandTyper";
import ConstantFold from "../../utils/ConstantFold";
import ConstExprLowering from "../../utils/ConstExprLowering";
import type IAnalysisContext from "./types/IAnalysisContext";

/** #1991: reads 1.2's syntax, not the parse tree */
class DivisionByZeroAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IDivisionByZeroError[] = [];

  public analyze(program: IProgramSyntax): IDivisionByZeroError[] {
    this.errors = [];
    for (const member of program.members) {
      this.declaration(member.declaration);
    }
    // Binary levels, then compound writes; report in source order
    return this.errors.sort(SourceOrder.bySpan);
  }

  private declaration(declaration: TMemberDeclaration): void {
    const atRunTime = new Set(
      declaration.kind === "function"
        ? DivisionByZeroAnalyzer.runTimeRoots(
            declaration.body.statements,
          ).flatMap(ExpressionNodes.direct)
        : [],
    );
    for (const part of DeclarationParts.of(declaration)) {
      for (const expr of ExpressionNodes.of(part)) {
        if (expr.kind === "binary") this.check(expr, atRunTime.has(expr));
      }
    }
    this.compoundDivisions(declaration);
  }

  /**
   * `x /<- d` and `x %<- d` divide `x` by `d`, in a statement or a `for`
   * header (#1770)
   */
  private compoundDivisions(declaration: TMemberDeclaration): void {
    for (const site of StatementNodes.assignments(declaration)) {
      const operator = CompoundOperator.binaryOf(site.operator);
      if (operator !== "/" && operator !== "%") continue;
      if (site.value.kind === "missing" || !this.isZero(site.value)) continue;
      this.addError(operator, site.value.span, true);
    }
  }

  private check(expr: TBinaryExpression, atRunTime: boolean): void {
    expr.operators.forEach((operator, i) => {
      if (operator !== "/" && operator !== "%") return;
      const divisor = expr.operands[i + 1];
      if (this.isZero(divisor)) {
        this.addError(operator, divisor.span, atRunTime);
      }
    });
  }

  private isZero(divisor: TExpression): boolean {
    const numeric = OperandTyper.valueLeaves(divisor, this.context).every(
      (leaf) =>
        leaf === null ||
        (leaf.enumTypeName == null && leaf.category !== "boolean"),
    );
    return (
      numeric &&
      ConstantFold.numberValue(
        this.context.program,
        this.context.sourceFile,
        ConstExprLowering.lower(divisor),
      ) === 0
    );
  }

  /**
   * Whether a `safe_div` call could replace a division: in a statement, and
   * not in what must be known at compile time there -- an array dimension, an
   * enum member's value, a const's initializer (#1268 review)
   */
  private static runTimeRoots(
    statements: readonly TStatement[],
  ): readonly TExpression[] {
    const compileTime = new Set(
      StatementNodes.of(statements).flatMap(
        DivisionByZeroAnalyzer.compileTimeRoots,
      ),
    );
    return DeclarationParts.statements(statements).flatMap((part) =>
      part.kind === "expression" && !compileTime.has(part.expression)
        ? [part.expression]
        : [],
    );
  }

  /** A local's dimensions, and a const local's value */
  private static compileTimeRoots(
    statement: TStatement,
  ): readonly TExpression[] {
    if (statement.kind !== "variableDeclaration") return [];
    return [
      ...statement.dimensions.filter((d): d is TExpression => d !== null),
      ...(!statement.modifiers.mut && statement.initializer !== null
        ? [statement.initializer]
        : []),
    ];
  }

  private addError(
    operator: string,
    span: ISourceSpan,
    atRunTime: boolean,
  ): void {
    const isDivision = operator === "/";
    const code = isDivision ? "E0800" : "E0802";
    const opName = isDivision ? "Division" : "Modulo";
    const builtin = isDivision ? "safe_div" : "safe_mod";

    this.errors.push({
      code,
      operator,
      span,
      message: `${opName} by zero`,
      helpText: atRunTime
        ? `Consider using ${builtin}(output, numerator, divisor, defaultValue) for runtime safety`
        : "A divisor known at compile time must not be zero",
    });
  }
}

export default DivisionByZeroAnalyzer;
