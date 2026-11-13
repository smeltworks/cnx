import type TRenderedStringPart from "../../../../types/TRenderedStringPart";
import type TStringValueForm from "../../../../types/TStringValueForm";

/**
 * How a bounded string's initializer is rendered (ADR-045).
 *
 * `string<N> s <- ...` admits four initializers, and 2.2 decides which one
 * it has (`StringValueForm`), by the rule an assignment's value is decided
 * by (#1257): a literal initializes the array, and a copy, a concatenation
 * and a substring are written into it.
 *
 * ## Why the renders are thunks
 *
 * Generating an expression registers effects: it can request an include and it
 * can allocate a C++ temp into `pendingTempDeclarations`, which the enclosing
 * block then emits. An effect raised for a value that is afterwards discarded
 * changes the emitted C. So each arm's code comes over unevaluated, and the
 * renderer pays for exactly the arm it takes.
 */
interface IPlannedStringInit {
  /** 2.2's decision: which of ADR-045's four forms the initializer is */
  readonly form: TStringValueForm["kind"];

  /**
   * The literal's, or the copied string's, SOURCE text: what the literal's
   * capacity invariant measures.
   */
  readonly text: string;

  /** The literal, or the one string copied in, as generated C */
  readonly render: () => string;

  /** #1209: the call filling the declared string in place, given its name; null to copy */
  readonly renderInto: ((target: string) => string) | null;

  /** A concatenation's or a substring's parts, as generated C */
  readonly renderParts: () => readonly TRenderedStringPart[];
}

export default IPlannedStringInit;
