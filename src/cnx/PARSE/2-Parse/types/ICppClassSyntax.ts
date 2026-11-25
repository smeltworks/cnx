import type TCppMemberSyntax from "./TCppMemberSyntax";

/** A C++ class or struct specifier as 1.2 lowers it (#1991) */
interface ICppClassSyntax {
  /** Null for an anonymous one, `typedef struct { ... } T;` */
  readonly name: string | null;
  /** Null when the specifier has no member specification */
  readonly members: readonly TCppMemberSyntax[] | null;
  /** #1975 review: the layout facts a length needs, `union`, `: Base`, ... */
  readonly isUnion: boolean;
  readonly hasBase: boolean;
  /** A virtual member function, so C++ adds a vtable pointer */
  readonly hasVirtual: boolean;
  readonly hasBitField: boolean;
  /** `union { ... };`, a member whose fields `members` does not list */
  readonly hasUnnamedMember: boolean;
  /** #2473 review: the names of its member templates, which 1.3 does not declare */
  readonly templateMembers: readonly string[];
}

export default ICppClassSyntax;
