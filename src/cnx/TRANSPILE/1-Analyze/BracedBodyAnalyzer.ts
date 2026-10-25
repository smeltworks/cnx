/**
 * E0716: an `if`, `else`, `while` or `for` body must be a braced block (#1090).
 *
 * MISRA C:2012 Rule 15.6 requires the body of every selection and iteration
 * statement to be a compound statement, and ADR-027 records it as enforced.
 * `do`-`while` and `forever` already take a `block` in the grammar; these four
 * take a `statement`, so an unbraced body parsed and passed through to the C.
 * An unbraced declaration was worse (#1795): C rejects it, and its name stayed
 * in scope after the `if`.
 *
 * `else if` is the one unbraced `else` body allowed: the `if` is the chain,
 * and each of its own bodies is checked here.
 *
 * 1.2's syntax already says whether a body is a block, so this reads it and
 * holds no parse tree; the statements nested in each come from
 * `StatementChildren` (#2003).
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TStatement from "../../types/syntax/TStatement";
import StatementChildren from "../../utils/StatementChildren";
import IBracedBodyError from "./types/IBracedBodyError";

type TBodyKeyword = "if" | "else" | "while" | "for";

class BracedBodyAnalyzer {
  private readonly found: IBracedBodyError[] = [];

  public analyze(program: IProgramSyntax): IBracedBodyError[] {
    for (const { declaration } of program.members) {
      this.declaration(declaration);
    }
    return this.found;
  }

  private declaration(declaration: TMemberDeclaration): void {
    if (declaration.kind === "function") {
      this.statements(declaration.body.statements);
    }
  }

  private statements(statements: readonly TStatement[]): void {
    for (const statement of statements) this.statement(statement);
  }

  /** The statement's own body checks, then every statement nested in it */
  private statement(statement: TStatement): void {
    this.bodies(statement);
    this.statements(StatementChildren.of(statement));
  }

  private bodies(statement: TStatement): void {
    switch (statement.kind) {
      case "if":
        this.body("if", statement.whenTrue);
        // `else if`: the nested `if` checks its own bodies
        if (statement.whenFalse !== null && statement.whenFalse.kind !== "if") {
          this.body("else", statement.whenFalse);
        }
        return;
      case "while":
      case "for":
        this.body(statement.kind, statement.body);
        return;
      // The grammar braces these bodies, or the statement has none
      case "doWhile":
      case "forever":
      case "critical":
      case "switch":
      case "block":
      case "variableDeclaration":
      case "constructorDeclaration":
      case "assignment":
      case "expression":
      case "return":
      case "missing":
        return;
      default: {
        const unplaced: never = statement;
        return unplaced;
      }
    }
  }

  private body(keyword: TBodyKeyword, body: TStatement): void {
    if (body.kind !== "block" && body.kind !== "missing") {
      const example = keyword === "else" ? "else" : `${keyword} (...)`;
      this.found.push({
        code: "E0716",
        span: body.span,
        message: `'${keyword}' body must be a braced block`,
        helpText: `Wrap the body in braces: \`${example} { ... }\` (MISRA C:2012 Rule 15.6)`,
      });
    }
  }
}

export default BracedBodyAnalyzer;
