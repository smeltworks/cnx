/**
 * EnumCollector - Collects enum symbols from C parse trees.
 */

import type ICEnumSyntax from "../../../2-Parse/types/ICEnumSyntax";
import type ICEnumSymbol from "../../../../types/symbols/c/ICEnumSymbol";
import type ICEnumMemberSymbol from "../../../../types/symbols/c/ICEnumMemberSymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import type ISourceSpan from "../../../../types/ISourceSpan";

/**
 * Result of collecting an enum - includes both the enum symbol and its members.
 */
interface IEnumCollectorResult {
  /** Null for an anonymous enum, whose constants are still names a header declares */
  readonly enum: ICEnumSymbol | null;
  readonly members: ReadonlyArray<ICEnumMemberSymbol>;
}

class EnumCollector {
  /** An enum and its members; an anonymous enum has only members (#2117) */
  static collect(
    enumSyntax: ICEnumSyntax,
    sourceFile: string,
    span: ISourceSpan,
  ): IEnumCollectorResult {
    const name = enumSyntax.name || null;
    const enumSymbol: ICEnumSymbol | null =
      name === null
        ? null
        : {
            kind: "enum",
            name,
            sourceFile,
            span,
            sourceLanguage: ESourceLanguage.C,
            visibility: "public",
            members: enumSyntax.members.map((member) => ({
              name: member.name,
            })),
          };
    return {
      enum: enumSymbol,
      members: enumSyntax.members.map(
        (member): ICEnumMemberSymbol => ({
          kind: "enum_member",
          name: member.name,
          sourceFile,
          span: member.span,
          sourceLanguage: ESourceLanguage.C,
          visibility: "public",
          parent: name,
        }),
      ),
    };
  }
}

export default EnumCollector;
