import type ISyntaxNode from "./ISyntaxNode";
import type TMemberDeclaration from "./TMemberDeclaration";

/** One `declaration`: a scope, or any declaration a scope may also hold */
type TDeclarationSyntax =
  | TMemberDeclaration
  | (ISyntaxNode & {
      readonly kind: "scope";
      readonly name: string;
      readonly members: ReadonlyArray<
        ISyntaxNode & {
          readonly visibility: "private" | "public" | null;
          readonly declaration: TMemberDeclaration;
        }
      >;
    });

export default TDeclarationSyntax;
