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
   * The stored C name of the scope type a bare `name` in `scopePath` binds to
   * (ADR-057), found by identity (#2116). Preferred over `isScopeType`, which
   * only 3-Declare -- still deciding those names -- supplies.
   */
  readonly scopeTypeCName?: (
    scopePath: string,
    name: string,
  ) => string | undefined;

  /**
   * The spelling 1.3 gave a written `Scope.T` / `Ns.T` -- `Ns::T` for a C++
   * head, else the C name (#388, #2116). A ladder that meets a qualified type
   * reads it here; there is no fallback spelling.
   */
  readonly qualifiedTypeName?: (written: string) => string;
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
