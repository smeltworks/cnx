import type ISourceSpan from "../../../types/ISourceSpan";
import type ICppFunctionDefinitionSyntax from "./ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "./IHeaderDeclaratorSyntax";
import type TCppTypeSpecifierSyntax from "./TCppTypeSpecifierSyntax";

/** One C++ declaration 1.3 declares symbols from, as 1.2 lowers it (#1991) */
type TCppDeclarationSyntax =
  | ICppFunctionDefinitionSyntax
  | {
      readonly kind: "namespace";
      readonly span: ISourceSpan;
      readonly name: string | null;
      readonly declarations: readonly TCppDeclarationSyntax[];
    }
  | {
      readonly kind: "alias";
      readonly span: ISourceSpan;
      readonly name: string;
      /** #2473 review: the aliased type, `using R = void;`; null behind a declarator */
      readonly type: string | null;
    }
  | {
      readonly kind: "simple";
      readonly span: ISourceSpan;
      readonly baseType: string;
      readonly isTypedef: boolean;
      readonly isVolatile: boolean;
      readonly typeSpecifiers: readonly TCppTypeSpecifierSyntax[];
      /** Null when the declaration has no declarator list */
      readonly declarators: readonly IHeaderDeclaratorSyntax[] | null;
    };

export default TCppDeclarationSyntax;
