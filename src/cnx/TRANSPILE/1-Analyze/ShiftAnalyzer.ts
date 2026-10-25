/**
 * Shift Analyzer: E0805 (signed operand) and E0873 (amount out of range).
 *
 * MISRA C:2012 Rule 10.1: Operands shall not be of an inappropriate essential type
 * - Left-shifting negative signed values is undefined behavior in C
 * - Right-shifting negative signed values is implementation-defined in C
 *
 * cnx rejects all shift operations on signed types (i8, i16, i32, i64) at
 * compile time to ensure defined, portable behavior.
 *
 * MISRA C:2012 Rule 12.2: the right operand of a shift shall lie in the range
 * zero to one less than the essential width of the left operand. #1322 moved
 * that rule here from `output/`. It reads the LEADING operand's type, as
 * codegen did (`(a + 1) << 9` is a composite and stays untyped), and
 * evaluates the amount when it is a literal or a named const. The compound
 * forms (`a <<<- 9`) are checked the same way.
 *
 * The signed rule asks whether ANY value leaf of the shifted operand is
 * signed, or is a negated literal (`-5`, signed in C, though an unsuffixed
 * literal has no category of its own under ADR-052). The width rule asks the
 * leading operand's type.
 *
 * Every operand is typed by the one operand typer, and every amount is
 * evaluated by it, binding names through Program's lexical frames (#1668):
 * a field, element, cast, call or C header operand is typed like a variable,
 * and a const local shadows as it does everywhere else. Every assignment
 * site is checked, `for` headers included (#1726).
 */

import IShiftError from "./types/IShiftError";
import type ISourceSpan from "../../types/ISourceSpan";
import OperandTyper from "../../utils/OperandTyper";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import ProgramAccesses from "../../utils/ProgramAccesses";
import CompoundOperator from "../../utils/CompoundOperator";
import EnumMemberValue from "./EnumMemberValue";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import type IOperandType from "../../types/IOperandType";
import SourceOrder from "../../utils/SourceOrder";

class ShiftCheck {
  constructor(
    private readonly analyzer: ShiftAnalyzer,
    private readonly context: IAnalysisContext,
  ) {}

  /** Each `<<` / `>>` of one shift level, between adjacent operands */
  public checkLevel(
    level: TBinaryExpression,
    enumBeingDeclared: string | null,
  ): void {
    for (let i = 0; i < level.operators.length; i += 1) {
      const operator = level.operators[i];
      if (operator !== "<<" && operator !== ">>") continue;

      const left = level.operands[i];
      if (this.isSigned(left, enumBeingDeclared)) {
        this.analyzer.addError(left.span, operator);
        continue;
      }

      // Rule 12.2: the amount against the width of the value shifted. For a
      // composite that is ADR-044's composite type, the one codegen emits it
      // by (#1668 review: this read the first leaf's, so `a + b << 9` with a
      // u8 `a` and a u32 `b` was E0873 against 8 bits, while the C shifts
      // `cnx_clamp_add_u32(a, b)`)
      this.checkAmount(
        ShiftCheck.shiftedType(left, this.context, enumBeingDeclared),
        level.operands[i + 1],
        level.written,
      );
    }
  }

  /**
   * `<<<-` and `>><-`: a signed target is E0805 (#1008), and the amount is
   * checked against the target's width, which codegen never did -- `a <<<- 9`
   * on a u8 emitted `a = (uint8_t)(a << 9U)` at exit 0.
   */
  public checkAssignment(site: IAssignmentSyntax): void {
    const operator = CompoundOperator.binaryOf(site.operator);
    if (operator !== "<<" && operator !== ">>") return;

    const targetType = OperandTyper.typeOfTarget(site.target, this.context);
    if (targetType?.category === "signed") {
      this.analyzer.addError(site.target.span, site.operator);
      return;
    }
    this.checkAmount(targetType, site.value, site.written);
  }

  /**
   * The type of the value a shift shifts: a composite's integer type, as the
   * typer settled it, or the operand's own type.
   */
  private static shiftedType(
    left: TExpression,
    context: IAnalysisContext,
    enumBeingDeclared: string | null,
  ): IOperandType | null {
    const t = EnumMemberValue.operandType(
      OperandTyper.typeOf(left, context),
      enumBeingDeclared,
    );
    if (t?.form.kind !== "composite") return t;
    if (t.typeName === null || t.bitWidth === null) return null;
    return {
      ...t,
      category: TypeCheckUtils.isSigned(t.typeName) ? "signed" : "unsigned",
    };
  }

  /**
   * Any value leaf signed, or a negated literal. A member of the enum being
   * declared is an i32 there (ADR-017), so `B <- E.A << 1` is a signed shift.
   */
  private isSigned(
    operand: TExpression,
    enumBeingDeclared: string | null,
  ): boolean {
    return OperandTyper.valueLeaves(operand, this.context).some((raw) => {
      const leaf = EnumMemberValue.operandType(raw, enumBeingDeclared);
      return (
        leaf !== null &&
        (leaf.category === "signed" ||
          (leaf.form.kind === "literal" && leaf.form.negated))
      );
    });
  }

  /**
   * E0873: a compile-time shift amount that is negative or not below the
   * width of the shifted operand's type. Silent when either side is unknown
   * -- a runtime amount, or an operand with no integer width. A bit of a
   * scalar is not an integer operand of its own (ADR-024).
   */
  private checkAmount(
    shifted: IOperandType | null,
    amountExpr: TExpression,
    written: string,
  ): void {
    if (shifted === null) return;
    if (shifted.form.kind === "bitIndex" || shifted.form.kind === "bitRange") {
      return;
    }
    const integer =
      shifted.category === "signed" || shifted.category === "unsigned";
    const width = shifted.bitWidth;
    if (!integer || width === null || shifted.dimensions.length > 0) return;
    const leftType = shifted.typeName ?? shifted.category;
    const amount = OperandTyper.constantOf(amountExpr, this.context);
    if (amount === null) return;
    const span = amountExpr.span;
    if (amount < 0) {
      this.analyzer.addAmountError(
        span,
        `Negative shift amount (${amount}) is undefined behavior (type: ${leftType}, expression: ${written})`,
        "Shift amounts must be non-negative (MISRA C:2012 Rule 12.2).",
      );
      return;
    }
    if (amount >= width) {
      this.analyzer.addAmountError(
        span,
        `Shift amount (${amount}) exceeds type width (${width} bits) for type '${leftType}' (expression: ${written})`,
        `Shift amount must be < ${width} for ${width}-bit types; shifting by the width or more is undefined behavior (MISRA C:2012 Rule 12.2).`,
      );
    }
  }
}

/**
 * Analyzer that detects shift operations on signed integer types, and shift
 * amounts outside the shifted operand's width.
 */
class ShiftAnalyzer {
  private errors: IShiftError[] = [];

  /** #1456: handed in rather than read off shared state. */
  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(program: IProgramSyntax): IShiftError[] {
    this.errors = [];
    const check = new ShiftCheck(this, this.context);

    for (const [expr, enumBeingDeclared] of EnumMemberValue.expressions(
      program,
    )) {
      if (expr.kind === "binary") check.checkLevel(expr, enumBeingDeclared);
    }
    for (const site of ProgramAccesses.writes(program)) {
      check.checkAssignment(site);
    }

    // Levels, then assignments; report in source order
    return this.errors.sort(SourceOrder.bySpan);
  }

  /**
   * Add a signed shift error
   */
  public addError(span: ISourceSpan, operator: string): void {
    this.errors.push({
      code: "E0805",
      span,
      message: `Shift operator '${operator}' not allowed on signed integer types`,
      helpText:
        "Shift operations on signed integers have undefined (<<) or implementation-defined (>>) behavior. Use unsigned types (u8, u16, u32, u64) for bit manipulation.",
    });
  }

  /**
   * Add a shift amount error (E0873)
   */
  public addAmountError(
    span: ISourceSpan,
    message: string,
    helpText: string,
  ): void {
    this.errors.push({ code: "E0873", span, message, helpText });
  }
}

export default ShiftAnalyzer;
