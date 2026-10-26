/**
 * #1975 review, #2078: a type named where a value goes.
 *
 * A chain that starts at a type -- `u32`, `Point`, `Geo.Box`, a header's
 * `Cfg` -- answers ADR-058's length properties of it and of its fields' types
 * (`Point.y.type_byte_length`), and names no value. `Point.x`, `Point.z.type_byte_length`
 * and `u32.foo` reached the C as written, at exit 0, and gcc rejected them.
 *
 * Error code:
 * - E0897: a chain that names a type does not end reading a length of it
 */
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionShape from "../../utils/ExpressionShape";
import ExpressionNodes from "../../utils/ExpressionNodes";
import OperandTyper from "../../utils/OperandTyper";
import type ITypeNameValueError from "./types/ITypeNameValueError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";

const HELP =
  "A type is measured, not read: it answers ADR-058's length properties, its own and its fields' (Point.type_byte_length, Point.x.type_bit_length). A value is read from a variable of the type.";

class TypeNameValueAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain, read or written; a chain's head is asked as the chain */
  public analyze(program: IProgramSyntax): ITypeNameValueError[] {
    return program.members.flatMap((member) =>
      DeclarationParts.of(member.declaration).flatMap((part) =>
        this.checkPart(part),
      ),
    );
  }

  private checkPart(
    part: Parameters<typeof ExpressionNodes.of>[0],
  ): ITypeNameValueError[] {
    const nodes = ExpressionNodes.of(part);
    const heads = new Set(
      nodes.flatMap((node) => (node.kind === "postfix" ? [node.primary] : [])),
    );
    return nodes.flatMap((expr) => {
      const isChain = expr.kind === "postfix" || expr.kind === "identifier";
      const error = isChain && !heads.has(expr) ? this.check(expr) : null;
      return error === null ? [] : [error];
    });
  }

  private check(chain: TExpression): ITypeNameValueError | null {
    const misnamed = OperandTyper.typeNamedAsValue(chain, this.context);
    if (misnamed === null) return null;
    const at = misnamed.at;
    const span = at?.span ?? chain.span;
    return {
      code: "E0897",
      span: span,
      message: TypeNameValueAnalyzer.message(chain, at),
      helpText: HELP,
    };
  }

  /** The chain as its source spells it, up to the op where it stops */
  private static message(
    chain: TExpression,
    at: TPostfixOpSyntax | null,
  ): string {
    const ops = chain.kind === "postfix" ? chain.ops : [];
    const before = (end: number): string =>
      chain.kind === "postfix"
        ? ExpressionShape.writtenThrough(chain, end)
        : chain.written;
    if (at?.kind === "member") {
      return `Type '${before(ops.indexOf(at))}' has no field or length property '${at.name}'`;
    }
    if (at !== null) {
      return `'${before(ops.indexOf(at))}' names a type, not a value`;
    }
    return ops.at(-1)?.kind === "member"
      ? `'${chain.written}' is a field of type '${before(ops.length - 1)}', not a value`
      : `'${chain.written}' names a type, not a value`;
  }
}

export default TypeNameValueAnalyzer;
