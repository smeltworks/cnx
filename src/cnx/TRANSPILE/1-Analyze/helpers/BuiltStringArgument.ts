import CallReach from "../../../utils/CallReach";
import CStringArgument from "../../../utils/CStringArgument";
import StringValueForm from "../../../utils/StringValueForm";
import StringWriteSites from "./StringWriteSites";
import type IValuePositions from "../../../types/IValuePositions";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ICCalleeSignature from "../types/ICCalleeSignature";

/**
 * #2348 review: the arguments 2.2 builds into a temporary before their
 * statement -- a concatenation or a substring written for a `string<N>`
 * parameter (#2239, `StringWriteSites`), or for a C `char` pointer parameter
 * (`CStringArgument`). 2.1's checks of a built argument read this.
 */
class BuiltStringArgument {
  /** Whether a C call's argument `index` is built, by the overloads it reaches */
  static forC(
    arg: TExpression,
    reached: readonly ICCalleeSignature[],
    index: number,
    context: IAnalysisContext,
  ): boolean {
    return (
      BuiltStringArgument.isBuiltForm(arg, context) &&
      CStringArgument.isBuiltFor(
        CallReach.shapedFor(
          reached.map((signature) => signature.parameters),
          index,
        ),
        context.symbolTable,
      )
    );
  }

  /** Every argument built for a cnx function's `string<N>` parameter */
  static forCnx(
    positions: IValuePositions,
    context: IAnalysisContext,
  ): ReadonlySet<TExpression> {
    const built = new Set<TExpression>();
    for (const { value, write } of StringWriteSites.of(positions)) {
      if (
        write === "argument" &&
        BuiltStringArgument.isBuiltForm(value, context)
      ) {
        built.add(value);
      }
    }
    return built;
  }

  private static isBuiltForm(
    value: TExpression,
    context: IAnalysisContext,
  ): boolean {
    const form = StringValueForm.of(value, context);
    return form.kind === "concat" || form.kind === "substring";
  }
}

export default BuiltStringArgument;
