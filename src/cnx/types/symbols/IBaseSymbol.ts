import type TSymbolKindCnx from "../symbol-kinds/TSymbolKindCnx";
import type ESourceLanguage from "../../utils/types/ESourceLanguage";
import type TVisibility from "../TVisibility";
import type ISourceSpan from "../ISourceSpan";

/**
 * Base interface for all symbol types.
 * All concrete symbol interfaces extend this with a narrowed `kind` literal.
 */
interface IBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindCnx;

  /** Symbol name -- the leaf, as the source spells it inside its scope */
  readonly name: string;

  /**
   * The identifier this symbol is emitted as in generated C --
   * `Motor__init`, `Outer__Inner__process`, or the bare name when global.
   *
   * Computed ONCE, from the scope chain, when the symbol is built
   * (`ScopeUtils.identityOf`). Before this field existed every consumer
   * re-derived it, and they did not all derive it the same way: the chain-walking
   * encoder and the leaf-only ones agreed because the grammar admits no nested
   * scopes. #1285 called that a coincidence; ADR-016 makes it a decision, and a
   * permanent one. Computing it once is still the point -- agreement reached
   * separately at each site is a duplicate path whether or not the fact it rests
   * on can change.
   *
   * ADR-063 makes the result injective, so it is also this symbol's canonical
   * identity -- what `SymbolTable` indexes it by, and what a lookup holding a
   * generated identifier should ask for.
   *
   * ## For member kinds, ONLY the second meaning holds (#1318)
   *
   * The two sentences above name two different things, and they coincide for
   * every kind C emits as an identifier. They do not coincide for members.
   * A struct field is emitted `p.x`, a bitmap field as a bit position, a
   * register member as an offset -- none is ever spelled as a standalone C
   * identifier, so for `struct_field`, `bitmap_field` and `register_member`
   * this field is the INDEX KEY and nothing else. `SPoint__x` is what
   * distinguishes that field from `SOther__x` in a table; it is not a name any
   * generated file contains, and a consumer that emits one has misread this.
   *
   * `enum_member` is the exception among members: `EColor__RED` and
   * `Motor__EMode__HIGH` are real, and appear in the committed `.expected.h`
   * fixtures. Its identity is checkable against generated output; the other
   * three kinds' identities are checkable only against each other.
   */
  readonly fullyQualifiedCName: string;

  /**
   * The name a cnx author would write -- `Motor.init`, `Outer.Inner.process`.
   *
   * A separate namespace from `fullyQualifiedCName`, not a transformation of it.
   * Diagnostics want this one: reporting the generated identifier names something
   * the author never typed (#1292).
   */
  readonly cnxScopedName: string;

  /**
   * The scope this symbol is declared in, as a dotted source path -- `""` at
   * file scope, `"Motor"`, `"Outer.Inner"`.
   *
   * A PATH, never the scope object (#1298). Holding the object gave every symbol
   * a chain to walk and a cycle to represent: the global scope is its own parent,
   * and a scope's `functions` point back at symbols that point at the scope. That
   * made the symbol graph unserializable -- `JsonCodec` recursed until the stack
   * was exhausted -- and it made `getScopePath`'s identity-based cycle guard
   * unable to fire on a proxy chain, so the hang the guard existed to prevent was
   * reachable with the guard silent.
   *
   * A path cannot express a cycle, so neither defect is representable rather than
   * being guarded against. It is also the key `SymbolRegistry` already stores
   * scopes under, so the object is one lookup away wherever the mutable member
   * lists are genuinely needed.
   *
   * Feeds `QualifiedCName.fromSourceName([scopePath, name])` directly: that encoder
   * expands a dotted component and drops empties, which is why replacing the
   * chain walk needed no adapter.
   */
  readonly scopePath: string;

  /** Source file where the symbol is defined */
  readonly sourceFile: string;

  /**
   * Where this symbol is declared, as a span rather than a bare line.
   *
   * Replaced `sourceLine` rather than joining it (#1318). Carrying both would
   * put one fact in two places -- `span.line` and `sourceLine` -- which is the
   * shape recorded in `visibility` below: two places held one fact, they
   * disagreed, and the header believed the wrong one (#1300).
   *
   * A column is what a symbol-level diagnostic was missing: 136 of 302
   * `.expected.error` fixtures began at `1:0` because a diagnostic about a
   * symbol had no position and fell back to the start of the file (#1316).
   */
  readonly span: ISourceSpan;

  /** Source language (Cnx, C, Cpp) */
  readonly sourceLanguage: ESourceLanguage;

  /**
   * Visibility as the source declares it (ADR-016), on every symbol kind.
   *
   * This is a fact about the declaration, not a decision about the output.
   * Whether a symbol reaches the generated header is a separate question --
   * `visibility`, minus ADR-030's `main` exemption, minus "a scope is a
   * container, not a declaration", plus the private types a public declaration
   * makes reachable. `PublicInterface` owns that computation; nothing else may
   * re-derive it.
   *
   * Four kinds used to carry no visibility at all, so their collectors hardcoded
   * an exported flag while `ScopeCollector` recorded the real answer beside them.
   * Two places held one fact, they disagreed, and the header believed the wrong
   * one -- every `private` struct, enum and bitmap was emitted into the public
   * interface (#1300).
   */
  readonly visibility: TVisibility;
}

export default IBaseSymbol;
