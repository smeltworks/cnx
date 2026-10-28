/**
 * RegisterCollector - Extracts register block declarations from parse trees.
 * Registers provide typed access to memory-mapped I/O locations.
 *
 * Produces TType-based IRegisterSymbol with proper IScopeSymbol references.
 */

import type IRegisterDeclarationSyntax from "../../../../types/syntax/IRegisterDeclarationSyntax";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import type IRegisterMemberSymbol from "../../../../types/symbols/IRegisterMemberSymbol";
import TypeUtils from "../utils/TypeUtils";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import MemberSymbolBase from "../utils/MemberSymbolBase";
import type IDeclareTypeFacts from "../../types/IDeclareTypeFacts";

class RegisterCollector {
  /**
   * Collect a register declaration and return an IRegisterSymbol.
   *
   * @param syntax The register declaration, as 1.2 lowered it
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this register belongs to (dotted path, "" at file scope)
   * @param typeFacts ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The register symbol with proper scope reference
   */
  static collect(
    syntax: IRegisterDeclarationSyntax,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    typeFacts?: IDeclareTypeFacts,
  ): IRegisterSymbol {
    const name = syntax.name;
    const span = syntax.span;
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    const baseAddress = syntax.address;

    // Collect register members
    const members = new Map<string, IRegisterMemberSymbol>();
    // #1318: a member hangs off the REGISTER, not the enclosing scope.
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const ownerScopedName = identity.cnxScopedName;

    for (const member of syntax.members) {
      const memberName = member.name;
      const offset = member.offset;
      const accessMod = member.access;

      // #1514: the member's type is recorded, not judged. Whether it names a
      // bitmap is a cross-file fact -- the bitmap may be declared in an
      // included file -- so this file cannot answer it, and asking a per-file
      // set here read "not declared here" as "not a bitmap". A bare name
      // inside a scope may also name an included scope's type, which is why
      // this is `resolveType`: it defers that case to 1.4 Resolve (ADR-057).
      const type = TypeUtils.resolveType(member.type, scopePath, typeFacts);

      const memberInfo: IRegisterMemberSymbol = {
        ...MemberSymbolBase.of({
          kind: "register_member" as const,
          name: memberName,
          parentScopedName: ownerScopedName,
          memberSpan: member.span,
          sourceFile,
          visibility,
        }),
        offset,
        type,
        access: accessMod,
      };

      members.set(memberName, memberInfo);
    }

    return {
      kind: "register",
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
      baseAddress,
      members,
    };
  }
}

export default RegisterCollector;
