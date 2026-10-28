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

import TSymbolKind from "../types/symbol-kinds/TSymbolKind";
import CppNamespaceUtils from "./CppNamespaceUtils";

/**
 * Symbol lookup interface for constructor detection
 */
interface ISymbolLookup {
  getSymbol(name: string): { kind: TSymbolKind } | undefined;
}

class CppConstructorHelper {
  /**
   * Extract just the class name (part after last ::).
   * e.g., TestNS::MyClass -> MyClass, CppTestClass -> CppTestClass
   */
  static extractClassName(qualifiedName: string): string {
    const parts = qualifiedName.split("::");
    return parts.at(-1)!;
  }

  /**
   * Build the constructor name pattern.
   * e.g., TestNS::MyClass -> TestNS::MyClass::MyClass
   */
  static buildConstructorName(
    qualifiedName: string,
    className: string,
  ): string {
    return CppNamespaceUtils.qualify(qualifiedName, className);
  }

  /**
   * Check if a type has a C++ constructor in the symbol table.
   *
   * @param typeName - The type's C++ name as 1.3 stored it (`Ns::T`), read
   *   as-is and never re-spelled (#2116)
   * @param symbolTable - Symbol table for lookup (may be null)
   * @returns true if a constructor function symbol exists
   */
  static hasConstructor(
    typeName: string,
    symbolTable: ISymbolLookup | null | undefined,
  ): boolean {
    if (!symbolTable) return false;

    const className = CppConstructorHelper.extractClassName(typeName);
    const constructorName = CppConstructorHelper.buildConstructorName(
      typeName,
      className,
    );

    const constructorSymbol = symbolTable.getSymbol(constructorName);
    return constructorSymbol?.kind === "function";
  }
}

export default CppConstructorHelper;
