import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";
import type TCaseLabelSyntax from "./TCaseLabelSyntax";
import type IVariableDeclarationSyntax from "./IVariableDeclarationSyntax";
import type IAssignmentSyntax from "./IAssignmentSyntax";

/**
 * A statement as plain data, lowered from the parse tree by `SyntaxLowering`
 * (#1932). Its expressions are `TExpression`s, so nothing under it is a parse
 * node. 1.2 lowers the whole file eagerly through `ProgramLowering` into
 * `IParsedFile.program`, and that is all the walker reads.
 *
 * The shape is the grammar's: one kind per `statement` alternative.
 */
/** `{ ... }`; `TBlockSyntax` derives its name for callers from here */
type TBody = ISyntaxNode & { readonly statements: readonly TStatement[] };

type TStatement = ISyntaxNode &
  (
    | ({ readonly kind: "variableDeclaration" } & IVariableDeclarationSyntax)
    | {
        /** `Type name(a, b);` -- a C++ constructor call (#375) */
        readonly kind: "constructorDeclaration";
        readonly type: TTypeSyntax;
        readonly name: string;
        readonly nameSpan: ISyntaxNode["span"];
        readonly arguments: readonly (ISyntaxNode & {
          readonly name: string;
        })[];
        /** #1643 (ADR-030): its own name is written bare in its arguments */
        readonly spellsOwnName: boolean;
        /**
         * ADR-072: `Type name(<expression>);`, the argument when it is not a
         * bare name -- only a register instance's address is written so.
         * A bare name stays in `arguments`: whether `Type` is a register is a
         * cross-file fact 1.4 settles.
         */
        readonly address: TExpression | null;
      }
    | ({ readonly kind: "assignment" } & IAssignmentSyntax)
    | { readonly kind: "expression"; readonly expression: TExpression }
    | {
        readonly kind: "if";
        readonly condition: TExpression;
        readonly whenTrue: TStatement;
        readonly whenFalse: TStatement | null;
      }
    | {
        readonly kind: "while";
        readonly condition: TExpression;
        readonly body: TStatement;
      }
    | {
        readonly kind: "doWhile";
        readonly body: TBody;
        readonly condition: TExpression;
      }
    | {
        readonly kind: "for";
        readonly init:
          | ({
              readonly kind: "variableDeclaration";
            } & IVariableDeclarationSyntax)
          | ({ readonly kind: "assignment" } & IAssignmentSyntax)
          | null;
        readonly condition: TExpression | null;
        readonly update: IAssignmentSyntax | null;
        readonly body: TStatement;
      }
    | { readonly kind: "forever"; readonly body: TBody }
    | {
        readonly kind: "switch";
        readonly subject: TExpression;
        readonly cases: readonly (ISyntaxNode & {
          readonly labels: readonly TCaseLabelSyntax[];
          readonly body: TBody;
        })[];
        readonly defaultCase:
          | (ISyntaxNode & {
              /** `default(n)`: the count as written, or null */
              readonly count: string | null;
              readonly body: TBody;
            })
          | null;
      }
    | { readonly kind: "return"; readonly value: TExpression | null }
    | { readonly kind: "critical"; readonly body: TBody }
    | ({ readonly kind: "block" } & Pick<TBody, "statements">)
    /** A statement the parser repaired, missing a part it requires */
    | { readonly kind: "missing" }
  );

export default TStatement;
