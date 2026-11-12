/**
 * How an argument to a C or C++ function is written, decided by 2.2 from the
 * parameter the callee declares (#1991): 2.3 writes it this way.
 */
type TCArgumentForm =
  /** #937: a callback-promoted parameter, already the pointer it takes */
  | "promoted-handle"
  /**
   * Its address, for a pointer parameter one level deeper than the value, or
   * for a scanf-family conversion that fills it (#2117)
   */
  | "address-of"
  /** As it is written */
  | "as-written";

export default TCArgumentForm;
