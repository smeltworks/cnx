import type IProgram from "../types/IProgram";
import type IVariableSymbol from "../types/symbols/IVariableSymbol";
import type TConstLiteral from "../types/TConstLiteral";
import type TSettledConst from "../types/TSettledConst";
import ConstantFold from "./ConstantFold";

/**
 * The C constant a const is written as where its value is used, or null when
 * it has none C can take: the one answer to "is this a const with a value".
 * Render spells the use from it (`PrivateConstValue`), and 2.1 asks it of a
 * case label (E0717), so a label 2.1 accepts is one render can write (#2051
 * review: the two decided it separately, and a string const passed E0717 to
 * reach gcc as `case Panel__S:`).
 *
 * An integer is its literal's notation or its settled digits, a float its
 * value held at its type, a bool `true`/`false`, an enum-typed const its
 * member, a char literal that literal and a header macro named alone that
 * macro. A string, an array or an initializer 1.4 could not settle is null.
 */
class ConstLiteral {
  static textOf(program: IProgram, symbol: IVariableSymbol): string | null {
    const literal = ConstLiteral.of(program, symbol);
    return literal === null ? null : ConstLiteral.spell(literal);
  }

  /** The const's answer before C spells it, or null when it has none */
  static of(program: IProgram, symbol: IVariableSymbol): TConstLiteral | null {
    if (
      !ConstantFold.hasCompileTimeValue(symbol) ||
      symbol.isArray ||
      symbol.initialValueExpr === undefined ||
      symbol.initialValue === undefined
    ) {
      return null;
    }
    return ConstLiteral.literalOf(
      program,
      symbol,
      program.settledConstOf(symbol.fullyQualifiedCName),
    );
  }

  /** How C writes the answer */
  private static spell(literal: TConstLiteral): string {
    switch (literal.kind) {
      case "member":
        return literal.cName;
      case "macro":
        // parenthesized, as its expansion may not be one operand
        return `(${literal.name})`;
      case "integer":
      case "float":
      case "bool":
      case "char":
        return literal.text;
      default: {
        const unhandled: never = literal;
        return unhandled;
      }
    }
  }

  /** The literal the const's settled value is */
  private static literalOf(
    program: IProgram,
    symbol: IVariableSymbol,
    settled: TSettledConst | null,
  ): TConstLiteral | null {
    if (settled?.kind === "value") {
      return {
        kind: "integer",
        digits: settled.digits,
        text: ConstLiteral.integerText(symbol, settled.digits),
      };
    }
    return (
      ConstLiteral.valueLiteral(program, settled) ??
      ConstLiteral.unsettledLiteral(symbol, settled)
    );
  }

  /**
   * #1735: how C writes a settled value that has no declaration of its own,
   * such as one value in a static-storage initializer: an integer is its
   * digits. Null when it has no value C can take.
   */
  static textOfValue(
    program: IProgram,
    settled: TSettledConst | null,
  ): string | null {
    const literal = ConstLiteral.valueLiteral(program, settled);
    return literal === null ? null : ConstLiteral.spell(literal);
  }

  /** The literal a value is, or null when it has none */
  private static valueLiteral(
    program: IProgram,
    settled: TSettledConst | null,
  ): TConstLiteral | null {
    switch (settled?.kind) {
      case "value":
        return {
          kind: "integer",
          digits: settled.digits,
          text: settled.digits,
        };
      case "float": {
        const text = ConstLiteral.floatText(settled);
        return text === null ? null : { kind: "float", text };
      }
      case "bool":
        return { kind: "bool", text: settled.value ? "true" : "false" };
      case "named": {
        const cName = ConstLiteral.enumMember(program, settled);
        return cName === null ? null : { kind: "member", cName };
      }
      default:
        return null;
    }
  }

  /**
   * A constant 1.4 has no value for, which C does: a char literal, and a
   * header macro named alone (parenthesized, as its expansion may not be one
   * operand). Anything else is null.
   */
  private static unsettledLiteral(
    symbol: IVariableSymbol,
    settled: TSettledConst | null,
  ): TConstLiteral | null {
    const expr = symbol.initialValueExpr!;
    if (
      settled?.kind === "notConstant" &&
      settled.reason === "character" &&
      expr.kind === "other" &&
      expr.what === "character"
    ) {
      return { kind: "char", text: symbol.initialValue! };
    }
    if (
      settled?.kind === "foreign" &&
      expr.kind === "name" &&
      expr.root === null &&
      expr.path.length === 1
    ) {
      return { kind: "macro", name: expr.path[0] };
    }
    return null;
  }

  /** A literal initializer keeps its notation (`0xAB`); the rest are digits */
  private static integerText(symbol: IVariableSymbol, digits: string): string {
    const expr = symbol.initialValueExpr!;
    return expr.kind === "literal" ? expr.text : digits;
  }

  /**
   * The shortest decimal that is the value at its type: an f32's is suffixed,
   * so C reads it as the float the const holds, not as a double.
   */
  private static floatText(
    settled: Extract<TSettledConst, { kind: "float" }>,
  ): string | null {
    const value = Number(settled.digits);
    if (!Number.isFinite(value)) return null;
    if (Object.is(value, -0)) return `-0.0${settled.typeName}`;
    const shortest =
      settled.typeName === "f32"
        ? ConstLiteral.shortestF32(value)
        : String(value);
    const spelled = /[.eE]/.test(shortest) ? shortest : `${shortest}.0`;
    return `${spelled}${settled.typeName}`;
  }

  /** Nine significant digits always reach a float, so the loop ends */
  private static shortestF32(value: number): string {
    let digits = 1;
    while (Math.fround(Number(value.toPrecision(digits))) !== value) digits++;
    return String(Number(value.toPrecision(digits)));
  }

  /** The member of the const's enum that has its value */
  private static enumMember(
    program: IProgram,
    settled: Extract<TSettledConst, { kind: "named" }>,
  ): string | null {
    const enumSymbol = program.symbolByCName(settled.typeName);
    if (enumSymbol?.kind !== "enum") return null;
    const members = [...enumSymbol.members.values()];
    const index = program
      .enumMemberValues(settled.typeName)
      .findIndex(
        (member) =>
          member.kind === "value" && member.value.toString() === settled.digits,
      );
    return index < 0 ? null : members[index].fullyQualifiedCName;
  }
}

export default ConstLiteral;
