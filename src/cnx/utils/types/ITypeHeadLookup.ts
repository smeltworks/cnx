import type TSymbol from "../../types/symbols/TSymbol";

/**
 * How `ScopeUtils.typeHeadCName` finds the type a chain head names, by
 * identity, so it reads the type's stored C name instead of encoding one
 * (#2116).
 */
interface ITypeHeadLookup {
  /** The member `name` of `scopePath`, for `this.T` */
  memberOf(scopePath: string, name: string): TSymbol | undefined;
  /** The scope type a bare `name` in `scopePath` binds to (ADR-057), if any */
  scopeTypeOf(scopePath: string, name: string): TSymbol | undefined;
}

export default ITypeHeadLookup;
