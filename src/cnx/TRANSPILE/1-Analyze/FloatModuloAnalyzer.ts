/**
 * Float Modulo Analyzer
 * Detects modulo operator usage with floating-point types at compile time
 *
 * The modulo operator (%) is only valid for integer types in C.
 * cnx catches this early with a clear error message.
 *
 * Each operand is typed by the one operand typer (#1668), which binds names
 * through Program's lexical frames and types every operand shape -- a field,
 * an element, a call, a cast, a C or C++ header's value.
 *
 * Issue #1220: this used to be a private Set of float variable names built
 * from this file's parse tree alone, so an `f32` arriving through an #include
 * was invisible and `floatValue % 2` compiled to C that gcc then rejects with
 * "invalid operands to binary %". The typer is the one cross-file-aware answer
 * the essential-type analyzers share, instead of a per-analyzer cache.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import OperandTyper from "../../utils/OperandTyper";
import IFloatModuloError from "./types/IFloatModuloError";
import type IAnalysisContext from "./types/IAnalysisContext";

/** #1991: reads 1.2's syntax, not the parse tree */
class FloatModuloAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IFloatModuloError[] {
    const errors: IFloatModuloError[] = [];
    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part)) {
          if (expr.kind !== "binary") continue;
          expr.operators.forEach((operator, i) => {
            const left = expr.operands[i];
            if (operator !== "%") return;
            if (this.isFloat(left) || this.isFloat(expr.operands[i + 1])) {
              errors.push({
                code: "E0804",
                span: left.span,
                message:
                  "Modulo operator not supported for floating-point types",
                helpText:
                  "The % operator only works with integer types. Use fmod() from <math.h> for floating-point remainder.",
              });
            }
          });
        }
      }
    }
    return errors;
  }

  private isFloat(operand: Parameters<typeof OperandTyper.typeOf>[0]): boolean {
    return OperandTyper.typeOf(operand, this.context)?.category === "floating";
  }
}

export default FloatModuloAnalyzer;
