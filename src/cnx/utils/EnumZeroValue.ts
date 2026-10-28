import invariant from "./invariant";
import ICodeGenSymbols from "../types/ICodeGenSymbols";

/**
 * ADR-017: the value an enum zero-initializes to -- the member whose value is
 * 0, else the first member. Shared by declaration-site zero-init and
 * `StructDefault` (#1283, #1971), which gives every enum field and array
 * element this value.
 */
class EnumZeroValue {
  static of(
    symbols: Pick<ICodeGenSymbols, "enumMembers" | "memberCNames">,
    enumName: string,
  ): string {
    const members = symbols.enumMembers.get(enumName);
    if (!members) {
      return `(${enumName})0`;
    }

    for (const [memberName, value] of members.entries()) {
      if (value === 0) {
        return EnumZeroValue.memberOf(symbols, enumName, memberName);
      }
    }

    const firstMember = members.keys().next().value;
    if (firstMember) {
      return EnumZeroValue.memberOf(symbols, enumName, firstMember);
    }

    return `(${enumName})0`;
  }

  /**
   * The C name 3-Declare gave `member` of `enumName`. Only a cnx enum has
   * members here, and its name is never `::`-spelled, so there is no C++
   * spelling to build (#2116).
   */
  private static memberOf(
    symbols: Pick<ICodeGenSymbols, "memberCNames">,
    enumName: string,
    member: string,
  ): string {
    const cName = symbols.memberCNames.get(enumName)?.get(member);
    invariant(
      cName !== undefined,
      `3-Declare names every member of '${enumName}' (missing '${member}')`,
    );
    return cName;
  }
}

export default EnumZeroValue;
