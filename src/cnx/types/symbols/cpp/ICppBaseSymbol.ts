import type TSymbolKindCpp from "../../symbol-kinds/TSymbolKindCpp";
import type ESourceLanguage from "../../../utils/types/ESourceLanguage";
import type TVisibility from "../../TVisibility";
import type ISourceSpan from "../../ISourceSpan";

/**
 * Base interface for all C++ language symbol types.
 * C++ symbols use simple strings for types since they pass through to codegen unchanged.
 */
interface ICppBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindCpp;

  /** Symbol name: the full `A::B` path 3-Declare spelled once */
  readonly name: string;

  /**
   * The name as declared, without its namespace or class (`Widget` of
   * `Outer::Inner::Widget`). A later layer holding an owner and a member asks
   * `getCppMembers(owner, member)` rather than spelling `owner::member` (#2116).
   */
  readonly unqualifiedName: string;

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

  /** Source language - always Cpp for C++ symbols */
  readonly sourceLanguage: ESourceLanguage.Cpp;

  /** Recorded "public" for every symbol, including class members declared under
   * `private:` or `protected:` — the resolver walks `memberdeclaration` only and never
   * reads an `accessSpecifier`, so this is not yet the declared visibility (#1475). */
  readonly visibility: TVisibility;

  /** Parent namespace or class name */
  readonly parent?: string;
}

export default ICppBaseSymbol;
