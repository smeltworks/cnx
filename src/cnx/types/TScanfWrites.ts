import type TExpression from "./syntax/TExpression";

/** What a call's format says it writes (`ScanfFormat`, #2117) */
type TScanfWrites =
  /** Not a call to a C standard scanf-family function */
  | { readonly kind: "not-scanf" }
  /** A scanf-family call whose format is not a string literal */
  | { readonly kind: "format-not-literal"; readonly format: TExpression }
  /** The arguments the literal format's conversions fill, by index */
  | { readonly kind: "literal"; readonly written: ReadonlySet<number> };

export default TScanfWrites;
