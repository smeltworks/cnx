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
import ComparisonChain from "../../utils/ComparisonChain";
import ExpressionChildren from "../../utils/ExpressionChildren";
import OperandTyper from "../../utils/OperandTyper";
import ProgramExpressions from "../../utils/ProgramExpressions";
import SourceOrder from "../../utils/SourceOrder";
import SourceSpanRange from "../../utils/SourceSpanRange";
import StringOperand from "../../utils/StringOperand";
import IStringComparisonError from "./types/IStringComparisonError";

const RULE = "ADR-045: '=' and '!=' compare a string only with another string.";

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
    const leftIsString = StringOperand.is(operands[0], this.context);
    const rightIsString = StringOperand.is(operands[1], this.context);
    if (leftIsString !== rightIsString) {
      const other = leftIsString ? operands[1] : operands[0];
      if (!this.cannotType(other)) {
        this.report(other.span, this.notAString(other), RULE);
        return;
      }
    }
    const pairIsString = leftIsString || rightIsString;
    for (let i = 2; i < operands.length; i += 1) {
      const isString = StringOperand.is(operands[i], this.context);
      if (!pairIsString && !isString) continue;
      const comparison = SourceSpanRange.between(
        operands[0].span,
        operands[i - 1].span,
      );
      if (isString) {
        const pairs = ComparisonChain.pairs(level, this.context);
        this.report(
          comparison,
          ComparisonChain.message(level, i, "the string "),
          pairs === null ? RULE : `ADR-045: did you mean '${pairs}'?`,
        );
      } else {
        this.report(
          comparison,
          ComparisonChain.message(level, i),
          `ADR-045: a string comparison takes two operands. Did you mean '${StringComparisonAnalyzer.intent(level, i)}'?`,
        );
      }
      return;
    }
  }

  /**
   * What a bool past a string pair likely meant: `a = b = true` and
   * `a != b = false` are the pair itself, `a = b`; any other bool is compared
   * with the pair's result outright, `(a = b) = p`.
   */
  private static intent(level: TBinaryExpression, i: number): string {
    const tail = level.operands[i].written;
    const pair = ComparisonChain.written(level, 0, i);
    const last = i === level.operands.length - 1;
    if (i !== 2 || !last || (tail !== "true" && tail !== "false")) {
      const rest = ComparisonChain.written(level, i, level.operands.length);
      return `(${pair}) ${level.operators[i - 1]} ${rest}`;
    }
    const holds = (level.operators[1] === "=") === (tail === "true");
    if (holds) return pair;
    const flipped = level.operators[0] === "=" ? "!=" : "=";
    return `${level.operands[0].written} ${flipped} ${level.operands[1].written}`;
  }

  /** What cnx cannot type, which the C compiler judges instead */
  private cannotType(operand: TExpression): boolean {
    if (OperandTyper.isStringValue(operand, this.context) === null) return true;
    const form = OperandTyper.typeOf(operand, this.context)?.form;
    if (form?.kind === "unreadableMacro") return true;
    return form?.kind === "foreign" && form.indeterminate;
  }

  /** `'x' is a u32, not a string` */
  private notAString(operand: TExpression): string {
    const name = this.typeText(operand);
    const article = /^([aeio]|f\d)/.test(name) ? "an" : "a";
    return `'${operand.written}' is ${article} ${name}, not a string`;
  }

  /** The cnx type an operand has; an unsuffixed number has none but its kind */
  private typeText(operand: TExpression): string {
    if (operand.kind === "literal") {
      const kind = operand.literalKind;
      if (kind === "integer" || kind === "hex" || kind === "binary") {
        return "integer";
      }
      if (kind === "float") return "floating-point number";
    }
    const type = OperandTyper.typeOf(operand, this.context);
    if (type === null) return "value";
    return type.typeName + type.dimensions.map((d) => `[${d}]`).join("");
  }

  private report(span: ISourceSpan, message: string, helpText: string): void {
    this.found.push({ code: "E0929", span, message, helpText });
  }
}

export default StringComparisonAnalyzer;
