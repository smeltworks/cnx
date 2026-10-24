import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type TExpression from "../types/syntax/TExpression";
import DeclarationParts from "./DeclarationParts";
import ExpressionNodes from "./ExpressionNodes";
import StatementNodes from "./StatementNodes";

/**
 * What a file writes and what it reads, decided once (#2115): an assignment's
 * target is a write, checked with its site, and not read again as an
 * expression.
 */
class ProgramAccesses {
  /** Every assignment site, in source order */
  static writes(program: IProgramSyntax): readonly IAssignmentSyntax[] {
    return program.members.flatMap(({ declaration }) =>
      StatementNodes.assignments(declaration),
    );
  }

  /** Every expression node, nested ones included, in source order */
  static expressions(program: IProgramSyntax): readonly TExpression[] {
    return program.members.flatMap(({ declaration }) =>
      DeclarationParts.of(declaration).flatMap(ExpressionNodes.of),
    );
  }

  /** Every expression node but a write's target */
  static reads(program: IProgramSyntax): readonly TExpression[] {
    const targets = new Set<TExpression>(
      ProgramAccesses.writes(program).map((site) => site.target),
    );
    return ProgramAccesses.expressions(program).filter(
      (expr) => !targets.has(expr),
    );
  }
}

export default ProgramAccesses;
