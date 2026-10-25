import type ISourceSpan from "../ISourceSpan";
import type IComment from "../IComment";
import type IProgramMember from "./IProgramMember";
import type ISyntaxNode from "./ISyntaxNode";
import type TDeclarationSyntax from "./TDeclarationSyntax";
import type TDirectiveKind from "./TDirectiveKind";

/** Comments written directly above a top-level item */
type TCommented = { readonly leadingComments: readonly IComment[] };

/** A `.cnx` file: its includes, directives and declarations, each in source order */
interface IProgramSyntax {
  /** The whole file, where its lexical frames begin */
  readonly span: ISourceSpan;
  readonly includes: ReadonlyArray<ISyntaxNode & TCommented>;
  readonly directives: ReadonlyArray<
    ISyntaxNode &
      TCommented & {
        readonly kind: TDirectiveKind;
        readonly text: string;
      }
  >;
  readonly declarations: ReadonlyArray<
    TCommented & { readonly declaration: TDeclarationSyntax }
  >;
  /**
   * Every declaration, a scope's members included, in source order (#2115).
   * Each is the same object `declarations` holds, not a copy.
   */
  readonly members: readonly IProgramMember[];
}

export default IProgramSyntax;
