/**
 * Base Identifier Builder
 *
 * Builds the base identifier string for assignment targets,
 * handling global., this., and bare identifier prefixes.
 *
 * Extracted from CodeGenerator.doGenerateAssignmentTarget to reduce
 * cognitive complexity.
 */

import IBaseIdentifierResult from "../types/IBaseIdentifierResult";

/**
 * Static utility for building base identifiers
 */
class BaseIdentifierBuilder {
  /**
   * Build the base identifier with appropriate prefix
   *
   * @param identifier The raw identifier
   * @param hasGlobal Whether global. prefix is present
   * @param hasThis Whether this. prefix is present
   * @param thisMemberCName The C name 3-Declare gave a member of the current
   *   scope (read for `this.`, #2116)
   * @returns The built identifier and first ID
   * @throws Error if this. is used outside a scope
   */
  static build(
    identifier: string,
    hasGlobal: boolean,
    hasThis: boolean,
    thisMemberCName: (name: string) => string,
  ): IBaseIdentifierResult {
    const firstId = identifier;

    if (hasGlobal) {
      // global.x - no prefix needed for code generation
      return { result: firstId, firstId };
    }

    if (hasThis) {
      // #1322: `this` outside a scope is E0431 in 2.1, so codegen is never
      // reached outside a scope here.
      return {
        result: thisMemberCName(firstId),
        firstId,
      };
    }

    // Bare identifier with postfix ops
    return { result: firstId, firstId };
  }
}

export default BaseIdentifierBuilder;
