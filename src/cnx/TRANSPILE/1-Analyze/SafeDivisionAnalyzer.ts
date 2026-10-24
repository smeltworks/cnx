/**
 * ADR-051's `safe_div` / `safe_mod` call shape: E0884, E0885.
 *
 * #1322. Three throws in `CallExprGenerator`, all reported as `1:0`, and one
 * of them unreachable-looking but real.
 *
 * ## Two throws, one rule
 *
 * "the first argument is not a simple identifier" and "the first argument
 * names nothing with a type" were separate throws, and they are the same
 * sentence: the output parameter must be a VARIABLE, because the generated
 * helper takes its address. `safe_div(1 + 1, ...)` fails the first,
 * `safe_div(someFunction, ...)` the second, and a reader is owed one
 * explanation rather than two.
 *
 * The second looked dead -- an undeclared name is E0427, reported earlier --
 * but a name can be declared and still not be a variable. `safe_div(helper,
 * 10, 2, 0)` where `helper` is a function reaches it, which is why this is a
 * diagnostic rather than a deletion.
 *
 * ## Not asked here
 *
 * Whether the OUTPUT is read-only is ADR-071's rule, not ADR-051's, and it is
 * reported as E0900 by the const analyzer, which reads the same
 * `SafeDivision.outputName`. A const output was accepted before #1322 and
 * emitted `&K` into a non-const pointer parameter.
 */

import type ISourceSpan from "../../types/ISourceSpan";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import SafeDivision from "../../utils/SafeDivision";
import ISafeDivisionError from "./types/ISafeDivisionError";
import BoundDeclaration from "./helpers/BoundDeclaration";
import type IAnalysisContext from "./types/IAnalysisContext";

/** `safe_div(output, numerator, divisor, defaultValue)` (ADR-051) */
const REQUIRED_ARGUMENTS = 4;

/** #1991: reads 1.2's syntax, not the parse tree */
class SafeDivisionAnalyzer {
  private readonly found: ISafeDivisionError[] = [];

  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): ISafeDivisionError[] {
    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part)) this.check(expr);
      }
    }
    return this.found;
  }

  private check(expr: Parameters<typeof SafeDivision.callOf>[0]): void {
    const call = SafeDivision.callOf(expr);
    if (call === null) return;
    if (call.args.length !== REQUIRED_ARGUMENTS) {
      this.found.push({
        code: "E0884",
        span: expr.span,
        message: `${call.name} takes exactly ${REQUIRED_ARGUMENTS} arguments (output, numerator, divisor, defaultValue), not ${call.args.length}`,
        helpText:
          "The result is written to the first argument and the fourth is used when the divisor is zero, so neither can be left out (ADR-051).",
      });
      return;
    }
    const output = SafeDivision.outputName(call.args);
    if (output === null) {
      this.found.push({
        code: "E0885",
        span: call.args[0].span,
        message: `${call.name} writes its result to the first argument, so it must be a variable`,
        helpText:
          "The generated helper takes the output's address; an expression has none. Declare a variable and pass it (ADR-051).",
      });
      return;
    }
    if (!this.isDeclared(output, expr.span)) return;
    if (this.isVariable(output, expr.span)) return;
    this.found.push({
      code: "E0885",
      span: call.args[0].span,
      message: `${call.name} writes its result to the first argument, and '${output}' is not a variable`,
      helpText:
        "The generated helper takes the output's address. Declare a variable of the result's type and pass that (ADR-051).",
    });
  }

  private isDeclared(name: string, at: ISourceSpan): boolean {
    if (this.isVariable(name, at)) return true;
    return (
      this.context.symbols.functionReturnTypes.has(name) ||
      this.context.program.symbolByCName(name) !== undefined
    );
  }

  private isVariable(name: string, at: ISourceSpan): boolean {
    const binding = this.context.program.bindValue(
      this.context.sourceFile,
      null,
      name,
      at,
    );
    return BoundDeclaration.of(binding) !== null;
  }
}

export default SafeDivisionAnalyzer;
