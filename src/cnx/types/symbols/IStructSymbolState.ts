import type TStructLayout from "../TStructLayout";

/**
 * **Every field here must be required — never optional.** The cache's defense
 * against silently dropping one is a compile error from
 * `TJsonSafe<Required<IStructSymbolState>>`, and an optional field would be
 * satisfied by omitting it: `new Set(undefined)` is an empty Set, which is
 * exactly #1225's failure mode (a warm build that never heard of a fact the
 * cold build knows). `Required<...>` at the use sites makes that a compile
 * error rather than a convention, but keeping fields required keeps the
 * intent legible here too.
 *
 * Issue #958: Immutable struct symbol state managed via immer produce().
 * All mutations are additive-only — no unmark/delete operations.
 * Resolution (e.g., "is this type truly opaque?") happens at query time.
 */
interface IStructSymbolState {
  /**
   * Typedef names declared against a forward-declared struct (additive only).
   * The one handle mark: `OpaqueTypeResolution` decides whether a body arrived.
   */
  opaqueTypes: Set<string>;
  /** Typedef name → struct tag (e.g., "widget_t" → "_widget_t") */
  typedefToTag: Map<string, string>;
  /** Struct tags that have full definitions (bodies) */
  structTagsWithBodies: Set<string>;
  /**
   * Typedefs of a pointer to a struct, e.g. `typedef struct opaque_t* handle_t`.
   *
   * Issue #957 rightly keeps these out of opaqueTypes -- they are already
   * pointers, not incomplete structs. But the fact was then discarded, and a
   * generated header cannot tell one from a plain external struct: it emitted
   * `typedef struct handle_t handle_t;`, declaring a different type than the
   * real definition (#1164). Recorded here so both the forward-declaration
   * filter and the include-propagation check can ask.
   */
  pointerTypedefs: Set<string>;
  /**
   * #1975: header structs whose members do not sum to a length, and why.
   * A struct absent here sums its fields.
   */
  structLayouts: Map<string, TStructLayout>;
}

export default IStructSymbolState;
