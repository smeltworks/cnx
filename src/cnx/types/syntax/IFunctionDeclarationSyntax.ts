import type IParameterSyntax from "./IParameterSyntax";
import type ISyntaxNode from "./ISyntaxNode";
import type TBlockSyntax from "./TBlockSyntax";
import type TTypeSyntax from "./TTypeSyntax";
import type TOverflowBehavior from "../TOverflowBehavior";

/** `[clamp|wrap] type name(params) { ... }`; `parameters` is `null` when `()` is empty */
interface IFunctionDeclarationSyntax extends ISyntaxNode {
  readonly returnType: TTypeSyntax;
  /** ADR-044: the result's written `clamp`/`wrap`; null when none is written */
  readonly returnOverflow: TOverflowBehavior | null;
  readonly name: string;
  /** Where the function's name is written */
  readonly nameSpan: ISyntaxNode["span"];
  readonly parameters: readonly IParameterSyntax[] | null;
  readonly body: TBlockSyntax;
}

export default IFunctionDeclarationSyntax;
