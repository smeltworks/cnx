/**
 * What a const is written as where its value is used (`ConstLiteral`): the
 * one decision render spells and 2.1 keys a case label on, so the two cannot
 * read a const differently (#2085 review).
 */
type TConstLiteral =
  /** `digits` is the settled value; `text` its literal's notation (`0xAB`) */
  | { readonly kind: "integer"; readonly digits: string; readonly text: string }
  | { readonly kind: "float"; readonly text: string }
  | { readonly kind: "bool"; readonly text: string }
  /** An enum-typed const: the member of its enum that has its value */
  | { readonly kind: "member"; readonly cName: string }
  /** `casts`: the C types of its written casts, outermost first (#2372) */
  | {
      readonly kind: "char";
      readonly text: string;
      readonly casts: readonly string[];
    }
  /** A header macro named alone */
  | { readonly kind: "macro"; readonly name: string };

export default TConstLiteral;
