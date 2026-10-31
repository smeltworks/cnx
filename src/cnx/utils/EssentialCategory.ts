import OperandTyper from "./OperandTyper";
import type IOperandType from "../types/IOperandType";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";

/**
 * A Rule 10.4 category: `signed`, `unsigned`, `floating`, `character`,
 * `boolean`, or `enum:<C name>` -- each named enum its own -- or null for an
 * operand with none (an unsuffixed literal, a bit, a struct, an unknown).
 */
type TCategory = string | null;

/** The operators MISRA lets combine a character with an integer */
const CHARACTER_ARITHMETIC: ReadonlySet<string> = new Set(["+"]);

/**
 * MISRA C:2012 Rule 10.4's essential type categories (ADR-024), as policy
 * over the operand typer's facts: an operand's category, whether two may be
 * combined, and what a level of operators folds to. E0810 reports a mix from
 * these answers, and a conversion site reads a value's category from them
 * (#2375), so the two cannot disagree about what a value is.
 */
class EssentialCategory {
  /**
   * #1688 (ADR-024): a header macro cnx cannot type. Not a Rule 10.4
   * category -- it is rejected beside an integer only, as E0811 or E0812
   */
  static readonly UNREADABLE_MACRO = "unreadable macro";

  /** An operand's Rule 10.4 category, or null when it has none */
  static ofType(t: IOperandType | null): TCategory {
    if (t === null) return null;
    // An array is not an arithmetic operand of any category (#1191)
    if (t.dimensions.length > 0) return null;
    // A subscript into a scalar is a bit index or range, not arithmetic
    // on the scalar's category (ADR-024)
    if (t.form.kind === "bitIndex" || t.form.kind === "bitRange") return null;
    // Which overload a call selects is C++'s decision, not ours (C03)
    if (t.form.kind === "foreign" && t.form.indeterminate) return null;
    if (t.form.kind === "unreadableMacro") {
      return EssentialCategory.UNREADABLE_MACRO;
    }
    if (t.category === "enum") return `enum:${t.enumTypeName ?? t.typeName}`;
    return t.category === "none" ? null : t.category;
  }

  /**
   * A value's category: a level of operators folds its operands left to
   * right, and is null when a pair in it may not be combined; any other value
   * has the category its value leaves share, or null when they have none or
   * disagree. `leafType` lets a caller see a leaf as it does (an enum member
   * being declared is an `i32`, ADR-017).
   */
  static of(
    expr: TExpression,
    ctx: ITypingContext,
    leafType: (t: IOperandType | null) => IOperandType | null = (t) => t,
  ): TCategory {
    const level = OperandTyper.compositeLevelOf(expr);
    if (level !== null) {
      let running = EssentialCategory.of(level.operands[0], ctx, leafType);
      for (let i = 1; i < level.operands.length; i += 1) {
        const right = EssentialCategory.of(level.operands[i], ctx, leafType);
        const operator = level.operators[i - 1];
        if (EssentialCategory.differ(running, right, operator)) return null;
        running = EssentialCategory.fold(running, right, operator);
      }
      return running;
    }
    let resolved: TCategory = null;
    for (const leaf of OperandTyper.valueLeaves(expr, ctx)) {
      const category = EssentialCategory.ofType(leafType(leaf));
      if (category === null) continue;
      if (resolved === null) {
        resolved = category;
      } else if (resolved !== category) {
        return null;
      }
    }
    return resolved;
  }

  /** Whether two categories may not be combined by `operator` */
  static differ(left: TCategory, right: TCategory, operator: string): boolean {
    if (left === null || right === null || left === right) return false;
    const integer = (c: string) => c === "signed" || c === "unsigned";
    // ADR-024 (#1688): an unreadable macro needs a cast beside an integer
    // only; beside anything else it is C's to evaluate, as it always was
    const macro = EssentialCategory.UNREADABLE_MACRO;
    if (left === macro || right === macro) {
      return integer(left) || integer(right);
    }
    const characterExempt =
      CHARACTER_ARITHMETIC.has(operator) &&
      ((left === "character" && integer(right)) ||
        (right === "character" && integer(left)));
    return !characterExempt;
  }

  /**
   * The category after `running operator right`: character for MISRA's
   * exempt character + integer (D.7), the running one when `right` has
   * none, and `right`'s otherwise. Owner ruling (2026-09-28, #1760 review):
   * D.7 stands, so `u32 a + 'A' + i32 s` is legal; computing its exact
   * value into the destination is #1809.
   */
  static fold(
    running: TCategory,
    right: TCategory,
    operator: string,
  ): TCategory {
    const macro = EssentialCategory.UNREADABLE_MACRO;
    if (right === null || right === macro) return running ?? right;
    if (running === null || running === macro) return right;
    if (
      running !== right &&
      !EssentialCategory.differ(running, right, operator)
    ) {
      return "character";
    }
    return right;
  }
}

export default EssentialCategory;
