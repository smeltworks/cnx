import type INamedTypeResolution from "../../../types/INamedTypeResolution";

/**
 * A cnx type, reduced to what 2.3 Render asks of it.
 *
 * #1445: `TypeGenerationHelper` used to take a `TypeContext` and re-walk the
 * six type alternatives itself. That was the seventh ladder #1285 set out to
 * collapse -- `TypeNameLadder`'s own header names this helper as one of the seven
 * -- and it was still standing. The named branches come from that one ladder
 * now, so the renderer receives a classification instead of re-deriving one.
 *
 * The three non-named alternatives stay separate fields rather than joining
 * the union, because 1.3 Declare and 2.3 Render want DIFFERENT answers for
 * them: `TypeNameLadder.resolveWrittenName` yields `string<32>`, where the
 * renderer wants `char`, and a primitive's
 * written name, where the renderer wants it through `TYPE_MAP`. Folding them
 * in would force one of the two to re-derive, which is the thing this replaces.
 */
interface IPlannedType {
  /**
   * The named-type branch `TypeNameLadder` classified -- `this.T`, `global.T`,
   * `Scope.T` or a bare `T` -- or null for every other alternative.
   *
   * For an array type this describes the ELEMENT: the renderer emits the
   * element type and the dimensions are appended by whoever declares the
   * variable.
   */
  readonly named: INamedTypeResolution | null;

  /**
   * #1984: the named type is a function used as a type. 1.4 settled it so;
   * this is its answer, read for the file the type is written in.
   */
  readonly isCallback: boolean;

  /** `string<N>` or a bare `string`, whose element type is `char`. */
  readonly isString: boolean;

  /**
   * The string type's source text -- `string<32>`, or `string` unbounded.
   *
   * Undefined unless `isString`. Present because 2.3's two readers want
   * different answers from the same node: the renderer emits `char`, and the
   * parameter context reports the written text for an ARRAY element while
   * reporting a bare `"string"` for a top-level one. That asymmetry is
   * load-bearing -- a top-level string's capacity travels separately -- so the
   * text is carried rather than either reader re-deriving it.
   */
  readonly stringTypeText: string | undefined;

  /** A primitive's WRITTEN name; the renderer maps it through `TYPE_MAP`. */
  readonly primitiveName: string | null;

  /** True when the alternatives above describe an array's element type. */
  readonly isArray: boolean;

  /**
   * The line a bare `userType` sits on, for `AdrProvenance`. Undefined for
   * every other branch, and for a `userType` whose token carries no position.
   */
  readonly userTypeLine: number | undefined;

  /**
   * The type's source text. This is what an unrecognized alternative renders
   * as -- a C++ `templateType` passes through unchanged, and `void` is its own
   * text, which is why the renderer needs no special case for it.
   */
  readonly text: string;

  /**
   * The type's written name, resolved in the scope that writes it: a named
   * type's C name, an array's element name, or else the source text (#1991)
   */
  readonly writtenName: string;
}

export default IPlannedType;
