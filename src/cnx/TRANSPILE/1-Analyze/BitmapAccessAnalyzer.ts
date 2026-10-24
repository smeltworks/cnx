/**
 * ADR-034 bitmap access: E0881, E0882, E0883.
 *
 * #1322. Three throws in three files, each resolving "what bitmap is this?" its
 * own way and all reporting `1:0` -- the bracket-indexing one built a
 * `Error at line N:` prefix into its message, which is a position smuggled
 * through prose rather than carried by the diagnostic.
 *
 * ## One resolution, two ways to hold a bitmap
 *
 * A bitmap is reached either through a declared variable (`Flags f; f.Mode`)
 * or through a register member typed by one (`this.SysTick.CTRL`). Codegen
 * asked those separately -- the literal-overflow check keyed on the assignment
 * handler's already-resolved field, the unknown-field check on a map lookup
 * deep in expression generation, and the bracket check on
 * a register-member map keyed by a GENERATED C name, which is why it could
 * only ever fire for registers. Here both routes answer one question,
 * the typer's chain (#1749 review), and all three rules read it.
 *
 * That is also what closes the bracket rule's hole: `f[0]` on a bitmap
 * VARIABLE was accepted and emitted as a bit index, because the check looked
 * only in the register map. ADR-034 says a bitmap is addressed by named field.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import ProgramAccesses from "../../utils/ProgramAccesses";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import OperandTyper from "../../utils/OperandTyper";
import BitmapFieldStep from "../../utils/BitmapFieldStep";
import type IBitmapFieldTarget from "../../types/IBitmapFieldTarget";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import PROPERTY_NAMES from "../../utils/constants/PROPERTY_NAMES";
import ConstantExpression from "./helpers/ConstantExpression";
import IBitmapAccessError from "./types/IBitmapAccessError";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";

class BitmapAccessCheck {
  private readonly found: IBitmapAccessError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IBitmapAccessError[] {
    return this.found;
  }

  public checkExpression(expr: TExpression): void {
    if (expr.kind === "postfix") this.checkChain(expr);
  }

  public checkSite(site: IAssignmentSyntax): void {
    if (site.target.kind !== "postfix") return;
    const field = this.checkChain(site.target);
    if (field === null) return;

    // E0881: the value must fit the field it is written to. Folded by the
    // one binder, so a const is its value (#1760 second review: reading the
    // literal text let `f.Mode <- BIG` truncate silently).
    const value = ConstantExpression.valueAt(site.value, this.context);
    const maximum = 2 ** field.layout.width - 1;
    if (value === null || value <= maximum) return;
    this.found.push({
      code: "E0881",
      span: site.value.span,
      message: `Value ${value} exceeds ${field.layout.width}-bit field '${field.fieldName}' maximum of ${maximum}`,
      helpText: `A ${field.layout.width}-bit field holds 0 through ${maximum}; widen the field in the bitmap declaration, or write a value that fits (ADR-034).`,
    });
  }

  /**
   * Walk one chain as the typer typed it, whatever spells its prefix (#1749
   * review): every step off a bitmap value is a named field of it. Reports
   * E0921, E0883 and E0882 where they apply, and returns the bitmap field the
   * chain ends at when it ends at one.
   */
  private checkChain(
    node: TExpressionOf<"postfix">,
  ): IBitmapFieldTarget | null {
    const bitmaps = this.context.symbols.bitmapFields;
    if (!bitmaps) return null;
    const steps = OperandTyper.chainOf(node, this.context).steps;
    for (const [i, step] of steps.entries()) {
      const bitmap = step.before?.bitmapTypeName;
      const fields = bitmap ? bitmaps.get(bitmap) : undefined;
      if (!bitmap || fields === undefined) continue;
      if (step.before!.dimensions.length > 0) {
        if (step.member === null || step.property !== null) continue;
        this.found.push({
          code: "E0921",
          span: node.span,
          message: `Field '${step.member}' of an array of '${bitmap}' names no element`,
          helpText: `A field belongs to one '${bitmap}' value; index every dimension first, e.g. NAME[i].${step.member} (ADR-034).`,
        });
        return null;
      }
      // ADR-034 addresses a bitmap by named field, never by bit index
      if (step.subscript !== null) {
        this.found.push({
          code: "E0883",
          span: node.span,
          message: `Cannot use bracket indexing on bitmap type '${bitmap}'`,
          helpText: `A bitmap is addressed by named field, not by bit index -- write ${BitmapAccessCheck.spellingBefore(node, steps.length, i)}.FIELD_NAME (ADR-034).`,
        });
        return null;
      }
      // ADR-058's properties describe the type's shape rather than name a
      // field, so they are not unknown fields. E0867 owns whether one is used
      // correctly.
      const field = step.member;
      if (field === null || step.property !== null) continue;
      if (PROPERTY_NAMES.has(field)) continue;
      if (!fields.has(field)) {
        const known = [...fields.keys()];
        const quoted = known.map((k) => `'${k}'`).join(", ");
        this.found.push({
          code: "E0882",
          span: node.span,
          message: `Unknown bitmap field '${field}' on '${bitmap}'`,
          helpText:
            known.length === 0
              ? "The bitmap declares no fields (ADR-034)."
              : `'${bitmap}' declares ${quoted} (ADR-034).`,
        });
        return null;
      }
    }
    return BitmapFieldStep.fieldOf(steps.at(-1), bitmaps);
  }

  /**
   * The name spelled before the typer's step `at` -- the typer types the
   * chain's last `count` operations -- for a message to show
   */
  private static spellingBefore(
    node: TExpressionOf<"postfix">,
    count: number,
    at: number,
  ): string {
    const op = node.ops[node.ops.length - count + at - 1];
    if (op === undefined) {
      return node.primary.kind === "identifier" ? node.primary.name : "NAME";
    }
    return op.kind === "member" ? op.name : "NAME";
  }
}

class BitmapAccessAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /**
   * #1991: reads 1.2's syntax, not the parse tree. A target is checked as a
   * site, with its value, and not again as an expression.
   */
  public analyze(program: IProgramSyntax): IBitmapAccessError[] {
    const check = new BitmapAccessCheck(this.context);
    ProgramAccesses.checkReadsAndWrites(program, check);
    return check.errors().sort(SourceOrder.bySpan);
  }
}

export default BitmapAccessAnalyzer;
