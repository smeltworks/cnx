/**
 * What an argument declares that its address loses when it reaches a plain
 * pointer -- `atomic`, `volatile`, or a register member's volatile access.
 * One decision for both places cnx takes an argument's address: a
 * scanf-family conversion (#2398) and a `mut` parameter (#2238).
 */
import OperandTyper from "../../../utils/OperandTyper";
import ExpressionShape from "../../../utils/ExpressionShape";
import BoundDeclaration from "./BoundDeclaration";
import WrittenBinding from "./WrittenBinding";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";

class ArgumentQualifier {
  /** The qualifier the address would drop, or null */
  static of(
    arg: TExpression,
    context: IAnalysisContext,
  ): { readonly is: string; readonly write: string } | null {
    const chain = OperandTyper.chainOf(
      ExpressionShape.unparenthesized(arg),
      context,
    );
    if (chain.steps.some((step) => step.registerMember !== null)) {
      return { is: "a register member", write: "volatile" };
    }
    // the written binding, not the chain root: `S.shared`, `(cfg).total`
    const declaration = BoundDeclaration.of(
      WrittenBinding.ofExpression(arg, context)?.binding ?? null,
    );
    if (declaration?.isAtomic === true) {
      return { is: "atomic", write: "atomic" };
    }
    if (declaration?.isVolatile === true) {
      return { is: "volatile", write: "volatile" };
    }
    return null;
  }
}

export default ArgumentQualifier;
