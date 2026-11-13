import type IPlannedClamp from "../../../2-Plan/types/IPlannedClamp";
import type IGeneratorOutput from "../generators/IGeneratorOutput";

/**
 * One level of the binary precedence ladder, reduced to what renders it.
 *
 * #1445 box 3: `BinaryExprGenerator` had ten generators, one per grammar
 * precedence level, recursing into each other. They reduce to FOUR renderings
 * plus a leaf -- the ten levels differ in which separator, which default
 * operator and which extra rule applies, not in what they do.
 *
 * ## There is no nested IR, and that is deliberate
 *
 * Operands are THUNKS that re-enter the planner one level down and render the
 * result. So this record is one level deep and the nesting lives in the closure
 * chain, which matters for two reasons:
 *
 *   - Nine of the ten levels are single-child pass-through levels for almost every
 *     expression, and the planner collapses them by returning the child's plan
 *     directly. A plan is only as deep as the expression's real operator
 *     nesting.
 *   - Laziness has to be in the PLANNER, not just in a top-level thunk. See
 *     below.
 *
 * ## Why every operand is a thunk
 *
 * An operand renders when the renderer writes it, against the type 2.2
 * planned for it -- none for an operand nested anywhere under a comparison
 * (#1032, #1991).
 *
 * Issue #1032 is what that costs: `i32 < 0` emitting `signedIdx < 0U`, which C's
 * usual arithmetic conversions then promote to unsigned, making the test dead.
 * `tests/comparison-expected-type/subscript-operand-window` pins it for
 * subscript operands specifically, because every other fixture that compares
 * one sits in an `if` condition where `expectedType` is already null and the
 * window is a no-op.
 */
type TPlannedBinaryExpr =
  /** A single operand: the ladder bottomed out. */
  | { readonly kind: "leaf"; readonly render: () => string }
  /**
   * Operands joined by one fixed separator: `||`, `&&`, `|`, `^`, `&`.
   *
   * These five levels take no operators from the tree because the grammar
   * admits only one at each.
   */
  | {
      readonly kind: "join";
      readonly separator: string;
      readonly renderOperands: readonly (() => IGeneratorOutput)[];
    }
  /**
   * An equality or relational comparison.
   *
   * 2.2 plans its operands with no expected type -- see above. `adrLine` is present only when ADR-001's `=`-means-equality rule
   * actually fired: an expression using only `!=` is unchanged from C and must
   * not claim a matrix cell (#1241).
   */
  | {
      readonly kind: "comparison";
      readonly operators: readonly string[];
      /** ADR-001: maps `=` to `==`. Absent on the relational arm. */
      readonly mapOperator: ((operator: string) => string) | null;
      readonly adrLine: number | undefined;
      /**
       * ADR-045: the operands are strings, so this is a `strcmp`.
       *
       * Decided at plan time because `isStringExpression` is a type-registry
       * predicate that generates nothing. The RENDERER raises the
       * `<string.h>` include, on the branch that emits the call -- a plan that
       * pre-registered it would drag the header into every file with a
       * comparison in it.
       */
      readonly strcmp: { readonly isNotEqual: boolean } | null;
      readonly renderOperands: readonly (() => IGeneratorOutput)[];
    }
  /** `<<` / `>>`, joined with operators read from the tree and no window. */
  | {
      readonly kind: "shift";
      readonly operators: readonly string[];
      readonly renderOperands: readonly (() => IGeneratorOutput)[];
    }
  /**
   * `+ - * / %` -- constant-folded, or lowered to ADR-044 saturating helpers,
   * or joined.
   *
   * `clamp` is 2.2's decision (#1991): the helpers a `clamp` integer chain
   * calls, or null when it is plain C.
   */
  | {
      readonly kind: "arithmetic";
      /**
       * #1175: the chain's value when it is a constant expression, decided in
       * 2.2 by the one evaluator (ADR-044: none where it would clamp or wrap);
       * null otherwise
       */
      readonly constantValue: string | null;
      readonly operators: readonly string[];
      readonly clamp: IPlannedClamp | null;
      readonly adrLine: number | undefined;
      readonly renderOperands: readonly (() => IGeneratorOutput)[];
    };

export default TPlannedBinaryExpr;
