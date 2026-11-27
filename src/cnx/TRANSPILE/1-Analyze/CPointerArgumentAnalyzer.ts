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
 * E0930, #2117 (owner ruling 2026-11-12): a scanf-family call says which
 * arguments it writes only in a literal format (`ScanfFormat`), so a format
 * that is not a string literal is a compile error.
 *
 * Asked only where both sides are known: a C function (a cnx function's
 * parameters are cnx's own), a parameter of exactly one pointer, and an
 * argument the typer types as a declared value. A literal or an expression is
 * passed as a compound literal of the parameter's type.
 */

import OperandTyper from "../../utils/OperandTyper";
import CCallee from "./helpers/CCallee";
import FunctionReference from "./helpers/FunctionReference";
import CArgumentWrite from "./helpers/CArgumentWrite";
import WrittenBinding from "./helpers/WrittenBinding";
import BoundDeclaration from "./helpers/BoundDeclaration";
import BindingSite from "../../utils/BindingSite";
import MutArgument from "./helpers/MutArgument";
import ArgumentQualifier from "./helpers/ArgumentQualifier";
import CPointerParameter from "../../utils/CPointerParameter";
import StringValueForm from "../../utils/StringValueForm";
import CStringArgument from "../../utils/CStringArgument";
import BuiltStringArgument from "./helpers/BuiltStringArgument";
import StatementNodes from "../../utils/StatementNodes";
import SourceOrder from "../../utils/SourceOrder";
import ValuePositions from "./helpers/ValuePositions";
import type IValuePositions from "../../types/IValuePositions";
import ScanfFormat from "../../utils/ScanfFormat";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import CNX_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import type IOperandType from "../../types/IOperandType";
import type TStringPart from "../../types/TStringPart";
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
    if (expr.kind !== "postfix") return;
    // Each call in a chain reaches its own callee (`get_pair(p).a`, #2473)
    const scopePath = OperandTyper.scopePathAt(expr.span, this.context);
    for (const chainCall of FunctionReference.callsIn(
      expr,
      scopePath,
      this.context,
    )) {
      if (chainCall.cCallee !== null) this.checkCall(chainCall.cCallee);
    }
  }

  private checkCall(callee: ICCallee): void {
    this.rejectsFormatNotLiteral(callee);
    const lost = this.rejectsLostWrites(callee);
    // The one overload this call can reach, by the rule E0708 and E0899 read
    const reached = CCallee.reachable(callee);
    const only = reached.length === 1 ? reached[0] : undefined;
    callee.arguments.forEach((arg, index) => {
      if (lost.has(index)) return;
      if (BuiltStringArgument.forC(arg, reached, index, this.context)) {
        this.checkBuilt(arg, callee, reached, index);
        return;
      }
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
      this.warnsNotMemorySafe(arg, callee, index);
    });
  }

  /** E0896: cnx cannot see how far C reads or writes through the pointer */
  private warnsNotMemorySafe(
    arg: TExpression,
    callee: ICCallee,
    index: number,
  ): void {
    this.found.push({
      code: "E0896",
      span: arg.span,
      message: `cnx cannot see how '${callee.name}' uses parameter ${index + 1}, so passing '${arg.written}' to it is not memory safe`,
      helpText: `Consider converting '${callee.name}' to cnx.`,
      severity: "warning",
    });
  }

  /** What a built argument needs: a const pointee, known parts, a result not into it */
  private checkBuilt(
    arg: TExpression,
    callee: ICCallee,
    reached: readonly ICCalleeSignature[],
    index: number,
  ): void {
    if (
      this.rejectsBuiltWrite(arg, callee, index) ||
      this.rejectsUnknownLength(arg, callee, index) ||
      this.rejectsPointerResult(arg, callee, reached, index)
    ) {
      return;
    }
    this.warnsNotMemorySafe(arg, callee, index);
  }

  /**
   * E0915 (#2348 review): a built argument for a parameter C may write
   * through (`CArgumentWrite`). The write lands in the temporary and is
   * lost, as for a cnx `mut` parameter (ADR-071 Decision 2).
   */
  private rejectsBuiltWrite(
    arg: TExpression,
    callee: ICCallee,
    index: number,
  ): boolean {
    if (!CArgumentWrite.mayWrite(callee, index, this.context)) return false;
    this.found.push({
      code: "E0915",
      span: arg.span,
      message: `cannot pass '${arg.written}' to parameter ${index + 1} of '${callee.name}', which '${callee.name}' may write through: it is not a variable, so the write would be lost`,
      helpText: `A C pointer parameter that is not const writes its argument (ADR-071 Decision 2); copy '${arg.written}' into a \`mut\` string<N> and pass that, or declare the C parameter const char*.`,
      severity: "error",
    });
    return true;
  }

  /** E0930: a scanf-family format that is not a string literal */
  private rejectsFormatNotLiteral(callee: ICCallee): void {
    const writes = ScanfFormat.writesOf(callee.name, callee.arguments);
    if (writes.kind !== "format-not-literal") return;
    this.found.push({
      code: "E0930",
      span: writes.format.span,
      message: `the format of '${callee.name}' is not a string literal, so cnx cannot tell which arguments '${callee.name}' writes`,
      helpText: `Write the format as a string literal, e.g. ${callee.name}(..., "%d", value).`,
      severity: "error",
      // #1523: the rule is about the format, so the format's declaration
      declaredAt: BindingSite.ofOperands([writes.format], this.context),
    });
  }

  /**
   * E0915: a conversion fills an argument that is no variable (`MutArgument`),
   * so C would take its address and fail, or the write would be lost; or one
   * whose qualifier its address would drop (#2398)
   */
  private rejectsLostWrites(callee: ICCallee): ReadonlySet<number> {
    const lost = new Set<number>();
    const writes = ScanfFormat.writesOf(callee.name, callee.arguments);
    if (writes.kind !== "literal") return lost;
    for (const index of writes.written) {
      const arg = callee.arguments[index];
      if (arg === undefined || MutArgument.isWritable(arg, this.context)) {
        continue;
      }
      this.found.push({
        code: "E0915",
        span: arg.span,
        // #1402: about the argument the format writes
        declaredAt: BindingSite.ofChain(arg, this.context),
        message: `cannot pass '${arg.written}' as argument ${index + 1} of '${callee.name}', which its format writes: it is not a variable, so the write would be lost`,
        helpText: `A scanf-family conversion writes its argument (ADR-071 Decision 2); pass a \`mut\` variable.`,
        severity: "error",
      });
      lost.add(index);
    }
    for (const index of writes.written) {
      const arg = callee.arguments[index];
      const qualifier =
        arg === undefined || lost.has(index)
          ? null
          : ArgumentQualifier.of(arg, this.context);
      if (qualifier === null) continue;
      this.found.push({
        code: "E0915",
        span: arg.span,
        // #1402: about the argument the format writes
        declaredAt: BindingSite.ofChain(arg, this.context),
        message: `cannot pass '${arg.written}' as argument ${index + 1} of '${callee.name}', which its format writes: it is ${qualifier.is}, and '${callee.name}' would write it through a plain pointer, so the ${qualifier.write} write would be lost`,
        helpText: `Scan into a \`mut\` local, then assign it to '${arg.written}' (ADR-071 Decision 2, #2398).`,
        severity: "error",
      });
      lost.add(index);
    }
    return lost;
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
    const written =
      WrittenBinding.ofExpression(callee.arguments[index], this.context)
        ?.binding ?? null;
    if (
      !CArgumentWrite.mayWrite(callee, index, this.context) ||
      (BoundDeclaration.of(written)?.isConst !== true &&
        !this.isCString(callee.arguments[index]))
    ) {
      return false;
    }
    this.found.push({
      code: "E0900",
      span: callee.arguments[index].span,
      ...this.readOnlyWriteText(callee, index, parameter, pointee),
      severity: "error",
      declaredAt: BindingSite.of(written, this.context),
    });
    return true;
  }

  /** What E0900 says about the write `rejectsReadOnlyWrite` found */
  private readOnlyWriteText(
    callee: ICCallee,
    index: number,
    parameter: ICCalleeSignature["parameters"][number] | undefined,
    pointee: string | null,
  ): { readonly message: string; readonly helpText: string } {
    const arg = callee.arguments[index];
    const name = callee.name;
    if (this.isCString(arg)) {
      return {
        message: `'${arg.written}' is a C string, whose characters cnx does not write, and argument ${index + 1} of '${name}' is one '${name}' may write through`,
        helpText: `A cstring is const char* (ADR-046), \`mut\` or not: declare the C parameter const char*, or copy '${arg.written}' into a \`mut\` string<N> and pass that.`,
      };
    }
    if (callee.signatures.length > 1) {
      return {
        message: `'${arg.written}' is read-only, and every overload of '${name}' this call can reach may write through argument ${index + 1}`,
        helpText: `Declare '${arg.written}' \`mut\`, or give '${name}' an overload that takes it const.`,
      };
    }
    if (parameter === undefined) {
      return {
        message: `'${arg.written}' is read-only, and argument ${index + 1} of '${name}' fills its '...', which '${name}' may write through`,
        helpText: `Declare '${arg.written}' \`mut\`.`,
      };
    }
    if (pointee !== null) {
      const objectType = this.objectTypeOf(arg);
      const typeSuffix = objectType === null ? "" : ` ${objectType}`;
      return {
        message: `'${arg.written}' is read-only${typeSuffix}, and parameter ${index + 1} of '${name}' is a pointer '${name}' may write through`,
        helpText: `Declare '${arg.written}' \`mut\`, or declare the C parameter const ${pointee}*.`,
      };
    }
    return {
      message: `'${arg.written}' is read-only, and parameter ${index + 1} of '${name}' is ${parameter.isArray ? "an array" : "a reference"} '${name}' may write through`,
      helpText: `Declare '${arg.written}' \`mut\`, or declare the C parameter const.`,
    };
  }

  /** ADR-046: a C string, whose characters are C's and cnx never writes */
  private isCString(value: TExpression): boolean {
    return OperandTyper.typeOf(value, this.context)?.typeName === "cstring";
  }

  /**
   * E0900 (#2348 review): a C string stored in a C struct's field C may write
   * the characters through -- a `char*` that is not const -- by a struct
   * initializer or an assignment. `mut` reassigns a `cstring`, and never
   * writes its characters (ADR-046).
   */
  public checkFieldStore(
    value: TExpression,
    structType: string | null,
    field: string | null,
  ): void {
    if (structType === null || field === null || !this.isCString(value)) {
      return;
    }
    const fieldType = this.context.symbolTable
      .getStructFieldTypes(structType)
      ?.get(field);
    if (
      fieldType === undefined ||
      !CStringArgument.isWritableCharPointer(
        fieldType,
        this.context.symbolTable,
      )
    ) {
      return;
    }
    this.found.push({
      code: "E0900",
      span: value.span,
      message: `'${value.written}' is a C string, whose characters cnx does not write, and field '${field}' of '${structType}' is a '${fieldType}' C may write through`,
      helpText: `A cstring is const char* (ADR-046), \`mut\` or not: declare the C field const char*, or store a \`mut\` string<N> there.`,
      severity: "error",
    });
  }

  /** Each struct initializer's fields and assignment to a field, for `checkFieldStore` */
  public checkFieldStores(
    program: IProgramSyntax,
    positions: IValuePositions,
  ): void {
    for (const member of program.members) {
      for (const site of StatementNodes.assignments(member.declaration)) {
        const last = OperandTyper.chainOf(site.target, this.context).steps.at(
          -1,
        );
        this.checkFieldStore(
          site.value,
          last?.before?.typeName ?? null,
          last?.member ?? null,
        );
      }
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const node of ExpressionNodes.of(part)) {
          if (node.kind !== "structInitializer") continue;
          const structType = ValuePositions.at(
            positions.positions,
            node,
          ).typeText;
          for (const field of node.fields) {
            this.checkFieldStore(field.value, structType, field.name);
          }
        }
      }
    }
  }

  /** The C type of what an argument hands over */
  private objectTypeOf(arg: TExpression): string | null {
    return CPointerArgumentAnalyzer.cTypeOf(
      OperandTyper.typeOf(arg, this.context),
    );
  }

  /**
   * E0948 (#2348 review): a string built for a C function that returns a
   * pointer that can point at characters (`CStringArgument.mayPointInto`).
   * The temporary lives only as long as the statement's block, and the
   * pointer -- what `strstr` or `strchr` return, or a typedef of one -- may
   * point into it. A `FILE*` cannot.
   */
  private rejectsPointerResult(
    arg: TExpression,
    callee: ICCallee,
    reached: readonly ICCalleeSignature[],
    index: number,
  ): boolean {
    if (
      !reached.some((signature) =>
        CStringArgument.mayPointInto(
          signature.returnType,
          this.context.symbolTable,
        ),
      )
    ) {
      return false;
    }
    this.found.push({
      code: "E0948",
      span: arg.span,
      aboutItsPosition: true,
      message: `'${callee.name}' returns a pointer, which may point into the string built for '${arg.written}', parameter ${index + 1}; that string does not outlive its block`,
      helpText: `ADR-045: copy '${arg.written}' into a string<N> first, and pass that.`,
    });
    return true;
  }

  /**
   * E0947 (#2348 review): a concatenation or a substring passed to a C
   * `char*` is built into a temporary at the sum of its parts' capacities
   * (ADR-045), so each whole part needs one. A substring's length is E0922's.
   */
  private rejectsUnknownLength(
    arg: TExpression,
    callee: ICCallee,
    index: number,
  ): boolean {
    const form = StringValueForm.of(arg, this.context);
    const parts =
      form.kind === "concat"
        ? form.parts
        : form.kind === "substring"
          ? [form.part]
          : [];
    const unknown = parts.find(
      (part): part is Extract<TStringPart, { kind: "whole" }> =>
        part.kind === "whole" &&
        StringValueForm.partCapacity(part, this.context, () => null) === null,
    );
    if (unknown === undefined) return false;
    this.found.push({
      code: "E0947",
      span: arg.span,
      aboutItsPosition: true,
      message: `The length of '${unknown.value.written}' is not known, so '${arg.written}' cannot be built for parameter ${index + 1} of '${callee.name}'`,
      helpText: `ADR-045: copy '${unknown.value.written}' into a string<N> first, and pass the concatenation of that.`,
    });
    return true;
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
    this.found.push({
      code: "E0895",
      span: arg.span,
      message: `'${arg.written}' is ${argType}, and parameter ${index + 1} of '${name}' points to ${pointee}`,
      helpText: `A C pointer parameter takes an object of the type it points to; pass a ${pointee}, or an array of them.`,
      severity: "error",
    });
    return true;
  }

  /** `widget_t` and the `_widget_t` it aliases are one type (#958) */
  private structIdentity(cType: string): string {
    return this.context.symbolTable.getStructTagForTypedef(cType) ?? cType;
  }
}

class CPointerArgumentAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(
    program: IProgramSyntax,
    positions: IValuePositions,
  ): IBaseAnalysisError[] {
    const check = new CPointerArgumentCheck(this.context);
    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part))
          check.checkExpression(expr);
      }
    }
    check.checkFieldStores(program, positions);
    return check.errors().sort(SourceOrder.bySpan);
  }

  /** A declared value's C type -- an array's is its element's -- or null */
  static cTypeOf(typed: IOperandType | null): string | null {
    if (typed?.form.kind !== "declared" || typed.typeName === null) {
      return null;
    }
    // A sized string, or main's unsized `string args[]` element, is char's
    if (typed.stringCapacity !== null || typed.typeName === "string") {
      return "char";
    }
    // ADR-046: a C string is the pointer to char itself (#2348)
    if (typed.typeName === "cstring") return "char";
    return CNX_TO_C_TYPE_MAP[typed.typeName] ?? typed.typeName;
  }
}

export default CPointerArgumentAnalyzer;
