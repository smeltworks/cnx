/**
 * A C++ constructor argument must name a declared `const` variable.
 *
 * #1322. The rule was two throws with identical text -- `VariableDeclHelper`
 * for a file-scope declaration, `ScopeGenerator` for one inside a `scope` --
 * and, more to the point, TWO WAYS of deciding const-ness. One read
 * `CodeGenState.getVariableTypeInfo`, falling back to a scope-qualified name
 * built by hand; the other went through `orchestrator.isConstValue` on a name
 * qualified by a different helper. They agreed by construction only for as long
 * as nobody edited one of them, which is the shape CLAUDE.md calls the worst
 * anti-pattern: the same decision derived twice.
 *
 * Here it is one question -- what does this name's declaration say? -- asked of
 * the lexical frames, which already handle a scope member and a file-scope
 * variable the same way, with shadowing.
 *
 * It moves on `IDeclaredVar.isConst`, added for exactly this: the collector
 * reads `constModifier` at every declaration site, so 2.1 answers without any
 * codegen state.
 *
 * Both diagnostics of the family move together. "is not declared" was thrown
 * from the same loop one step earlier, and splitting them would leave a rule
 * half in each pass.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TStatement from "../../types/syntax/TStatement";
import StatementNodes from "../../utils/StatementNodes";
import BoundDeclaration from "./helpers/BoundDeclaration";
import IConstructorArgumentError from "./types/IConstructorArgumentError";
import type IAnalysisContext from "./types/IAnalysisContext";

type TConstructorDeclaration = Extract<
  TStatement,
  { kind: "constructorDeclaration" }
>;

class ConstructorArgumentCheck {
  private readonly found: IConstructorArgumentError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IConstructorArgumentError[] {
    return this.found;
  }

  public check(declaration: TConstructorDeclaration): void {
    const line = declaration.span.line;
    const column = declaration.span.column;
    for (const argument of declaration.arguments) {
      const name = argument.name;
      // What the name binds to before this declaration, through Program's
      // one binder (#1668): a const local, member or global, this file's or
      // an included one's
      const declared = BoundDeclaration.of(
        this.context.program.bindValue(
          this.context.sourceFile,
          null,
          name,
          argument.span,
        ),
      );

      if (!declared) {
        this.found.push({
          code: "E0433",
          line,
          column,
          message: `Constructor argument '${name}' is not declared`,
          helpText: `Declare '${name}' before the constructor, or pass a literal.`,
        });
        continue;
      }
      if (!declared.isConst) {
        this.found.push({
          code: "E0432",
          line,
          column,
          message: `Constructor argument '${name}' must be read-only`,
          helpText:
            "A C++ constructor runs during static initialization, before main, so it may only read a value fixed at compile time. Remove `mut` from the argument's declaration.",
        });
      }
    }
  }
}

class ConstructorArgumentAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(program: IProgramSyntax): IConstructorArgumentError[] {
    const check = new ConstructorArgumentCheck(this.context);
    const visit = (declaration: TMemberDeclaration): void => {
      if (declaration.kind === "constructorDeclaration")
        check.check(declaration);
      for (const statement of StatementNodes.in(declaration)) {
        if (statement.kind === "constructorDeclaration") check.check(statement);
      }
    };
    for (const member of program.members) visit(member.declaration);
    return check.errors();
  }
}

export default ConstructorArgumentAnalyzer;
