import type TRegisterAccessMode from "../TRegisterAccessMode";
import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/**
 * `register Name { offset access type member, ... }` -- a register TYPE
 * (ADR-072 Part 1). It has no address; each instance supplies one.
 */
interface IRegisterDeclarationSyntax extends ISyntaxNode {
  readonly name: string;
  readonly members: ReadonlyArray<
    ISyntaxNode & {
      readonly name: string;
      readonly type: TTypeSyntax;
      readonly access: TRegisterAccessMode;
      readonly offset: TExpression;
    }
  >;
}

export default IRegisterDeclarationSyntax;
