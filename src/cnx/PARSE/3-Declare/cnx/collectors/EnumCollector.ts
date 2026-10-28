/**
 * EnumCollector - Extracts enum type declarations from parse trees.
 * ADR-017: Enums provide named integer constants with auto-increment support.
 *
 * Produces TType-based IEnumSymbol with proper IScopeSymbol references.
 */

import type TDeclarationSyntax from "../../../../types/syntax/TDeclarationSyntax";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import ConstExprLowering from "../../../../utils/ConstExprLowering";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import type IEnumMemberSymbol from "../../../../types/symbols/IEnumMemberSymbol";
import MemberSymbolBase from "../utils/MemberSymbolBase";

class EnumCollector {
  /**
   * Collect an enum declaration and return an IEnumSymbol.
   *
   * @param syntax The enum declaration as 1.2 lowered it (#1991)
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this enum belongs to (dotted path, "" at file scope)
   * @param visibility ADR-016 visibility as declared (#1300)
   * @returns The enum symbol with proper scope reference. Each member's value
   *          is recorded as WRITTEN, and its number is left to 1.4 Resolve:
   *          a value may name a const or an earlier member (ADR-017 "Member
   *          Values"), and those settle across the whole program (#1669). A
   *          value 1.4 cannot settle, a negative one, or one outside `i32` is
   *          2.1 Analyze's to report.
   */
  static collect(
    syntax: Extract<TDeclarationSyntax, { kind: "enum" }>,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
  ): IEnumSymbol {
    const name = syntax.name;
    const span = syntax.span;

    const members = new Map<string, IEnumMemberSymbol>();

    // #1318: a member's identity hangs off the ENUM's source-spelled name, not
    // the enclosing scope's. `identityOf` then yields the identifier codegen
    // already emits -- EColor__RED, and Motor__EMode__HIGH for a scope-declared
    // enum, because fromSourceName expands the dotted component. Derived here once
    // rather than at each consumer (#1285).
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const enumScopedName = identity.cnxScopedName;

    for (const member of syntax.members) {
      const memberName = member.name;
      members.set(memberName, {
        ...MemberSymbolBase.of({
          kind: "enum_member" as const,
          name: memberName,
          parentScopedName: enumScopedName,
          memberSpan: member.span,
          sourceFile,
          visibility,
        }),
        valueExpr: member.value ? ConstExprLowering.lower(member.value) : null,
        value: null,
      });
    }

    return {
      kind: "enum",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      // #1318 review: the same identity the members were keyed by, not a
      // second call with the same arguments -- change one and the members
      // would keep the old parent name while this reported the new one.
      ...identity,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cnx,
      visibility,
      members,
    };
  }
}

export default EnumCollector;
