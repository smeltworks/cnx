/**
 * Operator Operand Analyzer
 *
 * MISRA C:2012 Rule 10.1: "Operands shall not be of an inappropriate essential
 * type." Each arithmetic, bitwise, shift and relational operator takes a set
 * of operand types, and an operand outside that set is an error. The set is an
 * allow-list (#1191): an array, a struct, a string, a float
 * under a bitwise or shift operator, or a type added later is rejected because
 * it is not in the set, not because some check names it.
 *
 * Before this, each wrong type had its own analyzer -- a bool here, a float
 * under `%` there -- and anything none of them named reached C: `row + 1` on a
 * `u8[3]` computed on the array's address (#1191), and `k << 1` on an `f32`
 * emitted C that gcc rejects (#1798).
 *
 * Which code reports a rejection depends only on what the operand is: a bool
 * is E0807 (a bool target of a compound assignment E0806, Issue #1145), a
 * float under `%` is E0804, and everything else is E0925.
 *
 * Equality and the logical operators are not this rule's: cnx requires
 * conditions to be explicit comparisons, so `if (flag = true)` must stay
 * legal, and `!flag` remains the way to negate.
 *
 * An operand whose type cnx cannot read is admitted, so the C compiler judges
 * it as before: one with no type at all, an unreadable header macro (#1688),
 * or a C++ overload set whose return categories disagree. Unknown is not
 * "not a number".
 *
 * Every operand is typed by the one operand typer (#1668), the same fact
 * E0810 reads; `admits` is where E0810 defers to this rule, so one defect
 * is reported under one code.
 */

import IOperatorOperandError from "./types/IOperatorOperandError";
import OperandTyper from "../../utils/OperandTyper";
import CompoundAssignmentAnalyzer from "./CompoundAssignmentAnalyzer";
import CompoundOperator from "../../utils/CompoundOperator";
import EnumMemberValue from "./EnumMemberValue";
import ExpressionShape from "../../utils/ExpressionShape";
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import ProgramAccesses from "../../utils/ProgramAccesses";
import SourceOrder from "../../utils/SourceOrder";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../types/IOperandType";
import type TEssentialCategory from "../../types/TEssentialCategory";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TBinaryExpression from "../../types/syntax/TBinaryExpression";
import type TExpression from "../../types/syntax/TExpression";

type TCategories = ReadonlySet<TEssentialCategory>;

const INTEGER: TCategories = new Set(["signed", "unsigned"]);
const ARITHMETIC: TCategories = new Set(["signed", "unsigned", "floating"]);
/**
 * MISRA C:2012 Rule 10.1: a char is an operand of `+` and `-`. Which other
 * operand it may meet there is Rule 10.2's, which this table does not check.
 */
const ADDITIVE: TCategories = new Set([...ARITHMETIC, "character"]);
/** ADR-017: an enum compares with its own type's members */
const RELATIONAL: TCategories = new Set([...ADDITIVE, "enum"]);

/** What each binary operator takes; an operator not listed is not this rule's */
const BINARY: ReadonlyMap<string, TCategories> = new Map([
  ["+", ADDITIVE],
  ["-", ADDITIVE],
  ["*", ARITHMETIC],
  ["/", ARITHMETIC],
  ["%", INTEGER],
  ["&", INTEGER],
  ["|", INTEGER],
  ["^", INTEGER],
  ["<<", INTEGER],
  [">>", INTEGER],
  ["<", RELATIONAL],
  [">", RELATIONAL],
  ["<=", RELATIONAL],
  [">=", RELATIONAL],
]);

/** Prefix `-` and `~`; `!` and `&` are not this rule's */
const UNARY: ReadonlyMap<string, TCategories> = new Map([
  ["-", ARITHMETIC],
  ["~", INTEGER],
]);

/** Why an operand is outside its operator's set, which picks the message */
type TRejection =
  | "bool"
  | "floatModulo"
  | "array"
  | "floating"
  | "character"
  | "enum"
  | "string"
  | "struct"
  | "other";

const NOUNS: Readonly<
  Record<Exclude<TRejection, "bool" | "floatModulo">, string>
> = {
  array: "an array operand",
  floating: "a float operand",
  character: "a char operand",
  enum: "an enum operand",
  string: "a string operand",
  struct: "a struct operand",
  other: "this operand",
};

const HELP: Readonly<
  Record<Exclude<TRejection, "bool" | "floatModulo">, string>
> = {
  array: "an array is not a number. Subscript it down to one element first.",
  floating: "shift and bitwise operators take integers only.",
  character:
    "a char takes only binary '+' and '-' and the comparisons. Cast it to an integer type first, e.g. (u8)value.",
  enum: "an enum is not a number (ADR-017). Cast it to an unsigned type first, e.g. (u8)value.",
  string:
    "a string is not a number. Join strings with '+' and compare them with '=' / '!='.",
  struct: "a struct is not a number. Use one of its fields.",
  other: "this operator takes numbers only.",
};

/**
 * Checks each operator against the sets above. `enumBeingDeclared` is the
 * enum whose member values are being read (`EnumMemberValue`), handed to each
 * check rather than held, so it cannot outlive the member values it is for.
 */
class OperatorOperandCheck {
  constructor(
    private readonly analyzer: OperatorOperandAnalyzer,
    private readonly context: IAnalysisContext,
  ) {}

  private rejection(
    operator: string,
    admits: TCategories,
    expr: TExpression,
    enumBeingDeclared: string | null,
  ): TRejection | null {
    // A string literal has no operand type, but it is a string (ADR-045)
    if (ExpressionShape.isStringLiteral(expr)) {
      return operator === "+" ? null : "string";
    }
    return OperatorOperandAnalyzer.rejection(
      operator,
      admits,
      EnumMemberValue.operandType(
        OperandTyper.typeOf(expr, this.context),
        enumBeingDeclared,
      ),
      this.context,
    );
  }

  /**
   * One error per operator whose left or right operand is outside its set,
   * reported at the offending operand -- `flag / other` is one mistake.
   * `operators[i]` joins operand `i` to `i + 1`.
   */
  public checkExpression(
    expr: TExpression,
    enumBeingDeclared: string | null,
  ): void {
    if (expr.kind === "unary") this.checkUnary(expr, enumBeingDeclared);
    if (expr.kind === "binary") this.checkLevel(expr, enumBeingDeclared);
  }

  private checkLevel(
    level: TBinaryExpression,
    enumBeingDeclared: string | null,
  ): void {
    level.operators.forEach((operator, i) => {
      const admits = BINARY.get(operator);
      if (admits === undefined) return;
      const left = level.operands[i];
      const right = level.operands[i + 1];
      const leftRejection = this.rejection(
        operator,
        admits,
        left,
        enumBeingDeclared,
      );
      const rejection =
        leftRejection ??
        this.rejection(operator, admits, right, enumBeingDeclared);
      if (rejection === null) return;
      // E0804 has always been reported at the left operand
      const at =
        leftRejection !== null || rejection === "floatModulo" ? left : right;
      this.analyzer.addError(at, operator, rejection);
    });
  }

  private checkUnary(
    expr: Extract<TExpression, { readonly kind: "unary" }>,
    enumBeingDeclared: string | null,
  ): void {
    const admits = UNARY.get(expr.operator);
    if (admits === undefined) return;
    const rejection = this.rejection(
      expr.operator,
      admits,
      expr.operand,
      enumBeingDeclared,
    );
    if (rejection !== null)
      this.analyzer.addError(expr, expr.operator, rejection);
  }

  /**
   * A compound assignment applies a binary operator that the expression
   * grammar never expresses as a level, so both halves are checked here:
   * `n +<- flag` must fail as `n <- n + flag` does. A bool target is E0806.
   * The value is judged before the target's shape, as on main, so `m +<- f`
   * with a bool `f` stays E0807 whatever `m` is; a whole array or string
   * target is then E0857's (`CompoundAssignmentAnalyzer`).
   */
  public checkAssignment(site: IAssignmentSyntax): void {
    const operator = CompoundOperator.binaryOf(site.operator);
    if (operator === null) return;
    const target = OperandTyper.typeOfTarget(site.target, this.context);
    if (OperandTyper.isBoolean(target)) {
      this.analyzer.addCompoundAssignmentError(site.target);
      return;
    }
    const admits = BINARY.get(operator);
    if (admits === undefined) return;
    // A whole-array or string target is E0857's whatever its value (#2193)
    if (CompoundAssignmentAnalyzer.rejectsTarget(site.target, this.context)) {
      return;
    }
    const rejection = this.rejection(operator, admits, site.value, null);
    if (rejection !== null) {
      this.analyzer.addError(site.value, site.operator, rejection);
      return;
    }
    // An enum target, `m +<- 1`, is #2264's open question, so it is left as
    // on main until that is decided
    if (target?.category === "enum") return;
    const targetRejection = OperatorOperandAnalyzer.rejection(
      operator,
      admits,
      target,
      this.context,
    );
    if (targetRejection !== null) {
      this.analyzer.addError(site.target, site.operator, targetRejection, true);
    }
  }
}

class OperatorOperandAnalyzer {
  private errors: IOperatorOperandError[] = [];
  /** One error per source position: `-row + 1` is one mistake, at `row` */
  private readonly reportedAt = new Set<string>();

  /** #1456: handed in rather than read off shared state. */
  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(private readonly context: IAnalysisContext) {}

  /**
   * Whether `operator` takes this operand. E0810 asks, so that an operand
   * this rule rejects is not also reported as a category mix (#1668).
   */
  static admits(
    operator: string,
    operand: IOperandType | null,
    context: IAnalysisContext,
  ): boolean {
    const admits = BINARY.get(operator);
    return (
      admits === undefined ||
      OperatorOperandAnalyzer.rejection(operator, admits, operand, context) ===
        null
    );
  }

  /** Why `operand` is outside `admits`, or null when it is in it */
  static rejection(
    operator: string,
    admits: TCategories,
    operand: IOperandType | null,
    context: IAnalysisContext,
  ): TRejection | null {
    if (operand === null) return null;
    if (OperandTyper.isBoolean(operand)) return "bool";
    const form = operand.form;
    // A ternary is each of its arms: `(c ? row : n) + 1` is an array operand
    if (form.kind === "ternary") {
      for (const arm of form.arms) {
        const rejection = OperatorOperandAnalyzer.rejection(
          operator,
          admits,
          arm,
          context,
        );
        if (rejection !== null) return rejection;
      }
      return null;
    }
    // A string -- a C `char[N]` among them -- before its dimensions: under
    // `+` it is concatenation, not an array (ADR-045)
    if (OperatorOperandAnalyzer.isString(operand)) {
      return operator === "+" ? null : "string";
    }
    if (operand.dimensions.length > 0) return "array";
    // One bit or a bit range of a scalar is an unsigned value (ADR-007)
    if (form.kind === "bitIndex" || form.kind === "bitRange") return null;
    if (form.kind === "unreadableMacro") return null;
    if (form.kind === "foreign" && form.indeterminate) return null;
    const category = operand.category;
    // A composite whose leaves are not one number category was judged at
    // those leaves -- `(flag + 1) * 2` is one E0807, at `flag` -- and so was
    // an enum composite, `(Perm.READ | Perm.WRITE) + 1`
    if (
      form.kind === "composite" &&
      (category === "none" || category === "boolean" || category === "enum")
    ) {
      return null;
    }
    if (category === "none") {
      return OperatorOperandAnalyzer.uncategorized(operand, context);
    }
    if (admits.has(category)) return null;
    // A C header's enum is not ADR-017's: which operators take one is open
    // (#2352), so this rule admits it, as before, until that is decided. A
    // composite never reaches here, so this is one header value.
    if (category === "enum" && operand.enumTypeName === null) return null;
    switch (category) {
      case "floating":
        return operator === "%" ? "floatModulo" : "floating";
      case "character":
      case "enum":
        return category;
      default:
        return "other";
    }
  }

  /**
   * ADR-045's string: a `string<N>` or `string`, a C `char` array, or a
   * concatenation whose every leaf is one
   */
  private static isString(operand: IOperandType): boolean {
    if (
      OperandTyper.isString(operand) ||
      (operand.typeName === "char" && operand.dimensions.length === 1)
    ) {
      return true;
    }
    const form = operand.form;
    return (
      form.kind === "composite" &&
      form.leaves.length > 0 &&
      form.leaves.every(
        (leaf) => leaf !== null && OperatorOperandAnalyzer.isString(leaf),
      )
    );
  }

  /**
   * An operand with no essential category: an unsuffixed literal takes the
   * category of what it is combined with (ADR-052). Anything else with no
   * category is not a number, except what the compiler judges: a C++ header
   * class, which may declare the operator, and an opaque handle, a pointer.
   */
  private static uncategorized(
    operand: IOperandType,
    context: IAnalysisContext,
  ): TRejection | null {
    if (operand.form.kind === "literal") return null;
    // A C char pointer: which operators take one is open (#2348), so this
    // rule admits it, as before, until ADR-046 decides
    if (operand.typeName === "cstring") return null;
    // A whole bitmap is its backing integer (ADR-034, owner ruling #2245)
    if (operand.bitmapTypeName !== null) return null;
    const typeName = operand.typeName;
    if (typeName === null) return null;
    if (context.symbols.knownStructs.has(typeName)) return "struct";
    // Neither is Rule 10.1's, so the compiler judges them, as on main
    // (#2347 review)
    const cpp = context.symbolTable.getCppSymbol(typeName);
    if (cpp?.kind === "class" || cpp?.kind === "struct") return null;
    if (context.program.isOpaqueType(typeName)) return null;
    if (
      ForeignTypeFacts.isStructType(
        typeName,
        context.symbolTable,
        OperandTyper.target(context),
      )
    ) {
      return "struct";
    }
    return "other";
  }

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(program: IProgramSyntax): IOperatorOperandError[] {
    this.errors = [];
    this.reportedAt.clear();
    const check = new OperatorOperandCheck(this, this.context);

    for (const [expr, enumBeingDeclared] of EnumMemberValue.expressions(
      program,
    )) {
      check.checkExpression(expr, enumBeingDeclared);
    }
    for (const site of ProgramAccesses.writes(program)) {
      check.checkAssignment(site);
    }

    return this.errors.sort(SourceOrder.bySpan);
  }

  public addError(
    at: TExpression,
    operator: string,
    rejection: TRejection,
    isTarget = false,
  ): void {
    const span = at.span;
    const position = `${span.line}:${span.column}`;
    if (this.reportedAt.has(position)) return;
    this.reportedAt.add(position);
    if (rejection === "bool") {
      this.errors.push({
        code: "E0807",
        span,
        message: `Operator '${operator}' is not valid on a bool operand`,
        helpText:
          "MISRA C:2012 Rule 10.1: a bool is not a number. Use the logical operators " +
          "(&&, ||, !) to combine flags, or '=' / '!=' to compare them.",
      });
      return;
    }
    if (rejection === "floatModulo") {
      this.errors.push({
        code: "E0804",
        span,
        message: "Modulo operator not supported for floating-point types",
        helpText:
          "The % operator only works with integer types. Use fmod() from <math.h> for floating-point remainder.",
      });
      return;
    }
    this.errors.push({
      code: "E0925",
      span,
      message: `Operator '${operator}' is not valid on ${NOUNS[rejection]}`,
      // A target cannot be cast, so its help is the written-out form
      helpText: isTarget
        ? "MISRA C:2012 Rule 10.1: a compound target cannot be cast. Write the read and the write out separately, casting the read, e.g. x <- (u8)x * 2."
        : `MISRA C:2012 Rule 10.1: ${HELP[rejection]}`,
    });
  }

  /**
   * Add a compound-assignment-to-bool error, naming the target as written so
   * the suggested fix is code that can be pasted back (Issue #1183 review:
   * `flags[0] +<- true` used to suggest `flags <- !flags`, which does not
   * compile).
   */
  public addCompoundAssignmentError(target: IAssignmentSyntax["target"]): void {
    this.errors.push({
      code: "E0806",
      span: target.span,
      message: `Compound assignment is not valid on bool '${target.written}' - only '<-' is`,
      helpText: `MISRA C:2012 Rule 10.1: a bool is not a number. To flip it, use '${target.written} <- !${target.written}'.`,
    });
  }
}

export default OperatorOperandAnalyzer;
