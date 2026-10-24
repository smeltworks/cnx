/**
 * Parameter Naming Analyzer
 * Issue #227: Validates that function parameters don't use reserved naming patterns
 *
 * Parameters cannot start with their containing function's name followed by underscore.
 * This naming pattern is reserved for scope-level variables and would bypass the
 * conflict detection heuristic in SymbolTable.detectConflict().
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type ISourceSpan from "../../types/ISourceSpan";
import IParameterNamingError from "./types/IParameterNamingError";

/**
 * Pure function to check if a parameter name uses a reserved pattern
 *
 * @param parameterName - The parameter name to check
 * @param functionName - The name of the containing function (without scope prefix)
 * @returns true if the parameter name is problematic
 */
function isReservedParameterName(
  parameterName: string,
  functionName: string,
): boolean {
  // Deliberately a literal single underscore, NOT QualifiedCName.SEPARATOR.
  //
  // E0227 exists because `process_value` could shadow a scope variable that also
  // generated the C name `process_value`. ADR-063 makes that collision
  // unrepresentable — a scope member now generates `process__value`, which E0201
  // already rejects as a parameter name. So this rule is arguably obsolete.
  //
  // Retiring it would change what cnx accepts, which needs its own ADR, so the
  // existing behavior is preserved verbatim here. Tracked separately.
  return parameterName.startsWith(functionName + "_");
}

/**
 * Pure function to create the error message
 *
 * @param parameterName - The parameter name
 * @param functionName - The containing function name
 * @returns The formatted error message
 */
function formatParameterNamingError(
  parameterName: string,
  functionName: string,
): string {
  return (
    `Parameter '${parameterName}' cannot start with function name prefix ` +
    `'${functionName}_'. This naming pattern is reserved for scope-level variables.`
  );
}

class ParameterNamingAnalyzer {
  private readonly errors: IParameterNamingError[] = [];

  public analyze(program: IProgramSyntax): IParameterNamingError[] {
    for (const member of program.members) {
      this.declaration(member.declaration);
    }
    return this.errors;
  }

  private declaration(declaration: TMemberDeclaration): void {
    if (declaration.kind === "function") {
      for (const parameter of declaration.parameters ?? []) {
        if (isReservedParameterName(parameter.name, declaration.name)) {
          this.addError(parameter.name, declaration.name, parameter.nameSpan);
        }
      }
    }
  }

  private addError(
    parameterName: string,
    functionName: string,
    at: ISourceSpan,
  ): void {
    this.errors.push({
      code: "E0227",
      parameterName,
      functionName,
      line: at.line,
      column: at.column,
      message: formatParameterNamingError(parameterName, functionName),
      helpText: `Consider renaming to a name that doesn't start with '${functionName}_'`,
    });
  }
}

export default ParameterNamingAnalyzer;
