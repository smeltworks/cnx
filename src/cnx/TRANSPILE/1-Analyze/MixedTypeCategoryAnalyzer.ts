/**
 * Mixed Type Category Analyzer
 *
 * Detects operators whose two operands have different essential type
 * categories at compile time: signed, unsigned, floating, and -- per MISRA
 * C:2012 Rule 10.4, for cnx and header types alike (#1668, ruling 2) --
 * character, Boolean, and each named enum as a category of its own.
 *
 * MISRA C:2012 Rule 10.4: "Both operands of an operator in which the usual
 * arithmetic conversions are performed shall have the same essential type
 * category." Combining a signed and an unsigned value (e.g. `u32 + i32`) relies
 * on C's usual arithmetic conversions, whose result can be surprising (ADR-024).
 *
 * To combine a signed and an unsigned value, the developer reinterprets one
 * operand's bits to the other's category with bit indexing (ADR-007), e.g.
 * `a + b[0, 32]`, making the conversion explicit. To combine an integer and a
 * floating value, the developer casts the integer, e.g. `(f32)i * k` (#1668).
 *
 * UNSUFFIXED integer literals are exempt: such a literal has no fixed
 * essential category — it is contextually typed to the other operand
 * (ADR-052), so `a + 5` and `k * 3` are fine. A suffixed literal has its
 * suffix's category (#1668, R2): `a + 5i32` is signed against unsigned. A
 * float literal is NOT exempt: no integer operand can adopt it, so `i * 2.5`
 * is floating against unsigned. MISRA's one exception is kept: `+` and `+<-`
 * may combine a character with a signed or unsigned operand. The rule fires
 * only when BOTH operands resolve to a category, and the two differ.
 *
 * Compound assignments (`+<-`, `*<-`, ...) are the same operators, so the
 * target and the value are compared the same way (#1668). `y *<- 2.5` is
 * `y <- y * 2.5`; checking only the binary form rejected the second spelling
 * and accepted the first.
 *
 * Each operand is typed by the one operand typer (#1668), which binds a name
 * through Program's lexical frames -- so a same-named variable of a different
 * category in another function or a nested block never poisons the lookup
 * (Issue #1085 review) -- and types every shape of operand: fields, elements,
 * calls, casts, C and C++ operands. This analyzer applies Rule 10.4's policy
 * to the facts (`rule104Category`); the typer decides no policy.
 *
 * Note: shift operators (<< / >>) are intentionally NOT checked here — MISRA
 * Rule 10.4 only governs operators subject to the usual arithmetic conversions,
 * and a shift count is promoted independently. A signed shift count is a Rule
 * 10.1 concern handled elsewhere (Issue #1085 review).
 */

import type TExpression from "../../types/syntax/TExpression";
import IMixedTypeCategoryError from "./types/IMixedTypeCategoryError";
import OperatorOperandAnalyzer from "./OperatorOperandAnalyzer";
import EnumValueResolver from "./EnumValueResolver";
import OperandTyper from "../../utils/OperandTyper";
import CompoundOperator from "../../utils/CompoundOperator";
import CLAMP_HELPER_FOR_OPERATOR from "../../types/CLAMP_HELPER_FOR_OPERATOR";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TBinaryOperatorLevel from "./types/TBinaryOperatorLevel";
import type IOperandType from "../../types/IOperandType";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import EnumMemberValue from "./EnumMemberValue";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import SourceOrder from "../../utils/SourceOrder";

/**
 * A Rule 10.4 category: `signed`, `unsigned`, `floating`, `character`,
 * `boolean`, or `enum:<C name>` -- each named enum its own -- or null for an
 * operand with none (an unsuffixed literal, a bit, a struct, an unknown).
 */
type Category = string | null;

/** The places two operands meet: a binary operator, a ternary, a compound assignment */
type TOperatorSite = "binary" | "conditional" | "compound";

/**
 * #1688 (ADR-024): a header macro cnx cannot type. Not a Rule 10.4
 * category -- it is rejected beside an integer only, as E0811 or E0812
 */
const UNREADABLE_MACRO = "unreadable macro";

/**
 * The compound arm's shifts, whose operands are not Rule 10.4 operands. The
 * binary walk skips the same operators by level (`level === "shift"`); #2049
 * makes the two one rule.
 */
const NOT_RULE_10_4_OPERATORS: ReadonlySet<string> = new Set(["<<", ">>"]);

/** The operators MISRA lets combine a character with an integer */
const CHARACTER_ARITHMETIC: ReadonlySet<string> = new Set(["+"]);

class MixedCategoryCheck {
  private readonly enums: EnumValueResolver;

  /**
   * Each checked level's own category, for the level that contains it: the
   * running category it folded to, or null when a pair in it differed --
   * already reported there, once. Levels are checked innermost first.
   */
  private readonly levelCategories = new Map<string, Category>();

  /** The enum whose member values are being read (`EnumMemberValue`) */
  public enumBeingDeclared: string | null = null;

  constructor(
    private readonly analyzer: MixedTypeCategoryAnalyzer,
    private readonly context: IAnalysisContext,
  ) {
    this.enums = new EnumValueResolver(context);
  }

  /**
   * One key per written node: each lowering builds new objects, so a level is
   * known again by where it was written, not by identity.
   */
  private static writtenAt(expr: TExpression): string {
    const { line, column, endLine, endColumn } = expr.span;
    return `${expr.kind}:${line}:${column}:${endLine}:${endColumn}`;
  }

  /**
   * An operand's Rule 10.4 category, or null when it has none. The policy
   * over the typer's facts, decided here and only here.
   */
  static rule104Category(t: IOperandType | null): Category {
    if (t === null) return null;
    // An array is not an arithmetic operand of any category (#1191)
    if (t.dimensions.length > 0) return null;
    // A subscript into a scalar is a bit index or range, not arithmetic
    // on the scalar's category (ADR-024)
    if (t.form.kind === "bitIndex" || t.form.kind === "bitRange") return null;
    // Which overload a call selects is C++'s decision, not ours (C03)
    if (t.form.kind === "foreign" && t.form.indeterminate) return null;
    if (t.form.kind === "unreadableMacro") return UNREADABLE_MACRO;
    if (t.category === "enum") return `enum:${t.enumTypeName ?? t.typeName}`;
    return t.category === "none" ? null : t.category;
  }

  /**
   * One category for an operand. An operand that is itself an operator level
   * has the category that level folded to; any other has the category its
   * value leaves share, or null when they have none -- or disagree, which is
   * reported at the inner operator, once.
   */
  private operandCategory(operand: TExpression): Category {
    const level = OperandTyper.compositeLevelOf(operand);
    const key = level === null ? null : MixedCategoryCheck.writtenAt(level);
    if (key !== null && this.levelCategories.has(key)) {
      return this.levelCategories.get(key) ?? null;
    }
    let resolved: Category = null;
    for (const leaf of OperandTyper.valueLeaves(operand, this.context)) {
      const category = MixedCategoryCheck.rule104Category(
        EnumMemberValue.operandType(leaf, this.enumBeingDeclared),
      );
      if (category === null) continue;
      if (resolved === null) {
        resolved = category;
      } else if (resolved !== category) {
        return null;
      }
    }
    return resolved;
  }

  /**
   * Checks one level, folding a running category left to right (#1760
   * review). Only adjacent operands were compared, so a category-less
   * literal between two operands broke the chain: `a * 2 * k` passed. A
   * category-less operand now adopts the running category; an exempt
   * character + integer gives character (MISRA C:2012 D.7); after a pair
   * that differs -- reported there -- the right operand's category runs on.
   */
  public checkLevel(
    expr: TBinaryExpression,
    level: TBinaryOperatorLevel,
  ): void {
    const operands = expr.operands;
    let running = this.operandCategory(operands[0]);
    let mixed = false;
    for (let i = 1; i < operands.length; i += 1) {
      const right = this.operandCategory(operands[i]);
      const operator = expr.operators[i - 1];
      if (this.reportsPair(operands[i - 1], operands[i], level, operator)) {
        if (MixedCategoryCheck.differ(running, right, operator)) {
          this.analyzer.addError(
            operands[i].span.line,
            operands[i].span.column,
            running!,
            right!,
            "binary",
            operator,
          );
          mixed = true;
        }
      }
      running = MixedCategoryCheck.fold(running, right, operator);
    }
    this.levelCategories.set(
      MixedCategoryCheck.writtenAt(expr),
      mixed ? null : running,
    );
  }

  /** Whether this rule, not another, reports a mix between two operands */
  private reportsPair(
    left: TExpression,
    right: TExpression,
    level: TBinaryOperatorLevel,
    operator: string,
  ): boolean {
    if (this.enumComparison(left, right, level)) return false;
    return !this.ownedElsewhere(
      operator,
      EnumMemberValue.operandType(
        OperandTyper.typeOf(left, this.context),
        this.enumBeingDeclared,
      ),
      EnumMemberValue.operandType(
        OperandTyper.typeOf(right, this.context),
        this.enumBeingDeclared,
      ),
    );
  }

  /**
   * The category after `running operator right`: character for MISRA's
   * exempt character + integer (D.7), the running one when `right` has
   * none, and `right`'s otherwise. Owner ruling (2026-09-28, #1760 review):
   * D.7 stands, so `u32 a + 'A' + i32 s` is legal here; computing its exact
   * value into the destination is #1809.
   */
  private static fold(
    running: Category,
    right: Category,
    operator: string,
  ): Category {
    if (right === null || right === UNREADABLE_MACRO) return running ?? right;
    if (running === null || running === UNREADABLE_MACRO) return right;
    if (
      running !== right &&
      !MixedCategoryCheck.differ(running, right, operator)
    ) {
      return "character";
    }
    return right;
  }

  /**
   * Whether ADR-017 reports this pair (E0434, with its own message), so that
   * one defect has one code. Asked of E0434's own reading, so the two cannot
   * disagree about what is a cnx enum: a header's enum is not one there,
   * and its comparison with an integer is this rule's mix.
   */
  private enumComparison(
    left: TExpression,
    right: TExpression,
    level: TBinaryOperatorLevel,
  ): boolean {
    if (level !== "equality" && level !== "relational") return false;
    return (
      this.enums.classify(left).kind === "enum" ||
      this.enums.classify(right).kind === "enum"
    );
  }

  /**
   * Whether Rule 10.1 reports this pair: an operand its operator does not
   * take (E0804/E0806/E0807/E0925), so that one defect has one code.
   */
  private ownedElsewhere(
    operator: string,
    left: IOperandType | null,
    right: IOperandType | null,
  ): boolean {
    return (
      !OperatorOperandAnalyzer.admits(operator, left, this.context) ||
      !OperatorOperandAnalyzer.admits(operator, right, this.context)
    );
  }

  /**
   * A conditional's two value arms are Rule 10.4 operands of each other
   * (ruling R3); its condition is not an operand. An arm whose own leaves
   * are mixed has no category, so that defect is reported once, at its own
   * operator, and never again here.
   */
  public checkTernary(expr: TExpression): void {
    if (expr.kind !== "ternary") return;
    const left = this.operandCategory(expr.whenTrue);
    const right = this.operandCategory(expr.whenFalse);
    if (left === null || right === null || left === right) return;
    if (
      (left === UNREADABLE_MACRO || right === UNREADABLE_MACRO) &&
      !MixedCategoryCheck.differ(left, right, ":")
    ) {
      return;
    }
    this.analyzer.addError(
      expr.whenFalse.span.line,
      expr.whenFalse.span.column,
      left,
      right,
      "conditional",
    );
  }

  /** Whether two categories may not be combined by `operator` */
  private static differ(
    left: Category,
    right: Category,
    operator: string,
  ): boolean {
    if (left === null || right === null || left === right) return false;
    const integer = (c: string) => c === "signed" || c === "unsigned";
    // ADR-024 (#1688): an unreadable macro needs a cast beside an integer
    // only; beside anything else it is C's to evaluate, as it always was
    if (left === UNREADABLE_MACRO || right === UNREADABLE_MACRO) {
      return integer(left) || integer(right);
    }
    const characterExempt =
      CHARACTER_ARITHMETIC.has(operator) &&
      ((left === "character" && integer(right)) ||
        (right === "character" && integer(left)));
    return !characterExempt;
  }

  public checkCompound(site: IAssignmentSyntax): void {
    const operator = CompoundOperator.binaryOf(site.operator);
    if (operator === null || NOT_RULE_10_4_OPERATORS.has(operator)) return;

    const value = site.value;
    const target = OperandTyper.typeOfTarget(site.target, this.context);
    if (
      this.ownedElsewhere(
        operator,
        target,
        OperandTyper.typeOf(value, this.context),
      )
    ) {
      return;
    }
    const left = MixedCategoryCheck.rule104Category(target);
    const right = this.operandCategory(value);
    if (MixedCategoryCheck.differ(left, right, operator)) {
      this.analyzer.addError(
        value.span.line,
        value.span.column,
        left!,
        right!,
        "compound",
        operator,
      );
    }
  }
}

class MixedTypeCategoryAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IMixedTypeCategoryError[] = [];

  public analyze(program: IProgramSyntax): IMixedTypeCategoryError[] {
    this.errors = [];
    const check = new MixedCategoryCheck(this, this.context);
    const expressions = EnumMemberValue.parts(program).flatMap(
      ([part, enumBeingDeclared]) =>
        ExpressionNodes.of(part).map((expr): [TExpression, string | null] => [
          expr,
          enumBeingDeclared,
        ]),
    );

    // Levels are met outermost first; checked innermost first, so a level
    // that is an operand of another has its category when that one asks
    const levels: Array<
      [TBinaryExpression, TBinaryOperatorLevel, string | null]
    > = [];
    for (const [expr, enumBeingDeclared] of expressions) {
      if (expr.kind !== "binary") continue;
      const level = expr.level;
      if (level === "or" || level === "and" || level === "shift") continue;
      levels.push([expr, level, enumBeingDeclared]);
    }
    levels.reverse();
    for (const [expr, level, enumBeingDeclared] of levels) {
      check.enumBeingDeclared = enumBeingDeclared;
      check.checkLevel(expr, level);
    }
    check.enumBeingDeclared = null;

    for (const member of program.declarations) {
      for (const site of StatementNodes.assignments(member.declaration)) {
        check.checkCompound(site);
      }
    }
    for (const [expr, enumBeingDeclared] of expressions) {
      check.enumBeingDeclared = enumBeingDeclared;
      check.checkTernary(expr);
    }

    // Read off 1.2's syntax (#1991); reported in source order
    return this.errors.sort(SourceOrder.compare);
  }

  /** The diagnostic's text for each place two categories meet */
  private static message(what: TOperatorSite, pair: string): string {
    if (what === "conditional") {
      return `Conditional operator's value arms have different essential type categories (${pair})`;
    }
    if (what === "compound") {
      return `Compound assignment combines a target and a value of different essential type categories (${pair})`;
    }
    return `Binary operator combines operands of different essential type categories (${pair})`;
  }

  /** E0811's and E0812's text for each place an integer meets an unreadable macro */
  private static unreadableMacroMessage(what: TOperatorSite): string {
    if (what === "conditional") {
      return "Conditional operator's value arms combine an integer and a header macro whose type cnx cannot read";
    }
    if (what === "compound") {
      return "Compound assignment combines an integer and a header macro whose type cnx cannot read";
    }
    return "Binary operator combines an integer operand and a header macro whose type cnx cannot read";
  }

  /** How a category reads in a message */
  private static label(category: string): string {
    if (category.startsWith("enum:")) return `enum ${category.slice(5)}`;
    return category === "boolean" ? "Boolean" : category;
  }

  public addError(
    line: number,
    column: number,
    left: string,
    right: string,
    what: TOperatorSite = "binary",
    operator?: string,
  ): void {
    if (left === UNREADABLE_MACRO || right === UNREADABLE_MACRO) {
      this.addUnreadableMacroError(line, column, what, operator);
      return;
    }
    const integer = (c: string) => c === "signed" || c === "unsigned";
    const floating =
      (left === "floating" && integer(right)) ||
      (right === "floating" && integer(left));
    const signedness = integer(left) && integer(right);
    let pair = `${MixedTypeCategoryAnalyzer.label(left)} and ${MixedTypeCategoryAnalyzer.label(right)}`;
    if (floating) pair = "integer and floating";
    if (signedness) pair = "signed and unsigned";
    const rule =
      "MISRA C:2012 Rule 10.4: both operands must share an essential type category. ";
    let helpText = `${rule}Convert one operand explicitly, e.g. with a cast (ADR-024).`;
    if (floating) {
      // A compound assignment's target is its left operand, and a target
      // cannot be cast (#1760 review)
      helpText =
        what === "compound" && integer(left)
          ? `${rule}The target cannot be converted: write the assignment out with explicit conversions, e.g. x <- (u32)((f32)x * k) (ADR-024).`
          : `${rule}Convert the integer operand with an explicit cast, e.g. (f32)value (ADR-024).`;
    }
    if (signedness) {
      helpText = `${rule}Reinterpret one operand's bits to match the other with bit indexing, e.g. value[0, 32] (ADR-007/ADR-024).`;
    }
    this.errors.push({
      code: "E0810",
      line,
      column,
      message: MixedTypeCategoryAnalyzer.message(what, pair),
      helpText,
    });
  }

  /** E0811 or E0812: an integer beside a header macro cnx cannot type (#1688, ADR-024) */
  private addUnreadableMacroError(
    line: number,
    column: number,
    what: TOperatorSite,
    operator: string | undefined,
  ): void {
    // An operator that hands an integer operand to a clamp helper (ADR-044)
    // makes an unreadable macro beside it E0811; any other makes it E0812
    const clamped =
      operator !== undefined &&
      CLAMP_HELPER_FOR_OPERATOR[operator] !== undefined;
    const why = clamped
      ? "this operator would hand it to an integer clamp helper untyped"
      : "C's usual arithmetic conversions decide this result from the type it really has, which can change a comparison, a bit operation or a quotient (an unsigned 3 < -1 is true)";
    this.errors.push({
      code: clamped ? "E0811" : "E0812",
      line,
      column,
      message: MixedTypeCategoryAnalyzer.unreadableMacroMessage(what),
      helpText: `ADR-024: a header macro is typed from its replacement tokens, and this one's are not a literal expression; ${why}. Cast the macro to the type it has, e.g. (u32)MACRO or (f32)MACRO.`,
    });
  }
}

export default MixedTypeCategoryAnalyzer;
