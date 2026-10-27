import type IProgram from "../types/IProgram";
import type TSymbol from "../types/symbols/TSymbol";
import type IEnumMemberSymbol from "../types/symbols/IEnumMemberSymbol";

/**
 * The symbol a qualified case label names, found by walking its chain from
 * the head's symbol: `EMode.IDLE`, `this.State.IDLE`, `Panel.LIMIT`,
 * `Panel.State.STOPPED`. A label is keyed and rendered by the symbol's
 * `fullyQualifiedCName`, so no pass spells the member's C name again (#2116).
 */
class CaseLabelSymbol {
  static of(
    program: Pick<IProgram, "symbolByCName" | "memberOf">,
    headCName: string,
    rest: readonly string[],
  ): TSymbol | IEnumMemberSymbol | undefined {
    let named: TSymbol | IEnumMemberSymbol | undefined =
      program.symbolByCName(headCName);
    for (const name of rest) {
      named = CaseLabelSymbol.memberOf(program, named, name);
    }
    return named;
  }

  /** ADR-016: a scope's members are found by its path, an enum's by name */
  private static memberOf(
    program: Pick<IProgram, "memberOf">,
    owner: TSymbol | IEnumMemberSymbol | undefined,
    name: string,
  ): TSymbol | IEnumMemberSymbol | undefined {
    switch (owner?.kind) {
      case "scope":
        return program.memberOf(owner.cnxScopedName, name);
      case "enum":
        return owner.members.get(name);
      default:
        return undefined;
    }
  }
}

export default CaseLabelSymbol;
