/**
 * A whole array's C dimensions, leading first. A string array's last is its
 * characters', NUL included: `string<8>[2]` is `[2][9]` (ADR-045).
 */
class CArrayDimensions {
  static of(
    dimensions: ReadonlyArray<number | string>,
    stringCapacity: number | null,
  ): ReadonlyArray<number | string> {
    return stringCapacity === null
      ? dimensions
      : [...dimensions, stringCapacity + 1];
  }
}

export default CArrayDimensions;
