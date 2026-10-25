import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type IVariableDeclarationSyntax from "../types/syntax/IVariableDeclarationSyntax";
import VariableDeclarations from "./VariableDeclarations";
import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type TExpression from "../types/syntax/TExpression";
import type IValuePositions from "../types/IValuePositions";
import DeclarationParts from "./DeclarationParts";
import ExpressionNodes from "./ExpressionNodes";
import StatementNodes from "./StatementNodes";

/** A check that judges what a file reads and each write site */
interface IAccessCheck {
  checkExpression(expr: TExpression): void;
  checkSite(site: IAssignmentSyntax): void;
}

/** A check that also judges every variable declaration */
interface IDeclarationAccessCheck extends IAccessCheck {
  checkDeclaration(declaration: IVariableDeclarationSyntax): void;
}

/**
 * What a file writes and what it reads, decided once (#2115): an assignment's
 * target is a write, checked with its site, and not read again as an
 * expression.
 */
class ProgramAccesses {
  /** Each read to `checkExpression`, then each write site to `checkSite` */
  static checkReadsAndWrites(
    program: IProgramSyntax,
    valuePositions: IValuePositions,
    check: IAccessCheck,
  ): void {
    for (const expr of ProgramAccesses.reads(program, valuePositions)) {
      check.checkExpression(expr);
    }
    for (const site of ProgramAccesses.writes(program)) check.checkSite(site);
  }

  /**
   * Each variable declaration, each write site, then every expression --
   * a target included -- for a check that judges a value wherever it stands
   */
  static checkEverything(
    program: IProgramSyntax,
    check: IDeclarationAccessCheck,
  ): void {
    for (const entry of VariableDeclarations.in(program)) {
      check.checkDeclaration(entry.declaration);
    }
    for (const site of ProgramAccesses.writes(program)) check.checkSite(site);
    for (const expr of ProgramAccesses.expressions(program)) {
      check.checkExpression(expr);
    }
  }

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

  /** Every expression node but a write's target, which 2.1 placed as one */
  static reads(
    program: IProgramSyntax,
    valuePositions: IValuePositions,
  ): readonly TExpression[] {
    return ProgramAccesses.expressions(program).filter(
      (expr) => valuePositions.sites.get(expr)?.site.kind !== "target",
    );
  }
}

export default ProgramAccesses;
