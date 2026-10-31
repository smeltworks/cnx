import ExpressionShape from "../../utils/ExpressionShape";
import VariableDeclarations from "../../utils/VariableDeclarations";
import StringUtils from "../../utils/StringUtils";
import StringValueForm from "../../utils/StringValueForm";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import CharacterWrite from "../../utils/CharacterWrite";
import IStringDeclarationError from "./types/IStringDeclarationError";
import ConstantExpression from "./helpers/ConstantExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TStringPart from "../../types/TStringPart";
import type IValuePositions from "../../types/IValuePositions";
import invariant from "../../utils/invariant";
import StringWriteSites from "./helpers/StringWriteSites";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ProgramExpressions from "../../utils/ProgramExpressions";
/**
 * ADR-045 string writes: whether a declaration's initializer or an
 * assignment's value fits the `string<N>` it lands in, E0864-E0865.
 *
 * #1322. Fourteen throws in `StringDeclHelper`, all reaching the user as `1:0`.
 *
 * ## Three messages that were one rule
 *
 * At file scope a string may be initialized by a LITERAL and by nothing else.
 * C has no place to run `strncpy` or `strncat` before `main`, so a copy from a
 * variable, a concatenation and a substring extraction are all impossible
 * there -- and all three threw, with three different messages, from three
 * different generation paths. Probed rather than assumed: a literal and an
 * absent initializer are accepted at file scope; those three are not.
 *
 * Written as one question about the initializer's FORM, the three collapse.
 *
 * ## Capacity is asked of the declaration, not of codegen
 *
 * The capacity rules -- an array needs `string<N>[M]`, a non-const needs
 * `string<N>`, a const without one needs a literal to infer from -- are all
 * properties of the declaration's own syntax. The fit rules need a source
 * capacity, which is `IDeclaredVar.stringCapacity`: a literal's is its length,
 * a variable's is what its declaration said.
 *
 * #1991: those capacity rules and the file-scope form are syntax, so 1.2's
 * `StringForm` reports them (E0862/E0863). This pass reads 1.2's declarations
 * and asks only whether an initializer fits (E0864/E0865). Both read
 * `VariableDeclarations.ruled` (#2073), so they judge the same declarations.
 */

/** Whether a write declares its string or assigns an existing one */
type TWrite =
  | "declaration"
  | "assignment"
  | "argument"
  | "field"
  | "character"
  | "range";

/** The declarations and assignments 1.2 returned, each whole-string value checked against its capacity */
class StringDeclarationCheck {
  private readonly found: IStringDeclarationError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IStringDeclarationError[] {
    return this.found;
  }

  public variable(declaration: IVariableDeclarationSyntax): void {
    const type = declaration.type;
    // An inferred const capacity always fits; a string array's elements are
    // checked where they are written
    if (type.kind !== "string" || type.capacity === null) return;
    const initializer = declaration.initializer;
    if (initializer === null) return;
    this.checkFit(
      initializer,
      Number.parseInt(type.capacity, 10),
      "declaration",
    );
  }

  /**
   * #2191: ADR-045's capacity rules hold for an assignment as for a
   * declaration -- "Assignment from larger" and "In-place concatenation" are
   * its errors -- at every target that writes one whole `string<N>`
   */
  public assignment(site: IAssignmentSyntax): void {
    if (site.operator !== "<-") return;
    // #1748, #2373: one character `s[i]` is a `string<1>`, and a range
    // `s[i, n]` a `string<n>`, when a string is written into it (ADR-045)
    if (CharacterWrite.of(site.target, site.value, this.context) === "string") {
      const span = OperandTyper.characterSpan(site.target, this.context);
      invariant(span !== null, "a character write has a span");
      this.checkFit(
        site.value,
        span.count,
        span.range && span.count > 1 ? "range" : "character",
      );
      return;
    }
    const capacity = OperandTyper.stringCopyCapacity(site.target, this.context);
    if (capacity === null) return;
    this.checkFit(site.value, capacity, "assignment");
  }

  /**
   * #2239: an argument is written into its `string<N>` parameter, so the
   * same rules hold there -- a value that may not fit is E0864, never cut
   * short (ADR-045, "No Silent Truncation")
   */
  public argument(value: TExpression, capacity: number): void {
    this.checkFit(value, capacity, "argument");
  }

  /**
   * #2236: a struct initializer's `string<N>` field is written as any
   * `string<N>` is (E0864). At file scope only a literal can be, for the
   * reason E0863 gives a file-scope string.
   */
  public field(
    value: TExpression,
    capacity: number,
    atFileScope: boolean,
  ): void {
    if (atFileScope && !ExpressionShape.isStringLiteral(value)) {
      this.found.push({
        code: "E0863",
        span: value.span,
        message: `A string field at file scope may only be initialized by a literal, not '${value.written}'`,
        helpText:
          "Copying, concatenating and extracting a substring all need runtime calls, which C cannot make before `main`. Move the declaration into a function, or initialize the field empty and assign it later.",
      });
      return;
    }
    this.checkFit(value, capacity, "field");
  }

  /**
   * #2240: a substring's length is a compile-time constant, wherever the
   * substring is read, so E0864 and E0865 can check what it copies (ADR-045)
   */
  public substringLength(node: TExpression): void {
    if (node.kind !== "postfix") return;
    if (!OperandTyper.isSubstring(node, this.context)) return;
    const last = node.ops.at(-1);
    if (last?.kind !== "subscript") return;
    const length = last.indexes.at(1);
    if (length === undefined || this.constantOf(length) !== null) return;
    this.found.push({
      code: "E0922",
      span: length.span,
      message: `A substring's length must be a compile-time constant, not '${length.written}'`,
      helpText:
        "Write the length as a literal or a constant, so the substring is known to fit what it is copied into (ADR-045). The start may be computed at run time.",
    });
  }

  /** E0864/E0865 for the form `StringValueForm` gives the value */
  private checkFit(value: TExpression, capacity: number, write: TWrite): void {
    const form = StringValueForm.of(value, this.context);
    const parts =
      form.kind === "concat"
        ? form.parts
        : form.kind === "substring"
          ? [form.part]
          : [];
    for (const part of parts) {
      if (part.kind === "substring" && this.checkBounds(value, part)) return;
    }
    switch (form.kind) {
      case "literal":
        this.checkLiteral(value, form.literal, capacity, write);
        return;
      case "substring":
        this.checkSubstring(value, form.part, capacity, write);
        return;
      case "concat":
        this.checkConcat(value, form.parts, capacity, write);
        return;
      case "copy":
        this.checkCopy(value, form.value, capacity, write);
        return;
    }
  }

  private checkLiteral(
    value: TExpression,
    literal: TExpression,
    capacity: number,
    write: TWrite,
  ): void {
    const length = StringUtils.literalLength(literal.written);
    if (length <= capacity) return;
    this.found.push({
      code: "E0864",
      span: value.span,
      message: `String literal (${length} chars) exceeds string<${capacity}> capacity`,
      helpText: StringDeclarationCheck.help(
        write,
        length,
        "shorten the literal",
      ),
    });
  }

  /** E0865: a substring's bounds stay within its source. True when reported. */
  private checkBounds(
    value: TExpression,
    part: Extract<TStringPart, { kind: "substring" }>,
  ): boolean {
    const sourceCapacity = OperandTyper.scalarStringCapacity(
      OperandTyper.chainOf(part.chain, this.context).steps.at(-1)?.before,
    );
    const start = this.constantOf(part.start);
    const length = this.lengthOf(part);
    if (sourceCapacity === null || start === null || length === null) {
      return false;
    }
    if (start + length <= sourceCapacity) return false;
    this.found.push({
      code: "E0865",
      span: value.span,
      message: `Substring bounds [${start}, ${length}] exceed the source string<${sourceCapacity}>`,
      helpText:
        "The bounds are counted in characters from zero; keep start + length within the source's capacity.",
    });
    return true;
  }

  private checkSubstring(
    value: TExpression,
    part: Extract<TStringPart, { kind: "substring" }>,
    capacity: number,
    write: TWrite,
  ): void {
    const length = this.lengthOf(part);
    if (length === null || length <= capacity) return;
    this.found.push({
      code: "E0864",
      span: value.span,
      message: `Substring length ${length} exceeds destination string<${capacity}> capacity`,
      helpText: StringDeclarationCheck.help(
        write,
        length,
        "take fewer characters",
      ),
    });
  }

  private checkConcat(
    value: TExpression,
    parts: readonly TStringPart[],
    capacity: number,
    write: TWrite,
  ): void {
    // A part of unknown length (a C string, an unsized `string`) is bounded
    // when it is built; the parts that can be measured still have to fit
    const each = parts.map((part) => this.capacityOf(part));
    const required = each.reduce<number>((sum, n) => sum + (n ?? 0), 0);
    if (required <= capacity) return;
    const where = StringDeclarationCheck.whose(write);
    const least = each.includes(null) ? "at least " : "";
    this.found.push({
      code: "E0864",
      span: value.span,
      message: `String concatenation requires ${least}capacity ${required}, but ${where} is string<${capacity}>`,
      helpText: StringDeclarationCheck.help(
        write,
        required,
        "shorten the operands",
      ),
    });
  }

  private checkCopy(
    value: TExpression,
    source: TExpression,
    capacity: number,
    write: TWrite,
  ): void {
    const sourceCapacity = this.capacityOf({ kind: "whole", value: source });
    if (sourceCapacity === null || sourceCapacity <= capacity) return;
    this.found.push({
      code: "E0864",
      span: value.span,
      message: StringDeclarationCheck.copyMessage(
        write,
        sourceCapacity,
        capacity,
      ),
      helpText: StringDeclarationCheck.help(
        write,
        sourceCapacity,
        "extract a substring of the source",
      ),
    });
  }

  /**
   * The most characters a part holds: a literal's length, a string's
   * capacity, a substring's length -- one rule for a whole value and for
   * every concatenation operand (#2160 review). Null when unknown, a C
   * string's among them.
   */
  private capacityOf(part: TStringPart): number | null {
    if (part.kind === "substring") return this.lengthOf(part);
    if (ExpressionShape.isStringLiteral(part.value)) {
      return StringUtils.literalLength(part.value.written);
    }
    return OperandTyper.scalarStringCapacity(
      OperandTyper.typeOf(part.value, this.context),
    );
  }

  private lengthOf(
    part: Extract<TStringPart, { kind: "substring" }>,
  ): number | null {
    return part.length === null ? 1 : this.constantOf(part.length);
  }

  /** How to make a value fit: widen what it lands in, or `fix` the value */
  private static help(write: TWrite, required: number, fix: string): string {
    if (write === "character") {
      return `One character of a string<N> is a string<1> (ADR-045): ${fix}.`;
    }
    if (write === "range") {
      return `A range of a string<N> holds as many characters as its length (ADR-045): ${fix}.`;
    }
    return `Widen ${StringDeclarationCheck.whose(write)} to string<${required}>, or ${fix}.`;
  }

  private static whose(write: TWrite): string {
    switch (write) {
      case "declaration":
        return "the declaration";
      case "assignment":
        return "the target";
      case "argument":
        return "the parameter";
      case "field":
        return "the field";
      case "character":
        return "the character";
      case "range":
        return "the range";
    }
  }

  private static copyMessage(
    write: TWrite,
    source: number,
    capacity: number,
  ): string {
    switch (write) {
      case "declaration":
        return `Cannot initialize string<${capacity}> from string<${source}> -- the source may not fit`;
      case "assignment":
        return `Cannot assign string<${source}> to string<${capacity}> -- the source may not fit`;
      case "argument":
        return `Cannot pass string<${source}> to a string<${capacity}> parameter -- the source may not fit`;
      case "field":
        return `Cannot initialize a string<${capacity}> field from string<${source}> -- the source may not fit`;
      case "character":
        return `Cannot write string<${source}> into one character, a string<${capacity}> -- the source may not fit`;
      case "range":
        return `Cannot write string<${source}> into a ${capacity}-character range -- the source may not fit`;
    }
  }

  private constantOf(expr: TExpression): number | null {
    return ConstantExpression.valueAt(expr, this.context);
  }
}

class StringDeclarationAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(
    program: IProgramSyntax,
    positions: IValuePositions,
  ): IStringDeclarationError[] {
    const check = new StringDeclarationCheck(this.context);
    for (const entry of VariableDeclarations.ruled(program)) {
      check.variable(entry.declaration);
    }
    const fileScope = VariableDeclarations.fileScopeValues(program);
    // A slice write's range is ADR-007's, not a substring read
    const targets = new Set<TExpression>();
    const visit = (declaration: TMemberDeclaration): void => {
      for (const site of StatementNodes.assignments(declaration)) {
        targets.add(site.target);
        check.assignment(site);
      }
    };
    for (const entry of program.members) visit(entry.declaration);
    for (const { value, write, capacity } of StringWriteSites.of(positions)) {
      if (write === "field") {
        check.field(value, capacity, fileScope.has(value));
      } else {
        check.argument(value, capacity);
      }
    }
    for (const node of ProgramExpressions.of(program).flatMap((expression) =>
      ExpressionNodes.direct(expression),
    )) {
      if (!targets.has(node)) check.substringLength(node);
    }
    return check.errors();
  }
}

export default StringDeclarationAnalyzer;
