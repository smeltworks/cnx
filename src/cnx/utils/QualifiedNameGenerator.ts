/**
 * QualifiedNameGenerator - C-style name generation for cnx symbols
 *
 * Provides transpiled C name generation for use in the output layer.
 * Delegates to ScopeUtils for the actual implementation to avoid duplication
 * with the types layer.
 *
 * Design decisions:
 * - Lives in output layer (codegen) since it generates C output
 * - Delegates to ScopeUtils for symbol-based name generation
 * - Provides string-based methods for backward compatibility
 * - Handles nested scopes: Outer.Inner.func -> Outer_Inner_func
 * - Global scope functions keep their bare names
 */
import type IProgram from "../types/IProgram";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";
import ScopeUtils from "./ScopeUtils";

class QualifiedNameGenerator {
  // ============================================================================
  // Symbol-based methods (preferred)
  // ============================================================================

  /**
   * Generate the transpiled C name for a function.
   *
   * For global scope functions, returns the bare name (e.g., "main").
   * For scoped functions, returns "Scope_name" (e.g., "Test_fillData").
   * For nested scopes, returns "Outer_Inner_name" (e.g., "Outer_Inner_deepFunc").
   *
   * #2116: 3-Declare stored it on the symbol; this reads it, never re-encodes.
   */
  static forFunction(func: IFunctionSymbol): string {
    return func.fullyQualifiedCName;
  }

  // #1298 removed `getScopePath`, a delegate to a `ScopeUtils` walk that no
  // longer exists: a scope's path is now a field on every symbol, so there is
  // nothing left to compute or to delegate.

  // ============================================================================
  // String-based methods (for transition - use symbol-based when possible)
  // ============================================================================

  /**
   * Generate a qualified function name for a function named inside a scope.
   *
   * Takes the scope PATH. #1285 replaced a leaf `string` with the scope symbol,
   * because the caller had to flatten a symbol to its leaf name and this had to
   * look it back up, losing any outer chain in between. #1298 makes it a string
   * again -- but the WHOLE path, which loses nothing, and which the caller already
   * holds.
   *
   * Falls back to qualifying the bare name when the function is not registered.
   */
  static forFunctionInScope(
    scopePath: string,
    funcName: string,
    program: IProgram | null,
  ): string {
    // #1452 box 3: the scope graph arrives as an argument rather than off a
    // global. `utils/` authors no facts and now reaches for none either.
    if (!program) return ScopeUtils.qualifyInScope(funcName, scopePath);
    const func = program.resolveFunction(funcName, scopePath);
    if (func) {
      return this.forFunction(func);
    }
    return ScopeUtils.qualifyInScope(funcName, scopePath);
  }
}

export default QualifiedNameGenerator;
