/**
 * ADR-058 (#1975 review 2): how a length property is answered for its
 * subject -- decided once by `LengthProperty.rule`, then folded by 1.4,
 * planned by 2.2 and written by 2.3.
 */
type TLengthRule =
  /** The declared, logical width or count: `LengthProperty.of` */
  | { readonly kind: "logical" }
  /** The characters of the type's name: `u32` is 3 */
  | { readonly kind: "spelling" }
  /** C's `sizeof`, for the C compiler to answer; a string's buffer, its terminator included (`string<8>` is 9) */
  | { readonly kind: "memory" }
  /** At runtime: an unsigned value's bits up to its highest 1 */
  | { readonly kind: "bits" }
  /** At runtime: an integer's characters in decimal, a `-` included */
  | { readonly kind: "decimal"; readonly signed: boolean }
  /** At runtime: the chars a string holds now, `strlen` */
  | { readonly kind: "string" }
  | {
      readonly kind: "error";
      readonly message: string;
      readonly helpText: string;
    };

export default TLengthRule;
