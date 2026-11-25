/**
 * #2474: the one rule for which of a name's header declarations a file
 * reads. The symbol table's per-file view and 1.4's header values both ask
 * it, so an array's bound and its index check read one answer.
 */
type TDimensions = ReadonlyArray<number | string>;

class ForeignRedeclaration {
  /** The declarations a reader reads: the ones it sees, else every one */
  static pool<T>(declared: readonly T[], sees: (entry: T) => boolean): T[] {
    const seen = declared.filter(sees);
    return seen.length > 0 ? seen : [...declared];
  }

  /**
   * An array's dimensions as C composes its redeclarations: an unsized
   * `extern uint8_t t[];` takes the bound `uint8_t t[4];` gives it, in
   * either order
   */
  static dimensions(
    first: TDimensions,
    redeclared: readonly TDimensions[],
  ): (number | string)[] {
    return first.map(
      (dimension, k) =>
        (dimension === ""
          ? redeclared.find(
              (other) => other.length === first.length && other[k] !== "",
            )?.[k]
          : dimension) ?? "",
    );
  }
}

export default ForeignRedeclaration;
