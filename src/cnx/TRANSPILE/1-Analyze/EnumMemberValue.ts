/**
 * Enum Member Value
 *
 * Inside an enum's own member values, a member of that enum is an `i32`
 * (ADR-017 owner rulings, 2026-10-03), so `RW <- Perm.READ | Perm.WRITE`
 * needs no cast. Rule 10.1 (E0925 and E0805) and Rule 10.4 (E0810) read
 * their operands through here, so they cannot disagree about such a member.
 */

import DeclarationParts from "../../utils/DeclarationParts";
import ScopeUtils from "../../utils/ScopeUtils";
import type IOperandType from "../../types/IOperandType";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";

type TEnumPart = readonly [part: TSyntaxPart, enumBeingDeclared: string | null];

class EnumMemberValue {
  /**
   * Every declaration's parts, each with the C name of the enum whose member
   * values it is part of, or null -- through scopes, where `Perm` in
   * `scope Motor` is `Motor__Perm`.
   */
  static parts(program: IProgramSyntax): readonly TEnumPart[] {
    return program.declarations.flatMap((member) =>
      EnumMemberValue.partsOf(member.declaration, ""),
    );
  }

  private static partsOf(
    declaration: TDeclarationSyntax,
    scopePath: string,
  ): readonly TEnumPart[] {
    if (declaration.kind === "scope") {
      const path =
        scopePath === ""
          ? declaration.name
          : `${scopePath}.${declaration.name}`;
      return declaration.members.flatMap((member) =>
        EnumMemberValue.partsOf(member.declaration, path),
      );
    }
    const enumBeingDeclared =
      declaration.kind === "enum"
        ? ScopeUtils.qualifyInScope(declaration.name, scopePath)
        : null;
    return DeclarationParts.of(declaration).map(
      (part): TEnumPart => [part, enumBeingDeclared],
    );
  }

  /** The operand as it reads where `enumBeingDeclared`'s values are given */
  static operandType(
    operand: IOperandType | null,
    enumBeingDeclared: string | null,
  ): IOperandType | null {
    if (
      operand?.category !== "enum" ||
      enumBeingDeclared === null ||
      operand.enumTypeName !== enumBeingDeclared
    ) {
      return operand;
    }
    return { ...operand, category: "signed" };
  }
}

export default EnumMemberValue;
