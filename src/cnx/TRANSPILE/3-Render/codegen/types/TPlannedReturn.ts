/**
 * What a `return` statement carries, if anything.
 *
 * #1445 box 3: `ControlFlowGenerator` asked `node.expression()` twice -- once
 * as a predicate and once with `!` to use it -- which is the shape a union
 * states once.
 */
type TPlannedReturn =
  /** `return;` -- no expression to render. */
  | { readonly kind: "void" }
  /**
   * `return <expr>;`, written against the function's declared return type,
   * which 2.2 planned for it (#1277, #1991): it is what gives a bare enum
   * member its enum (ADR-017), what types a struct literal that no
   * declaration names, and what puts the MISRA C:2012 Rule 7.2 suffix on
   * `return 1;`.
   */
  | {
      readonly kind: "value";
      readonly render: () => string;
    }
  | {
      /** #1209: the lines that write the value into the caller's buffer */
      readonly kind: "buffer";
      readonly renderWrite: () => readonly string[];
    };

export default TPlannedReturn;
