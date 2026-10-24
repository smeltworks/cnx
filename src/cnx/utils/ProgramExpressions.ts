import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type TExpression from "../types/syntax/TExpression";
import type TSyntaxPart from "../types/syntax/TSyntaxPart";
import DeclarationParts from "./DeclarationParts";
import TypeParts from "./TypeParts";

/**
 * Every outermost expression 1.2 returned for a file, in source order,
 * including a written type's dimensions. The expressions inside each one are
 * `ExpressionChildren`'s; where each one sits is `DeclarationParts`' (#1991).
 */
class ProgramExpressions {
  static of(program: IProgramSyntax): readonly TExpression[] {
    return program.members.flatMap((member) =>
      DeclarationParts.of(member.declaration).flatMap(
        ProgramExpressions.inPart,
      ),
    );
  }

  /** A part's outermost expressions: itself, or a written type's dimensions */
  static inPart(part: TSyntaxPart): readonly TExpression[] {
    return part.kind === "expression"
      ? [part.expression]
      : TypeParts.of(part.type).flatMap(ProgramExpressions.inPart);
  }
}

export default ProgramExpressions;
