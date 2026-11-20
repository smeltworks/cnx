/**
 * What an argument declares that its address loses when it reaches a plain
 * pointer -- `atomic`, `volatile`, or a register member's volatile access.
 * The one decision for a scanf-family conversion (#2398), a `mut` parameter
 * and a safe-division output (#2238).
 */
import ForeignTypeFacts from "../../../utils/ForeignTypeFacts";
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
  ): {
    readonly is: string;
    readonly write: string;
    readonly access?: string;
  } | null {
    const chain = OperandTyper.chainOf(
      ExpressionShape.unparenthesized(arg),
      context,
    );
    const member = chain.steps.find((step) => step.registerMember !== null);
    if (member?.registerMember != null) {
      return {
        is: "a register member",
        write: "volatile",
        access: context.symbols.registerMemberAccess.get(member.registerMember),
      };
    }
    // the written binding, not the chain root: `S.shared`, `(cfg).total`
    const binding = WrittenBinding.ofExpression(arg, context)?.binding ?? null;
    if (binding?.kind === "foreign") {
      return ArgumentQualifier.isVolatileForeign(binding.name, chain, context)
        ? { is: "volatile", write: "volatile" }
        : null;
    }
    const declaration = BoundDeclaration.of(binding);
    if (declaration?.isAtomic === true) {
      return { is: "atomic", write: "atomic" };
    }
    if (declaration?.isVolatile === true) {
      return { is: "volatile", write: "volatile" };
    }
    return null;
  }

  /**
   * A header value's `volatile`: its declaration's, or a field's on the way,
   * each through its typedefs. Read per step rather than from the operand's
   * side effect, which an index's call or volatile read also sets (#2468
   * review).
   */
  private static isVolatileForeign(
    name: string,
    chain: ReturnType<typeof OperandTyper.chainOf>,
    context: IAnalysisContext,
  ): boolean {
    const target = OperandTyper.target(context);
    const root = ForeignTypeFacts.variableOperand(
      name,
      context.symbolTable,
      target,
    );
    if (root?.hasSideEffect === true) return true;
    return chain.steps.some(
      (step) =>
        step.member !== null &&
        step.before?.typeName != null &&
        ForeignTypeFacts.fieldOperand(
          step.before.typeName,
          step.member,
          context.symbolTable,
          target,
        )?.hasSideEffect === true,
    );
  }
}

export default ArgumentQualifier;
