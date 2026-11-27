import type ICppBaseSymbol from "./ICppBaseSymbol";

/**
 * Symbol representing a C++ enum member.
 */
interface ICppEnumMemberSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "enum_member" */
  readonly kind: "enum_member";

  /** Optional explicit value */
  readonly value?: number;

  /** #2510 review: declared by an enum inside this class, which scopes it */
  readonly inStruct?: string;
}

export default ICppEnumMemberSymbol;
