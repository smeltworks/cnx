import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import MainSignature from "../../utils/MainSignature";
import type IUnwrittenSyntax from "./types/IUnwrittenSyntax";
import type IWrittenPart from "./types/IWrittenPart";

/**
 * Every outermost type and expression 2.3 writes in one file, with the scope it
 * is written in: what 2.2 decides before 2.3 renders any of the file (#1991).
 */
class WrittenParts {
  /** Every part but the declarations 2.2 decided 2.3 writes nothing of */
  static of(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): readonly IWrittenPart[] {
    return program.members
      .filter(
        ({ declaration, scope }) =>
          scope === null ||
          (!WrittenParts.headerText(declaration) &&
            !unwritten.declarations.has(declaration)),
      )
      .flatMap(({ declaration, scope }) =>
        WrittenParts.inDeclaration(declaration, scope),
      );
  }

  /**
   * `expr` and every expression nested in it that 2.3 writes: none of a value
   * it writes as its folded value (#1735)
   */
  static nodes(
    expr: TExpression,
    unwritten: IUnwrittenSyntax,
  ): readonly TExpression[] {
    return ExpressionNodes.direct(expr).filter(
      (node) => !unwritten.values.has(node),
    );
  }

  /**
   * #1300: a scope's struct, enum or bitmap is written into the `.c` as the
   * header's text, so 2.3 renders none of its parts
   */
  private static headerText(declaration: TMemberDeclaration): boolean {
    return (
      declaration.kind === "struct" ||
      declaration.kind === "enum" ||
      declaration.kind === "bitmap"
    );
  }

  private static inDeclaration(
    declaration: TMemberDeclaration,
    scope: string | null,
  ): IWrittenPart[] {
    return DeclarationParts.of(WrittenParts.asSpelled(declaration)).map(
      (part) => ({ part, scope }),
    );
  }

  /** `main(string args[])` is written `int main(int argc, char *argv[])`, so 2.3 spells none of its parameters */
  private static asSpelled(
    declaration: TMemberDeclaration,
  ): TMemberDeclaration {
    return declaration.kind === "function" &&
      MainSignature.takesArgs(declaration.name, declaration.parameters)
      ? { ...declaration, parameters: null }
      : declaration;
  }
}

export default WrittenParts;
