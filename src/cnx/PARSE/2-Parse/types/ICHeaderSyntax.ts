import type TCExternalDeclarationSyntax from "./TCExternalDeclarationSyntax";

/**
 * 1.2's plain-data form of one C header (#1991): what 1.3 declares from it,
 * read off the tree while 1.2 still holds it.
 */
interface ICHeaderSyntax {
  readonly declarations: readonly TCExternalDeclarationSyntax[];
  /**
   * #2494 review: every macro the header `#undef`s, so one could mean two
   * things at two points of the header
   */
  readonly undefinedMacros: readonly string[];
}

export default ICHeaderSyntax;
