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
 * A string is a `string<N>`, a string literal, a C `char` array or a C char
 * pointer (`cstring`): what `strcmp` takes. An operand whose type cnx cannot
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

const HELP =
  "ADR-045: '=' and '!=' compare a string only with another string, through strcmp.";

const CHAIN_HELP =
  "A comparison is a bool, so compare each pair on its own and join them with && or ||, e.g. (a = b) && (b = c).";

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
      if (!this.isUntypeable(other)) {
        this.report(
          other.span,
          StringComparisonAnalyzer.notAString(other.written),
        );
        return;
      }
    }
    const pairIsString = leftIsString || rightIsString;
    for (let i = 2; i < operands.length; i += 1) {
      if (!pairIsString && !this.isString(operands[i])) continue;
      const comparison = SourceSpanRange.between(
        operands[0].span,
        operands[i - 1].span,
      );
      const message = pairIsString
        ? `A string comparison takes exactly two operands: '${StringComparisonAnalyzer.written(level, i + 1)}'`
        : StringComparisonAnalyzer.notAString(
            StringComparisonAnalyzer.written(level, i),
          );
      this.report(comparison, message, [CHAIN_HELP]);
      return;
    }
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
  private isUntypeable(operand: TExpression): boolean {
    if (OperandTyper.isStringValue(operand, this.context) === null) return true;
    const form = OperandTyper.typeOf(operand, this.context)?.form;
    if (form?.kind === "unreadableMacro") return true;
    return form?.kind === "foreign" && form.indeterminate;
  }

  private static notAString(written: string): string {
    return `A string cannot be compared with a value that is not a string: '${written}'`;
  }

  /** The chain before operand `end`, as written */
  private static written(level: TBinaryExpression, end: number): string {
    let text = level.operands[0].written;
    for (let i = 1; i < end; i += 1) {
      text += ` ${level.operators[i - 1]} ${level.operands[i].written}`;
    }
    return text;
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
