/**
 * A C function's pointer parameter takes an object of the type it points to:
 * E0895.
 *
 * #1977, owner ruling: a struct handed to a C function's `const uint8_t*` is a
 * compile error. The C was `send_u8(&r, 12U)` -- exit 0, and an
 * incompatible-pointer conversion gcc 14 rejects -- with a byte count nobody
 * checks against the object. A `u32` handed to the same parameter was passed
 * as `w`, a pointer made from an integer. One rule covers both: the argument's
 * C type is the pointee's, or the parameter is `void*`. A read-only argument
 * also needs a parameter that points to const, or C could write to it: that
 * is a write, so it is ADR-071's E0900.
 *
 * E0896, owner ruling: cnx cannot see how a C function uses its pointer --
 * one `u8` or `n` of them -- so it accepts both, and warns that the call is not
 * memory safe.
 *
 * Asked only where both sides are known: a C function (a cnx function's
 * parameters are cnx's own), a parameter of exactly one pointer, and an
 * argument the typer types as a declared value. A literal or an expression is
 * passed as a compound literal of the parameter's type.
 */

import OperandTyper from "../../utils/OperandTyper";
import CCallee from "./helpers/CCallee";
import CArgumentWrite from "./helpers/CArgumentWrite";
import WrittenBinding from "./helpers/WrittenBinding";
import BoundDeclaration from "./helpers/BoundDeclaration";
import MutSite from "./helpers/MutSite";
import CPointerParameter from "../../utils/CPointerParameter";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import CNX_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import type IOperandType from "../../types/IOperandType";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type ICCallee from "./types/ICCallee";
import type ICCalleeSignature from "./types/ICCalleeSignature";

class CPointerArgumentCheck {
  private readonly found: IBaseAnalysisError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IBaseAnalysisError[] {
    return this.found;
  }

  /** A call to a C (or C++) function, and nothing after it (`CCallee`) */
  public checkExpression(expr: TExpression): void {
    const callee = CCallee.of(expr, this.context);
    if (callee === null) return;
    const only =
      callee.signatures.length === 1 ? callee.signatures[0] : undefined;
    callee.arguments.forEach((arg, index) => {
      const parameter = only?.parameters[index];
      const pointee =
        parameter === undefined
          ? null
          : CPointerParameter.pointee(parameter.type);
      if (
        parameter !== undefined &&
        pointee !== null &&
        pointee !== "void" &&
        this.rejectsType(arg, callee.name, index, pointee)
      ) {
        return;
      }
      if (this.rejectsReadOnlyWrite(callee, index, parameter, pointee)) {
        return;
      }
      if (pointee === null) return;
      this.report(
        arg,
        `cnx cannot see how '${callee.name}' uses parameter ${index + 1}, so passing '${arg.written}' to it is not memory safe`,
        `Consider converting '${callee.name}' to cnx.`,
        "E0896",
        "warning",
      );
    });
  }

  /**
   * E0900, the one decision: a read-only binding handed to a C callee that may
   * write it (`CArgumentWrite`) -- through a pointer, `void*` included, an
   * array, a reference, a variadic callee's `...`, or every overload the call
   * can reach. The message says which.
   */
  private rejectsReadOnlyWrite(
    callee: ICCallee,
    index: number,
    parameter: ICCalleeSignature["parameters"][number] | undefined,
    pointee: string | null,
  ): boolean {
    const arg = callee.arguments[index];
    const name = callee.name;
    if (
      !CArgumentWrite.mayWrite(callee, index, this.context) ||
      BoundDeclaration.of(
        WrittenBinding.ofExpression(arg, this.context)?.binding ?? null,
      )?.isConst !== true
    ) {
      return false;
    }
    if (callee.signatures.length > 1) {
      this.report(
        arg,
        `'${arg.written}' is read-only, and every overload of '${name}' this call can reach may write through argument ${index + 1}`,
        `Declare '${arg.written}' \`mut\`, or give '${name}' an overload that takes it const.`,
        "E0900",
      );
    } else if (parameter === undefined) {
      const object = arg.kind === "unary" ? arg.operand : arg;
      this.report(
        arg,
        `'${object.written}' is read-only, and argument ${index + 1} of '${name}' fills its '...', which '${name}' may write through`,
        `Declare '${object.written}' \`mut\`.`,
        "E0900",
      );
    } else if (pointee !== null) {
      const objectType = this.objectTypeOf(arg);
      const typeSuffix = objectType === null ? "" : ` ${objectType}`;
      this.report(
        arg,
        `'${arg.written}' is read-only${typeSuffix}, and parameter ${index + 1} of '${name}' is a pointer '${name}' may write through`,
        `Declare '${arg.written}' \`mut\`, or declare the C parameter const ${pointee}*.`,
        "E0900",
      );
    } else {
      this.report(
        arg,
        `'${arg.written}' is read-only, and parameter ${index + 1} of '${name}' is ${parameter.isArray ? "an array" : "a reference"} '${name}' may write through`,
        `Declare '${arg.written}' \`mut\`, or declare the C parameter const.`,
        "E0900",
      );
    }
    return true;
  }

  /** The C type of what an argument hands over: `&x` hands over x */
  private objectTypeOf(arg: TExpression): string | null {
    return (
      CPointerArgumentAnalyzer.cTypeOf(
        OperandTyper.typeOf(arg, this.context),
      ) ??
      (arg.kind === "unary" && arg.operator === "&"
        ? CPointerArgumentAnalyzer.cTypeOf(
            OperandTyper.typeOf(arg.operand, this.context),
          )
        : null)
    );
  }

  /** E0895, when the argument is not what the pointer points to */
  private rejectsType(
    arg: TExpression,
    name: string,
    index: number,
    pointee: string,
  ): boolean {
    const argType = CPointerArgumentAnalyzer.cTypeOf(
      OperandTyper.typeOf(arg, this.context),
    );
    if (
      argType === null ||
      this.structIdentity(argType) === this.structIdentity(pointee)
    ) {
      return false;
    }
    this.report(
      arg,
      `'${arg.written}' is ${argType}, and parameter ${index + 1} of '${name}' points to ${pointee}`,
      `A C pointer parameter takes an object of the type it points to; pass a ${pointee}, or an array of them.`,
    );
    return true;
  }

  /** `widget_t` and the `_widget_t` it aliases are one type (#958) */
  private structIdentity(cType: string): string {
    return this.context.symbolTable.getStructTagForTypedef(cType) ?? cType;
  }

  private report(
    at: TExpression,
    message: string,
    helpText: string,
    code = "E0895",
    severity: IBaseAnalysisError["severity"] = "error",
  ) {
    this.found.push({
      code,
      line: at.span.line,
      column: at.span.column,
      message,
      helpText,
      severity,
      ...(code === "E0900" && {
        declaredAt: MutSite.of(
          WrittenBinding.ofExpression(at, this.context)?.binding ?? null,
          this.context,
        ),
      }),
    });
  }
}

class CPointerArgumentAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IBaseAnalysisError[] {
    const check = new CPointerArgumentCheck(this.context);
    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part))
          check.checkExpression(expr);
      }
    }
    return check.errors();
  }

  /** A declared value's C type -- an array's is its element's -- or null */
  static cTypeOf(typed: IOperandType | null): string | null {
    if (typed?.form.kind !== "declared" || typed.typeName === null) {
      return null;
    }
    if (typed.stringCapacity !== null) return "char";
    return CNX_TO_C_TYPE_MAP[typed.typeName] ?? typed.typeName;
  }
}

export default CPointerArgumentAnalyzer;
