/**
 * ADR-049: reads the target catalog -- a cnx source file -- into plain data.
 *
 * The catalog is parsed by the real cnx grammar, so it stays a cnx
 * program rather than a look-alike some second reader accepts. This module is
 * the only one that sees its parse tree; what leaves it is structs, constants
 * and literal values. Judging those values (kinds, completeness, the schema)
 * is `TargetDescriptions`' job, not this one's.
 *
 * A value counts only if it is a literal: an unsigned decimal integer, `true`
 * or `false`, or a string with no escapes. Anything else -- `16 + 16`, `-1`,
 * `(true)`, `32u8`, a reference to another constant -- is reported, because
 * no reader of the catalog may have to evaluate code to learn a target.
 */
import CnxSourceParser from "./CnxSourceParser";
import type * as Parser from "./grammar/CnxParser";
import ExpressionUnwrapper from "./ExpressionUnwrapper";
import type ITargetCatalogEntry from "../../types/ITargetCatalogEntry";
import type ITargetCatalogSource from "../../types/ITargetCatalogSource";
import type TTargetFieldValue from "../../types/TTargetFieldValue";

class TargetCatalogParser {
  static parse(text: string): ITargetCatalogSource {
    const parsed = CnxSourceParser.parse(text);
    const errors = parsed.parseErrors.map(
      (error) => `line ${error.line}: ${error.message}`,
    );
    const structs = new Map<string, ReadonlyMap<string, string>>();
    const entries: ITargetCatalogEntry[] = [];

    const directives = [
      ...parsed.tree.includeDirective(),
      ...parsed.tree.preprocessorDirective(),
    ];
    for (const directive of directives) {
      errors.push(
        `line ${directive.start!.line}: directives are not allowed in the catalog`,
      );
    }

    for (const declaration of parsed.tree.declaration()) {
      const struct = declaration.structDeclaration();
      const variable = declaration.variableDeclaration();
      if (struct) {
        structs.set(
          struct.IDENTIFIER().getText(),
          TargetCatalogParser.members(struct),
        );
      } else if (variable) {
        const entry = TargetCatalogParser.entry(variable, errors);
        if (entry) {
          entries.push(entry);
        }
      } else {
        errors.push(
          `line ${declaration.start!.line}: only structs and constants are allowed in the catalog`,
        );
      }
    }

    return { structs, entries, errors };
  }

  private static members(
    struct: Parser.StructDeclarationContext,
  ): ReadonlyMap<string, string> {
    const members = new Map<string, string>();
    for (const member of struct.structMember()) {
      const suffix = member.arrayDimension().length > 0 ? "[]" : "";
      members.set(
        member.memberName().getText(),
        member.type().getText() + suffix,
      );
    }
    return members;
  }

  private static entry(
    variable: Parser.VariableDeclarationContext,
    errors: string[],
  ): ITargetCatalogEntry | null {
    const line = variable.start!.line;
    const name = variable.IDENTIFIER().getText();
    const expression = variable.expression();
    if (variable.constModifier() || variable.mutModifier() || !expression) {
      errors.push(
        `line ${line}: '${name}' must be a read-only value (no \`mut\`, no \`const\`)`,
      );
      return null;
    }
    const typeName = variable.type()!.getText();

    const initializer =
      ExpressionUnwrapper.getPostfixExpression(expression)
        ?.primaryExpression()
        ?.structInitializer() ?? null;
    if (!initializer) {
      const value = TargetCatalogParser.literal(expression);
      if (value === null) {
        errors.push(`line ${line}: '${name}' is not a literal`);
      }
      return {
        constName: name,
        typeName,
        line,
        fields: new Map(),
        ...(value === null ? {} : { value }),
      };
    }

    const fields = new Map<string, TTargetFieldValue>();
    for (const field of initializer.fieldInitializerList().fieldInitializer()) {
      const fieldName = field.memberName().getText();
      const value = TargetCatalogParser.literal(field.expression());
      if (value === null) {
        errors.push(
          `line ${field.start!.line}: '${name}.${fieldName}' is not a literal`,
        );
      } else {
        fields.set(fieldName, value);
      }
    }
    return { constName: name, typeName, line, fields };
  }

  /** The expression's value when it is one literal the catalog accepts */
  private static literal(
    expression: Parser.ExpressionContext,
  ): TTargetFieldValue | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(expression);
    if (!postfix || postfix.postfixOp().length > 0) {
      return null;
    }
    const literal = postfix.primaryExpression()?.literal();
    if (!literal) {
      return null;
    }
    const text = literal.getText();
    if (literal.TRUE() || literal.FALSE()) {
      return text === "true";
    }
    if (literal.INTEGER_LITERAL() && /^(0|[1-9]\d*)$/.test(text)) {
      return Number(text);
    }
    if (literal.STRING_LITERAL() && !text.includes("\\")) {
      return text.slice(1, -1);
    }
    return null;
  }
}

export default TargetCatalogParser;
