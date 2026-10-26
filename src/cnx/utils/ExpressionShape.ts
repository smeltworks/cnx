import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import type IChainHead from "../types/IChainHead";
import type TExpressionOf from "../types/syntax/TExpressionOf";

/**
 * Shape questions over a lowered expression, asked by 2.1 Analyze (which lowers
 * at the call) and by render alike, so the two cannot disagree (#1932).
 */
class ExpressionShape {
  /**
   * The expression as a primary and its postfix operations, when it is one --
   * no unary, binary or ternary operator at its top.
   */
  static postfixView(expr: TExpression): {
    readonly primary: TExpression;
    readonly ops: readonly TPostfixOpSyntax[];
  } | null {
    switch (expr.kind) {
      case "ternary":
      case "binary":
      case "unary":
      case "missing":
        return null;
      case "postfix":
        return { primary: expr.primary, ops: expr.ops };
      default:
        return { primary: expr, ops: [] };
    }
  }

  /** The identifier a postfix chain starts from, or null */
  static rootName(expr: TExpression): string | null {
    const view = ExpressionShape.postfixView(expr);
    return view?.primary.kind === "identifier" ? view.primary.name : null;
  }

  /**
   * What a bracketed expression holds, through any number of brackets:
   * `((cfg.total))` is `cfg.total`. The held node itself, so a plan keyed by
   * that node still finds it (#1203 review).
   */
  /**
   * ADR-045: a `+` chain's operands, two or more, a parenthesized chain
   * inside one flattened (#1954, #2232); null for any other value. The one
   * rule for "is this a concatenation" that 2.1 and 2.2 read (#2160 review).
   */
  static concatenationOperands(
    expr: TExpression,
  ): readonly TExpression[] | null {
    const value = ExpressionShape.unparenthesized(expr);
    if (
      value.kind !== "binary" ||
      value.level !== "additive" ||
      !value.operators.every((operator) => operator === "+")
    ) {
      return null;
    }
    return value.operands.flatMap((operand) => {
      const inner = ExpressionShape.concatenationOperands(operand);
      return inner ?? [ExpressionShape.unparenthesized(operand)];
    });
  }

  static unparenthesized(expr: TExpression): TExpression {
    return expr.kind === "parenthesized"
      ? ExpressionShape.unparenthesized(expr.expression)
      : expr;
  }

  /**
   * The name an expression IS -- a bare identifier, no member, subscript or
   * call -- or null. The call-argument plan and SafeDivision/ConstAssignment
   * ask this one function (#1445, #1932).
   */
  static simpleIdentifier(expr: TExpression): string | null {
    const view = ExpressionShape.postfixView(expr);
    return view?.ops.length === 0 ? ExpressionShape.rootName(expr) : null;
  }

  /**
   * A string literal itself -- not an expression whose text merely starts and
   * ends with a quote, like `"a" < "b"` (#1956).
   */
  static isStringLiteral(expr: TExpression): boolean {
    return expr.kind === "literal" && expr.literalKind === "string";
  }

  /**
   * ADR-035: what a whole array is given -- a list, or for a `u8` array a
   * string literal. ADR-014 holds it wherever a whole array is taken: a
   * declaration (1.2's `ArrayForm`), and a field or an assignment target
   * (2.1's `WholeArrayValueAnalyzer`), so both ask this.
   */
  static givesWholeArray(
    value: TExpression,
    elementType: string | null,
  ): boolean {
    if (value.kind === "arrayInitializer") return true;
    return ExpressionShape.isStringLiteral(value) && elementType === "u8";
  }

  /**
   * A postfix chain as written through its first `count` operations: the
   * value an operation applies to, as a message quotes it (`packets[1].header`
   * for the `[4]` of `packets[1].header[4]`). The source's spelling, not the
   * resolved symbol's, so a suggested fix is the text the developer wrote.
   */
  static writtenThrough(
    chain: TExpressionOf<"postfix">,
    count: number,
  ): string {
    return (
      chain.primary.written +
      chain.ops
        .slice(0, count)
        .map((op) => op.written)
        .join("")
    );
  }

  /**
   * A chain's head. A `this.`/`global.` root consumes the chain's first op, and
   * only a member op names it (`this[0]` names nothing). The typer, render's
   * subscript base and `UndeclaredValueAnalyzer` all ask this one function, for
   * expressions and assignment targets alike (#1932).
   */
  static headOf(chain: TExpression): IChainHead {
    const view = ExpressionShape.postfixView(chain);
    const primary = view?.primary ?? chain;
    const ops = view?.ops ?? [];
    if (primary.kind === "root") {
      const first = ops[0];
      const identifier =
        first?.kind === "member"
          ? { name: first.name, span: first.nameSpan }
          : null;
      return {
        primary,
        root: primary.root,
        identifier,
        ops,
        opsConsumed: 1,
        rootOp: ops[1] ?? null,
      };
    }
    const identifier =
      primary.kind === "identifier"
        ? { name: primary.name, span: primary.span }
        : null;
    return {
      primary,
      root: null,
      identifier,
      ops,
      opsConsumed: 0,
      rootOp: ops[0] ?? null,
    };
  }
}

export default ExpressionShape;
