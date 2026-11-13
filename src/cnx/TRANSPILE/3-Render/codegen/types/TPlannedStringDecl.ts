import type IPlannedStringInit from "./IPlannedStringInit";
import type IPlannedArrayDeclaration from "./IPlannedArrayDeclaration";

/**
 * One ADR-045 string declaration, reduced to which form it takes and what that
 * form needs to render.
 *
 * #1445 box 3: `StringDeclHelper` navigated a `TypeContext` to find out which
 * of three forms it had -- `arrayType()?.stringType()`, then `stringType()`,
 * then whether that carried an `INTEGER_LITERAL` -- and then navigated an
 * `ExpressionContext` for the initializer. Both of those walks belong to the
 * planner now; what reaches the renderer is the answer.
 *
 * A declaration that is not a string at all is `null` at the call site, not a
 * fourth arm here. The old shape returned `{ code: "", handled: false }` and
 * every caller had to remember to check `handled` before reading `code`; with
 * the question answered where the plan is built, "not a string" is a plan that
 * was never made.
 */
type TPlannedStringDecl =
  /**
   * `string<32>[4] items` -- Issue #1029's arrayType spelling.
   *
   * `dimensions` is the DECLARED shape, already folded and rendered: the
   * `arrayTypeDimension`s of the type plus any trailing `arrayDimension`s of
   * the declaration. It is eager because it is unconditional on this arm --
   * every string array emits its dimensions, initializer or not.
   *
   * The capacity dimension is NOT in it. `[capacity + 1]` is the NUL
   * convention, which is the renderer's to apply here exactly as it applies it
   * to a bounded string.
   */
  | {
      readonly kind: "array";
      readonly elementCapacity: number;
      readonly dimensions: string;
      /** #1209: another string array of its shape, copied in */
      readonly copy: IPlannedArrayDeclaration["copy"];
      /**
       * The first declared dimension when it is a numeric literal, else null.
       *
       * Pure, so eager -- and derived ONCE. The node-walking version computed
       * it twice from the same context, for the element-count check and again
       * for fill-all expansion, which is two derivations of one fact.
       */
      readonly declaredSize: number | null;
      /**
       * The initializer as generated C, or null when there is none.
       *
       * A thunk because the renderer must call `resetArrayInitTracking()`
       * immediately before it and read `wasArrayInit()` / `lastArrayInitCount`
       * / `lastArrayFillValue` immediately after: the array-initializer
       * bookkeeping is written BY this render and is only valid in that
       * window.
       */
      readonly renderInit: (() => string) | null;
    }
  /** `string<16> s` -- a bounded string, with or without an initializer. */
  | {
      readonly kind: "bounded";
      readonly capacity: number;
      readonly init: IPlannedStringInit | null;
    }
  /**
   * `const string s <- "literal"` -- capacity inferred from the literal.
   *
   * `initText` is null when the declaration has no initializer, which is one
   * of the three things E0862 rejects here; the other two are a non-const
   * declaration and an initializer that is not a literal, and the latter is
   * read off this same text.
   */
  | {
      readonly kind: "unsized";
      readonly initText: string | null;
      /**
       * #1664 box 3: the capacity 1.3 counted and the `.h` states -- null
       * only when the declaration has none, which E0862 rejects.
       */
      readonly declaredCapacity: number | null;
    };

export default TPlannedStringDecl;
