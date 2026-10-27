/**
 * What `TypeNameLadder` needs injected to resolve a type name.
 *
 * A shared contract rather than a module-private interface: 1.3 Declare
 * declares the resolver, 2.3 Render calls it, and `CodeGenState` binds its own
 * type sets to it. CLAUDE.md puts a type three layers reach in
 * `src/cnx/types/`, which every layer may depend on -- the alternative was a
 * structural copy in `state/` that had to be kept in step by hand, which is the
 * duplication this type exists to end rather than one more instance of it.
 *
 * The predicates stay INJECTED. `TypeNameLadder` reading `CodeGenState` directly
 * would put codegen state behind a resolver 1.3 Declare also calls, and 1.3
 * runs long before any of that state exists.
 */
interface ITypeBindingDeps {
  /**
   * ADR-057: whether a QUALIFIED name is a type declared in the current scope.
   * Consulted only for a bare `userType()` -- `this.T`, `global.T` and `Scope.T`
   * state their answer in the syntax and must keep their own branches, because
   * once a name is a string `global.Mode` and a bare `Mode` are identical.
   */
  readonly isScopeType?: (qualifiedName: string) => boolean;

  /**
   * C++ namespace-aware resolution for `Scope.Type` (Issue #388). Injected
   * because it is a codegen concern; without it the components are joined.
   */
  readonly resolveQualifiedType?: (identifiers: string[]) => string;
  /**
   * The C name 3-Declare gave `name` in `scopePath`, for `this.T` (#2116).
   * Absent only in 3-Declare, which is still deciding those names.
   */
  readonly memberCName?: (
    scopePath: string,
    name: string,
  ) => string | undefined;
}

export default ITypeBindingDeps;
