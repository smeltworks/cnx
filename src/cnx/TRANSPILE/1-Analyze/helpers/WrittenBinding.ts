/**
 * The declaration a written spelling reaches, past any scope names it is
 * qualified by: `S.x`, `global.S.x` and `this.Inner.x` reach the member `x`,
 * where Program's binder answers only the head (`S`, a scope). ADR-071's
 * read-only rule asks about the member, so a write through `S.x` from outside
 * the scope is one to `S__x`, not to nothing.
 */

import ExpressionShape from "../../../utils/ExpressionShape";
import type TChainRoot from "../../../types/TChainRoot";
import type TExpression from "../../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";
import type ITypingContext from "../../../types/ITypingContext";
import type IWrittenBinding from "../types/IWrittenBinding";

class WrittenBinding {
  /** `K`, `(K)`, `(cfg).x`, `table[0]`, `this.K`, `S.x`, `global.cfg.x`; null for anything else */
  static ofExpression(
    expr: TExpression,
    context: ITypingContext,
  ): IWrittenBinding | null {
    if (expr.kind === "unary" && expr.operator === "&") {
      return WrittenBinding.ofExpression(expr.operand, context);
    }
    const view = WrittenBinding.nameChain(expr);
    if (view === null) return null;
    if (view.primary.kind === "identifier") {
      return WrittenBinding.of(
        null,
        view.primary.name,
        view.ops,
        expr.span,
        context,
      );
    }
    const first = view.ops[0];
    if (view.primary.kind !== "root" || first?.kind !== "member") return null;
    return WrittenBinding.of(
      view.primary.root,
      first.name,
      view.ops.slice(1),
      expr.span,
      context,
    );
  }

  /**
   * The chain an expression writes, through brackets: `((a))` is `a` and
   * `(cfg.inner).v` is `cfg.inner.v`. Only this binding lookup flattens a
   * bracketed head into one chain; the syntax keeps its nodes (#1203 review).
   */
  private static nameChain(expr: TExpression): {
    readonly primary: TExpression;
    readonly ops: readonly TPostfixOpSyntax[];
  } | null {
    const view = ExpressionShape.postfixView(
      ExpressionShape.unparenthesized(expr),
    );
    if (view?.primary.kind !== "parenthesized") return view;
    const head = WrittenBinding.nameChain(view.primary);
    return head === null
      ? null
      : { primary: head.primary, ops: [...head.ops, ...view.ops] };
  }

  static of(
    root: TChainRoot,
    name: string,
    ops: readonly TPostfixOpSyntax[],
    at: { line: number; column: number },
    context: ITypingContext,
  ): IWrittenBinding {
    const program = context.program;
    let binding = program.bindValue(context.sourceFile, root, name, at);
    let memberName = name;
    let rest = ops;
    while (binding?.kind === "scope" && rest[0]?.kind === "member") {
      memberName = rest[0].name;
      rest = rest.slice(1);
      const symbol = program.memberOf(binding.scopePath, memberName);
      if (symbol?.kind === "variable") binding = { kind: "variable", symbol };
      else if (symbol?.kind === "scope")
        binding = { kind: "scope", scopePath: symbol.cnxScopedName };
      else binding = null;
    }
    return { binding, name: memberName, ops: rest };
  }
}

export default WrittenBinding;
