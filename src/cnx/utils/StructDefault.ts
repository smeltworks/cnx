/**
 * ADR-029 section 3 "Never Null": which fields of a struct hold something
 * other than zero when a value of it is declared without an initializer.
 *
 * A callback field holds the function its type was defined from, an enum
 * field its zero enumerator (ADR-017, #1971: the member whose value is 0, else
 * the first), and a field whose type is itself such a struct holds that
 * struct's default -- at any depth, and for every element of an array field.
 * Every other field is zero (ADR-015), which the aggregate brace already gives.
 *
 * #1283 / #1570 / #1565: this is one decision with three readers -- the
 * declaration-site initializer, the generated `<Struct>_init()` and the E0381
 * analyzer -- so it is asked here rather than worked out at each. It reads the
 * whole-program struct table (`structFields`, populated by 1.3 Declare for
 * every struct this file can see: top-level, scope-nested and included), not
 * the set of init functions generated so far, so the answer cannot depend on
 * the order the structs are declared in (#1570).
 */
import type IStructDefaultFacts from "../types/IStructDefaultFacts";
import type IStructFieldDefault from "../types/IStructFieldDefault";
import type ICodeGenSymbols from "../types/ICodeGenSymbols";
import type TType from "../types/TType";
import EnumZeroValue from "./EnumZeroValue";

class StructDefault {
  /**
   * The fields of `structName` whose default is not zero, in declaration
   * order. Empty when the whole struct defaults to zero, including when
   * `structName` is not a struct at all.
   */
  static fieldsOf(
    structName: string,
    facts: IStructDefaultFacts,
  ): readonly IStructFieldDefault[] {
    const fields = facts.structFields.get(structName);
    if (!fields) {
      return [];
    }
    const result: IStructFieldDefault[] = [];
    for (const [fieldName, typeName] of fields) {
      const value = StructDefault.defaultOf(typeName, facts);
      if (value !== null) {
        result.push({ fieldName, value });
      }
    }
    return result;
  }

  /**
   * The facts every reader asks this with (#1283 review), so 2.1 and 3 cannot
   * disagree on what a callback is: the 1.3 struct table, and the cnx
   * functions (`functionReturnTypes`, which 1.3 fills from cnx functions
   * only -- the set codegen's `callbackTypes` is registered from).
   */
  static factsOf(
    symbols: Pick<
      ICodeGenSymbols,
      | "structFields"
      | "functionReturnTypes"
      | "knownEnums"
      | "enumMembers"
      | "memberCNames"
    >,
  ): IStructDefaultFacts {
    return {
      structFields: symbols.structFields,
      isCallbackType: (typeName) => symbols.functionReturnTypes.has(typeName),
      enumZeroOf: (typeName) =>
        symbols.knownEnums.has(typeName)
          ? EnumZeroValue.of(symbols, typeName)
          : null,
    };
  }

  /**
   * The C name of an array's element type when every element is spelled --
   * one whose default is not zero (`defaultOf`) -- or null for an array whose
   * aggregate zero needs no element count.
   */
  static spelledElement(
    type: TType,
    facts: IStructDefaultFacts,
  ): string | null {
    const element = type.kind === "array" ? type.elementType : type;
    if (!("name" in element)) {
      return null;
    }
    return StructDefault.defaultOf(element.name, facts) === null
      ? null
      : element.name;
  }

  /** Does a value of `structName` hold anything other than zero by default? */
  static hasDefault(structName: string, facts: IStructDefaultFacts): boolean {
    return StructDefault.fieldsOf(structName, facts).length > 0;
  }

  /** A value of `typeName`'s non-zero default, or null when it is zero. */
  static defaultOf(
    typeName: string,
    facts: IStructDefaultFacts,
  ): IStructFieldDefault["value"] | null {
    if (facts.isCallbackType(typeName)) {
      return { kind: "callback", functionName: typeName };
    }
    const enumerator = facts.enumZeroOf(typeName);
    if (enumerator !== null) {
      return { kind: "enum", enumerator };
    }
    // E0426 rejects a type named before its definition (ADR-030, #1981), so a
    // struct cannot hold itself by value and this recursion is bounded by the
    // nesting depth the program declares.
    if (StructDefault.hasDefault(typeName, facts)) {
      return { kind: "struct", structName: typeName };
    }
    return null;
  }
}

export default StructDefault;
