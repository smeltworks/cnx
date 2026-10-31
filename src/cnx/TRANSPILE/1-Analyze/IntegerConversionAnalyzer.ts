/**
 * ADR-024 integer conversions: E0868, E0869 and E0891, and E0910 where a
 * value known at compile time overflows outside a static initializer.
 *
 * #1322. Six rules across `TypeResolver` and `CodeGenerator`, reached through
 * three entry points -- a declaration's initializer, an assignment, a cast --
 * and two rethrow WRAPPERS that caught the message and prefixed `${line}:${col}`
 * onto it. The wrappers are why the assignment fixtures already showed a real
 * position while the cast fixtures showed `1:0`: the same rule, smuggling its
 * position through the message on one path and not the other.
 *
 * ## The rule, once
 *
 * A literal must fit the target's range. A non-literal integer source must not
 * be wider than the target, and must agree with it on signedness. That is the
 * whole of it, whichever of the three spellings reaches it -- which is why it
 * is one analyzer with three listener methods rather than three checks.
 *
 * #1618: those three were not the only places a value lands. Every position
 * `ValuePositions` names reaches `checkAt` -- a return, an argument, an array
 * element, a field initializer, a ternary's arm -- and a compound assignment
 * lands its target and value combined, so each is checked as a declaration is.
 *
 * ## What is deliberately NOT typed
 *
 * A lone bit extraction, `large[0, 8]`, is ADR-024's explicit reinterpret --
 * the escape hatch the rule tells the author to use. Typing it would make the
 * sanctioned form fail the very check it exists to satisfy; codegen's
 * declaration path declined for that reason, and this pass declines for all
 * three. A composite's integer type is the typer's, which settles it by
 * `CompositeType.integerOf` over its value leaves -- category from the first
 * integer operand, width from the widest -- the one rule 2.2 sizes its clamp
 * helper by (#1668).
 *
 * ## Two holes codegen had, both closed
 *
 * A COMPOSITE source was typed on a declaration and not on an assignment, and
 * an assignment was checked against the ROOT variable's declared type rather
 * than the type the value actually lands in. The second is the sharper one:
 * `c.col <- wide` emitted `c.col = wide;`, a u32 truncated into a u8 field with
 * no diagnostic, because the lookup found `c` -- a struct -- and skipped.
 * Reading the chain to the field is what ADR-036's bounds rule already did,
 * so both holes closed by asking the question that was already being asked
 * next door -- now the one operand typer's `typeOfTarget` (#1668).
 *
 * ## A third hole this closes
 *
 * `u8 narrow <- this.wide;` inside a scope compiled clean, while the identical
 * line at top level was rejected -- codegen's text-keyed lookup did not resolve
 * the `this.` spelling, so the source read as untyped and untyped never
 * rejects. The lexical frames resolve it, so the rule now holds in the scope
 * contexts too. Measured against the corpus before relying on it.
 *
 * ## Typed by the one operand typer (#1668)
 *
 * Source and target come from `OperandTyper`, so a suffixed literal is its
 * suffix's type (`u8 x <- 300u16` narrows), `-w` is `w`'s type, a cast inside
 * a composite counts at the type it names, a bit range's const width folds,
 * and a C or C++ header's integer -- a source, or the field a value lands in
 * -- has its width on this target. Every assignment site is read, `for`
 * headers included (#1726).
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import ProgramAccesses from "../../utils/ProgramAccesses";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import CharacterWrite from "../../utils/CharacterWrite";
import ExpressionShape from "../../utils/ExpressionShape";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import invariant from "../../utils/invariant";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import CompositeType from "../../utils/CompositeType";
import CompoundOperator from "../../utils/CompoundOperator";
import StructInitializerType from "./helpers/StructInitializerType";
import ValuePositions from "./helpers/ValuePositions";
import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import IIntegerConversionError from "./types/IIntegerConversionError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IValuePosition from "../../types/IValuePosition";
import type IOperandType from "../../types/IOperandType";
import SourceOrder from "../../utils/SourceOrder";

const INTEGER_LITERAL = /^-?(?:\d+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/;

/** What a literal operand must fit: the range, the width, or nothing */
type TLiteralRole = "value" | "bits" | "exempt";

/** The expressions that build a value rather than name one (#1618). */
const CONSTANT_FORMS: ReadonlySet<TExpression["kind"]> = new Set([
  "literal",
  "unary",
  "parenthesized",
  "binary",
]);

type TFold = ReturnType<typeof OperandTyper.constantResultOf>;

class IntegerConversionCheck {
  /**
   * A literal's exact value. BigInt, not parseInt: a u64 bound is past 2^53,
   * where a double stops being exact and `0xFFFFFFFFFFFFFFFF` would round
   * into range.
   */
  static literalValue(text: string): bigint {
    return text.startsWith("-") ? -BigInt(text.slice(1)) : BigInt(text);
  }

  private readonly found: IIntegerConversionError[] = [];

  public constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  public errors(): IIntegerConversionError[] {
    return this.found;
  }

  public checkDeclaration(declaration: IVariableDeclarationSyntax): void {
    if (!declaration.initializer) return;
    if (this.checkStringsAt(declaration.initializer)) return;
    const target = declaration.type.text;
    if (!TypeCheckUtils.isInteger(target)) return;
    this.check(target, declaration.initializer, true);
  }

  /** The values typed by their position: arguments, fields, elements (#1618) */
  public checkExpression(expr: TExpression): void {
    switch (expr.kind) {
      case "postfix":
        for (const op of expr.ops) {
          if (op.kind !== "call") continue;
          for (const argument of op.arguments) this.checkAt(argument);
        }
        return;
      case "structInitializer":
        for (const field of expr.fields) this.checkAt(field.value);
        return;
      case "arrayInitializer":
        if (expr.fill) this.checkAt(expr.fill);
        for (const element of expr.elements) this.checkAt(element);
        return;
      case "cast":
        this.checkCast(expr);
        return;
      default:
        return;
    }
  }

  /**
   * E0914, then every integer rule, for a value at the type its position
   * gives it: a return value, an argument, a field, an element (#1618)
   */
  public checkAt(value: TExpression): void {
    if (this.checkStringsAt(value)) return;
    const target = StructInitializerType.valueTypeAt(
      ValuePositions.at(this.positions, value),
    );
    if (target !== null && TypeCheckUtils.isInteger(target)) {
      this.check(target, value, true);
    }
  }

  /** An assignment statement, or a `for` loop's init or update */
  public checkSite(site: IAssignmentSyntax): void {
    if (this.checkCharacterAt(site)) return;
    if (this.checkStringAt(site.value)) return;
    if (this.writesWholeString(site) && this.checkNonStringAt(site.value)) {
      return;
    }
    const target = site.target;
    if (
      target.kind === "postfix" &&
      target.ops.some(
        (op) => op.kind === "subscript" && op.indexes.length === 2,
      )
    ) {
      return;
    }
    const targetType =
      OperandTyper.typeOfTarget(target, this.context)?.typeName ?? "";
    if (!TypeCheckUtils.isInteger(targetType)) return;
    if (site.operator === "<-") {
      this.check(targetType, site.value, true);
      return;
    }
    this.checkCompound(targetType, site);
  }

  /**
   * ADR-024: `y op<- b` is `y <- y op b`, so what lands in `y` is the
   * composite of the two, typed as any composite is. A shift's count is no
   * leaf of it, so `y <<<- n` lands `y`'s own type.
   */
  private checkCompound(targetType: string, site: IAssignmentSyntax): void {
    const binary = CompoundOperator.binaryOf(site.operator);
    const shift = binary === "<<" || binary === ">>";
    const source = CompositeType.integerOf([
      OperandTyper.typeOfTarget(site.target, this.context),
      ...(shift ? [] : OperandTyper.valueLeaves(site.value, this.context)),
    ]);
    if (!shift) {
      this.checkLiteralLeaves(
        targetType,
        site.value,
        IntegerConversionCheck.roleOf(binary, null),
      );
    }
    if (source !== null) {
      this.checkConversion(targetType, source, site.value, "assign");
    }
  }

  /**
   * A value known at compile time lands as a lone literal does: one that does
   * not fit the target is E0868, however it is built. ADR-044's clamp is for
   * runtime values only, so `u8 a +<- 300`, `a <- a + 300` and
   * `a +<- (100 + 200)` are errors (#1618). The one evaluator,
   * `OperandTyper.constantResultOf`, decides what is known, a bound name's
   * value included: `-(128)` is -128, and `u32 x <- BIG * BIG` overflows.
   * A ternary is two arms unless its condition folds too.
   */
  private checkLiteralLeaves(
    target: string,
    value: TExpression,
    role: TLiteralRole,
  ): void {
    const roles = new Map<TExpression, TLiteralRole>([[value, role]]);
    // The range a `+ - *` literal must fit: the narrower of the target and
    // the type its level's arithmetic happens at, since the clamp acts there
    // (ADR-044): `u32 r <- b + 300` clamps 300 at u8
    const ranges = new Map<TExpression, string>([[value, target]]);
    const folds = new Map<TExpression, TFold | null>();
    const fold = (expr: TExpression): TFold | null => {
      if (!folds.has(expr)) {
        folds.set(
          expr,
          CONSTANT_FORMS.has(expr.kind)
            ? this.foldAt(target, expr, roles.get(expr) ?? "value")
            : null,
        );
      }
      return folds.get(expr)!;
    };
    const isLeaf = (expr: TExpression): boolean => {
      const inherited = roles.get(expr) ?? "value";
      const range = ranges.get(expr) ?? target;
      for (const child of IntegerConversionCheck.children(expr)) {
        ranges.set(child, this.levelRange(expr, range));
      }
      if (expr.kind === "binary") {
        IntegerConversionCheck.assignRoles(expr, roles, inherited);
      } else if (expr.kind === "parenthesized") {
        roles.set(expr.expression, inherited);
      } else if (expr.kind === "unary") {
        roles.set(expr.operand, inherited);
      }
      const result = fold(expr);
      return result?.kind === "value" || result?.kind === "overflow";
    };
    for (const leaf of OperandTyper.valueLeafExpressions(value, isLeaf)) {
      const leafRole = roles.get(leaf) ?? "value";
      if (leafRole === "exempt") continue;
      const text = this.knownText(target, leaf, fold(leaf));
      if (text === null) continue;
      if (leafRole === "bits") this.checkBits(target, text, leaf);
      else this.checkLiteral(ranges.get(leaf) ?? target, text, leaf);
    }
  }

  /** The expressions a value's leaf walk can descend to */
  private static children(expr: TExpression): readonly TExpression[] {
    switch (expr.kind) {
      case "binary":
        return expr.operands;
      case "ternary":
        return [expr.whenTrue, expr.whenFalse];
      case "parenthesized":
        return [expr.expression];
      case "unary":
        return [expr.operand];
      default:
        return [];
    }
  }

  /** A `+ - *` level narrows the range to the type it is computed at */
  private levelRange(expr: TExpression, range: string): string {
    if (
      expr.kind !== "binary" ||
      (expr.level !== "additive" && expr.level !== "multiplicative")
    ) {
      return range;
    }
    const level = CompositeType.integerOf(
      OperandTyper.valueLeaves(expr, this.context),
    );
    return level !== null && TYPE_WIDTH[level] < TYPE_WIDTH[range]
      ? level
      : range;
  }

  /**
   * What a literal operand must fit, by the operators beside it (#1618):
   * one of `+ - *` its target's range, since clamp or wrap would act on a
   * known value; one of `| ^` its target's width, since bits past it would be
   * dropped. A literal of `&`, or a `/` or `%` divisor, does not decide
   * whether the result overflows (`b & 0x1FF`, `b / 300`): nothing to catch.
   */
  private static roleOf(
    before: string | null,
    after: string | null,
  ): TLiteralRole {
    const beside = [before, after];
    if (beside.includes("&") || before === "/" || before === "%") {
      return "exempt";
    }
    return beside.includes("|") || beside.includes("^") ? "bits" : "value";
  }

  private static assignRoles(
    expr: Extract<TExpression, { kind: "binary" }>,
    roles: Map<TExpression, TLiteralRole>,
    inherited: TLiteralRole,
  ): void {
    // Inside an exempt operand, only a `+ - *` level hands its literal to a
    // clamp or a wrap; any other level stays exempt with its parent
    const arithmetic =
      expr.level === "additive" || expr.level === "multiplicative";
    expr.operands.forEach((operand, index) => {
      roles.set(
        operand,
        inherited === "exempt" && !arithmetic
          ? "exempt"
          : IntegerConversionCheck.roleOf(
              expr.operators[index - 1] ?? null,
              expr.operators[index] ?? null,
            ),
      );
    });
  }

  /** E0868 for a bit pattern wider than its target: `u8 a <- b | 0x100` */
  private checkBits(target: string, text: string, at: TExpression): void {
    const value = IntegerConversionCheck.literalValue(text);
    const width = TYPE_WIDTH[target];
    const fits =
      value >= 0n
        ? value < 1n << BigInt(width)
        : value >= -(1n << BigInt(width - 1));
    if (!fits) {
      this.found.push({
        code: "E0868",
        span: at.span,
        message: `Value ${text} has bits outside ${target}'s ${width} bits`,
        helpText: "Widen the target type, or drop the bits it cannot hold.",
      });
    }
  }

  /**
   * A leaf's known value as literal text, or null when it is not known. A
   * value-role fold runs at the target's width, and an overflow there is a
   * known value that does not fit: `u32 x <- 0x10000 * 0x10000` (#1618).
   */
  private knownText(
    target: string,
    leaf: TExpression,
    result: TFold | null,
  ): string | null {
    const literal = IntegerConversionCheck.integerLiteralText(leaf);
    if (literal !== null || result === null) return literal;
    if (result.kind === "overflow") {
      this.found.push({
        code: "E0910",
        span: leaf.span,
        message: `Value overflows ${result.typeName} at compile time: ${ConstantDiagnostics.OVERFLOW_CAUSE}`,
        helpText: ConstantDiagnostics.OVERFLOW_HELP,
      });
      return null;
    }
    // A typed value's range is its type's, which E0869 judges
    const judged =
      result.kind === "value" &&
      (result.typeName === null || result.typeName === target);
    return judged ? String(result.value) : null;
  }

  /** The one fold: a value-role operand at the target's width (#1618) */
  private foldAt(target: string, expr: TExpression, role: TLiteralRole): TFold {
    return OperandTyper.constantResultOf(
      expr,
      this.context,
      role === "value" ? target : null,
    );
  }

  /**
   * E0927: one character of a `string<N>` takes a character, or a string
   * E0864 fits into it (ADR-045, #1748). Any other value is MISRA C:2012
   * Rule 10.3's write across essential type categories. True when reported.
   */
  private checkCharacterAt(site: IAssignmentSyntax): boolean {
    if (site.operator !== "<-") return false;
    const write = CharacterWrite.of(site.target, site.value, this.context);
    if (write !== "other") return false;
    this.found.push({
      code: "E0927",
      span: site.value.span,
      message: `A value that is not a character cannot be assigned to a string's character: '${site.value.written}'`,
      helpText:
        "One character of a string<N> takes a character (ADR-045): a character literal, another string's character, or a one-character string",
    });
    return true;
  }

  /** E0914, then E0923: a string lands only in a string, and only a string does */
  private checkStringsAt(value: TExpression): boolean {
    return this.checkStringAt(value) || this.checkNonStringAt(value);
  }

  /**
   * E0923: a value that is not a string at a position that types it one
   * string<N> (ADR-045, #1634) -- whatever it is, as `OperandTyper.isStringValue`
   * decides. True when reported. Unreported, it reached the string copy, which
   * takes the value as an address. A string array's list element is E0866's
   * (ADR-035, #2195), which takes only a string literal there.
   */
  private checkNonStringAt(value: TExpression): boolean {
    const position = ValuePositions.at(this.positions, value);
    if (position.inList) return false;
    const target = StructInitializerType.valueTypeAt(position);
    if (target === null || !TypeCheckUtils.isSizedStringName(target)) {
      return false;
    }
    if (OperandTyper.isStringValue(value, this.context) !== false) {
      return false;
    }
    this.found.push({
      code: "E0923",
      span: value.span,
      message: `A value that is not a string cannot be assigned to ${target}: '${value.written}'`,
      helpText:
        "A string<N> holds only a string (ADR-045): a literal, another string<N>, a concatenation, a substring or a C string",
    });
    return true;
  }

  /** Whether the write lands one whole string<N>, by the copy's own rule */
  private writesWholeString(site: IAssignmentSyntax): boolean {
    return OperandTyper.stringCopyCapacity(site.target, this.context) !== null;
  }

  /**
   * E0914: a string value at a position that types it a cnx scalar -- an
   * integer, a float, a bool, an enum or a bitmap. True when reported, so the
   * value is not judged again as a number.
   */
  private checkStringAt(value: TExpression): boolean {
    const target = StructInitializerType.valueTypeAt(
      ValuePositions.at(this.positions, value),
    );
    if (target === null || !this.isScalar(target, value)) return false;
    if (!this.landsString(value)) return false;
    this.found.push({
      code: "E0914",
      span: value.span,
      message: `A string value cannot be assigned to ${target}: '${value.written}'`,
      helpText:
        "A string lands only in a string<N> (ADR-045); a u8 array may be initialized by a string literal (ADR-035)",
    });
    return true;
  }

  /**
   * Every cnx type that holds one value and is not a string. A named type
   * is the one its spelling names where the value is (ADR-057): `ELocal` in
   * `scope S` is `S__ELocal`.
   */
  private isScalar(target: string, value: TExpression): boolean {
    if (
      TypeCheckUtils.isInteger(target) ||
      TypeCheckUtils.isFloat(target) ||
      target === "bool"
    ) {
      return true;
    }
    const cName = this.context.program.cTypeNameAt(
      this.context.sourceFile,
      target,
      { line: value.span.line, column: value.span.column },
    );
    const symbols = this.context.symbols;
    return symbols.knownEnums.has(cName) || symbols.knownBitmaps.has(cName);
  }

  /**
   * Whether a string is what lands: the value itself, the one it
   * parenthesizes, or either arm of a ternary -- each arm lands in the target
   */
  private landsString(value: TExpression): boolean {
    if (value.kind === "parenthesized") {
      return this.landsString(value.expression);
    }
    if (value.kind === "ternary") {
      return (
        this.landsString(value.whenTrue) || this.landsString(value.whenFalse)
      );
    }
    return (
      ExpressionShape.isStringLiteral(value) ||
      OperandTyper.isScalarString(OperandTyper.typeOf(value, this.context))
    );
  }

  private checkCast(cast: Extract<TExpression, { kind: "cast" }>): void {
    const target = cast.type.text;
    if (!TypeCheckUtils.isInteger(target)) return;
    const source = this.conversionSource(cast.operand, false);
    if (source !== null) this.checkConversion(target, source, cast, "cast");
  }

  private check(
    target: string,
    value: TExpression,
    typeComposites: boolean,
  ): void {
    const text = IntegerConversionCheck.integerLiteralText(value);
    if (text !== null) {
      this.checkLiteral(target, text, value);
      return;
    }
    if (this.checkFloating(target, value)) return;
    const ternary = IntegerConversionCheck.ternaryOf(value);
    if (ternary !== null) {
      this.check(target, ternary.whenTrue, typeComposites);
      this.check(target, ternary.whenFalse, typeComposites);
      return;
    }
    this.checkLiteralLeaves(target, value, "value");
    const source = this.conversionSource(value, typeComposites);
    if (source !== null) this.checkConversion(target, source, value, "assign");
  }

  /** The ternary a value is, past its parentheses: each arm lands (ADR-022) */
  private static ternaryOf(
    value: TExpression,
  ): Extract<TExpression, { kind: "ternary" }> | null {
    if (value.kind === "parenthesized") {
      return IntegerConversionCheck.ternaryOf(value.expression);
    }
    return value.kind === "ternary" ? value : null;
  }

  /** An integer literal, or a minus over one, as one token: `-1`, `0xFF` */
  private static integerLiteralText(value: TExpression): string | null {
    const negated = value.kind === "unary" && value.operator === "-";
    const literal = negated ? value.operand : value;
    if (literal.kind !== "literal") return null;
    const text = negated ? `-${literal.text}` : literal.text;
    return INTEGER_LITERAL.test(text) ? text : null;
  }

  private checkFloating(target: string, value: TExpression): boolean {
    const floating = CompositeType.floatingOf(
      OperandTyper.valueLeaves(value, this.context),
    );
    if (floating === null) return false;
    this.found.push({
      code: "E0891",
      span: value.span,
      message: `Implicit conversion from floating ${floating} to integer ${target}`,
      helpText: `Write the conversion as a cast, which saturates: (${target})value (ADR-024)`,
    });
    return true;
  }

  private checkLiteral(target: string, text: string, at: TExpression): void {
    const value = IntegerConversionCheck.literalValue(text);

    if (TypeCheckUtils.isUnsigned(target) && value < 0n) {
      this.found.push({
        code: "E0868",
        span: at.span,
        message: `Negative value ${text} cannot be assigned to unsigned type ${target}`,
        helpText: `An unsigned type holds no negative values; use a signed type such as i${TYPE_WIDTH[target]}.`,
      });
      return;
    }
    const range = TypeCheckUtils.integerRange(target);
    invariant(range, `every caller checks that ${target} is an integer`);
    const [min, max] = range;
    if (value < min || value > max) {
      this.found.push({
        code: "E0868",
        span: at.span,
        message: `Value ${text} exceeds ${target} range (${min} to ${max})`,
        helpText: "Widen the target type, or narrow the value.",
      });
    }
  }

  private checkConversion(
    target: string,
    source: string,
    at: TExpression,
    kind: "assign" | "cast",
  ): void {
    if (source === target || !TypeCheckUtils.isInteger(source)) return;
    const verb = kind === "cast" ? "cast" : "assign";
    const subject = kind === "cast" ? "expr" : "value";
    const targetWidth = TYPE_WIDTH[target];

    if (TYPE_WIDTH[source] > targetWidth) {
      this.found.push({
        code: "E0869",
        span: at.span,
        message: `Cannot ${verb} ${source} to ${target} (narrowing)`,
        helpText: `Use bit indexing to say which bits you mean: ${subject}[0, ${targetWidth}]`,
      });
      return;
    }
    if (TypeCheckUtils.isSigned(source) !== TypeCheckUtils.isSigned(target)) {
      this.found.push({
        code: "E0869",
        span: at.span,
        message: `Cannot ${verb} ${source} to ${target} (sign change)`,
        helpText: `Use bit indexing to reinterpret the bits explicitly: ${subject}[0, ${targetWidth}]`,
      });
    }
  }

  // --- What type a source is ------------------------------------------------

  /**
   * The integer type a source converts from, as a cnx integer name, or
   * null when the rule does not judge it (#1668, the design's §5 row):
   *
   * - a top-level ternary, which only a cast brings here: `check` takes
   *   each arm where it stands;
   * - a lone bit extraction, `large[0, 8]`: ADR-024's explicit reinterpret,
   *   the form this rule tells the author to use;
   * - a composite, `a + b`: its integer type, as the typer settled it -- the
   *   one rule 2.2 sizes its clamp helper by -- unless `composites` is false,
   *   as for a cast;
   * - anything else: the typer's type, a C or C++ integer included, at its
   *   width on this target; a suffixed literal is its suffix's type.
   */
  private conversionSource(
    expr: TExpression,
    composites: boolean,
  ): string | null {
    if (expr.kind === "ternary") return null;
    const t = OperandTyper.typeOf(expr, this.context);
    if (t === null) return null;
    if (t.form.kind === "composite") {
      return composites && t.bitWidth !== null ? t.typeName : null;
    }
    if (t.form.kind === "bitRange" || t.form.kind === "bitIndex") return null;
    return IntegerConversionCheck.integerName(t);
  }

  private static integerName(t: IOperandType): string | null {
    if (t.dimensions.length > 0 || t.bitWidth === null) return null;
    if (t.category === "signed") return `i${t.bitWidth}`;
    if (t.category === "unsigned") return `u${t.bitWidth}`;
    return null;
  }
}

class IntegerConversionAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): IIntegerConversionError[] {
    const check = new IntegerConversionCheck(this.context, positions);
    for (const { declaration } of program.members) {
      for (const statement of StatementNodes.in(declaration)) {
        if (statement.kind === "return" && statement.value) {
          check.checkAt(statement.value);
        }
      }
    }
    ProgramAccesses.checkEverything(program, check);
    return check.errors().sort(SourceOrder.bySpan);
  }
}

export default IntegerConversionAnalyzer;
