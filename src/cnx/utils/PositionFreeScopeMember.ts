import type IProgram from "../types/IProgram";

/**
 * The member kinds `bindValue` does not bind, so no position decides them: a
 * type, or a register (ADR-004 makes it a value, but the binder binds only
 * variables and functions)
 */
const POSITION_FREE_KINDS: ReadonlySet<string> = new Set([
  "struct",
  "enum",
  "bitmap",
  "register",
]);

/**
 * #1643 review: whether `name` is a member of the scope at `scopePath` that
 * the binder has no position for -- a type or a register. A variable or
 * function member is the binder's alone (`bindValue`, by position): `members`
 * has no position, so it would admit a variable whose declaration has not
 * closed. A member whose symbol is missing, or of any other kind, is not one:
 * this fails closed. The one place analysis and emission both decide it, so
 * they cannot read a name differently.
 */
class PositionFreeScopeMember {
  static is(
    members: ReadonlySet<string> | undefined,
    scopePath: string,
    name: string,
    program: Pick<IProgram, "symbolByCName">,
  ): boolean {
    if (!(members?.has(name) ?? false)) {
      return false;
    }
    const kind = program.memberOf(scopePath, name)?.kind;
    return kind !== undefined && POSITION_FREE_KINDS.has(kind);
  }
}

export default PositionFreeScopeMember;
