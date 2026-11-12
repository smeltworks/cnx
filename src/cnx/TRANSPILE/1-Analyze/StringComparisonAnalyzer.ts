/**
 * E0929: `=` / `!=` compares a string only with a string, and a string
 * comparison has exactly two operands (ADR-045).
 *
 * A string comparison is written as `strcmp`, so a non-string operand beside
 * a string reached C as a `strcmp` argument: `x = "abc"` with `x: u32` emitted
 * `strcmp(x, "abc") == 0`, which gcc rejects (#2017).
 *
 * `a = b = c` is `(a = b) = c` (ADR-001, ADR-024), so past the first pair the
 * left operand is that pair's bool. A string there is compared with a bool,
 * and a string pair is not chained at all (#1373): `a = b = c` had emitted
 * `strcmp(a, b) == 0` and dropped `= c`. Both are reported at the comparison
 * before the operand, where `(a = b) = c` reports.
 *
 * A string is a `string<N>`, a string literal, or a C string (a `char` array
 * or a `char*`), which cnx treats as a string. An operand whose type cnx cannot
 * read is left to the C compiler, as Rule 10.1's check leaves it.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import type ISourceSpan from "../../types/ISourceSpan";
import type IAnalysisContext from "./types/IAnalysisContext";
import ExpressionChildren from "../../utils/ExpressionChildren";
import OperandTyper from "../../utils/OperandTyper";
import ProgramExpressions from "../../utils/ProgramExpressions";
import SourceOrder from "../../utils/SourceOrder";
import SourceSpanRange from "../../utils/SourceSpanRange";
import StringOperand from "../../utils/StringOperand";
import IStringComparisonError from "./types/IStringComparisonError";

const HELP = "ADR-045: '=' and '!=' compare a string only with another string.";

const MIXED_HELP =
  "Compare the string with another string, a string<N> or a string literal.";

class StringComparisonAnalyzer {
  private readonly found: IStringComparisonError[] = [];

  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IStringComparisonError[] {
    for (const root of ProgramExpressions.of(program)) {
      this.expression(root);
    }
    return this.found.sort(SourceOrder.bySpan);
  }

  private expression(expr: TExpression): void {
    if (expr.kind === "binary" && expr.level === "equality") {
      this.level(expr);
    }
    for (const child of ExpressionChildren.of(expr)) {
      this.expression(child);
    }
  }

  /** `operators[i]` joins operand `i` to `i + 1` */
  private level(level: TBinaryExpression): void {
    const operands = level.operands;
    const leftIsString = this.isString(operands[0]);
    const rightIsString = this.isString(operands[1]);
    if (leftIsString !== rightIsString) {
      const other = leftIsString ? operands[1] : operands[0];
      if (!this.cannotType(other)) {
        this.report(
          other.span,
          StringComparisonAnalyzer.notAString(other.written),
          [MIXED_HELP],
        );
        return;
      }
    }
    const pairIsString = leftIsString || rightIsString;
    for (let i = 2; i < operands.length; i += 1) {
      const isString = this.isString(operands[i]);
      if (!pairIsString && !isString) continue;
      const comparison = SourceSpanRange.between(
        operands[0].span,
        operands[i - 1].span,
      );
      const bool = StringComparisonAnalyzer.written(level, 0, i);
      const next = operands[i].written;
      const versusString = `'${bool}' is a bool, and a bool cannot be compared with the string '${next}'.`;
      if (!pairIsString) {
        this.report(comparison, StringComparisonAnalyzer.notAString(bool), [
          versusString,
        ]);
        return;
      }
      const help = isString
        ? `${versusString} Did you mean '${this.pairs(level, i)}'?`
        : `'${bool}' is a bool. To compare that bool with '${next}', write '(${bool})${StringComparisonAnalyzer.after(level, i)}'.`;
      this.report(
        comparison,
        `A string comparison takes exactly two operands: '${StringComparisonAnalyzer.written(level, 0, i + 1)}'`,
        [help],
      );
      return;
    }
  }

  /**
   * Each operand before the string at `through` compared with it, joined with
   * &&: `a = b = name` as `(a = name) && (b = name)`. An all-string chain is
   * compared with its last operand, so no operand is left out.
   */
  private pairs(level: TBinaryExpression, through: number): string {
    const operands = level.operands;
    const all = operands.every((operand) => this.isString(operand));
    const last = all ? operands.length - 1 : through;
    const operator = level.operators[last - 1];
    const target = operands[last].written;
    return operands
      .slice(0, last)
      .map((operand) => `(${operand.written} ${operator} ${target})`)
      .join(" && ");
  }

  /** What `strcmp` takes: a string, a C `char` array or a C char pointer */
  private isString(operand: TExpression): boolean {
    if (StringOperand.is(operand, this.context)) return true;
    const type = OperandTyper.typeOf(operand, this.context);
    if (type === null) return false;
    if (type.typeName === "char") return type.dimensions.length === 1;
    return type.typeName === "cstring";
  }

  /** What cnx cannot type, which the C compiler judges instead */
  private cannotType(operand: TExpression): boolean {
    if (OperandTyper.isStringValue(operand, this.context) === null) return true;
    const form = OperandTyper.typeOf(operand, this.context)?.form;
    if (form?.kind === "unreadableMacro") return true;
    return form?.kind === "foreign" && form.indeterminate;
  }

  private static notAString(written: string): string {
    return `A string cannot be compared with a value that is not a string: '${written}'`;
  }

  /** Operands `start` up to `end` and the operators between, as written */
  private static written(
    level: TBinaryExpression,
    start: number,
    end: number,
  ): string {
    let text = level.operands[start].written;
    for (let i = start + 1; i < end; i += 1) {
      text += ` ${level.operators[i - 1]} ${level.operands[i].written}`;
    }
    return text;
  }

  /** The operators and operands from operand `start` on, as written */
  private static after(level: TBinaryExpression, start: number): string {
    return level.operators
      .slice(start - 1)
      .map((operator, k) => ` ${operator} ${level.operands[start + k].written}`)
      .join("");
  }

  private report(
    span: ISourceSpan,
    message: string,
    more: string[] = [],
  ): void {
    this.found.push({
      code: "E0929",
      span,
      message,
      helpText: [HELP, ...more].join(" "),
    });
  }
}

export default StringComparisonAnalyzer;
