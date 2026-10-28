/**
 * One ADR-025 case label, reduced to which grammar alternative matched and
 * what it carries.
 *
 * #1445 box 3: `SwitchGenerator` asked a `CaseLabelContext` six questions in a
 * fixed order -- qualified type, identifier, integer, hex, binary, char -- and
 * took the first that answered. That order IS the discrimination, so the union
 * states it and the planner picks the arm in the same order.
 *
 * The three numeric arms stay distinct because they are rendered differently:
 * a binary literal is converted to hex (Issue #114, through `BigInt` so a
 * value above 2^53 keeps its precision), and a char literal is the one that
 * ignores a leading minus -- `'-'` is not a negative character.
 */
type TPlannedCaseLabel =
  /** `EState.IDLE` -- the C name 3-Declare gave the symbol it names (#2116) */
  | { readonly kind: "qualified"; readonly cName: string }
  /** A bare identifier: a const, or an enum member the switch's type declares. */
  | {
      readonly kind: "identifier";
      readonly name: string;
      /** The name as a use of it is written, when a binding resolves it */
      readonly resolved: string | null;
    }
  /**
   * `this.LIMIT` or `global.LIMIT` (#1629): the const its root binds, as
   * written by the planner. Never the switch enum's member, which a bare
   * label may be -- the root already said where the name lives.
   */
  | { readonly kind: "rooted"; readonly code: string }
  /** An integer or hex literal, with the minus that may precede it. */
  | {
      readonly kind: "numeric";
      readonly text: string;
      readonly negative: boolean;
    }
  /** A binary literal, which renders as hex. */
  | {
      readonly kind: "binary";
      readonly text: string;
      readonly negative: boolean;
    }
  /** A char literal, which never takes a minus. */
  | { readonly kind: "char"; readonly text: string }
  /**
   * No alternative matched.
   *
   * The node-walking version fell through to `""` here, and that is preserved
   * rather than made an error: the grammar admits nothing else today, so an
   * arm that cannot be reached is not the place to add a diagnostic.
   */
  | { readonly kind: "none" };

export default TPlannedCaseLabel;
