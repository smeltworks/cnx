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
}

export default ICEnumMemberSymbol;
