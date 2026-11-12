/**
 * Whether a call argument is an object a `mut` parameter can write (ADR-006,
 * #1203): a variable, a field or an element, through any brackets. Not a
 * literal, an operator's or a call's result, a cast, a struct literal, an
 * enum member, a bit of a scalar, a bitmap field or a C bit-field, a length property, a function's name, or a
 * header's macro or enum constant -- C would take the write into a compound literal and lose
 * it, or not compile. 2.1's E0915 and 2.2's argument form both ask this one
 * function, so an argument 2.1 accepts is never passed as a temporary.
 */

import ExpressionShape from "../../../utils/ExpressionShape";
import OperandTyper from "../../../utils/OperandTyper";
import WrittenBinding from "./WrittenBinding";
import type ITypingContext from "../../../types/ITypingContext";
import type TExpression from "../../../types/syntax/TExpression";
import type IWrittenBinding from "../types/IWrittenBinding";

class MutArgument {
  static isWritable(arg: TExpression, context: ITypingContext): boolean {
    const target = WrittenBinding.ofExpression(arg, context);
    if (target === null || target.ops.some((op) => op.kind === "call")) {
      return false;
    }
    if (!MutArgument.namesObject(target, context)) return false;
    const chain = OperandTyper.chainOf(
      ExpressionShape.unparenthesized(arg),
      context,
    );
    if (chain.endsOnBitField) return false;
    if (chain.steps.some((step) => step.property !== null)) return false;
    const form = OperandTyper.typeOf(arg, context)?.form.kind;
    return form !== "enumMember" && form !== "bitIndex" && form !== "bitRange";
  }

  /**
   * The header `#define` an argument names: text replacement, not a variable
   * (ADR-006), even when it expands to one. Null for anything else.
   */
  static headerMacro(arg: TExpression, context: ITypingContext): string | null {
    const target = WrittenBinding.ofExpression(arg, context);
    if (target === null || !MutArgument.isForeign(target)) return null;
    return context.program.headerMacro(context.sourceFile, target.name) === null
      ? null
      : target.name;
  }

  /** Not a cnx declaration: a header's name, or one nothing declares */
  private static isForeign(target: IWrittenBinding): boolean {
    return target.binding === null || target.binding.kind === "foreign";
  }

  /** A cnx declaration that is not a function, or a header's variable */
  private static namesObject(
    target: IWrittenBinding,
    context: ITypingContext,
  ): boolean {
    if (target.binding?.kind === "function") return false;
    if (!MutArgument.isForeign(target)) return true;
    if (context.program.headerMacro(context.sourceFile, target.name) !== null) {
      return false;
    }
    const symbol = context.symbolTable.getCSymbol(target.name);
    return symbol?.kind !== "enum_member" && symbol?.kind !== "function";
  }
}

export default MutArgument;
