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

import BindingSite from "../../utils/BindingSite";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import ProgramAccesses from "../../utils/ProgramAccesses";
import type IValuePositions from "../../types/IValuePositions";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import OperandTyper from "../../utils/OperandTyper";
import ExpressionShape from "../../utils/ExpressionShape";
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import BitmapFieldStep from "../../utils/BitmapFieldStep";
import type IBitmapFieldTarget from "../../types/IBitmapFieldTarget";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import PROPERTY_NAMES from "../../utils/constants/PROPERTY_NAMES";
import IBitmapAccessError from "./types/IBitmapAccessError";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";
import ValuePositions from "./helpers/ValuePositions";
import StructInitializerType from "./helpers/StructInitializerType";
import type IValuePosition from "../../types/IValuePosition";
import type IOperandType from "../../types/IOperandType";
import type ISourceSite from "../../types/ISourceSite";
import BitFieldIntegerType from "../../utils/BitFieldIntegerType";

/** The bits an assignment target holds: a bitmap field, or a C bit-field */
type TFieldBits = {
  readonly width: number;
  readonly name: string;
  readonly signed: boolean;
  /** How the help says to make the field wider */
  readonly widen: string;
  /** The integer a constant written to it folds at; null for a cnx field */
  readonly foldAs: string | null;
};

class BitmapAccessCheck {
  private readonly found: IBitmapAccessError[] = [];

  public constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  public errors(): IBitmapAccessError[] {
    return this.found;
  }

  public checkExpression(expr: TExpression): void {
    if (expr.kind === "postfix") this.checkChain(expr);
    if (expr.kind === "structInitializer") this.checkInitializer(expr);
  }

  /** A header struct's bit-field written by `{ field: value }`, as by `<-` */
  private checkInitializer(
    expr: Extract<TExpression, { kind: "structInitializer" }>,
  ): void {
    const declaredAt = StructInitializerType.declarationOf(
      ValuePositions.at(this.positions, expr),
      expr.span,
      this.context,
    );
    for (const field of expr.fields) {
      const t = ValuePositions.at(this.positions, field.value).headerField;
      const bits = BitmapAccessCheck.headerBits(t, field.name);
      if (bits !== null) this.checkFits(declaredAt, bits, field.value);
    }
  }

  public checkSite(site: IAssignmentSyntax): void {
    if (site.target.kind !== "postfix") return;
    const field = this.checkChain(site.target);
    // A one-bit bitmap field is a bool, so E0945 judges what it takes
    if (field !== null && field.layout.width === 1) return;
    const bits =
      field === null
        ? this.headerBitField(site.target)
        : BitmapAccessCheck.bitmapBits(field);
    if (bits === null) return;
    this.checkFits(
      BindingSite.ofChain(site.target, this.context),
      bits,
      site.value,
    );
  }

  private static bitmapBits(field: IBitmapFieldTarget): TFieldBits {
    return {
      width: field.layout.width,
      name: field.fieldName,
      signed: false,
      widen: "widen the field in the bitmap declaration",
      foldAs: null,
    };
  }

  /**
   * A C header struct's bit-field holds its declared width, as a cnx bitmap
   * field does (#1975), and takes a bitmap field's rules (ADR-072 ruling 19)
   */
  private headerBitField(target: TExpressionOf<"postfix">): TFieldBits | null {
    if (!OperandTyper.chainOf(target, this.context).endsOnBitField) return null;
    const name = target.ops.at(-1);
    if (name?.kind !== "member") return null;
    return BitmapAccessCheck.headerBits(
      OperandTyper.typeOfTarget(target, this.context),
      name.name,
    );
  }

  private static headerBits(
    t: IOperandType | null,
    name: string,
  ): TFieldBits | null {
    if (t?.bitWidth == null) return null;
    return {
      width: t.bitWidth,
      name,
      signed: t.category === "signed",
      widen: "widen the bit-field in its header",
      foldAs: BitFieldIntegerType.of(t),
    };
  }

  /**
   * E0881: a known value must fit the field it is written to. A typed
   * value is judged by its type, which E0869 owns (ADR-072 ruling 17), and a
   * one-bit bitmap field is a bool, whose values E0945 judges (#2372). A
   * ternary that does not fold is judged arm by arm, since each arm lands in
   * the field (ADR-022); one that folds is judged by the arm it picks.
   */
  private checkFits(
    declaredAt: ISourceSite | undefined,
    field: TFieldBits,
    expr: TExpression,
  ): void {
    const result = OperandTyper.constantResultOf(
      expr,
      this.context,
      field.foldAs,
    );
    const inner = ExpressionShape.unparenthesized(expr);
    if (result.kind !== "value" && inner.kind === "ternary") {
      this.checkFits(declaredAt, field, inner.whenTrue);
      this.checkFits(declaredAt, field, inner.whenFalse);
      return;
    }
    if (result.kind !== "value") return;
    if (result.typeName !== null) return;
    const value = ConstantEvaluator.toNumber(result.value);
    if (value === undefined) return;
    const width = field.width;
    const minimum = field.signed ? -(2 ** (width - 1)) : 0;
    const maximum = field.signed ? 2 ** (width - 1) - 1 : 2 ** width - 1;
    // A negative value written to an unsigned field is E0868's
    if (value <= maximum && (value >= minimum || !field.signed)) return;
    const bound = value > maximum ? "exceeds" : "is below";
    const limit =
      value > maximum ? `maximum of ${maximum}` : `minimum of ${minimum}`;
    this.found.push({
      code: "E0881",
      span: expr.span,
      declaredAt,
      message: `Value ${value} ${bound} ${width}-bit field '${field.name}' ${limit}`,
      helpText: `A ${width}-bit field holds ${minimum} through ${maximum}; ${field.widen}, or write a value that fits (ADR-034).`,
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
          declaredAt: BindingSite.ofChain(node, this.context),
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
          // #1402: about the bitmap type, wherever it is declared
          declaredAt: BindingSite.ofCName(bitmap, this.context),
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
          declaredAt: BindingSite.ofChain(node, this.context),
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
  public analyze(
    program: IProgramSyntax,
    valuePositions: IValuePositions,
  ): IBitmapAccessError[] {
    const check = new BitmapAccessCheck(this.context, valuePositions.positions);
    ProgramAccesses.checkReadsAndWrites(program, valuePositions, check);
    return check.errors().sort(SourceOrder.bySpan);
  }
}

export default BitmapAccessAnalyzer;
