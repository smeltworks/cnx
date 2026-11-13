/**
 * The array half of a variable declaration (ADR-035/ADR-036).
 *
 * cnx writes dimensions in the TYPE -- `u16[8] arr` -- and the grammar also
 * admits trailing `arrayDimension`s, so "is this an array" is the disjunction
 * of two places and both contribute text. That disjunction is decided here,
 * once, rather than re-asked at each of the four sites that used to ask it.
 *
 * ## What is eager, and the one that surprises
 *
 * `arrayTypeDimensions` is a STRING, not a thunk, and that is deliberate.
 * Rendering it can generate a dimension expression, and today it is rendered
 * unconditionally once `isArray` holds -- BEFORE the initializer branch chooses
 * whether to use it. One sub-branch (`hasEmptyArrayTypeDimension`, where size
 * inference has already produced the suffix) then discards it. Making it a
 * thunk would skip the render on exactly that sub-branch, which drops whatever
 * effects the dimension expression raised. Preserved as eager so the effects
 * are raised the same number of times.
 *
 * `renderCStyleDimensions` IS a thunk, for the mirror reason: today it runs
 * only on the branch that uses it.
 */
interface IPlannedArrayDeclaration {
  /** True when the type carries dimensions, or the declaration trails them. */
  readonly isArray: boolean;

  /** Any dimension, in either position, written as `[]`. */
  readonly hasEmptyDimension: boolean;

  /**
   * The empty dimension is in the TYPE rather than trailing.
   *
   * ADR-035 size inference fills that one from the initializer, so the
   * inferred suffix already carries it and the declared dimensions must not be
   * prepended a second time.
   */
  readonly hasEmptyArrayTypeDimension: boolean;

  /** The first declared dimension when it folds, else null. */
  readonly declaredSize: number | null;

  /** The type's own dimensions, already rendered -- see above. */
  readonly arrayTypeDimensions: string;

  /** The declaration's trailing dimensions. */
  readonly renderCStyleDimensions: () => string;

  /** Null when the declaration has no initializer. */
  readonly init: IPlannedArrayInitializer | null;

  /**
   * #1209: initialized from another array -- a variable, a field, a call --
   * which C cannot write as an initializer, so the declaration is zeroed and
   * then copied into element by element. Null for a list or a string.
   */
  readonly copy: IPlannedArrayCopy | null;
}

interface IPlannedArrayCopy {
  readonly dimensions: ReadonlyArray<number | string>;
  readonly renderSource: () => string;
}

/**
 * What ADR-035's array-initializer processing needs, unevaluated.
 *
 * Thunks, because `ArrayInitHelper.processArrayInit` decides when each
 * renders.
 */
interface IPlannedArrayInitializer {
  readonly renderExpression: () => string;
  readonly renderDimensions: () => string;
}

export default IPlannedArrayDeclaration;
