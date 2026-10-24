/**
 * Dependencies required for type generation that involve external state.
 */
interface ITypeGenerationDeps {
  checkNeedsStructKeyword: (name: string) => boolean;
  /**
   * #1508 / ADR-010: does this settled type name refer to a declaration in a
   * DIFFERENT file? Injected like `isScopeType` rather than read from global
   * state, so this helper stays unit-testable.
   *
   * Required, not optional. An omitted predicate defaulting to "no" would make
   * ADR-010 occupancy silently empty -- the `cppMode?: boolean` shape that let
   * two sites emit the wrong header extension (#1319).
   */
  isCrossFileDeclaration: (typeName: string) => boolean;
}

export default ITypeGenerationDeps;
