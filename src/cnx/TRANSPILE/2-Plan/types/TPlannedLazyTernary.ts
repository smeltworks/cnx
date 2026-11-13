import type TType from "../../../types/TType";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";

/**
 * #2332: a `?:` lowered to an `if`, by what each branch sets: a variable of
 * one C type, or (#1209) one buffer of a `string<N>` or an array declared
 * before the `if`, which an arm's call fills in place and any other arm is
 * copied into -- so the value outlives the branch that set it.
 */
type TPlannedLazyTernary =
  | { readonly kind: "value"; readonly cType: string }
  | {
      readonly kind: "buffer";
      readonly type: TType;
      /** Each arm's whole call to a function filling a buffer */
      readonly calls: ReadonlySet<TPostfixOpSyntax>;
    };

export default TPlannedLazyTernary;
