import type ICppEnumSyntax from "./ICppEnumSyntax";
import type TCppMemberSyntax from "./TCppMemberSyntax";
import type ICppMemberTemplate from "../../../types/symbols/cpp/ICppMemberTemplate";

/** A C++ class or struct specifier as 1.2 lowers it (#1991) */
interface ICppClassSyntax {
  /** Null for an anonymous one, `typedef struct { ... } T;` */
  readonly name: string | null;
  /** Null when the specifier has no member specification */
  readonly members: readonly TCppMemberSyntax[] | null;
  /** #1975 review: the layout facts a length needs, `union`, `: Base`, ... */
  readonly isUnion: boolean;
  readonly hasBase: boolean;
  /** #2510 review: each base as written, `cfg::Limits` or `Limits<3>` */
  readonly bases: readonly string[];
  /** A virtual member function, so C++ adds a vtable pointer */
  readonly hasVirtual: boolean;
  readonly hasBitField: boolean;
  /** `union { ... };`, a member whose fields `members` does not list */
  readonly hasUnnamedMember: boolean;
  /** #2473 review: its member templates, which 1.3 does not declare */
  readonly templateMembers: readonly ICppMemberTemplate[];
  /** #2510 review: the enums its body defines, whose constants it scopes */
  readonly enums: readonly ICppEnumSyntax[];
}

export default ICppClassSyntax;
