import type IVariableDeclarationSyntax from "../types/syntax/IVariableDeclarationSyntax";
import type TMemberDeclaration from "../types/syntax/TMemberDeclaration";
import type TExpression from "../types/syntax/TExpression";
import type TStatement from "../types/syntax/TStatement";
import type TSyntaxPart from "../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import StatementChildren from "./StatementChildren";
import TypeParts from "./TypeParts";

/**
 * Every outermost type and expression 1.2 returned for one declaration, in
 * source order, through its scope members and its function body's statements:
 * each written type, initializer, dimension, enum value, register address and
 * offset, condition, assignment side, return value and expression statement.
 * What is inside each one is `TypeParts`' and `ExpressionChildren`'s. Every
 * declaration and statement kind has an arm, so a new kind does not compile
 * until it is placed (#1991).
 */
class DeclarationParts {
  static of(declaration: TMemberDeclaration): readonly TSyntaxPart[] {
    switch (declaration.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        return DeclarationParts.statement(declaration);
      case "function":
        return [
          DeclarationParts.type(declaration.returnType),
          ...(declaration.parameters ?? []).flatMap((parameter) => [
            DeclarationParts.type(parameter.type),
            ...TypeParts.dimensions(parameter.dimensions),
          ]),
          ...DeclarationParts.statements(declaration.body.statements),
        ];
      case "register":
        return [
          DeclarationParts.expression(declaration.address),
          ...declaration.members.flatMap((member) => [
            DeclarationParts.type(member.type),
            DeclarationParts.expression(member.offset),
          ]),
        ];
      case "struct":
        return declaration.fields.flatMap((field) => [
          DeclarationParts.type(field.type),
          ...TypeParts.dimensions(field.dimensions),
        ]);
      case "enum":
        return declaration.members.flatMap((member) =>
          member.value === null
            ? []
            : [DeclarationParts.expression(member.value, true)],
        );
      case "bitmap":
      case "missing":
        return [];
      default: {
        const unplaced: never = declaration;
        return unplaced;
      }
    }
  }

  static statements(statements: readonly TStatement[]): readonly TSyntaxPart[] {
    return statements.flatMap((statement) => [
      ...DeclarationParts.statement(statement),
      ...DeclarationParts.statements(StatementChildren.of(statement)),
    ]);
  }

  /** The statement's own parts, not those of statements nested in it */
  static statement(statement: TStatement): readonly TSyntaxPart[] {
    switch (statement.kind) {
      case "variableDeclaration":
        return DeclarationParts.variable(statement);
      case "constructorDeclaration":
        return [DeclarationParts.type(statement.type)];
      case "assignment":
        return DeclarationParts.expressions([
          statement.target,
          statement.value,
        ]);
      case "expression":
        return [DeclarationParts.expression(statement.expression)];
      case "if":
      case "while":
      case "doWhile":
        return [DeclarationParts.expression(statement.condition)];
      case "for":
        return [
          ...(statement.init === null
            ? []
            : DeclarationParts.statement(statement.init)),
          ...DeclarationParts.expressions([
            statement.condition,
            statement.update?.target ?? null,
            statement.update?.value ?? null,
          ]),
        ];
      case "switch":
        return [DeclarationParts.expression(statement.subject)];
      case "return":
        return DeclarationParts.expressions([statement.value]);
      case "forever":
      case "critical":
      case "block":
      case "missing":
        return [];
      default: {
        const unplaced: never = statement;
        return unplaced;
      }
    }
  }

  private static variable(
    variable: IVariableDeclarationSyntax,
  ): readonly TSyntaxPart[] {
    return [
      DeclarationParts.type(variable.type),
      ...TypeParts.dimensions(variable.dimensions),
      ...DeclarationParts.expressions([variable.initializer]),
    ];
  }

  private static type(type: TTypeSyntax): TSyntaxPart {
    return { kind: "type", type };
  }

  private static expression(
    expression: TExpression,
    constant = false,
  ): TSyntaxPart {
    return { kind: "expression", expression, constant };
  }

  private static expressions(
    expressions: ReadonlyArray<TExpression | null>,
  ): readonly TSyntaxPart[] {
    return expressions.flatMap((expression) =>
      expression === null ? [] : [DeclarationParts.expression(expression)],
    );
  }
}

export default DeclarationParts;
