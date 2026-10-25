import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type IVariableDeclarationSite from "../types/syntax/IVariableDeclarationSite";
import type TMemberDeclaration from "../types/syntax/TMemberDeclaration";
import type TStatement from "../types/syntax/TStatement";
import type TExpression from "../types/syntax/TExpression";
import ExpressionNodes from "./ExpressionNodes";
import StatementChildren from "./StatementChildren";

/**
 * Every variable declaration in a file, in source order, with where it is
 * written (#2073).
 *
 * This is the one walk that decides which declarations ADR-035's and
 * ADR-045's declaration rules judge. 1.2 (`ArrayForm`, `StringForm`) and 2.1
 * (`ArrayDeclarationAnalyzer`, `StringDeclarationAnalyzer`) all ask `ruled`.
 * They used to walk separately: 1.2 the parse tree's `variableDeclaration`,
 * 2.1 the lowered statements including a `for` header's. Those two sets
 * agreed only because E0917 stops a `for` header's array or string first.
 */
class VariableDeclarations {
  /** Every variable declaration, with its site */
  static in(program: IProgramSyntax): readonly IVariableDeclarationSite[] {
    return program.members.flatMap(({ declaration, scope }) =>
      scope !== null && declaration.kind === "variableDeclaration"
        ? [{ declaration, site: "scopeMember" as const }]
        : VariableDeclarations.ofDeclaration(declaration),
    );
  }

  /**
   * The declarations ADR-035's and ADR-045's declaration rules judge: every
   * one but a `for` header's, which declares one scalar loop variable, so an
   * array or a string there is E0917 instead (ADR-036, #1823).
   */
  static ruled(program: IProgramSyntax): readonly IVariableDeclarationSite[] {
    return VariableDeclarations.in(program).filter(
      (entry) => entry.site !== "forHeader",
    );
  }

  /**
   * Every expression in an initializer outside a function -- a file's or a
   * scope member's -- which C evaluates before `main`, so it calls nothing
   * (#2236)
   */
  static fileScopeValues(program: IProgramSyntax): ReadonlySet<TExpression> {
    return new Set(
      VariableDeclarations.in(program).flatMap(({ declaration, site }) =>
        site === "statement" ||
        site === "forHeader" ||
        declaration.initializer === null
          ? []
          : ExpressionNodes.direct(declaration.initializer),
      ),
    );
  }

  /** The `for` headers' loop variables, which E0917 judges */
  static forHeaders(
    program: IProgramSyntax,
  ): readonly IVariableDeclarationSite[] {
    return VariableDeclarations.in(program).filter(
      (entry) => entry.site === "forHeader",
    );
  }

  private static ofDeclaration(
    declaration: TMemberDeclaration,
  ): readonly IVariableDeclarationSite[] {
    switch (declaration.kind) {
      case "variableDeclaration":
        return [{ declaration, site: "file" }];
      case "function":
        return VariableDeclarations.ofStatements(declaration.body.statements);
      default:
        return [];
    }
  }

  private static ofStatements(
    statements: readonly TStatement[],
  ): readonly IVariableDeclarationSite[] {
    return statements.flatMap((statement): IVariableDeclarationSite[] => [
      ...(statement.kind === "variableDeclaration"
        ? [{ declaration: statement, site: "statement" as const }]
        : []),
      ...(statement.kind === "for" &&
      statement.init?.kind === "variableDeclaration"
        ? [{ declaration: statement.init, site: "forHeader" as const }]
        : []),
      ...VariableDeclarations.ofStatements(StatementChildren.of(statement)),
    ]);
  }
}

export default VariableDeclarations;
