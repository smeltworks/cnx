import CppNamespaceUtils from "./CppNamespaceUtils";
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
    isCppNamespace = false,
  ): string {
    const members = symbols.enumMembers.get(enumName);
    if (!members) {
      return `(${enumName})0`;
    }

    for (const [memberName, value] of members.entries()) {
      if (value === 0) {
        return EnumZeroValue.memberOf(
          symbols,
          enumName,
          memberName,
          isCppNamespace,
        );
      }
    }

    const firstMember = members.keys().next().value;
    if (firstMember) {
      return EnumZeroValue.memberOf(
        symbols,
        enumName,
        firstMember,
        isCppNamespace,
      );
    }

    return `(${enumName})0`;
  }

  /** The C name 3-Declare gave `member` of `enumName` (`::` for C++, #388) */
  private static memberOf(
    symbols: Pick<ICodeGenSymbols, "memberCNames">,
    enumName: string,
    member: string,
    isCppNamespace: boolean,
  ): string {
    if (isCppNamespace) {
      return CppNamespaceUtils.fromParts([enumName, member]);
    }
    const cName = symbols.memberCNames.get(enumName)?.get(member);
    invariant(
      cName !== undefined,
      `3-Declare names every member of '${enumName}' (missing '${member}')`,
    );
    return cName;
  }
}

export default EnumZeroValue;
