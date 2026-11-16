/**
 * ADR-051's `safe_div` / `safe_mod` calls, and which argument they write to.
 *
 * #1322: two rules ask the same thing of these calls and they are not the same
 * rule. ADR-051 governs their SHAPE -- four arguments, the first a variable to
 * receive the quotient (E0884/E0885). ADR-071 governs mutability, and the
 * first argument is written through, so a read-only binding there is written
 * exactly as `K <- 1` writes it (E0900).
 *
 * The fact both need -- "argument 0 of this call is an output parameter" -- is
 * a property of these two builtins and belongs in one place. Before it was
 * shared, the const rule could not see the site at all: it walks assignment
 * targets, and this is a call argument. `safe_div(K, 10, 2, 0)` emitted `&K`
 * into a non-const pointer parameter, which gcc rejects with
 * `discards 'const' qualifier`, at exit 0.
 */

import type TExpression from "../types/syntax/TExpression";
import ExpressionShape from "./ExpressionShape";
import OperandTyper from "./OperandTyper";
import type ITypingContext from "../types/ITypingContext";

type TSafeDivisionName = "safe_div" | "safe_mod";

const OPERATIONS: Readonly<Record<TSafeDivisionName, "div" | "mod">> = {
  safe_div: "div",
  safe_mod: "mod",
};

const isName = (name: string): name is TSafeDivisionName =>
  Object.hasOwn(OPERATIONS, name);

class SafeDivision {
  /**
   * The call this postfix expression is, when it is one of ADR-051's, with the
   * arguments as written. Null for anything else.
   *
   * The name must be a bare primary identifier followed by exactly one call
   * op: `safe_div(...)`. A member access that happens to end in the same name
   * is a different function.
   */
  static callOf(
    expr: TExpression,
  ): { name: TSafeDivisionName; args: readonly TExpression[] } | null {
    if (expr.kind !== "postfix" || expr.ops.length !== 1) return null;
    if (expr.primary.kind !== "identifier") return null;
    const name = expr.primary.name;
    const op = expr.ops[0];
    if (!isName(name) || op.kind !== "call") return null;
    return { name, args: op.arguments };
  }

  /** The helper family a call is written through: `cnx_safe_div_*` or `cnx_safe_mod_*` */
  static operationOf(name: TSafeDivisionName): "div" | "mod" {
    return OPERATIONS[name];
  }

  /**
   * The type a call divides in, its output's: the helper is written in it
   * (2.2), and the numerator and default land in it as a call argument
   * lands in its parameter (ADR-024, #2424). The divisor does not land:
   * it is a `/` divisor (ADR-044) and the helper takes it wider (#2415).
   */
  static outputTypeOf(
    args: readonly TExpression[],
    ctx: ITypingContext,
  ): string | null {
    const output = args[0];
    if (output === undefined) return null;
    return OperandTyper.typeOf(output, ctx)?.typeName ?? null;
  }

  /** Whether argument `index` lands in the output's type: numerator, default */
  static landsInOutput(index: number): boolean {
    return index === 1 || index === 3;
  }

  static outputName(args: readonly TExpression[]): string | null {
    const first = args[0];
    return first === undefined ? null : ExpressionShape.simpleIdentifier(first);
  }
}

export default SafeDivision;
