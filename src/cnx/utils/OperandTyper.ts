/**
 * #1668: the one operand typer.
 *
 * Pass 2.1 (the analyzers) and pass 2.2 (planning the C) each typed
 * operands with a chain walker of their own, so every expression shape had
 * to be taught twice, and the two already disagreed. This answers "what is
 * the value type of this operand" once, as a pure function of the node and
 * the typing context -- no field, no state, no registry. Each consuming rule
 * applies its own policy to the facts; none is decided here.
 *
 * Names bind through `IProgram.bindValue`, so a local, a parameter, a scope
 * member and a global are found the same way for typing and emission; a C
 * or C++ header's operand is typed by `ForeignTypeFacts` from its spelling
 * and the run's target.
 */
import ExpressionCalls from "./ExpressionCalls";
import CppNamespaceUtils from "./CppNamespaceUtils";
import ExpressionShape from "./ExpressionShape";
import ConstExprLowering from "./ConstExprLowering";
import ConstantEvaluator from "./ConstantEvaluator";
import ConstantFold from "./ConstantFold";
import TTypeUtils from "./TTypeUtils";
import PrimitiveKindUtils from "./PrimitiveKindUtils";
import TypeCheckUtils from "./TypeCheckUtils";
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import ForeignTypeFacts from "./ForeignTypeFacts";
import LiteralUtils from "./LiteralUtils";
import CompositeType from "./CompositeType";
import QualifiedCName from "./QualifiedCName";
import LengthProperty from "./LengthProperty";
import TypeHead from "./TypeHead";
import ResolvedTarget from "./ResolvedTarget";
import PROPERTY_NAMES from "./constants/PROPERTY_NAMES";
import ScopeUtils from "./ScopeUtils";
import SubscriptClassifier from "./SubscriptClassifier";
import TypeResolver from "./TypeResolver";
import TypeNameLadder from "./TypeNameLadder";
import type THeaderMacro from "../types/THeaderMacro";
import type IChainStep from "../types/IChainStep";
import type IChainTyping from "../types/IChainTyping";
import type IOperandType from "../types/IOperandType";
import type ITargetDescription from "../types/ITargetDescription";
import type ITypingContext from "../types/ITypingContext";
import type TEssentialCategory from "../types/TEssentialCategory";
import type TType from "../types/TType";
import type TValueBinding from "../types/TValueBinding";
import type TSubscriptKind from "../types/TSubscriptKind";
import type IFieldBits from "../types/IFieldBits";
import type TExpression from "../types/syntax/TExpression";
import type TExpressionOf from "../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import DeclaredTypeFacts from "./DeclaredTypeFacts";

/** Where a chain walk stands between operations */
type TChainValue =
  | {
      readonly k: "value";
      readonly t: IOperandType;
      /**
       * A register member (ADR-004), by its C name and its register's: its
       * subscripts are bits, and a field of it is written per the member's
       * access. Null for any other value.
       */
      readonly registerMember: {
        readonly register: string;
        readonly cName: string;
      } | null;
    }
  | { readonly k: "scope"; readonly scopePath: string }
  /**
   * A type named where a value would be, `u32` or `Point.y` (#1975): no
   * value, but the shape ADR-058's length properties measure
   */
  | { readonly k: "type"; readonly t: IOperandType }
  | { readonly k: "enumType"; readonly name: string }
  | { readonly k: "register"; readonly name: string }
  | {
      readonly k: "function";
      readonly cName: string;
      readonly returnType: TType;
    }
  /** An unresolved name path: a C/C++ namespace, class or function */
  | { readonly k: "foreignPath"; readonly parts: readonly string[] }
  /** A header's function pointer, not yet called: its call's result */
  | { readonly k: "foreignFunction"; readonly result: IOperandType | null }
  | { readonly k: "unknown" };

const UNKNOWN: TChainValue = { k: "unknown" };

/** The operations a chain applies after its head */
type TChainOps = readonly TPostfixOpSyntax[];

/** A chain's head, typed, and the operations left to apply to it */
interface IChainStart {
  binding: TValueBinding | null;
  value: TChainValue;
  ops: TChainOps;
}

/** How an operand came to have its type */
type TOperandForm = IOperandType["form"];

const DECLARED: TOperandForm = { kind: "declared" };

/** A name that may be a macro cnx could not read (#1688, ADR-024) */
const UNREAD_MACRO: THeaderMacro = { kind: "unreadable" };

class OperandTyper {
  /**
   * Whether evaluating an expression has a side effect: it calls a function
   * or reads a volatile or atomic declaration. A call the typer cannot type
   * still counts, found by its spelling. The one test for an element read's
   * own side effect and for a read-modify-write target that would evaluate
   * the expression twice (E0890).
   */
  static hasSideEffect(expr: TExpression, ctx: ITypingContext): boolean {
    return (
      ExpressionCalls.callsAtTop(expr) ||
      OperandTyper.typeOf(expr, ctx)?.hasSideEffect === true
    );
  }

  /**
   * Whether a bit or bit-range subscript writes the value's bits (ADR-007):
   * an integer's, of any width, or a float's, through a union. The classifier
   * and the member-chain writer ask this one question (#1760 review), which
   * each had answered for integers alone, so a float element or field bit
   * write fell through to a plain subscript store that C rejects.
   */
  static hasWritableBits(t: IOperandType | null): boolean {
    return (
      t?.category === "signed" ||
      t?.category === "unsigned" ||
      t?.category === "floating"
    );
  }

  /**
   * The type 2.2 reads an expression AS, for the sites that take one type for
   * the whole of it: the MISRA 10.3 cast on an initializer, a simple
   * assignment, a slice source, a call argument, `~`'s width. A composite or a
   * ternary has no one type there -- its operands are typed one by one, by
   * CompositeType -- so it is null, as it always was; anything else is the
   * typer's type: `int` for an unsuffixed literal, the suffix's for a
   * suffixed one, `bool` for a Boolean.
   */
  static directTypeName(t: IOperandType | null): string | null {
    if (t === null) return null;
    if (t.form.kind === "composite" || t.form.kind === "ternary") return null;
    return t.typeName;
  }

  /**
   * The value type of any expression-level node: it descends through
   * single-child levels, parentheses, unary operators, ternaries and
   * composites. Null when the operand has no type this can settle.
   */
  static typeOf(expr: TExpression, ctx: ITypingContext): IOperandType | null {
    switch (expr.kind) {
      case "postfix":
        return OperandTyper.walkChain(expr, ctx).last;
      case "identifier":
        return OperandTyper.identifierType(expr, ctx);
      case "parenthesized":
        return OperandTyper.typeOf(expr.expression, ctx);
      case "literal":
        return OperandTyper.literalType(expr);
      case "cast":
        return OperandTyper.castType(expr, ctx);
      case "unary":
        return OperandTyper.unaryType(expr, ctx);
      case "ternary":
        return OperandTyper.ternaryType(expr, ctx);
      case "binary":
        if (OperandTyper.isBooleanLevel(expr)) {
          return OperandTyper.booleanValue(false);
        }
        // `a << n` is `a`'s type; the shift count is never an operand (C01)
        if (expr.level === "shift") {
          return OperandTyper.typeOf(expr.operands[0], ctx);
        }
        return OperandTyper.compositeType(expr, ctx);
      default:
        return null;
    }
  }

  /**
   * The value leaves of one arithmetic or bitwise level (#1668, §3.6), by the
   * one collection rule every consumer shares. It descends through arithmetic
   * and bitwise levels, parentheses, a ternary's VALUE arms (never its
   * condition), and unary `-` and `~`; it stops at a postfix chain, a cast, a
   * Boolean-valued level or `!` (one Boolean leaf) and `sizeof`; it excludes
   * `&x` and a shift count.
   */
  static valueLeaves(
    expr: TExpression,
    ctx: ITypingContext,
  ): Array<IOperandType | null> {
    return OperandTyper.valueLeafExpressions(expr).map((leaf) =>
      OperandTyper.typeOf(leaf, ctx),
    );
  }

  /**
   * The expressions `valueLeaves` types, by the same collection rule. An
   * expression `isLeaf` accepts is one leaf, however it is built.
   */
  static valueLeafExpressions(
    expr: TExpression,
    isLeaf: (expr: TExpression) => boolean = () => false,
  ): TExpression[] {
    if (isLeaf(expr)) return [expr];
    if (OperandTyper.isCompositeLevel(expr)) {
      return expr.operands.flatMap((operand) =>
        OperandTyper.valueLeafExpressions(operand, isLeaf),
      );
    }
    if (expr.kind === "ternary") {
      return [expr.whenTrue, expr.whenFalse].flatMap((arm) =>
        OperandTyper.valueLeafExpressions(arm, isLeaf),
      );
    }
    if (expr.kind === "unary" && expr.operator === "&") return [];
    const operand = OperandTyper.wrappedOperand(expr);
    return operand === null
      ? [expr]
      : OperandTyper.valueLeafExpressions(operand, isLeaf);
  }

  /**
   * The one expression a wrapper's value is: a parenthesized expression, a
   * shift's left operand (its count is not a value leaf), or the operand of
   * a unary `-` or `~` -- except a negated literal, `-5`, which is one leaf.
   * Null for anything else.
   *
   * The one descent `valueLeaves` and `compositeLevelOf` share (#1760 second
   * review): the second stopped at a unary or a shift, so the category of
   * `-(a + 'A')` was scanned from leaves that disagree, where `(a + 'A')`
   * had its level's.
   */
  private static wrappedOperand(expr: TExpression): TExpression | null {
    if (expr.kind === "parenthesized") return expr.expression;
    if (expr.kind === "binary" && expr.level === "shift") {
      return expr.operands[0];
    }
    if (expr.kind !== "unary") return null;
    if (expr.operator !== "-" && expr.operator !== "~") return null;
    const negatedLiteral =
      expr.operator === "-" && expr.operand.kind === "literal";
    return negatedLiteral ? null : expr.operand;
  }

  /**
   * A postfix chain or assignment target, typed one operation at a time. A
   * `this.` or `global.` root has consumed its first `.name`.
   */
  static chainOf(chain: TExpression, ctx: ITypingContext): IChainTyping {
    return OperandTyper.walkChain(chain, ctx).typing;
  }

  /**
   * An operand's compile-time integer value, by the one evaluator (#1175):
   * literals, names that bind here to a const (through the one binder, so a
   * const local shadows as it does everywhere else), and the arithmetic over
   * them that C computes exactly. Anything else -- a call, an element, a
   * variable, arithmetic ADR-044 would clamp or wrap -- is a runtime value:
   * null. So is a comparison, which is a bool, not an integer.
   *
   * This used to read only a literal under leading minus signs or a bare
   * name, and called arithmetic a runtime value, because folding it exactly
   * disagreed with ADR-044's saturating C. The evaluator folds at the
   * operands' width and declines where C would clamp, so that reason is gone,
   * and a fifth rule for a constant's value with it.
   */
  /**
   * The evaluator's whole answer for `expr`, folded in `context` (a type
   * name) when given: an `overflow` is a known value that does not fit (#1618).
   */
  static constantResultOf(
    expr: TExpression,
    ctx: ITypingContext,
    context: string | null = null,
  ): ReturnType<typeof ConstantEvaluator.evaluate> {
    return ConstantEvaluator.evaluate(
      ConstExprLowering.lower(expr),
      ConstantFold.environment(ctx.program, ctx.sourceFile),
      context,
    );
  }

  static constantOf(expr: TExpression, ctx: ITypingContext): number | null {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(expr),
      ConstantFold.environment(ctx.program, ctx.sourceFile),
    );
    return result.kind === "value" && result.typeName !== "bool"
      ? (ConstantEvaluator.toNumber(result.value) ?? null)
      : null;
  }

  /**
   * A bare name's value type as it binds at `at`: a local, a member, a
   * global or a header's variable, through Program's one binder. For a rule
   * that holds a name rather than an expression node.
   */
  static typeOfName(
    name: string,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): IOperandType | null {
    const binding = ctx.program.bindValue(ctx.sourceFile, null, name, at);
    return binding && binding.kind !== "scope"
      ? OperandTyper.boundValue(binding, ctx)
      : null;
  }

  /** The value type an assignment target writes */
  static typeOfTarget(
    target: TExpression,
    ctx: ITypingContext,
  ): IOperandType | null {
    return OperandTyper.walkChain(target, ctx).last;
  }

  /** What a target's chain is rooted in: the declaration it writes into */
  static rootOfTarget(
    target: TExpression,
    ctx: ITypingContext,
  ): TValueBinding | null {
    return OperandTyper.walkChain(target, ctx).typing.root;
  }

  /**
   * ADR-014: the arrays a value passes by reference -- itself, or each value
   * arm of a ternary, through parentheses. Null when one is not an array: a
   * list, a string literal or a scalar is not passed as it stands, and nor is
   * a value the typer cannot type (a C macro such as `#define LIMIT 5`), which
   * is asked for a list as a scalar is.
   */
  static arrayArms(
    expr: TExpression,
    ctx: ITypingContext,
  ): TExpression[] | null {
    const inner = ExpressionShape.unparenthesized(expr);
    if (inner.kind === "ternary") {
      const whenTrue = OperandTyper.arrayArms(inner.whenTrue, ctx);
      const whenFalse = OperandTyper.arrayArms(inner.whenFalse, ctx);
      return whenTrue === null || whenFalse === null
        ? null
        : [...whenTrue, ...whenFalse];
    }
    if (
      inner.kind === "arrayInitializer" ||
      inner.kind === "structInitializer" ||
      ExpressionShape.isStringLiteral(inner)
    ) {
      return null;
    }
    const typed = OperandTyper.typeOf(inner, ctx);
    return typed !== null && typed.dimensions.length > 0 ? [inner] : null;
  }

  /**
   * The dimensions an assignment target takes a whole array of (#1782):
   * none for a scalar, an element, or an ADR-007 slice, which writes a
   * value's bytes rather than an array.
   */
  static wholeArrayDimensions(
    target: TExpression,
    ctx: ITypingContext,
  ): ReadonlyArray<number | string> {
    const { typing, last } = OperandTyper.walkChain(target, ctx);
    if (last === null || typing.steps.at(-1)?.subscript === "array_slice") {
      return [];
    }
    return last.dimensions;
  }

  /** The chain typed, and the value it ends on */
  private static walkChain(
    chain: TExpression,
    ctx: ITypingContext,
  ): { typing: IChainTyping; last: IOperandType | null } {
    const start = OperandTyper.chainStart(chain, ctx);
    const steps: IChainStep[] = [];
    let current = start.value;
    let bitField = false;
    for (const op of start.ops) {
      const before = OperandTyper.measuredBy(current, op, ctx);
      const { next, subscript } = OperandTyper.applyOp(current, op, ctx);
      const member = op.kind === "member" ? op.name : null;
      const field = bitField
        ? OperandTyper.fieldBitsOf(steps.at(-1), subscript, ctx)
        : null;
      const owner = field === null ? undefined : steps.at(-1);
      const beforeRegisterMember =
        owner !== undefined
          ? owner.beforeRegisterMember
          : current.k === "value"
            ? (current.registerMember?.cName ?? null)
            : null;
      steps.push({
        before,
        beforeNamesType: current.k === "type" || current.k === "enumType",
        beforeIsBitField: bitField,
        fieldBits: field,
        beforeRegisterMember,
        beforeRegister:
          owner !== undefined
            ? owner.beforeRegister
            : current.k === "value"
              ? (current.registerMember?.register ?? null)
              : null,
        registerMember:
          next.k === "value" ? (next.registerMember?.cName ?? null) : null,
        subscript,
        after: next.k === "value" ? next.t : null,
        callee: op.kind === "call" ? OperandTyper.calleeOf(current) : null,
        member,
        property:
          before !== null &&
          member !== null &&
          OperandTyper.readsProperty(before, member, ctx)
            ? member
            : null,
      });
      bitField = OperandTyper.isBitField(current, op, ctx);
      current = next;
    }
    return {
      typing: { root: start.binding, steps },
      last: current.k === "value" ? current.t : null,
    };
  }

  /**
   * What an op applies to: a value's type, or a named type's shape -- which
   * only a length property reads (#1975: `u32.type_byte_length`, `Mode.type_byte_length`)
   */
  private static measuredBy(
    current: TChainValue,
    op: TPostfixOpSyntax,
    ctx: ITypingContext,
  ): IOperandType | null {
    if (current.k === "value" || current.k === "type") return current.t;
    if (
      current.k === "enumType" &&
      op.kind === "member" &&
      OperandTyper.enumReadsProperty(current.name, op.name, ctx)
    ) {
      return {
        ...OperandTyper.plain(current.name),
        ...OperandTyper.namedFacts(current.name, ctx),
      };
    }
    return null;
  }

  /** `Mode.type_byte_length`: a property name the enum declares no member of */
  private static enumReadsProperty(
    cName: string,
    member: string,
    ctx: ITypingContext,
  ): boolean {
    const symbol = ctx.program.symbolByCName(cName);
    return (
      PROPERTY_NAMES.has(member) &&
      !(symbol?.kind === "enum" && symbol.members.has(member))
    );
  }

  /**
   * #1975: a type named at the head of a chain -- a primitive, a cnx
   * struct or bitmap (ADR-057's qualification, as every type position), or a
   * header's struct. Null for a name that is no such type.
   */
  private static typeHead(
    name: string,
    scopePath: string,
    ctx: ITypingContext,
  ): IOperandType | null {
    const primitive = TypeHead.primitive(name);
    if (primitive !== null) return OperandTyper.fromType(primitive, [], ctx);
    const cName = OperandTyper.cNameOf(
      ScopeUtils.qualifyScopeType(
        name,
        scopePath,
        OperandTyper.scopeTypesSeenBy(ctx),
      ),
    );
    const named = OperandTyper.namedTypeOf(cName, ctx);
    if (named !== null) return named;
    const target = OperandTyper.target(ctx);
    return TypeHead.header(name, ctx.symbolTable, target) === null
      ? null
      : ForeignTypeFacts.operandType(name, ctx.symbolTable, target);
  }

  /** A member of the enum the name names */
  private static enumMember(enumName: string): TChainValue {
    return {
      k: "value",
      registerMember: null,
      t: {
        ...OperandTyper.plain(enumName),
        category: "enum",
        enumTypeName: enumName,
        form: { kind: "enumMember" },
      },
    };
  }

  /** A cnx struct or bitmap the C name names; null for any other symbol */
  private static namedTypeOf(
    cName: string,
    ctx: ITypingContext,
  ): IOperandType | null {
    // An enum names its members first (`EMode.RUN`): `enumType` types it
    const type = TypeHead.ofSymbol(ctx.program.symbolByCName(cName), cName);
    return type === null || type.kind === "enum"
      ? null
      : OperandTyper.fromType(type, [], ctx);
  }

  /**
   * #1975 review, #2078: the op at which a chain that names a type stops
   * naming one it may. A type answers ADR-058's length properties, its own
   * and its fields' types' (`Point.y.type_byte_length`), and names no value. The
   * op that leaves that shape -- a missing field, `u32.foo`, a subscript --
   * or `at: null` for a chain that ends on the type (`Point.x`). Null for a
   * chain whose head is no type, or one that ends reading a length of one.
   */
  static typeNamedAsValue(
    chain: TExpression,
    ctx: ITypingContext,
  ): { at: TPostfixOpSyntax | null; type: IOperandType } | null {
    const start = OperandTyper.chainStart(chain, ctx);
    let current = start.value;
    for (const [i, op] of start.ops.entries()) {
      if (current.k !== "type") {
        current = OperandTyper.applyOp(current, op, ctx).next;
        continue;
      }
      const next = OperandTyper.applyOp(current, op, ctx).next;
      if (
        next.k === "type" ||
        (next.k === "value" && next.t.form.kind === "enumMember")
      ) {
        current = next;
        continue;
      }
      // A field of the name typed above; a length property ends the chain,
      // and LengthPropertyAnalyzer holds it to the type it is asked of
      if (op.kind === "member" && LengthProperty.isLength(op.name)) {
        const after = start.ops[i + 1];
        return after === undefined ? null : { at: after, type: current.t };
      }
      return { at: op, type: current.t };
    }
    return current.k === "type" ? { at: null, type: current.t } : null;
  }

  /**
   * Whether an operand's type is a string (ADR-045), an array of them
   * included: a `string<N>`, or the bare `string` keyword, whose capacity is
   * not known here -- main's `string args[]` (ADR-030) and an unsized
   * `const string`. #1668 (C12): three rules stood where this one does, and
   * only this one's callers ask it; the subscript shape knew only a capacity,
   * so the element of `args[0]` was read as a bit rather than a character.
   */
  /** A bounded string value -- not an array of them, nor an element of one, which is a char */
  static isScalarString(t: IOperandType | null): boolean {
    return t !== null && t.dimensions.length === 0 && OperandTyper.isString(t);
  }

  /**
   * A bounded `string<N>` value's capacity `N` -- not an array of them, which
   * an element of one is; null for anything else (#1737). What a copy into
   * the value is bounded by.
   */
  static scalarStringCapacity(
    t: IOperandType | null | undefined,
  ): number | null {
    if (t === null || t === undefined || t.dimensions.length > 0) return null;
    return t.stringCapacity;
  }

  /**
   * The capacity of the one `string<N>` a write stores whole -- through a
   * name or an element, never a slice or a bit of what it selects -- or null (#1731
   * review). 2.1's E0715 and 2.2's bounded copy both read it, so a `for`
   * header is never handed a copy 2.1 let through.
   */
  static wholeStringCapacity(
    written: IOperandType | null,
    subscript: TSubscriptKind | null,
  ): number | null {
    const writesWhole = subscript === null || subscript === "array_element";
    return writesWhole ? OperandTyper.scalarStringCapacity(written) : null;
  }

  /**
   * #1634: whether a value is a string, as the `string<N>` it lands in reads
   * it (ADR-045): a string literal; a `string<N>` or unsized `string` -- an
   * element or a field of one included; a concatenation of strings, or a
   * ternary between two; a C `char` array; or a substring of a string, its
   * `s[0]` among them. False for
   * every other value the typer types, so a category added later is no string
   * until this says so. Null for a value the typer leaves untyped, a header's
   * pointer among them (ForeignTypeFacts.operandType), which C judges.
   */
  static isStringValue(
    value: TExpression,
    ctx: ITypingContext,
  ): boolean | null {
    if (value.kind === "parenthesized") {
      return OperandTyper.isStringValue(value.expression, ctx);
    }
    const parts = OperandTyper.stringParts(value);
    if (parts !== null) {
      const each = parts.map((part) => OperandTyper.isStringValue(part, ctx));
      if (each.includes(false)) return false;
      return each.includes(null) ? null : true;
    }
    if (ExpressionShape.isStringLiteral(value)) return true;
    const t = OperandTyper.typeOf(value, ctx);
    if (t === null) return null;
    return (
      OperandTyper.isScalarString(t) ||
      (t.typeName === "char" && t.dimensions.length === 1) ||
      OperandTyper.isSubstring(value, ctx)
    );
  }

  /**
   * The values a ternary or a `+` chain is a string of, when each is: its two
   * arms, or its operands -- three or more among them, which #1954 tracks
   */
  private static stringParts(
    value: TExpression,
  ): readonly TExpression[] | null {
    if (value.kind === "ternary") return [value.whenTrue, value.whenFalse];
    return ExpressionShape.concatenationOperands(value);
  }

  /**
   * A subscript of one string, which ADR-045 reads as its substring:
   * `s[0, 2]`, or `s[0]`, its first character
   */
  static isSubstring(value: TExpression, ctx: ITypingContext): boolean {
    if (value.kind !== "postfix") return false;
    const step = OperandTyper.walkChain(value, ctx).typing.steps.at(-1);
    return (
      step !== undefined &&
      step.subscript !== null &&
      OperandTyper.isScalarString(step.before)
    );
  }

  /** `wholeStringCapacity` of what an assignment target writes */
  static stringCopyCapacity(
    target: TExpression,
    ctx: ITypingContext,
  ): number | null {
    const { written, subscript } = OperandTyper.writtenBy(target, ctx);
    return OperandTyper.wholeStringCapacity(written, subscript);
  }

  /**
   * The type an assignment target writes, which ADR-044's clamp and the
   * string copy both decide from (#1731 review)
   */
  static writtenType(
    target: TExpression,
    ctx: ITypingContext,
  ): IOperandType | null {
    return OperandTyper.writtenBy(target, ctx).written;
  }

  /**
   * What a target writes and through which subscript: its last step's, or with
   * no step the root itself -- `x`, `this.x` or `global.x`
   */
  private static writtenBy(
    target: TExpression,
    ctx: ITypingContext,
  ): { written: IOperandType | null; subscript: TSubscriptKind | null } {
    const walked = OperandTyper.walkChain(target, ctx);
    const step = walked.typing.steps.at(-1);
    return step === undefined
      ? { written: walked.last, subscript: null }
      : { written: step.after, subscript: step.subscript };
  }

  static isString(t: IOperandType | null): boolean {
    if (t === null) return false;
    const name = t.typeName ?? "";
    return (
      t.stringCapacity !== null ||
      name === "string" ||
      TypeCheckUtils.isSizedStringName(name)
    );
  }

  /**
   * Whether an operand is stored as a C array, which C decays to a pointer to
   * its first element: a whole array (`pts`, not `pts[0]`), or a string,
   * whose `char` buffer is an array though it is not one of `dimensions`.
   * Such an argument never takes `&` -- its address is a pointer to the ARRAY.
   */
  static decaysToPointer(t: IOperandType | null): boolean {
    return t !== null && (t.dimensions.length > 0 || OperandTyper.isString(t));
  }

  /**
   * ADR-057's scope-type predicate for the file being typed: the scope types
   * it declares or its include closure declares (#1724). The one answer 1.4
   * settled the file's symbols with and codegen qualifies with, so the typer
   * cannot see a sibling's scope type the file never includes.
   */
  private static scopeTypesSeenBy(
    ctx: ITypingContext,
  ): (qualifiedName: string) => boolean {
    return (qualifiedName) =>
      ctx.program.isScopeTypeVisibleFrom(ctx.sourceFile, qualifiedName);
  }

  /**
   * Whether an operand is essentially Boolean: an applied relational or
   * logical operator, `!`, or a `bool`. A single bit of a scalar is not
   * (ADR-024: it is a bit index), and neither is an array of bools.
   */
  static isBoolean(t: IOperandType | null): boolean {
    if (t === null || t.dimensions.length > 0) return false;
    return (
      t.form.kind === "boolean" ||
      (t.typeName === "bool" && t.form.kind !== "bitIndex")
    );
  }

  /** The essential category of a cnx type name: decided here, once (G8) */
  static categoryOf(typeName: string | null): TEssentialCategory {
    if (typeName === null) return "none";
    if (typeName === "bool") return "boolean";
    if (typeName === "char") return "character";
    // TypeCheckUtils' lists, not a second spelling of them (#1760 review)
    if (TypeCheckUtils.isUnsigned(typeName)) return "unsigned";
    if (TypeCheckUtils.isSigned(typeName)) return "signed";
    if (TypeCheckUtils.isFloat(typeName)) return "floating";
    return "none";
  }

  // --------------------------------------------------------------------------
  // Levels
  // --------------------------------------------------------------------------

  private static isBooleanLevel(expr: TExpressionOf<"binary">): boolean {
    return (
      expr.level === "or" ||
      expr.level === "and" ||
      expr.level === "equality" ||
      expr.level === "relational"
    );
  }

  /**
   * The composite operator level (`*`, `+`, `&`, `^`, `|`) an expression IS,
   * through single-child chains and `wrappedOperand`, or null. The same
   * descent `valueLeaves` flattens, for a rule that needs the level itself --
   * Rule 10.4's category of an operand that is an operation (#1760 review).
   */
  static compositeLevelOf(expr: TExpression): TExpressionOf<"binary"> | null {
    if (OperandTyper.isCompositeLevel(expr)) return expr;
    const operand = OperandTyper.wrappedOperand(expr);
    return operand === null ? null : OperandTyper.compositeLevelOf(operand);
  }

  private static isCompositeLevel(
    expr: TExpression,
  ): expr is TExpressionOf<"binary"> {
    return (
      expr.kind === "binary" &&
      (expr.level === "bitwiseOr" ||
        expr.level === "bitwiseXor" ||
        expr.level === "bitwiseAnd" ||
        expr.level === "additive" ||
        expr.level === "multiplicative")
    );
  }

  private static compositeType(
    expr: TExpressionOf<"binary">,
    ctx: ITypingContext,
  ): IOperandType {
    const leaves = OperandTyper.valueLeaves(expr, ctx);
    const typed = leaves.filter((leaf): leaf is IOperandType => leaf !== null);
    const categories = new Set(
      typed.map((leaf) => leaf.category).filter((c) => c !== "none"),
    );
    const names = new Set(typed.map((leaf) => leaf.typeName));
    const category =
      categories.size === 1 ? ([...categories][0] ?? "none") : "none";
    // The integer type the composite computes in, settled here once (#1760
    // second review): four consumers each re-derived it from the leaves
    const integer = CompositeType.integerOf(leaves);
    return {
      ...OperandTyper.plain(
        integer ?? OperandTyper.compositeName(names, category, leaves),
      ),
      category,
      bitWidth: integer === null ? null : OperandTyper.widthOf(integer),
      hasSideEffect: typed.some((leaf) => leaf.hasSideEffect),
      form: { kind: "composite", leaves },
    };
  }

  /**
   * A non-integer composite's type name: its leaves' one name, or for
   * floating leaves of different names C's usual arithmetic conversion
   * (`CompositeType`). An integer composite is typed by `CompositeType.
   * integerOf`, with its width, and its `bitWidth` says it is one.
   */
  private static compositeName(
    names: ReadonlySet<string | null>,
    category: TEssentialCategory,
    leaves: ReadonlyArray<IOperandType | null>,
  ): string | null {
    if (names.size === 1) return [...names][0] ?? null;
    return category === "floating" ? CompositeType.floatingOf(leaves) : null;
  }

  private static ternaryType(
    expr: TExpressionOf<"ternary">,
    ctx: ITypingContext,
  ): IOperandType | null {
    const whenTrue = OperandTyper.typeOf(expr.whenTrue, ctx);
    const whenFalse = OperandTyper.typeOf(expr.whenFalse, ctx);
    const same =
      whenTrue !== null &&
      whenFalse !== null &&
      whenTrue.typeName === whenFalse.typeName &&
      whenTrue.category === whenFalse.category;
    return {
      ...(same ? whenTrue : OperandTyper.floatingArms(whenTrue, whenFalse)),
      overflow: null,
      binding: null,
      hasSideEffect:
        (whenTrue?.hasSideEffect ?? false) ||
        (whenFalse?.hasSideEffect ?? false),
      form: { kind: "ternary", arms: [whenTrue, whenFalse] },
    };
  }

  /**
   * Two arms of different types: C's usual arithmetic conversion when every
   * arm with an essential category is floating (`c ? k : 2.0` is f64), and
   * untyped otherwise -- E0810 rejects the mixes in 2.1.
   */
  private static floatingArms(
    whenTrue: IOperandType | null,
    whenFalse: IOperandType | null,
  ): IOperandType {
    const arms = [whenTrue, whenFalse];
    const categorized = arms.filter(
      (arm): arm is IOperandType => arm !== null && arm.category !== "none",
    );
    const allFloating =
      categorized.length > 0 &&
      categorized.every((arm) => arm.category === "floating");
    if (!allFloating) return OperandTyper.plain(null);
    return {
      ...OperandTyper.plain(CompositeType.floatingOf(arms)),
      category: "floating",
    };
  }

  private static unaryType(
    expr: TExpressionOf<"unary">,
    ctx: ITypingContext,
  ): IOperandType | null {
    if (expr.operator === "!") {
      return OperandTyper.booleanValue(
        OperandTyper.typeOf(expr.operand, ctx)?.hasSideEffect ?? false,
      );
    }
    if (expr.operator === "-" || expr.operator === "~") {
      const t = OperandTyper.typeOf(expr.operand, ctx);
      if (t === null) return null;
      const form =
        expr.operator === "-" && t.form.kind === "literal"
          ? { ...t.form, negated: !t.form.negated }
          : t.form;
      return { ...t, form, overflow: null, binding: null };
    }
    // `&x` is an address, never a value operand (#1152)
    return null;
  }

  private static identifierType(
    expr: TExpressionOf<"identifier">,
    ctx: ITypingContext,
  ): IOperandType | null {
    const binding = ctx.program.bindValue(
      ctx.sourceFile,
      null,
      expr.name,
      OperandTyper.positionOf(expr),
    );
    const macro = OperandTyper.headerMacroType(binding, expr.name, ctx);
    if (macro) return macro;
    return binding ? OperandTyper.boundValue(binding, ctx) : null;
  }

  private static positionOf(node: TExpression): {
    line: number;
    column: number;
  } {
    return { line: node.span.line, column: node.span.column };
  }

  // --------------------------------------------------------------------------
  // Leaves
  // --------------------------------------------------------------------------

  /** A character constant, written inline or as a header macro's expansion */
  private static characterLiteral(): IOperandType {
    return {
      ...OperandTyper.plain("char"),
      category: "character",
      bitWidth: 8,
      form: {
        kind: "literal",
        literal: "char",
        negated: false,
      },
    };
  }

  private static literalType(
    expr: TExpressionOf<"literal">,
  ): IOperandType | null {
    const text = expr.text;
    if (text.startsWith("'")) return OperandTyper.characterLiteral();
    const typeName = LiteralUtils.typeOf(text);
    if (typeName === null) return null;
    if (typeName === "bool") {
      return {
        ...OperandTyper.plain("bool"),
        category: "boolean",
        form: {
          kind: "literal",
          literal: "bool",
          negated: false,
        },
      };
    }
    const floatParts = LiteralUtils.floatLiteralParts(text);
    if (floatParts !== null) {
      return {
        ...OperandTyper.plain(typeName),
        category: "floating",
        form: {
          kind: "literal",
          literal: "float",
          negated: false,
        },
      };
    }
    // An unsuffixed integer has no essential category of its own (ADR-052);
    // a suffixed one takes its suffix's (R2).
    const suffixed = typeName !== "int";
    return {
      ...OperandTyper.plain(typeName),
      category: suffixed ? OperandTyper.categoryOf(typeName) : "none",
      bitWidth: suffixed ? OperandTyper.widthOf(typeName) : null,
      form: { kind: "literal", literal: "integer", negated: false },
    };
  }

  private static castType(
    expr: TExpressionOf<"cast">,
    ctx: ITypingContext,
  ): IOperandType | null {
    const inner = OperandTyper.typeOf(expr.operand, ctx);
    const target = OperandTyper.typeOfWritten(
      expr.type,
      ctx,
      OperandTyper.positionOf(expr),
    );
    if (target === null) return null;
    return {
      ...target,
      overflow: null,
      binding: null,
      hasSideEffect: inner?.hasSideEffect ?? false,
      form: { kind: "cast" },
    };
  }

  /**
   * The scope path enclosing a node, from Program's lexical frames: the one
   * answer to "which scope is this in", which ADR-057 name lookups start from.
   */
  static scopePathAt(
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): string {
    return ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath;
  }

  /**
   * A written type -- a cast's, a declaration's -- resolved by the one
   * ladder (`TypeNameLadder`), so `this.T`, `global.T`, `Scope.T` and a bare `T`
   * name what they name everywhere else; qualifying the source text by hand
   * read `this.EMode` as a type called `this_EMode`.
   *
   * An array type is its element's type with the written dimensions (#1668
   * review: `EColor[2]` had no type at all, so its elements' bare enum
   * members lost their anchor).
   */
  static typeOfWritten(
    type: TTypeSyntax,
    ctx: ITypingContext,
    at: { line: number; column: number },
  ): IOperandType | null {
    if (type.kind === "array") {
      const element = OperandTyper.typeOfWritten(type.element, ctx, at);
      if (element === null) return null;
      const env = ConstantFold.environment(ctx.program, ctx.sourceFile);
      // #1175: the size as 1.4 settles a declared one -- never the source
      // text, which named what C cannot see
      const dimensions = type.dimensions.map((size) =>
        size ? ConstantFold.dimension(ConstExprLowering.lower(size), env) : "",
      );
      return {
        ...element,
        dimensions: [...dimensions, ...element.dimensions],
      };
    }
    if (
      type.kind === "primitive" &&
      PrimitiveKindUtils.isPrimitive(type.name)
    ) {
      return OperandTyper.fromType(
        TTypeUtils.createPrimitive(type.name),
        [],
        ctx,
      );
    }
    // ADR-057's qualification is the program's one answer, as for every
    // `TypeNameLadder` caller; whether the result is a cnx type this file
    // sees is `declaresNamedType`, as in `fromType` (#1668 review: the trio
    // was spelled out here by hand)
    const cName =
      TypeNameLadder.classifyNamed(
        type,
        ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath,
        { isScopeType: OperandTyper.scopeTypesSeenBy(ctx) },
      )?.name ?? null;
    if (cName !== null && OperandTyper.declaresNamedType(cName, ctx)) {
      return OperandTyper.fromType({ kind: "struct", name: cName }, [], ctx);
    }
    // A header's type, by its spelling
    return ForeignTypeFacts.operandType(
      type.text,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
  }

  /** A bound name's value: a local, a variable, or a header's variable */
  private static boundValue(
    binding: TValueBinding,
    ctx: ITypingContext,
  ): IOperandType | null {
    switch (binding.kind) {
      case "local": {
        const d = binding.declaration;
        return {
          ...OperandTyper.fromType(d.type, d.arrayDimensions, ctx),
          overflow: d.overflowBehavior,
          hasSideEffect: d.isVolatile || d.isAtomic,
          binding,
        };
      }
      case "variable": {
        const s = binding.symbol;
        return {
          ...OperandTyper.fromType(s.type, s.arrayDimensions ?? [], ctx),
          overflow: s.overflowBehavior,
          hasSideEffect: s.isVolatile || s.isAtomic,
          binding,
        };
      }
      case "foreign": {
        const t = ForeignTypeFacts.variableOperand(
          binding.name,
          ctx.symbolTable,
          OperandTyper.target(ctx),
        );
        return t ? { ...t, binding } : null;
      }
      case "scope":
      case "function":
        return null;
    }
  }

  /** A cnx type, as a declaration states it */
  private static fromType(
    type: TType,
    dimensions: ReadonlyArray<number | string>,
    ctx: ITypingContext,
  ): IOperandType {
    // A header's type named in a cnx declaration (`real_t x`,
    // `float32_t v`): 1.3 guesses a named type's kind from its spelling
    // (#1720), so a name that is no cnx struct, enum or bitmap, and that is
    // a C type or a header's, is asked of the header too (#1668 review:
    // it was untyped, and `x * i` went to an integer clamp helper).
    if (
      type.kind === "external" ||
      (OperandTyper.isNamedKind(type) &&
        !OperandTyper.declaresNamedType(type.name, ctx) &&
        ForeignTypeFacts.isForeignType(
          type.name,
          ctx.symbolTable,
          OperandTyper.target(ctx),
        ))
    ) {
      const foreign = ForeignTypeFacts.operandType(
        type.name,
        ctx.symbolTable,
        OperandTyper.target(ctx),
        dimensions,
      );
      if (foreign) return { ...foreign, form: DECLARED };
    }
    if (type.kind === "array") {
      return OperandTyper.fromType(
        type.elementType,
        [...type.dimensions, ...dimensions],
        ctx,
      );
    }
    const typeName = TypeResolver.getTypeName(type);
    const base = { ...OperandTyper.plain(typeName), dimensions };
    switch (type.kind) {
      case "primitive":
        return {
          ...base,
          category: OperandTyper.categoryOf(typeName),
          bitWidth: OperandTyper.widthOf(typeName),
        };
      case "string":
        return { ...base, stringCapacity: type.capacity };
      case "struct":
      case "enum":
      case "bitmap":
        return { ...base, ...OperandTyper.namedFacts(type.name, ctx) };
      default:
        return base;
    }
  }

  private static isNamedKind(
    type: TType,
  ): type is Extract<TType, { kind: "struct" | "enum" | "bitmap" }> {
    return (
      type.kind === "struct" || type.kind === "enum" || type.kind === "bitmap"
    );
  }

  /** Whether this file sees `name` declared as a cnx struct, enum or bitmap */
  private static declaresNamedType(name: string, ctx: ITypingContext): boolean {
    const symbols = ctx.symbols;
    return (
      symbols.knownStructs.has(name) ||
      symbols.knownEnums.has(name) ||
      symbols.knownBitmaps.has(name)
    );
  }

  /**
   * What a named cnx type is, from the names this file sees declared.
   * Never from `TType.kind`: 1.3 guesses a named type's kind from its
   * spelling, so an enum not named `E...` and every bitmap settle as a
   * struct (#1720).
   */
  private static namedFacts(
    name: string,
    ctx: ITypingContext,
  ): Pick<IOperandType, "category" | "enumTypeName" | "bitmapTypeName"> {
    if (ctx.symbols.knownEnums.has(name)) {
      return { category: "enum", enumTypeName: name, bitmapTypeName: null };
    }
    if (ctx.symbols.knownBitmaps.has(name)) {
      return { category: "none", enumTypeName: null, bitmapTypeName: name };
    }
    return { category: "none", enumTypeName: null, bitmapTypeName: null };
  }

  // --------------------------------------------------------------------------
  // Chains
  // --------------------------------------------------------------------------

  /**
   * A chain's head: a `this.`/`global.` root has its first `.name` in the
   * chain's first op. An assignment target is lowered to the same shape.
   */
  private static chainStart(
    chain: TExpression,
    ctx: ITypingContext,
  ): IChainStart {
    const at = OperandTyper.positionOf(chain);
    const head = ExpressionShape.headOf(chain);
    const rest = head.ops.slice(head.opsConsumed);
    if (head.root !== null) {
      if (head.identifier === null) {
        return { binding: null, value: UNKNOWN, ops: [] };
      }
      return OperandTyper.rootedStart(
        head.root,
        head.identifier.name,
        rest,
        at,
        ctx,
      );
    }
    if (head.identifier !== null) {
      return OperandTyper.namedStart(head.identifier.name, rest, at, ctx);
    }
    const t = OperandTyper.typeOf(head.primary, ctx);
    return {
      binding: null,
      value: t ? { k: "value", t, registerMember: null } : UNKNOWN,
      ops: rest,
    };
  }

  /** `this.name` or `global.name`, with that first member consumed */
  private static rootedStart(
    root: "this" | "global",
    name: string,
    ops: TChainOps,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): IChainStart {
    const binding = ctx.program.bindValue(ctx.sourceFile, root, name, at);
    // `global.NAME` names what a bare NAME names at file scope, a header
    // macro included (#1688); a `this.` name is the scope's own member
    if (root === "global") {
      const macro = OperandTyper.macroStart(binding, name, ops, ctx);
      if (macro) return macro;
    }
    if (binding?.kind === "scope") {
      return {
        binding,
        value: { k: "scope", scopePath: binding.scopePath },
        ops,
      };
    }
    if (binding?.kind === "foreign") {
      return OperandTyper.foreignStart(binding, name, ops, ctx);
    }
    // A function is typed by the call that follows it, as it was before the
    // binder named it (#1760 review)
    const valued = OperandTyper.valueStart(binding, ops, ctx);
    if (valued) return valued;
    const scopePath =
      root === "this"
        ? ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath
        : "";
    return {
      binding: null,
      value: OperandTyper.memberOfScope(scopePath, name, ctx),
      ops,
    };
  }

  /**
   * A chain starting at a binding that holds a value: a local or a variable.
   * An allow-list (#2115): a function is typed by the call after it, a scope
   * and a foreign name each have their own start.
   */
  private static valueStart(
    binding: TValueBinding | null,
    ops: TChainOps,
    ctx: ITypingContext,
  ): IChainStart | null {
    if (binding?.kind !== "local" && binding?.kind !== "variable") return null;
    const t = OperandTyper.boundValue(binding, ctx);
    return {
      binding,
      value: t ? { k: "value", t, registerMember: null } : UNKNOWN,
      ops,
    };
  }

  /** A bare name at the head of a chain */
  private static namedStart(
    name: string,
    ops: TChainOps,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): IChainStart {
    const binding = ctx.program.bindValue(ctx.sourceFile, null, name, at);
    if (binding?.kind === "scope") {
      return {
        binding,
        value: { k: "scope", scopePath: binding.scopePath },
        ops,
      };
    }
    const valued = OperandTyper.valueStart(binding, ops, ctx);
    if (valued) return valued;

    const scopePath = ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath;
    const nextIsCall = ops[0] !== undefined && OperandTyper.isCall(ops[0]);
    if (nextIsCall) {
      const fn = ctx.program.resolveFunction(name, scopePath);
      if (fn)
        return {
          binding: null,
          value: {
            k: "function",
            cName: fn.fullyQualifiedCName,
            returnType: fn.returnType,
          },
          ops,
        };
    }
    const symbols = ctx.symbols;
    // ADR-057's qualification, the program's one answer: a scope's own type
    // shadows a global one of the name, whatever kind each is (#1668 review:
    // an enums-only predicate let a global enum through a scope's struct)
    const enumName = ScopeUtils.qualifyScopeType(
      name,
      scopePath,
      OperandTyper.scopeTypesSeenBy(ctx),
    );
    const enumCName = OperandTyper.cNameOf(enumName);
    if (symbols.knownEnums.has(enumCName)) {
      return { binding: null, value: { k: "enumType", name: enumCName }, ops };
    }
    const registerCName =
      scopePath !== "" &&
      symbols.knownRegisters.has(
        ScopeUtils.getTranspiledCName({ name, scopePath }),
      )
        ? ScopeUtils.getTranspiledCName({ name, scopePath })
        : name;
    if (symbols.knownRegisters.has(registerCName)) {
      return {
        binding: null,
        value: { k: "register", name: registerCName },
        ops,
      };
    }
    return (
      OperandTyper.macroStart(binding, name, ops, ctx) ??
      OperandTyper.typeOrForeignStart(binding, name, scopePath, ops, ctx)
    );
  }

  /** A type named at a chain's head, else a header's name */
  private static typeOrForeignStart(
    binding: TValueBinding | null,
    name: string,
    scopePath: string,
    ops: TChainOps,
    ctx: ITypingContext,
  ): IChainStart {
    // A header's type binds as its name does, but names no value: `Cfg`. A
    // value wins a name it shares with a type: a scope's function shadows a
    // global type (ADR-057, #1281), a header's `stat()` its `struct stat` (C
    // keeps tags apart), and a class's static member is no field (`Dev.make`)
    const namesType =
      (binding === null || binding.kind === "foreign") &&
      !OperandTyper.headerNamesValue(name, ctx) &&
      !OperandTyper.namesStaticMember(name, ops, ctx);
    const type = namesType ? OperandTyper.typeHead(name, scopePath, ctx) : null;
    if (type !== null) {
      return { binding: null, value: { k: "type", t: type }, ops };
    }
    if (binding?.kind === "foreign") {
      return OperandTyper.foreignStart(binding, name, ops, ctx);
    }
    return { binding: null, value: { k: "foreignPath", parts: [name] }, ops };
  }

  /** #1975 review: whether a header declares a function or variable `name` */
  private static headerNamesValue(name: string, ctx: ITypingContext): boolean {
    return [
      ...ctx.symbolTable.getCOverloads(name),
      ...ctx.symbolTable.getCppOverloads(name),
    ].some(
      (symbol) => symbol.kind === "function" || symbol.kind === "variable",
    );
  }

  /** #1975 review: `Dev.make(3)`, `Dev.LIMIT` -- a C++ class's static member */
  private static namesStaticMember(
    name: string,
    ops: TChainOps,
    ctx: ITypingContext,
  ): boolean {
    const first = ops[0];
    return (
      first?.kind === "member" &&
      OperandTyper.headerNamesValue(
        CppNamespaceUtils.fromParts([name, first.name]),
        ctx,
      )
    );
  }

  /** A chain that is a floating or unreadable header macro named alone */
  private static macroStart(
    binding: TValueBinding | null,
    name: string,
    ops: TChainOps,
    ctx: ITypingContext,
  ): IChainStart | null {
    if (ops.length !== 0) return null;
    const t = OperandTyper.headerMacroType(binding, name, ctx);
    return t
      ? { binding: null, value: { k: "value", t, registerMember: null }, ops }
      : null;
  }

  /**
   * The one precedence for a name a header macro may define (#1688, ADR-024):
   * a cnx declaration of the name wins; a macro wins over a header
   * declaration, as the preprocessor replaces it before C sees one. Null for
   * an integer macro, which keeps an unsuffixed literal's untyped path. A
   * name nothing declares, in a file whose macros were not all read, may be
   * a macro of any type, so it is unreadable (#1688 review)
   */
  private static headerMacroType(
    binding: TValueBinding | null,
    name: string,
    ctx: ITypingContext,
  ): IOperandType | null {
    if (binding !== null && binding.kind !== "foreign") return null;
    const macro = ctx.program.headerMacro(ctx.sourceFile, name);
    const unread =
      macro === null &&
      binding === null &&
      ctx.program.headerMacrosUnread(ctx.sourceFile);
    return OperandTyper.macroOperand(unread ? UNREAD_MACRO : macro);
  }

  /** A floating, character or unreadable header macro's type; null for others */
  private static macroOperand(macro: THeaderMacro | null): IOperandType | null {
    if (macro === null || macro.kind === "integer") return null;
    if (macro.kind === "character") return OperandTyper.characterLiteral();
    if (macro.kind === "unreadable") {
      return { ...OperandTyper.plain(null), form: { kind: "unreadableMacro" } };
    }
    return {
      ...OperandTyper.plain(macro.typeName),
      category: "floating",
      form: { kind: "foreign", indeterminate: false },
    };
  }

  /**
   * A header's name at the head of a chain, bare or as `global.name`: its
   * variable's type, or a path a following call or member resolves (a
   * function, a namespace). One arm for both spellings (#1668 review:
   * `global.cGetF()` stopped at an untyped root).
   */
  private static foreignStart(
    binding: TValueBinding,
    name: string,
    ops: TChainOps,
    ctx: ITypingContext,
  ): IChainStart {
    const t = OperandTyper.boundValue(binding, ctx);
    return {
      binding,
      value: t
        ? { k: "value", t, registerMember: null }
        : { k: "foreignPath", parts: [name] },
      ops,
    };
  }

  /** What `Scope.name` denotes: a member, a function, an enum or a register */
  private static memberOfScope(
    scopePath: string,
    name: string,
    ctx: ITypingContext,
  ): TChainValue {
    const symbol = ctx.program.memberOf(scopePath, name);
    switch (symbol?.kind) {
      case "variable": {
        const t = OperandTyper.boundValue({ kind: "variable", symbol }, ctx);
        return t ? { k: "value", t, registerMember: null } : UNKNOWN;
      }
      case "function":
        return { k: "function", cName, returnType: symbol.returnType };
      case "enum":
        return { k: "enumType", name: cName };
      case "register":
        return { k: "register", name: cName };
      default:
        break;
    }
    // #1975 review: `Geo.Box`, `this.P`, `global.Point` name a type as a bare
    // `Point` does, so they answer its length properties alike
    const type = OperandTyper.namedTypeOf(cName, ctx);
    return type === null ? UNKNOWN : { k: "type", t: type };
  }

  private static applyOp(
    current: TChainValue,
    op: TPostfixOpSyntax,
    ctx: ITypingContext,
  ): { next: TChainValue; subscript: TSubscriptKind | null } {
    switch (op.kind) {
      case "member":
        return {
          next: OperandTyper.memberOf(current, op.name, ctx),
          subscript: null,
        };
      case "subscript":
        return OperandTyper.subscriptOf(current, op.indexes, ctx);
      case "call":
        return { next: OperandTyper.callOf(current, ctx), subscript: null };
      case "missing":
        return { next: UNKNOWN, subscript: null };
    }
  }

  private static isCall(op: TPostfixOpSyntax): boolean {
    return op.kind === "call";
  }

  /** A member named of a type: its field's type, or a header enum's member */
  private static memberOfType(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    // A header enum names its members first (`Color.Red`), as a cnx enum
    // does; only a length property measures it. It stays the header's enum,
    // which ADR-017 does not type (no `enumTypeName`)
    if (t.category === "enum" && !LengthProperty.isLength(member)) {
      return {
        k: "value",
        registerMember: null,
        t: { ...t, form: { kind: "enumMember" } },
      };
    }
    // `Point.y` names the field's type, still no value
    const field = OperandTyper.fieldOf(t, member, ctx);
    return field.k === "value" ? { k: "type", t: field.t } : field;
  }

  private static memberOf(
    current: TChainValue,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    switch (current.k) {
      case "scope":
        return OperandTyper.memberOfScope(current.scopePath, member, ctx);
      case "type":
        return OperandTyper.memberOfType(current.t, member, ctx);
      case "enumType":
        if (OperandTyper.enumReadsProperty(current.name, member, ctx)) {
          return UNKNOWN;
        }
        return OperandTyper.enumMember(current.name);
      case "register": {
        // The register symbol confirms the member exists; its type comes
        // from this file's view, which holds every member's C type
        const register = ctx.program.symbolByCName(current.name);
        const info =
          register?.kind === "register" ? register.members.get(member) : null;
        if (!info) return UNKNOWN;
        // #2155 review 8: the member is named whatever its type, so its
        // access rules apply to it
        const registerMember = {
          register: current.name,
          cName: info.fullyQualifiedCName,
        };
        // #1514: whether it names a bitmap is asked of the names this file
        // SEES, so an included bitmap counts
        const bitmap = DeclaredTypeFacts.registerMemberBitmap(
          ctx.symbols,
          registerMember.cName,
        );
        if (bitmap !== null) {
          const t = {
            ...OperandTyper.plain(bitmap),
            bitmapTypeName: bitmap,
          };
          return { k: "value", registerMember, t };
        }
        const cType = ctx.symbols.registerMemberCTypes.get(
          registerMember.cName,
        );
        // A register this file's view does not hold. `global.` cannot reach
        // one (E0427); `this.` through a scope spanned from an un-included
        // file still can, at exit 0 (#2275). Named, so its access rules apply,
        // of unknown type -- TODO(#2275): unreachable once that is rejected
        if (cType === undefined) {
          return { k: "value", registerMember, t: OperandTyper.plain(null) };
        }
        // A member records its C spelling (`uint16_t`)
        const foreign = ForeignTypeFacts.operandType(
          cType,
          ctx.symbolTable,
          OperandTyper.target(ctx),
        );
        if (foreign !== null) {
          return {
            k: "value",
            registerMember,
            t: { ...foreign, form: DECLARED },
          };
        }
        // A cnx enum types the member as that enum (#2155 review 9)
        const named = OperandTyper.namedFacts(cType, ctx);
        const t =
          named.category === "enum"
            ? { ...OperandTyper.plain(cType), ...named }
            : OperandTyper.plain(null);
        return { k: "value", registerMember, t };
      }
      case "foreignPath":
        return OperandTyper.foreignPathOf([...current.parts, member], ctx);
      case "value":
        return OperandTyper.fieldOf(current.t, member, ctx);
      default:
        return UNKNOWN;
    }
  }

  /**
   * Whether `.member` on a value of type `t` reads an ADR-058/ADR-045
   * property rather than a field. A field named like a property is a field
   * -- ADR-058's `struct Packet { u32 length; }` is "perfectly fine", and a
   * chain that resolves as a whole is a member access -- so only a property
   * name the value's type declares no field of reads the property. The one
   * answer: the typer records it on the chain step, and 2.1's property rules
   * and render read the step (#1760 review: each decided by the name alone).
   */
  private static readsProperty(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): boolean {
    return (
      PROPERTY_NAMES.has(member) && !OperandTyper.declaresField(t, member, ctx)
    );
  }

  /** Whether a value's type declares the field: a struct's, bitmap's or header's */
  private static declaresField(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): boolean {
    if (t.dimensions.length > 0) return false;
    if (t.bitmapTypeName !== null) {
      return (
        ctx.symbols.bitmapFields.get(t.bitmapTypeName)?.has(member) ?? false
      );
    }
    if (t.typeName === null) return false;
    const struct = ctx.program.symbolByCName(t.typeName);
    if (struct?.kind === "struct") return struct.fields.has(member);
    return ctx.symbolTable.getStructFieldInfo(t.typeName, member) !== undefined;
  }

  /** A field of a struct, a bitmap field, or a property (untyped here) */
  private static fieldOf(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    if (
      // ADR-058/ADR-045 properties: typed by their own rules, never as a member
      OperandTyper.readsProperty(t, member, ctx) ||
      t.typeName === null ||
      t.dimensions.length > 0
    ) {
      return UNKNOWN;
    }
    if (t.bitmapTypeName !== null) {
      return OperandTyper.bitmapFieldOf(t, t.bitmapTypeName, member, ctx);
    }
    const struct = ctx.program.symbolByCName(t.typeName);
    if (struct?.kind === "struct") {
      const field = struct.fields.get(member);
      if (!field) return UNKNOWN;
      return {
        k: "value",
        registerMember: null,
        t: {
          ...OperandTyper.fromType(
            field.type,
            LengthProperty.fieldDimensions(field.type, field.dimensions ?? []),
            ctx,
          ),
          overflow: field.overflowBehavior,
          hasSideEffect: t.hasSideEffect,
        },
      };
    }
    return OperandTyper.foreignFieldOf(t, t.typeName, member, ctx);
  }

  /**
   * ADR-034 (#2251): a bit or bit range of the bitmap field `fieldStep` read,
   * as bits of its bitmap at the field's offset; null for a header bit-field
   * or any other subscript
   */
  private static fieldBitsOf(
    fieldStep: IChainStep | undefined,
    subscript: TSubscriptKind | null,
    ctx: ITypingContext,
  ): IFieldBits | null {
    if (subscript !== "bit_single" && subscript !== "bit_range") return null;
    const bitmap = fieldStep?.before?.bitmapTypeName ?? null;
    const name = fieldStep?.member ?? null;
    if (bitmap === null || name === null) return null;
    const layout = ctx.symbols.bitmapFields.get(bitmap)?.get(name);
    if (layout === undefined) return null;
    return { storage: fieldStep?.before ?? null, offset: layout.offset };
  }

  /** Whether `op` reads a bitmap field or a header bit-field of `current` (ADR-058) */
  private static isBitField(
    current: TChainValue,
    op: TPostfixOpSyntax,
    ctx: ITypingContext,
  ): boolean {
    // `g.mode` or `KBF.a`: a value's field, or a type's (#1975)
    if (op.kind !== "member") return false;
    if (current.k !== "value" && current.k !== "type") return false;
    const t = current.t;
    if (t.dimensions.length > 0) return false;
    if (t.bitmapTypeName !== null) {
      return (
        ctx.symbols.bitmapFields.get(t.bitmapTypeName)?.has(op.name) ?? false
      );
    }
    const typeName = t.typeName ?? t.cType;
    if (typeName === null) return false;
    const info = ctx.symbolTable.getStructFieldInfo(typeName, op.name);
    return info?.bitWidth !== undefined;
  }

  /** A bitmap field: a Boolean bit, or an unsigned run of bits */
  private static bitmapFieldOf(
    t: IOperandType,
    bitmapTypeName: string,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    const field = ctx.symbols.bitmapFields.get(bitmapTypeName)?.get(member);
    if (!field) return UNKNOWN;
    const width = field.width;
    const typeName = width === 1 ? "bool" : OperandTyper.unsignedFor(width);
    return {
      k: "value",
      registerMember: null,
      t: {
        ...OperandTyper.plain(typeName),
        category: width === 1 ? "boolean" : "unsigned",
        bitWidth: width === 1 ? null : width,
        hasSideEffect: t.hasSideEffect,
      },
    };
  }

  /** A member of a header's struct or class */
  private static foreignFieldOf(
    t: IOperandType,
    typeName: string,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    const foreign = ForeignTypeFacts.fieldOperand(
      typeName,
      member,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    // A C struct's function-pointer field, `ops.get()` (#1668 review: its
    // call's result was untyped)
    const pointer = ForeignTypeFacts.fieldCallOperand(
      typeName,
      member,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    if (pointer !== undefined) {
      return { k: "foreignFunction", result: pointer };
    }
    if (foreign) {
      return {
        k: "value",
        registerMember: null,
        // A read of the field has the struct's side effect, or its own: a
        // volatile field is one (#1760 review: the struct's replaced it)
        t: {
          ...foreign,
          hasSideEffect: t.hasSideEffect || foreign.hasSideEffect,
        },
      };
    }
    // A field whose type cnx does not read, `char *p`: a value still, so
    // a length property of it is one, and E0867's to reject (#1975)
    const info = ctx.symbolTable.getStructFieldInfo(typeName, member);
    if (info !== undefined) {
      return {
        k: "value",
        registerMember: null,
        t: {
          ...OperandTyper.plain(null),
          cType: info.type,
          hasSideEffect: t.hasSideEffect,
          form: { kind: "foreign", indeterminate: false },
        },
      };
    }
    // A C++ class's member function, `dev.read()`: named `Dev::read`, as a
    // static member's call already is, so the call that follows
    // resolves it (#1668 review: an instance method's result was untyped)
    return t.form.kind === "foreign" || t.form.kind === "declared"
      ? { k: "foreignPath", parts: [typeName, member] }
      : UNKNOWN;
  }

  /**
   * A path into a C++ namespace or class, `NS.nf`: a variable the path names
   * is typed where it is reached, so a member after it resolves too
   * (`NS.nps.pf`); anything else stays a path, for a call to resolve
   * (#1668 review: a namespace variable was typed only when called).
   */
  private static foreignPathOf(
    parts: readonly string[],
    ctx: ITypingContext,
  ): TChainValue {
    const t = ForeignTypeFacts.variableOperand(
      CppNamespaceUtils.fromParts(parts),
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    return t
      ? { k: "value", registerMember: null, t }
      : { k: "foreignPath", parts };
  }

  /**
   * What the classifier is told about a subscripted value.
   *
   * ADR-024's "a subscript into a scalar is a bit index" is about integers
   * whose bits cnx can see, so a C or C++ header's scalar integer is one
   * (S25). A header's value that is NOT an integer -- a struct, a C++ type
   * with its own `operator[]` -- is left to C and C++: shown as unknown, so
   * its subscript stays the element access it always was.
   */
  private static subscriptedShape(
    t: IOperandType | null,
  ): { isArray: boolean; isString: boolean } | null {
    if (t === null) return null;
    const isArray = t.dimensions.length > 0;
    // A header scalar with bits -- an integer, or a float (#1760 review: a
    // `double`'s subscript was read as an element) -- is bit-indexed as a
    // cnx one is (ADR-007); anything else there is untyped
    if (
      t.form.kind === "foreign" &&
      !isArray &&
      !OperandTyper.hasWritableBits(t)
    ) {
      return null;
    }
    return { isArray, isString: OperandTyper.isString(t) };
  }

  private static subscriptOf(
    current: TChainValue,
    indices: readonly TExpression[],
    ctx: ITypingContext,
  ): { next: TChainValue; subscript: TSubscriptKind | null } {
    const t = current.k === "value" ? current.t : null;
    const subscript = SubscriptClassifier.classify({
      typeInfo: OperandTyper.subscriptedShape(t),
      subscriptCount: indices.length,
      isRegisterAccess:
        current.k === "value" && current.registerMember !== null,
    });
    if (t === null) return { next: UNKNOWN, subscript };
    // An element read whose index calls, or reads a volatile, has that side
    // effect too: `arr[nextIndex()]` is not a pure read
    const keep = {
      hasSideEffect:
        t.hasSideEffect ||
        indices.some((index) => OperandTyper.hasSideEffect(index, ctx)),
    };

    switch (subscript) {
      case "array_element": {
        if (t.dimensions.length > 0) {
          return {
            subscript,
            next: {
              k: "value",
              registerMember: null,
              t: {
                ...t,
                // ADR-044: an element is declared by its array (#1887)
                dimensions: t.dimensions.slice(1),
                binding: null,
                form: DECLARED,
                ...keep,
              },
            },
          };
        }
        // Only a string's element is a character (#1760 review). A header
        // value with no dimensions -- a C++ `operator[]` result, a `T*`
        // field -- is one the typer cannot see into, not a `char`
        if (!OperandTyper.isString(t)) {
          return { subscript, next: UNKNOWN };
        }
        return {
          subscript,
          next: {
            k: "value",
            registerMember: null,
            t: {
              ...OperandTyper.plain("char"),
              category: "character",
              bitWidth: 8,
              ...keep,
            },
          },
        };
      }
      case "array_slice":
        return {
          subscript,
          next: {
            k: "value",
            registerMember: null,
            t: { ...t, overflow: null, binding: null, ...keep },
          },
        };
      case "bit_single":
        return {
          subscript,
          next: {
            k: "value",
            registerMember: null,
            t: {
              ...OperandTyper.plain("bool"),
              category: "boolean",
              form: { kind: "bitIndex" },
              ...keep,
            },
          },
        };
      case "bit_range": {
        const width = OperandTyper.foldedWidth(indices[1], ctx);
        // The unsigned type that holds the bits, as 2.2 always typed a range
        const typeName =
          width === null ? null : OperandTyper.unsignedFor(width);
        return {
          subscript,
          next: {
            k: "value",
            registerMember: null,
            t: {
              ...OperandTyper.plain(typeName),
              category: "unsigned",
              bitWidth: OperandTyper.widthOf(typeName),
              form: { kind: "bitRange", width },
              ...keep,
            },
          },
        };
      }
    }
  }

  /** The C name of the function a call on `current` calls */
  private static calleeOf(current: TChainValue): string | null {
    if (current.k === "function") return current.cName;
    if (current.k === "foreignPath")
      return CppNamespaceUtils.fromParts(current.parts);
    return null;
  }

  private static callOf(
    current: TChainValue,
    ctx: ITypingContext,
  ): TChainValue {
    const call: TOperandForm = { kind: "call" };
    if (current.k === "function") {
      return {
        k: "value",
        registerMember: null,
        t: {
          ...OperandTyper.fromType(current.returnType, [], ctx),
          hasSideEffect: true,
          form: call,
        },
      };
    }
    if (current.k === "value" && current.t.typeName !== null) {
      // An ADR-029 callback: its type names the function that defines it
      const definer = ctx.program.symbolByCName(current.t.typeName);
      if (definer?.kind === "function") {
        return {
          k: "value",
          registerMember: null,
          t: {
            ...OperandTyper.fromType(definer.returnType, [], ctx),
            hasSideEffect: true,
            form: call,
          },
        };
      }
    }
    if (current.k === "foreignFunction") {
      return current.result
        ? {
            k: "value",
            registerMember: null,
            t: { ...current.result, hasSideEffect: true, form: call },
          }
        : UNKNOWN;
    }
    if (current.k === "foreignPath") {
      const t = ForeignTypeFacts.callOperand(
        CppNamespaceUtils.fromParts(current.parts),
        ctx.symbolTable,
        OperandTyper.target(ctx),
      );
      return t ? { k: "value", registerMember: null, t } : UNKNOWN;
    }
    return UNKNOWN;
  }

  // --------------------------------------------------------------------------
  // Small facts
  // --------------------------------------------------------------------------

  /** A bit range's width, when it folds in the constants visible there */
  private static foldedWidth(
    widthExpr: TExpression | undefined,
    ctx: ITypingContext,
  ): number | null {
    if (!widthExpr) return null;
    const value = ConstExprLowering.valueOf(
      widthExpr,
      ConstantFold.environment(ctx.program, ctx.sourceFile),
    );
    return value !== undefined && value > 0 ? value : null;
  }

  private static unsignedFor(width: number): string | null {
    if (width <= 8) return "u8";
    if (width <= 16) return "u16";
    if (width <= 32) return "u32";
    if (width <= 64) return "u64";
    return null;
  }

  private static widthOf(typeName: string | null): number | null {
    return typeName !== null && TypeCheckUtils.isInteger(typeName)
      ? TYPE_WIDTH[typeName]
      : null;
  }

  private static cNameOf(sourceName: string): string {
    return sourceName.includes(".")
      ? QualifiedCName.fromSourceName(sourceName)
      : sourceName;
  }

  private static booleanValue(hasSideEffect: boolean): IOperandType {
    return {
      ...OperandTyper.plain("bool"),
      category: "boolean",
      hasSideEffect,
      form: { kind: "boolean" },
    };
  }

  /** An operand with a type name and nothing else settled */
  private static plain(typeName: string | null): IOperandType {
    return {
      typeName,
      cType: null,
      dimensions: [],
      category: "none",
      bitWidth: null,
      stringCapacity: null,
      enumTypeName: null,
      bitmapTypeName: null,
      overflow: null,
      hasSideEffect: false,
      form: DECLARED,
      binding: null,
    };
  }

  /** The run's target description, or null while 1.4 has not resolved it */
  static target(ctx: ITypingContext): ITargetDescription | null {
    return ResolvedTarget.of(ctx.program.target());
  }
}

export default OperandTyper;
