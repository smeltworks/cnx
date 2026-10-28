/**
 * What 1.3 knows about a file's type names while it declares the file: the
 * scope types the file itself declares (ADR-057), and the one spelling it gave
 * each written `Scope.T` / `Ns.T` (#2116, `QualifiedTypeNames`).
 */
interface IDeclareTypeFacts {
  /** Whether a qualified name is a type this file declares in a scope */
  isScopeType(qualifiedName: string): boolean;
  /** The spelling of a `Scope.T` / `Ns.T` this file writes, by its text */
  qualifiedTypeName(written: string): string;
}

export default IDeclareTypeFacts;
