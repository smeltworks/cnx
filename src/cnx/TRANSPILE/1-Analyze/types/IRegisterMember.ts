/**
 * A register member (ADR-004) a chain names, as the typer resolved it.
 */
interface IRegisterMember {
  /** The member's key in `registerMemberAccess`, e.g. `Board__R__ST`. */
  readonly key: string;
  /** The C name of the register the member belongs to. */
  readonly register: string;
  /** The access modifier declared on the member. */
  readonly access: string;
  /** The member name as written, e.g. `ST`. */
  readonly member: string;
  /** The chain up to the member as written, e.g. `this.R.ST`. */
  readonly spelling: string;
}

export default IRegisterMember;
