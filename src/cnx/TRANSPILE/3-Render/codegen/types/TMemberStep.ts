/**
 * How one member step of an access chain joins its member (#2116).
 *
 * A scope member and a register member become part of one C identifier
 * (ADR-016: `Motor.speed` -> `Motor__speed`); every other step keeps a C
 * operator between the two. A scope member's step carries the C name 3-Declare
 * gave it, so nothing here spells it again.
 */
type TMemberStep =
  | { readonly kind: "scope-member"; readonly cName: string }
  | { readonly kind: "register-member" }
  | { readonly kind: "access"; readonly separator: "." | "->" | "::" };

export default TMemberStep;
