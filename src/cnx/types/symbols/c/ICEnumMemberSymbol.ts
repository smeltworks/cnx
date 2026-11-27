import type ICBaseSymbol from "./ICBaseSymbol";

/**
 * Symbol representing a C enum member.
 */
interface ICEnumMemberSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "enum_member" */
  readonly kind: "enum_member";

  /** Parent enum name; null for an anonymous enum's constant */
  readonly parent: string | null;

  /** Optional explicit value */
  readonly value?: number;

  /**
   * #2510 review: declared by an enum inside a struct, which gives it file
   * scope in C and the struct's scope in C++
   */
  readonly inStruct?: true;
}

export default ICEnumMemberSymbol;
