/**
 * E0929: `=` / `!=` compares a string only with a string (ADR-045).
 *
 * A string comparison is written as `strcmp`, so a non-string operand beside
 * a string reached C as a `strcmp` argument: `x = "abc"` with `x: u32` emitted
 * `strcmp(x, "abc") == 0`, which gcc rejects (#2017).
 *
 * A comparison's result is a bool, and `a = b = c` is `(a = b) = c` (ADR-001,
 * ADR-024), so a string past a chain's first pair is compared with that bool
 * (#1373). It had emitted `strcmp(a, b) == 0` and dropped `= c`.
 *
 * An operand whose type cnx cannot read is admitted, so the C compiler judges
 * it, as Rule 10.1's check does; so are a C `char` array and a C char pointer,
 * which `strcmp` takes.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import ExpressionChildren from "../../utils/ExpressionChildren";
import OperandTyper from "../../utils/OperandTyper";
import ProgramExpressions from "../../utils/ProgramExpressions";
import SourceOrder from "../../utils/SourceOrder";
import StringOperand from "../../utils/StringOperand";
import IStringComparisonError from "./types/IStringComparisonError";

const HELP =
  "ADR-045: '=' and '!=' compare a string only with another string, through strcmp.";

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
    const left = operands[0];
    const right = operands[1];
    const leftIsString = StringOperand.is(left, this.context);
    if (leftIsString !== StringOperand.is(right, this.context)) {
      const other = leftIsString ? right : left;
      if (!this.mayMeetAString(other)) this.report(other, other.written);
    }
    for (let i = 2; i < operands.length; i += 1) {
      if (!StringOperand.is(operands[i], this.context)) continue;
      // Past the first pair the left operand is the comparison before it
      this.report(operands[0], StringComparisonAnalyzer.written(level, i), [
        "A comparison is a bool, so compare each pair on its own and join them with && or ||, e.g. (a = b) && (b = c).",
      ]);
    }
  }

  /** What strcmp takes beside a string, or what cnx cannot type */
  private mayMeetAString(operand: TExpression): boolean {
    if (OperandTyper.isStringValue(operand, this.context) !== false) {
      return true;
    }
    const type = OperandTyper.typeOf(operand, this.context);
    if (type === null) return true;
    const form = type.form;
    if (form.kind === "unreadableMacro") return true;
    if (form.kind === "foreign" && form.indeterminate) return true;
    return type.typeName === "cstring";
  }

  /** The chain before operand `end`, as written */
  private static written(level: TBinaryExpression, end: number): string {
    let text = level.operands[0].written;
    for (let i = 1; i < end; i += 1) {
      text += ` ${level.operators[i - 1]} ${level.operands[i].written}`;
    }
    return text;
  }

  private report(at: TExpression, written: string, more: string[] = []): void {
    this.found.push({
      code: "E0929",
      span: at.span,
      message: `A string cannot be compared with a value that is not a string: '${written}'`,
      helpText: [HELP, ...more].join(" "),
    });
  }
}

export default StringComparisonAnalyzer;
