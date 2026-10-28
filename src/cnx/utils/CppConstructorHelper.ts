/**
 * CppConstructorHelper
 *
 * Helper class for C++ constructor detection logic.
 * Issue #517: C++ classes with user-defined constructors are NOT aggregate types,
 * so designated initializers { .field = value } don't work with them.
 *
 * #1322: moved out of `output/codegen/helpers/` because both passes ask it.
 * "Does this type have a constructor in the symbol table?" is a question about
 * the SYMBOL MODEL, not about rendering -- it reads a lookup and a name
 * spelling and nothing else -- and pass 2.1 may not import `output/`
 * (`2-1-analyze-reads-no-later-pass`). Its location was the only thing making it
 * a codegen fact.
 */

import type IResolvedSymbols from "../types/IResolvedSymbols";

class CppConstructorHelper {
  /**
   * Check if a type has a C++ constructor in the symbol table: a function the
   * class declares under its own unqualified name.
   *
   * @param typeName - The type's C++ name as 1.3 stored it (`Ns::T`), read
   *   as-is and never re-spelled; the constructor is found by (class, name),
   *   so nothing spells `Ns::T::T` (#2116)
   * @param symbolTable - Symbol table for lookup (may be null)
   * @returns true if a constructor function symbol exists
   */
  static hasConstructor(
    typeName: string,
    symbolTable:
      | Pick<IResolvedSymbols, "getCppSymbol" | "getCppMembers">
      | null
      | undefined,
  ): boolean {
    if (!symbolTable) return false;
    const cls = symbolTable.getCppSymbol(typeName);
    if (cls === undefined) return false;
    return symbolTable
      .getCppMembers(cls.name, cls.unqualifiedName)
      .some((member) => member.kind === "function");
  }
}

export default CppConstructorHelper;
