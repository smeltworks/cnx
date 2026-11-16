/**
 * A function parameter, reduced to what ADR-006's signature adapter asks of it.
 *
 * #1445: `ParameterInputAdapter.fromAST` took a `ParameterContext` and three
 * callbacks that each took another parse node. Everything it did with them was
 * to turn a node into a string -- a type name, a mapped C type, a dimension --
 * and every decision it makes afterwards is about those strings and
 * `CodeGenState`. So the strings come over instead.
 *
 * The sibling `fromSymbol` already took a record of facts (`IParameterSymbol`).
 * The two now differ in WHICH record rather than in kind, which is the shape
 * the .c/.h divergences this adapter keeps fixing (#914, #1164, #1545) would
 * eventually be closed from.
 */
interface IPlannedParameter {
  readonly name: string;

  /** An explicit `const` modifier in the source. */
  readonly isConst: boolean;

  /** The cnx type name -- `u32`, `string<32>`, `Point`, `Motor__State`. */
  readonly typeName: string;

  /** The mapped C type. */
  readonly mappedType: string;

  /** #1984: 1.4 settled the parameter's type as a callback (ADR-029) */
  readonly isCallback: boolean;

  /**
   * The array dimensions, rendered on demand, or null when the parameter is
   * not an array.
   *
   * A thunk, because a parameter whose type is a callback returns before any
   * dimension is needed, and rendering one is not free: a dimension that is
   * not a compile-time constant goes through expression generation, which can
   * queue a pending temp declaration. The node-walking version got that order
   * for free by only reaching the dimensions inside the array branch.
   */
  readonly renderDimensions: (() => readonly string[]) | null;

  /** True when the type -- or an array's element type -- is a string. */
  readonly isString: boolean;

  /** A bounded string's capacity, absent for an unbounded `string`. */
  readonly stringCapacity: number | undefined;

  /**
   * The PARAMETER's line, which ADR-013 and ADR-030 record against.
   */
  readonly line: number | undefined;

  /**
   * The STRING TYPE's line, which the string branch records ADR-013 against.
   *
   * ADR-013 is recorded against THREE different positions depending on which
   * branch fires -- the parameter's, the string type's, and the array type's.
   * They differ only when a parameter spans lines, and all three are carried
   * over rather than unified: picking one would change recorded provenance for
   * reasons unrelated to this change, and occupancy is derived from those
   * positions (#1241).
   */
  readonly stringTypeLine: number | undefined;

  /** The ARRAY TYPE's line, which the array branch records ADR-013 against. */
  readonly arrayTypeLine: number | undefined;
}

export default IPlannedParameter;
