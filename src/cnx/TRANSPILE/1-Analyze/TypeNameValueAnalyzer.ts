/**
 * #1975 review, #2078: a type named where a value goes.
 *
 * A chain that starts at a type -- `u32`, `Point`, `Geo.Box`, a header's
 * `Cfg` -- answers ADR-058's length properties of it and of its fields' types
 * (`Point.y.type_byte_length`), and names no value. `Point.x`, `Point.z.type_byte_length`
 * and `u32.foo` reached the C as written, at exit 0, and gcc rejected them.
 *
 * Error codes:
 * - E0897: a chain that names a type does not end reading a length of it
 * - E0942: a register instance or register parameter, whole, where a value
 *   is read or written (ADR-072); a register parameter's argument is E0940's
 */
import FunctionReference from "./helpers/FunctionReference";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionShape from "../../utils/ExpressionShape";
import ExpressionNodes from "../../utils/ExpressionNodes";
import OperandTyper from "../../utils/OperandTyper";
import type ITypeNameValueError from "./types/ITypeNameValueError";
import type ISourceSite from "../../types/ISourceSite";
import type IOperandType from "../../types/IOperandType";
import BindingSite from "../../utils/BindingSite";
import RegisterInstance from "../../utils/RegisterInstance";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";

const HELP =
  "A type is measured, not read: it answers ADR-058's length properties, its own and its fields' (Point.type_byte_length, Point.x.type_bit_length). A value is read from a variable of the type.";

const REGISTER_HELP =
  "A register type is a layout with no address; an instance gives it one (`GpioPort GPIO1(0x401B8000);`), and its members are read and written through that instance (`GPIO1.DR`).";

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
    const registerArguments = new Set(
      nodes.flatMap((node) => this.registerArgumentsOf(node)),
    );
    return nodes.flatMap((expr) => {
      const isChain = expr.kind === "postfix" || expr.kind === "identifier";
      if (!isChain || heads.has(expr)) return [];
      const error = registerArguments.has(expr)
        ? null
        : (this.check(expr) ?? this.checkRegister(expr));
      return error === null ? [] : [error];
    });
  }

  /** The arguments a call places in register parameters: E0940 decides them */
  private registerArgumentsOf(node: TExpression): TExpression[] {
    if (node.kind !== "postfix") return [];
    const call = node.ops.find((op) => op.kind === "call");
    if (call?.kind !== "call") return [];
    const callee = FunctionReference.ofCallChain(
      node,
      OperandTyper.scopePathAt(node.span, this.context),
      this.context,
    );
    if (callee === null) return [];
    return call.arguments.flatMap((arg, index) => {
      const param = callee.parameters[index];
      return param !== undefined &&
        RegisterInstance.typeNamedBy(this.context.program, param.type) !== null
        ? [ExpressionShape.unparenthesized(arg)]
        : [];
    });
  }

  /** E0942: a register, whole, where a value is read or written */
  private checkRegister(chain: TExpression): ITypeNameValueError | null {
    const type = OperandTyper.wholeRegisterTypeOf(chain, this.context);
    if (type === null) return null;
    return {
      code: "E0942",
      span: chain.span,
      message: `'${chain.written}' is a '${type}' register, not a value`,
      helpText:
        "A register is hardware at a fixed address (ADR-072): read and write its members (`GPIO1.DR`), or pass it to a register parameter. It is not read, assigned or stored whole.",
    };
  }

  private check(chain: TExpression): ITypeNameValueError | null {
    const misnamed = OperandTyper.typeNamedAsValue(chain, this.context);
    if (misnamed === null) return null;
    const at = misnamed.at;
    const span = at?.span ?? chain.span;
    // ADR-072: a register type has members, but only an instance reaches them
    const register = RegisterInstance.isType(
      this.context.program.symbolByCName(misnamed.type.typeName ?? ""),
    );
    return {
      code: "E0897",
      span: span,
      message: register
        ? `'${TypeNameValueAnalyzer.written(chain, at)}' is a register type, not a value; reach its members through an instance`
        : TypeNameValueAnalyzer.message(chain, at),
      helpText: register ? REGISTER_HELP : HELP,
      declaredAt: this.typeDeclaration(misnamed.type),
    };
  }

  /** #1402: where the type named as a value is declared */
  private typeDeclaration(type: IOperandType): ISourceSite | undefined {
    return BindingSite.ofCName(type.typeName, this.context);
  }

  /** The chain as its source spells it, up to the op where it stops */
  /** The chain as written up to the op `at`, or whole */
  private static written(
    chain: TExpression,
    at: TPostfixOpSyntax | null,
  ): string {
    if (chain.kind !== "postfix" || at === null) return chain.written;
    return ExpressionShape.writtenThrough(chain, chain.ops.indexOf(at));
  }

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
