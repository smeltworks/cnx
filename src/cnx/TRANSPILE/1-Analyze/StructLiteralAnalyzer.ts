/**
 * ADR-014 struct initializers: E0357 and E0358. Where a whole array is taken,
 * a struct initializer is E0866, `WholeArrayValueAnalyzer`'s (#1782).
 *
 * #1322. Two throws in `CodeGenerator._resolveStructInitializerTypeName`, both
 * reported as `1:0`, and one of them fired on valid code (#1277).
 *
 * ## One question, asked once
 *
 * A struct literal has no type of its own; the position it stands in supplies
 * one (`Point p <- { x: 1 }`). Where nothing does, nothing can say what struct
 * this is -- E0357. A bare `{ x: 1, y: 2 };` as an expression statement is the
 * only shape in the language that reaches it.
 *
 * ## E0356 is retired, with the syntax it rejected
 *
 * A second rule stood here: a WRITTEN type (`Point { x: 1 }`) where the
 * position already declared one was redundant. It had no reachable complement
 * -- every position that consumes a value declares a type, so the written form
 * was an error in all of them, and the one place it parsed was a bare
 * expression statement, where it built a compound literal and discarded it.
 * The grammar alternative is removed on the language owner's decision, which
 * makes `Point { x: 1 }` a parse error and leaves this rule with one question
 * rather than two.
 *
 * E0357's help therefore does not offer "write the type" as a remedy: there is
 * no type to write. The only remedy is to move the initializer somewhere a
 * type is declared.
 *
 * ## Why #1277 was a codegen bug and not this rule's business
 *
 * The "cannot infer" throw fired on three shapes that are perfectly valid:
 * `return { x: 1, y: 2 };` at file scope, the same inside a scope method, and
 * a `for` header's declaration. In each, a type WAS available and codegen
 * simply did not thread it -- the return path set an expected type only when
 * the return type was an enum, the `for` header set none at all, and the scope
 * method never recorded its return type. That is fixed at the three emission
 * sites, so the rule here sees a position that supplies a type and stays
 * silent. Relocating the throw without fixing them would have preserved a
 * rejection of valid code behind a fresh error code.
 *
 * The scope-method half was found by an invariant this card installed: a bare
 * enum member returned from a scope method reached `Internal:` rather than a
 * diagnostic, because 2.1 said the position established an enum type and
 * codegen disagreed. Two generators had open-coded the same four-step function
 * context and one was missing a line.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StructInitializerType from "./helpers/StructInitializerType";
import ValuePositions from "./helpers/ValuePositions";
import type IValuePosition from "../../types/IValuePosition";
import IStructLiteralError from "./types/IStructLiteralError";
import type IAnalysisContext from "./types/IAnalysisContext";

class StructLiteralCheck {
  private readonly found: IStructLiteralError[] = [];

  public constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  public errors(): IStructLiteralError[] {
    return this.found;
  }

  public checkExpression(init: TExpression): void {
    if (init.kind !== "structInitializer") return;
    const at = ValuePositions.at(this.positions, init);
    // The STRUCTURAL question -- "does some enclosing position supply a type?"
    // -- and deliberately not "which type", which a C-header struct's field
    // cannot answer in this pass. See `IValuePosition.supplied`.
    if (!at.supplied) {
      this.found.push({
        code: "E0357",
        span: init.span,
        message:
          "Cannot infer struct type: nothing here says which struct this is",
        helpText:
          "Put the initializer where a type is declared -- a variable, an assignment target, a field, an argument, or a return (ADR-014).",
      });
      return;
    }

    // ADR-014: where a whole array is taken, a struct initializer is not a
    // list -- E0866, `WholeArrayValueAnalyzer`'s, which ran before this.
    // `nonStructTypeOf` answers null there.

    // #1802: only a struct takes `{ field: value }`. A bitmap is its backing
    // integer wherever it is written, inside a struct or not (owner ruling
    // 2026-09-28), and a scalar's field list became a designated initializer
    // C rejects.
    const target = StructInitializerType.nonStructTypeOf(
      at,
      init.span,
      this.context,
    );
    if (target === null) return;
    this.found.push({
      code: "E0358",
      span: init.span,
      message: `A struct initializer cannot be a value of '${target.typeName}', which is not a struct`,
      helpText: target.isBitmap
        ? `A bitmap's value is its backing integer, set field by field after: '${target.typeName} v <- 0; v.<field> <- true;' (ADR-034).`
        : `Give a value of type '${target.typeName}'; only a struct takes '{ field: value }' (ADR-014).`,
    });
  }
}

class StructLiteralAnalyzer {
  public constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): IStructLiteralError[] {
    const check = new StructLiteralCheck(this.context, positions);
    for (const member of program.members) {
      for (const expr of DeclarationParts.of(member.declaration).flatMap(
        ExpressionNodes.of,
      )) {
        check.checkExpression(expr);
      }
    }
    return check
      .errors()
      .sort(
        (a, b) => a.span.line - b.span.line || a.span.column - b.span.column,
      );
  }
}

export default StructLiteralAnalyzer;
