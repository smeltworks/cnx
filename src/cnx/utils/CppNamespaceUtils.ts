/**
 * C++ Namespace Detection Utilities
 *
 * Provides shared logic for detecting C++ scope-like symbols and spelling C++
 * qualified names. Nothing converts a generated `A__B` back to `A::B`: 1.3
 * spells a written C++ path once and later layers read it (#2116).
 *
 * Issue #522: Consolidated from duplicate implementations in:
 * - CodeGenerator.ts (isCppScopeSymbol)
 * - generateStructHeader.ts (isCppNamespace, convertToCppNamespaceIfNeeded)
 */

import type IResolvedSymbols from "../types/IResolvedSymbols";
import ESourceLanguage from "./types/ESourceLanguage";

/**
 * Static utility methods for C++ namespace operations
 */
class CppNamespaceUtils {
  static readonly SEPARATOR = "::";

  /** The one spelling of a C++ qualified name: `scope::name`, or `name` at file scope */
  static qualify(scope: string | null | undefined, name: string): string {
    return scope ? CppNamespaceUtils.fromParts([scope, name]) : name;
  }

  /** `A::B::C` from its parts */
  static fromParts(parts: readonly string[]): string {
    return parts.join(CppNamespaceUtils.SEPARATOR);
  }

  /**
   * Check if a symbol name refers to a C++ scope-like symbol that requires :: syntax.
   * This includes C++ namespaces, classes, and enum classes (scoped enums).
   *
   * @param name - The symbol name to check (e.g., "SeaDash" or "Lib")
   * @param symbolTable - Optional symbol table for lookups
   * @returns true if the symbol is a C++ namespace, class, or enum
   */
  static isCppNamespace(
    name: string,
    symbolTable: IResolvedSymbols | undefined,
  ): boolean {
    if (!symbolTable) {
      return false;
    }

    const symbols = symbolTable.getOverloads(name);
    for (const sym of symbols) {
      // Only consider C++ symbols
      if (sym.sourceLanguage !== ESourceLanguage.Cpp) {
        continue;
      }

      // C++ namespaces, classes, and enums (enum class) need :: syntax
      if (
        sym.kind === "namespace" ||
        sym.kind === "class" ||
        sym.kind === "enum"
      ) {
        return true;
      }
    }

    return false;
  }
}

export default CppNamespaceUtils;
