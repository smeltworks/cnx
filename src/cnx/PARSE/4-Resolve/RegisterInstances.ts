import type TSymbol from "../../types/symbols/TSymbol";
import type IRegisterSymbol from "../../types/symbols/IRegisterSymbol";
import type IRegisterMemberSymbol from "../../types/symbols/IRegisterMemberSymbol";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type TConstExpr from "../../types/TConstExpr";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import MemberSymbolBase from "../3-Declare/cnx/utils/MemberSymbolBase";

/**
 * ADR-072 Part 1: `register GpioPort { ... }` declares a TYPE, and
 * `GpioPort GPIO1(0x401B8000);` an instance of it at a fixed address.
 *
 * 1.3 cannot tell the instance from a C++ constructor call (#375): whether
 * `GpioPort` is a register is a cross-file fact. This is the first layer that
 * knows, so it decides once. An instance becomes a register symbol carrying
 * the type's members, re-parented to the instance so their C names are
 * `GPIO1__DR`, and its address and every offset folded to a number here --
 * nothing later evaluates one.
 */
class RegisterInstances {
  static bind(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    environmentOf: (sourceFile: string) => IConstantEnvironment,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const types = new Map<string, IRegisterSymbol>();
    const settled = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, symbols] of symbolsByFile) {
      const env = environmentOf(sourceFile);
      settled.set(
        sourceFile,
        symbols.map((symbol) => {
          if (symbol.kind !== "register" || symbol.addressExpr !== null) {
            return symbol;
          }
          const type = RegisterInstances.withOffsets(symbol, env);
          types.set(type.fullyQualifiedCName, type);
          return type;
        }),
      );
    }
    const result = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, symbols] of settled) {
      const env = environmentOf(sourceFile);
      result.set(
        sourceFile,
        symbols.map((symbol) => {
          const type = RegisterInstances.typeOf(symbol, types);
          return type === null || symbol.kind !== "variable"
            ? symbol
            : RegisterInstances.instance(symbol, type, env);
        }),
      );
    }
    return result;
  }

  /** The register type a constructed variable is an instance of, if any */
  private static typeOf(
    symbol: TSymbol,
    types: ReadonlyMap<string, IRegisterSymbol>,
  ): IRegisterSymbol | null {
    if (symbol.kind !== "variable" || !symbol.constructedAddress) return null;
    const type = symbol.type;
    // TODO(#1720): restore the kind check once TypeResolver settles kinds.
    // TypeResolver guesses a kind from the spelling (`EXTI_Type` reads as an
    // enum), so the register type is found by name alone
    if (!("name" in type) || typeof type.name !== "string") return null;
    return types.get(type.name) ?? null;
  }

  /** A register type with every offset folded where it is written */
  private static withOffsets(
    type: IRegisterSymbol,
    env: IConstantEnvironment,
  ): IRegisterSymbol {
    const members = new Map<string, IRegisterMemberSymbol>();
    for (const [name, member] of type.members) {
      members.set(name, {
        ...member,
        offsetValue: RegisterInstances.fold(member.offset, env),
      });
    }
    return { ...type, members };
  }

  private static instance(
    variable: IVariableSymbol,
    type: IRegisterSymbol,
    env: IConstantEnvironment,
  ): IRegisterSymbol {
    const addressExpr = variable.constructedAddress!;
    const members = new Map<string, IRegisterMemberSymbol>();
    for (const [name, member] of type.members) {
      members.set(name, {
        ...member,
        ...MemberSymbolBase.of({
          kind: "register_member" as const,
          name,
          parentScopedName: variable.cnxScopedName,
          memberSpan: member.span,
          sourceFile: member.sourceFile,
          visibility: member.visibility,
        }),
      });
    }
    return {
      kind: "register",
      name: variable.name,
      scopePath: variable.scopePath,
      fullyQualifiedCName: variable.fullyQualifiedCName,
      cnxScopedName: variable.cnxScopedName,
      sourceFile: variable.sourceFile,
      span: variable.span,
      sourceLanguage: variable.sourceLanguage,
      visibility: variable.visibility,
      registerType: type.fullyQualifiedCName,
      addressExpr,
      baseAddress: RegisterInstances.fold(addressExpr, env),
      members,
    };
  }

  /** A compile-time constant's value; null when it is not one */
  private static fold(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): bigint | null {
    const result = ConstantEvaluator.evaluate(expr, env);
    return result.kind === "value" ? result.value : null;
  }
}

export default RegisterInstances;
