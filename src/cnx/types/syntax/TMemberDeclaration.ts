import type IFunctionDeclarationSyntax from "./IFunctionDeclarationSyntax";
import type IRegisterDeclarationSyntax from "./IRegisterDeclarationSyntax";
import type IStructDeclarationSyntax from "./IStructDeclarationSyntax";
import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TStatement from "./TStatement";

/** A declaration that may stand in a scope */
type TMemberDeclaration =
  | Extract<
      TStatement,
      { kind: "variableDeclaration" | "constructorDeclaration" }
    >
  | ({ readonly kind: "function" } & IFunctionDeclarationSyntax)
  | ({ readonly kind: "register" } & IRegisterDeclarationSyntax)
  | ({ readonly kind: "struct" } & IStructDeclarationSyntax)
  | (ISyntaxNode & {
      readonly kind: "enum";
      readonly name: string;
      readonly members: ReadonlyArray<
        ISyntaxNode & {
          readonly name: string;
          readonly value: TExpression | null;
        }
      >;
    })
  | (ISyntaxNode & {
      readonly kind: "bitmap";
      readonly name: string;
      /** As written: `bitmap8`, `bitmap16`, ... */
      readonly bitmapType: string;
      readonly members: ReadonlyArray<
        ISyntaxNode & {
          readonly name: string;
          /** The width literal as written, or null for a one-bit field */
          readonly width: string | null;
        }
      >;
    })
  | (ISyntaxNode & { readonly kind: "missing" });

export default TMemberDeclaration;
