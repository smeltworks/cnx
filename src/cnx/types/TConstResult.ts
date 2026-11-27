import type ISourcePosition from "../utils/types/ISourcePosition";
import type IUnreadBitWidth from "./IUnreadBitWidth";

/**
 * What a `TConstExpr` is worth, by the one rule (#1175, #1669): the value the
 * same expression has when the program runs (ADR-044 "Values fixed at compile
 * time").
 *
 * - `value`: computed. `typeName` is the type the arithmetic happened at, or
 *   null when no operand gave it one.
 * - `notConstant`: something in it has no value while the program compiles.
 * - `overflow`: the arithmetic happens at `typeName`, which cannot hold the
 *   result, so at run time the program would clamp or wrap there.
 * - `float`: a float value, as IEEE arithmetic at `typeName` computes it --
 *   C's, with `FLT_EVAL_METHOD` 0 (ADR-051 §4). Not an integer constant, so
 *   `evaluate` reports it as `notConstant` "float"; `fold` and `numberValue`
 *   see it.
 * - `foreign`: it depends on a name only C knows the value of -- a macro. C can
 *   evaluate it where C
 *   allows (an array dimension); cnx cannot use it where it needs the value.
 */
type TConstResult =
  | {
      readonly kind: "value";
      readonly value: bigint;
      readonly typeName: string | null;
    }
  | {
      readonly kind: "notConstant";
      readonly reason:
        | "variable"
        | "parameter"
        | "function"
        | "call"
        | "scope"
        | "unfolded"
        | "laterMember"
        | "selfMember"
        | "unknown"
        | "subscript"
        | "float"
        | "string"
        | "character"
        | "initializer"
        | "address"
        | "member"
        | "undeclaredMember"
        | "leadingZero"
        | "sizeofExpression"
        | "lengthRule"
        | "divisionByZero"
        | "negativeShift"
        | "disputed"
        | "unreadMacro";
      /** The offending part as the source spells it, for a message */
      readonly spelling: string;
      readonly at: ISourcePosition | null;
      /** For an `unfolded` const: why its own initializer has no value */
      /** For `unreadMacro`: why cnx did not read a header array's macro dimension */
      readonly unread?: IUnreadBitWidth;
      readonly because?: Exclude<
        TConstResult,
        { readonly kind: "value" | "float" }
      >;
    }
  | { readonly kind: "overflow"; readonly typeName: string }
  | {
      readonly kind: "float";
      readonly value: number;
      readonly typeName: "f32" | "f64";
      /** Where the float comes from, for a message where an integer is needed */
      readonly spelling: string;
      readonly at: ISourcePosition | null;
    }
  | {
      readonly kind: "foreign";
      /** What only C knows, as the source spells it, for a message */
      readonly spelling: string;
      /**
       * A name a header declares; a name no cnx declaration binds, in a
       * file that includes a header, which may be a macro (a `#define` never
       * reaches the symbol model); or a memory size the C compiler decides
       * for the target (ADR-058 `.memory_*`)
       */
      readonly why: "header" | "maybeHeader" | "target";
      /** For a memory size: the C that measures it, `sizeof` (ADR-058) */
      readonly c?: string;
    };

export default TConstResult;
