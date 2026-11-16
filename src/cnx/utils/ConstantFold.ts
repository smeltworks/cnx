/**
 * #1664 review of #1668's C11: how every pass folds a constant, from 1.4 on.
 *
 * A name's value is its bound declaration's: the binder decides what a
 * spelling means (a local, then the enclosing scope's member, then a
 * file-scope global -- ADR-057), and only a const that folded has a value.
 * The folds used to be handed maps of the consts that had folded, keyed by
 * name. A name bound to anything else -- a parameter, a variable, a const
 * that did not fold, a scope const declared further down -- was simply
 * absent, so the same spelling one level out answered instead: a false
 * E0854 on `arr[N]` for a parameter `N`, a scope array sized by the global's
 * `N`. Asking the binder has no such fallthrough.
 *
 * #1175: what is folded is an expression's plain-data form, by the one
 * evaluator (`ConstantEvaluator`), never its text. Each name in it carries
 * where it is written, so the environment needs only the file.
 */
import ConstantEvaluator from "./ConstantEvaluator";
import ConstExprLowering from "./ConstExprLowering";
import invariant from "./invariant";
import ConstExprPrinter from "./ConstExprPrinter";
import TypeCheckUtils from "./TypeCheckUtils";
import TTypeUtils from "./TTypeUtils";
import UNRESOLVED_DIMENSION from "../types/UNRESOLVED_DIMENSION";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import type IProgram from "../types/IProgram";
import type TConstExpr from "../types/TConstExpr";
import type TSettledConst from "../types/TSettledConst";
import type TType from "../types/TType";
import type TExpression from "../types/syntax/TExpression";

class ConstantFold {
  /** What a name is worth where it is written in `sourceFile`: the program's answer */
  /**
   * Whether a binding has a compile-time value: a read-only one that is not
   * `volatile`. A volatile is read where it is written -- its value is the
   * hardware's or an interrupt's, never its initializer (ADR-064, #2155
   * review 8). The one answer 1.4 settles by, and every reader of a settled
   * const (case labels, dimensions, inlined private consts) follows it.
   */
  static hasCompileTimeValue(binding: {
    readonly isConst: boolean;
    readonly isVolatile: boolean;
  }): boolean {
    return binding.isConst && !binding.isVolatile;
  }

  static environment(
    program: IProgram,
    sourceFile: string,
  ): IConstantEnvironment {
    return {
      valueOf: (name) => program.constantValueOf(sourceFile, name),
      cTypeName: (typeName, at) =>
        program.cTypeNameAt(sourceFile, typeName, at),
      isTypeName: (typeName, at) =>
        program.isTypeNameAt(sourceFile, typeName, at),
    };
  }

  /**
   * `environment`, except that a macro from an included C header whose C
   * replacement cnx can read (`HeaderMacros`: plain integer arithmetic)
   * answers that value at the target's `int` width (#1283 review). Folding
   * alone leaves it to C (`foreign`), which is right for a spelling C writes
   * -- a dimension stays `N_HANDLERS` (#1127) -- but not where cnx must
   * know the value: an element count, or whether a static initializer's
   * arithmetic would clamp or wrap (#1735 review 2).
   */
  static readingHeaderMacros(
    program: IProgram,
    sourceFile: string,
  ): IConstantEnvironment {
    const folded = ConstantFold.environment(program, sourceFile);
    const target = program.target();
    invariant(
      target.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    const intBits = target.description.int_bits;
    return {
      ...folded,
      valueOf: (name) => {
        const bound = folded.valueOf(name);
        if (bound.kind !== "foreign" || name.root !== null) return bound;
        if (name.path.length !== 1) return bound;
        const macro = program.headerMacro(sourceFile, name.path[0]);
        const value =
          macro?.kind === "integer"
            ? (macro.valueByIntBits.get(intBits) ?? null)
            : null;
        return value === null
          ? bound
          : { kind: "value", value: BigInt(value), typeName: null };
      },
    };
  }

  /**
   * A constant expression's value as a number, integer or float, where it is
   * written in `sourceFile` (`ConstantEvaluator.numberValue`)
   */
  static numberValue(
    program: IProgram,
    sourceFile: string,
    expr: TConstExpr,
  ): number | null {
    return ConstantEvaluator.numberValue(
      expr,
      ConstantFold.environment(program, sourceFile),
    );
  }

  /**
   * An operand's value where it is written, when it is known at compile time:
   * the one reading 2.1 and 2.2 share, so E0811 and the helper 2.2 plans for a
   * divisor agree (#1790 review)
   */
  static expressionValue(
    program: IProgram,
    sourceFile: string,
    expr: TExpression,
  ): number | null {
    return ConstantFold.numberValue(
      program,
      sourceFile,
      ConstExprLowering.lower(expr),
    );
  }

  /**
   * #1175: a dimension as C writes it, decided once for the .c (render) and
   * the .h (1.4's settled symbol). Its value; the C for one only C can
   * evaluate (a header macro), written from its structure; null when it has
   * none, which 2.1 Analyze reports (E0909, E0910) before anything emits it.
   * A value past what a `number` holds exactly is its digits, so the two
   * files still write the same.
   */
  static settled(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): number | string | null {
    const result = ConstantEvaluator.evaluate(expr, env);
    if (result.kind === "value") {
      return (
        ConstantEvaluator.toNumber(result.value) ?? result.value.toString()
      );
    }
    return result.kind === "foreign" ? ConstExprPrinter.toC(expr, env) : null;
  }

  /** `settled` as a symbol records it: UNRESOLVED_DIMENSION for none */
  static dimension(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): number | string {
    return ConstantFold.settled(expr, env) ?? UNRESOLVED_DIMENSION;
  }

  /**
   * #1175: what a const's initializer settles to -- the one rule for a
   * file-scope, scope and local const alike. Evaluated at the declared type,
   * which is the initializer's context (ADR-044 "Integer Literals"), and a
   * value only when that type holds it: `const u8 B <- 300` overflows u8.
   * A float const is its initializer's value converted to the declared type,
   * as C initializes it (#1268 review). Null for a const that is neither,
   * which has no value here.
   */
  static constValue(
    expr: TConstExpr,
    env: IConstantEnvironment,
    type: TType,
  ): TSettledConst | null {
    if (type.kind === "enum" || type.kind === "struct") {
      const result = ConstantEvaluator.evaluate(expr, env);
      return result.kind === "value"
        ? {
            kind: "named",
            digits: result.value.toString(),
            typeName: type.name,
          }
        : null;
    }
    const typeName = ConstantFold.typeNameOf(type);
    return typeName === null
      ? null
      : ConstantFold.primitiveValue(expr, env, typeName);
  }

  /**
   * #1735: a value of a cnx primitive type, held at that type -- a
   * const's initializer and each value in a static-storage initializer
   * alike. Null for a type that is not a number or a bool.
   */
  static primitiveValue(
    expr: TConstExpr,
    env: IConstantEnvironment,
    typeName: string,
  ): TSettledConst | null {
    if (TypeCheckUtils.isFloat(typeName)) {
      return ConstantFold.floatConst(
        expr,
        env,
        typeName === "f32" ? "f32" : "f64",
      );
    }
    if (typeName === "bool") return ConstantFold.boolConst(expr, env);
    if (!TypeCheckUtils.isInteger(typeName)) return null;
    const result = ConstantEvaluator.evaluate(expr, env, typeName);
    if (result.kind !== "value") return result;
    const range = TypeCheckUtils.integerRange(typeName)!;
    if (result.value < range[0] || result.value > range[1]) {
      return { kind: "overflow", typeName };
    }
    return { kind: "value", digits: result.value.toString(), typeName };
  }

  /** #1739: a bool const is its initializer's truth, as C's `bool` holds it */
  private static boolConst(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): TSettledConst {
    const result = ConstantEvaluator.evaluate(expr, env, "bool");
    return result.kind === "value"
      ? { kind: "bool", value: result.value !== 0n }
      : result;
  }

  private static floatConst(
    expr: TConstExpr,
    env: IConstantEnvironment,
    typeName: "f32" | "f64",
  ): TSettledConst {
    const result = ConstantEvaluator.fold(expr, env, typeName);
    if (result.kind !== "value" && result.kind !== "float") return result;
    const value =
      result.kind === "value"
        ? ConstantEvaluator.integerAsFloat(result.value, typeName)
        : ConstantEvaluator.heldFloat(result.value, typeName);
    // `String(-0)` is "0"; the sign is the value's
    const digits = Object.is(value, -0) ? "-0" : String(value);
    return { kind: "float", digits, typeName };
  }

  /** A declared type's cnx name, for the range a folded value must fit */
  static typeNameOf(type: TType): string | null {
    return TTypeUtils.isPrimitive(type) ? type.primitive : null;
  }
}

export default ConstantFold;
