import CppNamespaceUtils from "./CppNamespaceUtils";
import QualifiedCName from "./QualifiedCName";

/**
 * ADR-017: the value an enum zero-initializes to -- the member whose value is
 * 0, else the first member. Shared by declaration-site zero-init and
 * `StructDefault` (#1283, #1971), which gives every enum field and array
 * element this value.
 */
class EnumZeroValue {
  static of(
    enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>,
    enumName: string,
    isCppNamespace = false,
  ): string {
    const members = enumMembers.get(enumName);
    if (!members) {
      return `(${enumName})0`;
    }

    for (const [memberName, value] of members.entries()) {
      if (value === 0) {
        return EnumZeroValue.memberOf(enumName, memberName, isCppNamespace);
      }
    }

    const firstMember = members.keys().next().value;
    if (firstMember) {
      return EnumZeroValue.memberOf(enumName, firstMember, isCppNamespace);
    }

    return `(${enumName})0`;
  }

  /** ADR-017 member of the enum whose C name is `enumName` (`::` for C++, #388) */
  private static memberOf(
    enumName: string,
    member: string,
    isCppNamespace: boolean,
  ): string {
    return isCppNamespace
      ? CppNamespaceUtils.fromParts([enumName, member])
      : QualifiedCName.fromSourceName([enumName, member]);
  }
}

export default EnumZeroValue;
