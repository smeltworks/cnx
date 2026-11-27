/**
 * A value a C or C++ header declares, as 1.4 needs it for a constant
 * expression (#1175): a variable's element type and dimensions, which a
 * length property measures; or a function. Neither is a constant expression
 * in C -- not even an `extern const` object -- so neither is a dimension.
 */
type IForeignValue =
  | {
      readonly kind: "variable";
      /** The element's C type, which cnx does not measure */
      readonly type: string;
      /** Empty for a scalar */
      readonly dimensions: ReadonlyArray<number | string>;
      /**
       * #2514: unsized here, in a header the files that include it read
       * differently, so which bound C composes cnx cannot tell
       */
      readonly disputed?: true;
    }
  | { readonly kind: "function" };

export default IForeignValue;
