/**
 * #1735: the values a static-storage initializer holds.
 *
 * A file-scope or scope variable is initialized before the program runs, so C
 * requires each value in its initializer to be a constant expression (C99
 * 6.7.8p4): a `const` object is not one, and neither is ADR-044's clamp helper
 * call. Each is a value fixed at compile time (ADR-044, #1175), `mut` or not.
 * One of a cnx number or bool type that is not written as a literal is
 * folded here, at the type its position holds it at: the one answer 2.1
 * rejects (E0909, E0910) and 2.2 spells. One of any other type (an enum, a
 * struct) has no typed fold, but is asked the same question untyped, so one
 * that reads a variable or calls a function is rejected too (#2018).
 */
import type IProgram from "../../../types/IProgram";
import type TValueBinding from "../../../types/TValueBinding";
import type ISourcePosition from "../../../utils/types/ISourcePosition";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type IValuePosition from "../../../types/IValuePosition";
import type TConstExpr from "../../../types/TConstExpr";
import type TSettledConst from "../../../types/TSettledConst";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../../types/syntax/TMemberDeclaration";
import type TExpression from "../../../types/syntax/TExpression";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import ConstExprPrinter from "../../../utils/ConstExprPrinter";
import ConstantEvaluator from "../../../utils/ConstantEvaluator";
import type IConstantEnvironment from "../../../utils/types/IConstantEnvironment";
import ConstantFold from "../../../utils/ConstantFold";
import LengthProperty from "../../../utils/LengthProperty";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import TypeText from "../../../utils/TypeText";
import type IStaticValue from "../types/IStaticValue";
import ValuePositions from "./ValuePositions";

type TConstName = Extract<TConstExpr, { kind: "name" }>;

const WRAPPING_OPERATORS: ReadonlySet<string> = new Set(["+", "-", "*", "<<"]);
type TReason = Extract<TSettledConst, { kind: "notConstant" }>["reason"];

/** What a value of no number or bool type has no value for C by */
const UNTYPED_WITHOUT_VALUE: ReadonlySet<TReason> = new Set<TReason>([
  "variable",
  "parameter",
  "call",
]);

class StaticInitializers {
  /** Each value to fold in the file's static-storage initializers */
  static values(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): IStaticValue[] {
    return program.members
      .flatMap(({ declaration }) =>
        StaticInitializers.declarations(declaration),
      )
      .flatMap((declaration) =>
        StaticInitializers.leaves(declaration.initializer!).flatMap((value) => {
          return StaticInitializers.isLiteral(value)
            ? []
            : [
                {
                  declaration,
                  value,
                  typeName: StaticInitializers.typeAt(positions, value),
                },
              ];
        }),
      );
  }

  /**
   * The value, held at its type, by the fold every pass shares. One of no
   * number or bool type is only asked whether it has a value: null when it
   * does, why not when it does not. A header macro is left to C, as it is
   * written (#1127).
   */
  static settle(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): TSettledConst | null {
    return StaticInitializers.settleIn(
      value,
      ConstantFold.environment(program, sourceFile),
    );
  }

  /**
   * `settle`, reading each header macro cnx can: what 2.1 checks, so a
   * macro's arithmetic clamps or wraps no more silently than a const's
   * (#1735 review 2). C is still given the macro.
   */
  static check(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): TSettledConst | null {
    return StaticInitializers.settleIn(
      value,
      ConstantFold.readingHeaderMacros(program, sourceFile),
    );
  }

  private static settleIn(
    value: IStaticValue,
    env: IConstantEnvironment,
  ): TSettledConst | null {
    const lowered = ConstExprLowering.lower(value.value);
    if (value.typeName !== null) {
      const settled = ConstantFold.primitiveValue(lowered, env, value.typeName);
      // A float fold past its type's range is infinite, which C has no
      // constant for (#1735 review 2)
      return settled?.kind === "float" &&
        !Number.isFinite(Number(settled.digits))
        ? { kind: "overflow", typeName: settled.typeName }
        : settled;
    }
    const result = ConstantEvaluator.evaluate(lowered, env);
    return result.kind === "value" ? null : result;
  }

  /**
   * Whether the value has none C can be given, which 2.1 reports (E0909):
   * one of a number or bool type that cnx cannot fold and C cannot
   * evaluate; one of any other type that reads a variable or calls a function
   */
  static lacksValue(value: IStaticValue, settled: TSettledConst): boolean {
    if (settled.kind !== "notConstant") return false;
    return value.typeName === null
      ? UNTYPED_WITHOUT_VALUE.has(settled.reason)
      : !StaticInitializers.cHasValue(settled);
  }

  /**
   * A value C evaluates that reads a cnx const, written as dimensions are
   * (`ConstantFold.settled`): each cnx name as its value, each header name
   * as C spells it -- since C cannot read the const object (#1735 review)
   */
  static cText(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): string {
    return ConstExprPrinter.toC(
      ConstExprLowering.lower(value.value),
      ConstantFold.environment(program, sourceFile),
    );
  }

  /**
   * Whether the value does arithmetic that can clamp or wrap: what cnx
   * must see every operand of to check (#1735 review 2)
   */
  static wraps(value: IStaticValue): boolean {
    const wraps = (expr: TConstExpr): boolean => {
      switch (expr.kind) {
        case "binary":
          return (
            WRAPPING_OPERATORS.has(expr.op) ||
            wraps(expr.left) ||
            wraps(expr.right)
          );
        case "unary":
          return expr.op === "-" || wraps(expr.operand);
        case "cast":
          return wraps(expr.operand);
        case "ternary":
          return (
            wraps(expr.condition) ||
            wraps(expr.whenTrue) ||
            wraps(expr.whenFalse)
          );
        default:
          return false;
      }
    };
    return wraps(ConstExprLowering.lower(value.value));
  }

  /** The value's outermost form, which says what does not fit */
  static formOf(value: IStaticValue): TConstExpr["kind"] {
    return ConstExprLowering.lower(value.value).kind;
  }

  /**
   * Whether the value reads a variable, `const` or not: what C rejects in a
   * static initializer, where an enum member or a length property is not
   */
  static readsVariable(
    value: TExpression,
    program: IProgram,
    sourceFile: string,
  ): boolean {
    return StaticInitializers.bindings(value, program, sourceFile).some(
      ({ binding }) => binding.kind === "variable" || binding.kind === "local",
    );
  }

  /**
   * What each name the value reads binds to, and where it is written; a
   * length property's subject is a size, which C is never asked to read
   */
  static bindings(
    value: TExpression,
    program: IProgram,
    sourceFile: string,
  ): { readonly binding: TValueBinding; readonly at: ISourcePosition }[] {
    return StaticInitializers.names(ConstExprLowering.lower(value)).flatMap(
      (name) => {
        if (LengthProperty.isLength(name.path.at(-1) ?? "")) return [];
        const target = program.constantTargetOf(sourceFile, name);
        return target === null
          ? []
          : [{ binding: target.binding, at: name.at }];
      },
    );
  }

  /**
   * Whether C has a value cnx does not: a char literal, or a name only a
   * header declares, reached directly or through the consts it is read from
   */
  static cHasValue(settled: TSettledConst): boolean {
    if (settled.kind === "foreign") return true;
    if (settled.kind !== "notConstant") return false;
    if (settled.reason === "character") return true;
    return settled.reason === "unfolded" && settled.because !== undefined
      ? StaticInitializers.cHasValue(settled.because)
      : false;
  }

  /**
   * The const a value names alone, as `CH` or `S.LIMIT` -- what C is given
   * when cnx has no value for it but C does (`cHasValue`) -- or null
   */
  static namedConst(
    value: TExpression,
    program: IProgram,
    sourceFile: string,
  ): IVariableSymbol | null {
    const lowered = ConstExprLowering.lower(value);
    if (lowered.kind !== "name") return null;
    const target = program.constantTargetOf(sourceFile, lowered);
    return target?.binding.kind === "variable" && target.rest.length === 0
      ? target.binding.symbol
      : null;
  }

  /** Each bare name the value reads (`N`, not `this.N` or `S.N`) */
  static bareNames(value: TExpression): TConstName[] {
    return StaticInitializers.names(ConstExprLowering.lower(value)).filter(
      (name) => name.root === null && name.path.length === 1,
    );
  }

  private static names(expr: TConstExpr): TConstName[] {
    switch (expr.kind) {
      case "name":
        return [expr];
      case "cast":
      case "unary":
        return StaticInitializers.names(expr.operand);
      case "binary":
        return [
          ...StaticInitializers.names(expr.left),
          ...StaticInitializers.names(expr.right),
        ];
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse].flatMap(
          StaticInitializers.names,
        );
      default:
        return [];
    }
  }

  /** The file's file-scope and scope variables that have an initializer */
  private static declarations(
    declaration: TMemberDeclaration,
  ): IStaticValue["declaration"][] {
    return declaration.kind === "variableDeclaration" && declaration.initializer
      ? [declaration]
      : [];
  }

  /** The values an initializer holds: an array's elements, a struct's fields */
  private static leaves(expr: TExpression): TExpression[] {
    switch (expr.kind) {
      case "arrayInitializer":
        return expr.fill === null
          ? expr.elements.flatMap(StaticInitializers.leaves)
          : StaticInitializers.leaves(expr.fill);
      case "structInitializer":
        return expr.fields.flatMap((field) =>
          StaticInitializers.leaves(field.value),
        );
      default:
        return [expr];
    }
  }

  /** The number or bool type the value's position holds it at, or null */
  private static typeAt(
    positions: ReadonlyMap<TExpression, IValuePosition>,
    value: TExpression,
  ): string | null {
    const typeText = ValuePositions.at(positions, value).typeText;
    if (typeText === null) return null;
    const typeName = TypeText.withoutDimensions(typeText);
    return TypeCheckUtils.isInteger(typeName) ||
      TypeCheckUtils.isFloat(typeName) ||
      typeName === "bool"
      ? typeName
      : null;
  }

  /** A literal is written as it stands, so it keeps its notation (`0xAB`) */
  private static isLiteral(value: TExpression): boolean {
    return (
      value.kind === "literal" ||
      (value.kind === "unary" &&
        value.operator === "-" &&
        value.operand.kind === "literal")
    );
  }
}

export default StaticInitializers;
