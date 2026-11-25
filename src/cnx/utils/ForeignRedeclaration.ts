/**
 * #2474: the one rule for which of a name's header declarations a file
 * reads. The symbol table's per-file view and 1.4's header values both ask
 * it, so an array's bound and its index check read one answer.
 */
class ForeignRedeclaration {
  /** The declarations a reader reads: the ones it sees, else every one */
  static pool<T>(declared: readonly T[], sees: (entry: T) => boolean): T[] {
    const seen = declared.filter(sees);
    return seen.length > 0 ? seen : [...declared];
  }

  /**
   * The declaration a reader reads from its pool. An array's bound is its
   * last declaration's, so a trailing `extern uint8_t t[];` leaves it unknown
   * (E0909) rather than folding a bound read from another branch; every
   * other name is its first declaration.
   */
  static read<T>(
    pool: readonly T[],
    isArray: (entry: T) => boolean,
  ): T | undefined {
    const first = pool[0];
    return first !== undefined && isArray(first) ? pool.at(-1) : first;
  }
}

export default ForeignRedeclaration;
