import type IPlannedWholeArrayWrite from "./IPlannedWholeArrayWrite";

/**
 * How an argument passed by reference is written, and the C type that form
 * writes (#1991): 2.3 writes it this way, and 2.2 plans the C type from the
 * same answer.
 */
type TArgumentForm =
  /** A bare name: a parameter or an array as is, anything else by address */
  | { readonly kind: "identifier" }
  /** An array, which decays without `&`: a member, or a ternary of arrays */
  | { readonly kind: "array" }
  /** C++: a member converted through a `cType` temporary (#256) */
  | { readonly kind: "member-temp"; readonly cType: string }
  /** An lvalue by address, a string's element cast to `cast*` (#246) */
  | { readonly kind: "lvalue"; readonly cast: string | null }
  /** A value, in C a `compoundLiteral` `&(T){value}` */
  | { readonly kind: "rvalue"; readonly compoundLiteral: string | null }
  /** C: a struct literal, by the address of its own compound literal (#1530) */
  | { readonly kind: "literal-address" }
  // ADR-072: a register instance, as a pointer to its layout
  | { readonly kind: "register"; readonly pointer: string }
  /** #2157: a list for an array parameter, passed as a temporary of its shape */
  | { readonly kind: "array-temp"; readonly array: IPlannedWholeArrayWrite }
  /**
   * #2239: a concatenation or a substring for a `string<N>` parameter, built
   * into a `string<capacity>` temporary before the statement and passed as it
   */
  | { readonly kind: "string-built"; readonly capacity: number };

export default TArgumentForm;
