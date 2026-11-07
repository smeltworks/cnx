import type TCSymbol from "../../../types/symbols/c/TCSymbol";
import type TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import type THeaderMacro from "../../../types/THeaderMacro";

/**
 * The symbols this program's C and C++ headers declare.
 *
 * A shared contract rather than a codegen type: 1.4 Resolve takes it to derive
 * the cross-file facts that are ABOUT foreign declarations — symbol conflicts
 * among them, which header declares a type, opaque-vs-defined — and the
 * orchestrator supplies it. `Program` holds cnx symbols only, which is why
 * those three facts could not previously be authored there (#1511).
 *
 * The two languages stay separate because their order is observable: a
 * conflict report lists definitions cnx first, then C, then C++.
 */
interface IForeignSymbols {
  readonly c: ReadonlyArray<TCSymbol>;
  readonly cpp: ReadonlyArray<TCppSymbol>;

  /**
   * Typedefs a header declared against a forward-declared struct.
   *
   * The RAW set, not the answer: a typedef is only truly opaque if the tag it
   * names never got a body, and resolving that is `Program`'s job. Handing over
   * a pre-resolved set would leave the derivation outside the artifact, which
   * is the thing #1511 is moving.
   */
  readonly opaqueTypedefs: ReadonlySet<string>;

  /** Typedef name to the struct tag it aliases. */
  readonly typedefToTag: ReadonlyMap<string, string>;

  /** Struct tags a header gave a full definition. */
  readonly structTagsWithBodies: ReadonlySet<string>;

  /**
   * #1688: each cnx file's header macros, keyed by the file's path, each
   * typed from its replacement tokens (ADR-024). A `#define` is in no symbol
   * list above.
   */
  readonly macros: ReadonlyMap<string, ReadonlyMap<string, THeaderMacro>>;

  /**
   * #1688: the cnx files whose C includes' macros were not all read: the
   * preprocessor could not read the file's own C includes together.
   */
  readonly macrosUnread: ReadonlySet<string>;

  /**
   * #1881: each cnx file's macros it may name, object-like or function-like:
   * those its own C includes define themselves, or `-D` defines.
   */
  readonly visibleMacros: ReadonlyMap<string, ReadonlySet<string>>;

  /** #1881: every macro some cnx file's C includes define, builtins included */
  readonly macroNames: ReadonlySet<string>;

  /**
   * #1619: the C type the run's header compiler gives each `<stdint.h>`/
   * `<stddef.h>` integer name its predefined macros define (`uint32_t` to
   * `long unsigned int`)
   */
  readonly integerTypes: ReadonlyMap<string, string>;
}

export default IForeignSymbols;
