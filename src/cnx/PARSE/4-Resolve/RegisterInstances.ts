import type TSymbol from "../../types/symbols/TSymbol";
import type IRegisterSymbol from "../../types/symbols/IRegisterSymbol";
import type IRegisterMemberSymbol from "../../types/symbols/IRegisterMemberSymbol";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type TConstExpr from "../../types/TConstExpr";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import RegisterLayout from "../../utils/RegisterLayout";
import type ITargetWidths from "../../types/ITargetWidths";
import TypeResolver from "../../utils/TypeResolver";
import ScopeFunctions from "./ScopeFunctions";
import type IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import type IParameterInfo from "../../types/symbols/IParameterInfo";
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
    widths: ITargetWidths,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const types = new Map<string, IRegisterSymbol>();
    const bitmapBitWidth = RegisterInstances.namedTypeBits(
      symbolsByFile,
      widths,
    );
    const taken = RegisterInstances.parameterTypeNames(symbolsByFile);
    const settled = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, symbols] of symbolsByFile) {
      const env = environmentOf(sourceFile);
      settled.set(
        sourceFile,
        symbols.map((symbol) => {
          if (symbol.kind !== "register" || symbol.addressExpr !== null) {
            return symbol;
          }
          const type = {
            ...RegisterInstances.withOffsets(
              symbol,
              env,
              widths,
              bitmapBitWidth,
            ),
            isParameterLayout: taken.has(symbol.fullyQualifiedCName),
          };
          types.set(type.fullyQualifiedCName, type);
          return type;
        }),
      );
    }
    const instanced = new Set<string>();
    for (const symbols of settled.values()) {
      for (const symbol of symbols) {
        const type = RegisterInstances.typeOf(symbol, types);
        if (type !== null) instanced.add(type.fullyQualifiedCName);
      }
    }
    for (const [sourceFile, symbols] of settled) {
      settled.set(
        sourceFile,
        symbols.map((symbol) => {
          if (symbol.kind !== "register" || symbol.addressExpr !== null) {
            return symbol;
          }
          const type = {
            ...symbol,
            isHardwareLayout:
              symbol.isParameterLayout ||
              instanced.has(symbol.fullyQualifiedCName),
          };
          types.set(type.fullyQualifiedCName, type);
          return type;
        }),
      );
    }
    const result = new Map<string, ReadonlyArray<TSymbol>>();
    const stamped = new Map<TSymbol, TSymbol>();
    for (const [sourceFile, symbols] of settled) {
      const env = environmentOf(sourceFile);
      const bound = symbols.map((symbol) => {
        if (symbol.kind === "function") {
          const withStamp = RegisterInstances.withRegisterParameters(
            symbol,
            types,
          );
          stamped.set(symbol, withStamp);
          return withStamp;
        }
        const type = RegisterInstances.typeOf(symbol, types);
        return type === null || symbol.kind !== "variable"
          ? symbol
          : RegisterInstances.instance(symbol, type, env);
      });
      ScopeFunctions.adopt(bound, stamped);
      result.set(sourceFile, bound);
    }
    return result;
  }

  /**
   * Each bitmap's and enum's bit width, by C name: a bitmap member is its
   * backing integer, an enum member as wide as the target's compiler makes
   * the enum (ruling 14)
   */
  private static namedTypeBits(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    targetWidths: ITargetWidths,
  ): Map<string, number> {
    const bits = new Map<string, number>();
    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        if (symbol.kind === "bitmap") {
          bits.set(symbol.fullyQualifiedCName, symbol.bitWidth);
        }
        if (symbol.kind === "enum") {
          const values = [...symbol.members.values()].map(
            (member) => member.value ?? 0,
          );
          const enumBits = RegisterLayout.enumBits(values, targetWidths);
          if (enumBits !== null) bits.set(symbol.fullyQualifiedCName, enumBits);
        }
      }
    }
    return bits;
  }

  /** Every type name some function's parameter is declared with */
  private static parameterTypeNames(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
  ): Set<string> {
    const names = new Set<string>();
    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        if (symbol.kind !== "function") continue;
        for (const parameter of symbol.parameters) {
          names.add(TypeResolver.getTypeName(parameter.type));
        }
      }
    }
    return names;
  }

  /** A function with each parameter of a register type stamped `isRegister` */
  private static withRegisterParameters(
    func: IFunctionSymbol,
    types: ReadonlyMap<string, IRegisterSymbol>,
  ): IFunctionSymbol {
    const isRegister = (parameter: IParameterInfo): boolean =>
      types.has(TypeResolver.getTypeName(parameter.type));
    if (!func.parameters.some(isRegister)) return func;
    return {
      ...func,
      parameters: func.parameters.map((parameter) =>
        isRegister(parameter) ? { ...parameter, isRegister: true } : parameter,
      ),
    };
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
    widths: ITargetWidths,
    bitmapBitWidth: ReadonlyMap<string, number>,
  ): IRegisterSymbol {
    const members = new Map<string, IRegisterMemberSymbol>();
    for (const [name, member] of type.members) {
      const offsetValue = RegisterInstances.fold(member.offset, env);
      members.set(name, {
        ...member,
        offsetValue,
        bytes: RegisterLayout.bytesOf(member, widths, bitmapBitWidth),
        layoutUnion:
          member.group === null || offsetValue === null
            ? null
            : RegisterLayout.groupName(offsetValue),
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
      isParameterLayout: false,
      isHardwareLayout: false,
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
