/**
 * Struct Field Analyzer
 * Validates that struct field names don't conflict with cnx reserved property names
 *
 * Fields cannot use reserved names like 'length' which conflict with cnx's
 * built-in .length property for primitives and arrays.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type ISourceSpan from "../../types/ISourceSpan";
import IStructFieldError from "./types/IStructFieldError";
import SymbolUtils from "../../PARSE/3-Declare/SymbolUtils";

/**
 * Pure function to create the error message
 *
 * @param fieldName - The field name
 * @param structName - The containing struct name
 * @returns The formatted error message
 */
function formatStructFieldError(fieldName: string, structName: string): string {
  return (
    `Struct field '${fieldName}' in '${structName}' uses a reserved cnx property name. ` +
    `The '.${fieldName}' property is built-in and will shadow this field.`
  );
}

class StructFieldAnalyzer {
  private readonly errors: IStructFieldError[] = [];

  public analyze(program: IProgramSyntax): IStructFieldError[] {
    for (const member of program.members) {
      this.declaration(member.declaration);
    }
    return this.errors;
  }

  private declaration(declaration: TMemberDeclaration): void {
    if (declaration.kind === "struct") {
      for (const field of declaration.fields) {
        if (SymbolUtils.isReservedFieldName(field.name)) {
          this.addError(declaration.name, field.name, field.nameSpan);
        }
      }
    }
  }

  private addError(
    structName: string,
    fieldName: string,
    at: ISourceSpan,
  ): void {
    const reservedNames = SymbolUtils.getReservedFieldNames().join(", ");
    this.errors.push({
      code: "E0355",
      structName,
      fieldName,
      span: at,
      message: formatStructFieldError(fieldName, structName),
      helpText: `Reserved field names: ${reservedNames}. Consider using 'len', 'size', or 'count' instead.`,
    });
  }
}

export default StructFieldAnalyzer;
