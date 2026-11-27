/**
 * ExternalTypeHeaderBuilder
 * Builds mapping from external type names to their C header include directives.
 *
 * Issue #589: Extracted from Transpiler.buildExternalTypeHeaders()
 * Issue #497: Enables header generation to include original C headers instead of
 * generating conflicting forward declarations for types like anonymous struct typedefs.
 * ADR-055 Phase 7: Uses TAnySymbol instead of ISymbol.
 */

/**
 * What this builder needs to know about a file.
 *
 * #1511: it used to take the whole `SymbolTable` and filter symbols by kind
 * here. The kinds that form a type are a property of the symbols, so that
 * filter is now authored in `Program` and this asks for the answer — which is
 * also why the parameter is this one method rather than `IProgram`: nothing
 * here needs the rest of the artifact, and the narrow shape keeps the unit
 * tests free of a whole program.
 */
interface ITypeSource {
  typesDeclaredIn(filePath: string): ReadonlySet<string>;
  /**
   * #2474: the header this file reads a foreign type from, by its own
   * includes, or undefined when no header declares it
   */
  declaringHeader(typeName: string): string | undefined;
}

/**
 * Builds mapping from external type names to their C header include directives
 */
class ExternalTypeHeaderBuilder {
  /**
   * Build a map from external type names to their C header include directives.
   *
   * This enables header generation to include the original C headers instead of
   * generating conflicting forward declarations for types like anonymous struct typedefs.
   *
   * @param headerIncludeDirectives Map from header file paths to their include directives
   * @param typeSource Answers which type names a file declares (`Program`)
   * @returns Map from type names to include directives (e.g., "MyStruct" -> '#include "mystruct.h"')
   */
  static build(
    headerIncludeDirectives: ReadonlyMap<string, string>,
    typeSource: ITypeSource,
  ): Map<string, string> {
    const typeHeaders = new Map<string, string>();

    // #2474: a type two headers declare is included from the one the file
    // reads, so its header never pulls in the other's conflicting typedef.
    // Otherwise the first directive declaring it wins (#1511).
    for (const [headerPath, directive] of headerIncludeDirectives) {
      for (const typeName of typeSource.typesDeclaredIn(headerPath)) {
        const reads = typeSource.declaringHeader(typeName);
        if (reads !== undefined && reads !== headerPath) continue;
        if (!typeHeaders.has(typeName)) {
          typeHeaders.set(typeName, directive);
        }
      }
    }

    return typeHeaders;
  }
}

export default ExternalTypeHeaderBuilder;
