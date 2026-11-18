import type ISourceSpan from "../ISourceSpan";
import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";

/** One operation of a postfix chain, as the grammar's `postfixOp` */
type TPostfixOpSyntax = ISyntaxNode &
  (
    | {
        readonly kind: "member";
        readonly name: string;
        /** The name's own token; `span` covers the `.` too */
        readonly nameSpan: ISourceSpan;
      }
    | {
        readonly kind: "subscript";
        /**
         * `x[start, length]` (ADR-007 §1). `x[start]` is `x[start, 1]`, so a
         * length left out is lowered as the literal `1`: no pass can tell the
         * two spellings apart, and none may.
         */
        readonly start: TExpression;
        readonly length: TExpression;
      }
    | { readonly kind: "call"; readonly arguments: readonly TExpression[] }
    /** Where the parser recovered from an error; see `TExpression`'s */
    | { readonly kind: "missing" }
  );

export default TPostfixOpSyntax;
