import type TChainRoot from "./TChainRoot";
import type TBinaryOperator from "./syntax/TBinaryOperator";
import type ISourceSpan from "./ISourceSpan";

/**
 * An integer expression whose value may be needed while the program compiles
 * -- an array dimension, an enum member's value, a const's initializer -- as
 * plain data (#1175, #1669).
 *
 * ## Why not the parse tree, and why not its text
 *
 * The tree is Tier 1 with a short lifetime: 1.3 Declare consumes it and does
 * not re-export it (#1317, docs/architecture/README.md), so a pass after 1.3
 * cannot hold one. Its `getText()` is not a substitute. ANTLR joins the tokens
 * with no separator, so the text re-lexes as different tokens: `(LIM < -1)`
 * reads back as `(LIM<-1)`, where `<-` is assignment, and `1 - -1` reaches C as
 * `1--1`, which C reads as a decrement. This form is lowered from the tree once,
 * where the tree is in hand, and every pass evaluates it by the one rule in
 * `ConstantEvaluator`.
 *
 * Plain data, so a symbol carrying it stays JSON-encodable (#1298): a literal
 * holds its value as decimal digits, because a u64 is past what a `number`
 * holds exactly and a `bigint` is not JSON.
 */
type TConstExpr =
  | {
      readonly kind: "literal";
      /** The value in decimal digits, whatever notation the source used */
      readonly digits: string;
      /** The literal token as written, which C reads as the same value (`0xAB`) */
      readonly text: string;
      /**
       * A suffixed literal's type (`9u8`); `bool` for `true` and `false`; null
       * for an unsuffixed integer literal, which has no type of its own (ADR-052)
       */
      readonly typeName: string | null;
    }
  | {
      readonly kind: "name";
      readonly root: TChainRoot;
      /** `N` is `["N"]`; `Scope.N` and `EColor.COUNT` are two segments */
      readonly path: readonly string[];
      /** Where the name is written, which is where it binds (ADR-057) */
      readonly at: ISourceSpan;
    }
  | {
      readonly kind: "cast";
      readonly typeName: string;
      readonly operand: TConstExpr;
      readonly at: ISourceSpan;
    }
  | {
      readonly kind: "unary";
      readonly op: "-" | "~" | "!";
      readonly operand: TConstExpr;
    }
  | {
      readonly kind: "binary";
      readonly op: TBinaryOperator;
      readonly left: TConstExpr;
      readonly right: TConstExpr;
    }
  | {
      readonly kind: "ternary";
      readonly condition: TConstExpr;
      readonly whenTrue: TConstExpr;
      readonly whenFalse: TConstExpr;
    }
  | {
      /** Something no constant expression contains, kept so the reason can be reported */
      readonly kind: "other";
      readonly what:
        | "call"
        | "subscript"
        | "float"
        | "string"
        | "character"
        | "initializer"
        | "address"
        | "member"
        | "leadingZero"
        | "sizeofExpression";
      /** The source spelling, for a diagnostic's message only -- never emitted */
      readonly spelling: string;
      readonly at: ISourceSpan;
    };

export default TConstExpr;
