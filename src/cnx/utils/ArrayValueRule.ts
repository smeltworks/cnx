import type TExpression from "../types/syntax/TExpression";

/**
 * ADR-035 (#1209 clarification, 2026-11-13): an array is given a list, a
 * `u8` array's string literal, or another array of its element type and
 * shape, which is copied element by element. A copy runs as a statement, so
 * it needs a function to run in and a written size to copy into: at file
 * scope, or for an inferred size, only a list or a literal is accepted. The
 * wording of each rejection, for 1.2's arms and 2.1's.
 */
class ArrayValueRule {
  /** 2.1: inside a function, neither a list nor an array */
  static notAnArrayMessage(value: TExpression): string {
    return `An array must be initialized by a list or an array, not '${value.written}'`;
  }

  static readonly NOT_AN_ARRAY_HELP =
    "Write the elements out in brackets, or give it an array of its element type and shape, which is copied (ADR-035).";

  /** 1.2: at file scope, or of an inferred size, where only a list is */
  static notAListMessage(value: TExpression, inFunction: boolean): string {
    const where = inFunction ? "of an inferred size" : "at file scope";
    return `An array ${where} must be initialized by a list, not '${value.written}'`;
  }

  static notAListHelp(inFunction: boolean): string {
    return inFunction
      ? "Write the elements out in brackets, or write its size to copy another array in (ADR-035)."
      : "Write the elements out in brackets; a copy of another array runs inside a function, and file scope has none (ADR-035).";
  }
}

export default ArrayValueRule;
