import type ISourceSpan from "../types/ISourceSpan";
/**
 * An expression as a `TConstExpr` (#1175, #1669), so a value can be computed
 * from it by `ConstantEvaluator`.
 *
 * Lowered from the expression's plain-data syntax (#1932), which 1.2 Parse
 * lowered from the tree -- never from `getText()`: ANTLR joins tokens with no
 * separator, and the joined text re-lexes as different tokens -- `1 - -1`
 * becomes `1--1`, `(A < -1)` becomes `(A<-1)`. The syntax already has the
 * operators and operands apart, so no text is ever re-read.
 *
 * Lowering decides nothing about values. A name stays a name, a call stays a
 * call, and `ConstantEvaluator` says what each is worth.
 */
import invariant from "./invariant";
import ConstantEvaluator from "./ConstantEvaluator";
import LiteralUtils from "./LiteralUtils";
import LengthProperty from "./LengthProperty";
import ELEMENT_STEP from "../types/ELEMENT_STEP";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import type TConstExpr from "../types/TConstExpr";
import type TExpression from "../types/syntax/TExpression";
import type TExpressionOf from "../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";

type TOtherWhat = Extract<TConstExpr, { kind: "other" }>["what"];

/** What a chain is, by the first operation that keeps it from naming a value */
const BLOCKING_WHAT: Record<
  Exclude<TPostfixOpSyntax["kind"], "member">,
  TOtherWhat
> = {
  subscript: "subscript",
  call: "call",
  // a parse error's gap: the chain names nothing a constant could hold
  missing: "member",
};

/** A suffixed literal: its value, and the type its suffix names */
const SUFFIXED = /^(.+?)([uUiI](?:8|16|32|64))$/;

class ConstExprLowering {
  /**
   * What an expression written here is worth, as an integer. Undefined when
   * it has no value -- a runtime operand, a C macro -- which is a real
   * answer, not a failure.
   */
  static valueOf(
    expr: TExpression,
    env: IConstantEnvironment,
  ): number | undefined {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(expr),
      env,
    );
    return result.kind === "value"
      ? ConstantEvaluator.toNumber(result.value)
      : undefined;
  }

  static lower(expr: TExpression): TConstExpr {
    switch (expr.kind) {
      case "ternary":
        return {
          kind: "ternary",
          condition: ConstExprLowering.lower(expr.condition),
          whenTrue: ConstExprLowering.lower(expr.whenTrue),
          whenFalse: ConstExprLowering.lower(expr.whenFalse),
        };
      case "binary":
        return ConstExprLowering.chain(expr);
      case "unary":
        if (expr.operator === "&") {
          return ConstExprLowering.other("address", expr);
        }
        return {
          kind: "unary",
          op: expr.operator,
          operand: ConstExprLowering.lower(expr.operand),
        };
      case "postfix":
        return ConstExprLowering.postfix(expr);
      case "identifier":
        return {
          kind: "name",
          root: null,
          path: [expr.name],
          at: ConstExprLowering.at(expr),
        };
      case "root":
        // `this` / `global` alone, which name no value
        return {
          kind: "name",
          root: expr.root,
          path: [],
          at: ConstExprLowering.at(expr),
        };
      case "literal":
        return ConstExprLowering.literal(expr);
      case "parenthesized":
        return ConstExprLowering.lower(expr.expression);
      case "cast":
        return {
          kind: "cast",
          typeName: expr.type.text,
          operand: ConstExprLowering.lower(expr.operand),
          at: ConstExprLowering.at(expr),
        };
      case "sizeof":
        // ADR-023: E0603 rejects it; a size is ADR-058's `.type_byte_length`
        return ConstExprLowering.other("sizeofExpression", expr);
      case "structInitializer":
      case "arrayInitializer":
        return ConstExprLowering.other("initializer", expr);
      case "missing":
        // A parse error's gap names nothing, so it binds to nothing
        return {
          kind: "name",
          root: null,
          path: [],
          at: ConstExprLowering.at(expr),
        };
    }
  }

  /** One left-associative binary level, `a op b op c` as `(a op b) op c` */
  private static chain(expr: TExpressionOf<"binary">): TConstExpr {
    let result = ConstExprLowering.lower(expr.operands[0]);
    expr.operators.forEach((op, i) => {
      result = {
        kind: "binary",
        op,
        left: result,
        right: ConstExprLowering.lower(expr.operands[i + 1]),
      };
    });
    return result;
  }

  /**
   * A name, possibly qualified (`this.N`, `Scope.N`, `EColor.COUNT`,
   * `buf.type_element_count`). A subscript or a call anywhere in the chain makes it
   * something no constant contains.
   */
  private static postfix(expr: TExpressionOf<"postfix">): TConstExpr {
    const { primary, ops } = expr;
    // ADR-058: a length property is the same for every element, so before
    // one a subscript is a step into the element, whatever its index
    const last = ops.at(-1)!;
    const measured =
      last.kind === "member" && LengthProperty.isLength(last.name);
    const blocking = ops.find(
      (op): op is Exclude<TPostfixOpSyntax, { kind: "member" }> =>
        op.kind !== "member" && !(measured && ConstExprLowering.isElement(op)),
    );
    if (blocking) {
      return ConstExprLowering.other(BLOCKING_WHAT[blocking.kind], expr);
    }
    const root = primary.kind === "root" ? primary.root : null;
    const head = primary.kind === "identifier" ? primary.name : undefined;
    if (root === null && head === undefined) {
      return ConstExprLowering.other("member", expr);
    }
    return {
      kind: "name",
      root,
      path: [
        ...(head === undefined ? [] : [head]),
        ...ops.map((op) => (op.kind === "member" ? op.name : ELEMENT_STEP)),
      ],
      at: ConstExprLowering.at(expr),
    };
  }

  /** `[i]`, not a bit range `[start, width]` */
  private static isElement(op: TPostfixOpSyntax): boolean {
    return op.kind === "subscript" && op.indexes.length === 1;
  }

  private static literal(expr: TExpressionOf<"literal">): TConstExpr {
    const { literalKind, text } = expr;
    if (literalKind === "true" || literalKind === "false") {
      return {
        kind: "literal",
        digits: literalKind === "true" ? "1" : "0",
        text,
        typeName: "bool",
      };
    }
    // ADR-044: there is no octal literal, so a leading zero is E0912 in 1.2;
    // until then it has no value, suffixed (`010u8`) or not
    if (
      (literalKind === "integer" || literalKind === "suffixedDecimal") &&
      LiteralUtils.hasLeadingZero(text)
    ) {
      return ConstExprLowering.other("leadingZero", expr);
    }
    switch (literalKind) {
      case "suffixedDecimal":
      case "suffixedHex":
      case "suffixedBinary": {
        const match = SUFFIXED.exec(text);
        invariant(
          match,
          `a suffixed integer literal ends in its suffix: ${text}`,
        );
        return {
          kind: "literal",
          digits: BigInt(match[1]).toString(),
          text,
          typeName: match[2].toLowerCase(),
        };
      }
      case "integer":
      case "hex":
      case "binary":
        return {
          kind: "literal",
          digits: BigInt(text).toString(),
          text,
          typeName: null,
        };
      case "float":
      case "suffixedFloat":
        return ConstExprLowering.other("float", expr);
      case "string":
        return ConstExprLowering.other("string", expr);
      case "char":
        return ConstExprLowering.other("character", expr);
      case "null":
        return ConstExprLowering.other("address", expr);
    }
  }

  private static other(what: TOtherWhat, expr: TExpression): TConstExpr {
    return {
      kind: "other",
      what,
      spelling: expr.written,
      at: ConstExprLowering.at(expr),
    };
  }

  /** Where a node is written, which is where a name in it binds (ADR-057) */
  private static at(expr: TExpression): ISourceSpan {
    return expr.span;
  }
}

export default ConstExprLowering;
