/**
 * #2473 review: which of a C or C++ callee's overloads a call reaches, and the
 * parameter each argument is written for. 2.2 writes an argument for that
 * parameter -- by its address for a pointer -- and 2.1's write and read-only
 * checks judge the overloads an argument so written can reach, so the two
 * passes read one answer.
 */
class CallReach {
  /**
   * Whether a call of `count` arguments can reach a function of these
   * parameters: it passes every one without a default argument, and no more
   * than it declares unless it is variadic
   */
  static takes(
    parameters: readonly object[],
    isVariadic: boolean,
    count: number,
  ): boolean {
    // A C++ parameter records `hasDefault`; a C one never has a default
    const required = parameters.filter(
      (parameter) =>
        !("hasDefault" in parameter && parameter.hasDefault === true),
    ).length;
    return count >= required && (count <= parameters.length || isVariadic);
  }

  /**
   * The parameter argument `index` is written for: the first reached
   * overload's that declares one
   */
  static shapedFor<TParameter>(
    reached: readonly (readonly TParameter[])[],
    index: number,
  ): TParameter | undefined {
    for (const parameters of reached) {
      const parameter = parameters[index];
      if (parameter !== undefined) return parameter;
    }
    return undefined;
  }

  /** A pointer parameter, which an argument written for it is passed to as a pointer */
  static passesPointer(type: string): boolean {
    return type.trim().endsWith("*");
  }
}

export default CallReach;
