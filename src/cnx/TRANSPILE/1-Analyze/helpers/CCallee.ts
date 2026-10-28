import OperandTyper from "../../../utils/OperandTyper";
import ForeignTypeFacts from "../../../utils/ForeignTypeFacts";
import TypedefParamParser from "../../../utils/TypedefParamParser";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ICCallee from "../types/ICCallee";
import type ICCalleeSignature from "../types/ICCalleeSignature";

type TPostfix = Extract<TExpression, { kind: "postfix" }>;

/**
 * The C (or C++) function a call reaches, and nothing after the call: one
 * named (`f(a)`, `global.f(a)`, `hw.f(a)` in a C++ namespace), a C++ method
 * (`c.set(a)`), or a value of a C function-pointer typedef (`h.fill(a)`). A
 * cnx function of that name is cnx's own, so it is not one. E0895's
 * pointer check and ADR-071's write tracking ask this one question.
 */
class CCallee {
  static of(expr: TExpression, context: IAnalysisContext): ICCallee | null {
    if (expr.kind !== "postfix") return null;
    const call = expr.ops.at(-1);
    if (call?.kind !== "call") return null;
    for (const name of CCallee.namesOf(expr, context)) {
      if (context.program.symbolByCName(name)?.kind === "function") {
        return null;
      }
      const signatures = CCallee.signaturesOf(name, context);
      if (signatures.length > 0) {
        return { name, arguments: call.arguments, signatures };
      }
    }
    const typedef = CCallee.typedefSignature(expr, context);
    return typedef === null
      ? null
      : {
          name: typedef.name,
          arguments: call.arguments,
          signatures: [typedef.signature],
        };
  }

  /**
   * The signatures a call with this many arguments can reach. A C++ compiler
   * picks among an overload set; each of them is one it may pick.
   */
  static reachable(callee: ICCallee): readonly ICCalleeSignature[] {
    if (callee.signatures.length === 1) return callee.signatures;
    const count = callee.arguments.length;
    return callee.signatures.filter(
      (signature) =>
        signature.parameters.length === count ||
        (signature.isVariadic && count >= signature.parameters.length),
    );
  }

  /**
   * The C++ name of `method` on what `receiver` is, or null: the stored name
   * of the member the receiver's class declares, found by (class, method)
   * rather than spelled `Class::method` (#2116)
   */
  static methodName(
    receiver: TExpression,
    method: string,
    context: IAnalysisContext,
  ): string | null {
    const typeName = OperandTyper.directTypeName(
      OperandTyper.typeOf(receiver, context),
    );
    if (typeName === null) return null;
    // Every overload of one (class, method) shares its name: 3-Declare spells
    // it from the class and the method alone, so the first one's is all of
    // theirs; only the parameters differ.
    return context.symbolTable.getCppMembers(typeName, method)[0]?.name ?? null;
  }

  private static namesOf(expr: TPostfix, context: IAnalysisContext): string[] {
    const before = expr.ops.slice(0, -1);
    if (expr.primary.kind === "root" && expr.primary.root === "global") {
      const only = before[0];
      return before.length === 1 && only.kind === "member" ? [only.name] : [];
    }
    if (before.length === 0) {
      return expr.primary.kind === "identifier" ? [expr.primary.name] : [];
    }
    const names: string[] = [];
    if (
      expr.primary.kind === "identifier" &&
      before.every((op) => op.kind === "member")
    ) {
      // #2116: `hw.f(a)` reads the stored name of the `f` namespace hw declares
      const named = ForeignTypeFacts.cppPath(context.symbolTable, undefined, [
        expr.primary.name,
        ...before.map((op) => (op.kind === "member" ? op.name : "")),
      ])[0];
      if (named !== undefined) names.push(named.name);
    }
    const method = before.at(-1);
    if (method?.kind === "member") {
      const name = CCallee.methodName(
        { ...expr, ops: expr.ops.slice(0, -2) },
        method.name,
        context,
      );
      if (name !== null) names.push(name);
    }
    return names;
  }

  private static signaturesOf(
    name: string,
    context: IAnalysisContext,
  ): ICCalleeSignature[] {
    for (const symbol of context.symbolTable.getCOverloads(name)) {
      if (symbol.kind === "function" && symbol.parameters) {
        return [
          {
            parameters: symbol.parameters,
            isVariadic: symbol.isVariadic === true,
          },
        ];
      }
    }
    return context.symbolTable.getCppOverloads(name).flatMap((symbol) =>
      symbol.kind === "function" && symbol.parameters
        ? [
            {
              parameters: symbol.parameters,
              isVariadic: symbol.isVariadic === true,
            },
          ]
        : [],
    );
  }

  /**
   * `const uint8_t*` from a typedef parameter's text, which the grammar may
   * run together, `const` with no space after it: its words up to the last `*`, `const` apart
   */
  private static pointerType(text: string): string {
    const head = text.slice(0, text.lastIndexOf("*") + 1);
    const stars = (head.match(/\*/g) ?? []).length;
    const isConst = /^const(?=\s|[A-Z_a-z])/.test(head);
    const base = head
      .replace(/^const\s*/, "")
      .replaceAll("*", "")
      .trim();
    return `${isConst ? "const " : ""}${base}${"*".repeat(stars)}`;
  }

  /**
   * A C struct field's declared type, for `h.fill(...)`: a function-pointer
   * field is typed as what it returns, not as its typedef
   */
  private static fieldTypeOf(
    expr: TPostfix,
    context: IAnalysisContext,
  ): string | null {
    const field = expr.ops.at(-2);
    if (field?.kind !== "member") return null;
    const receiver = OperandTyper.directTypeName(
      OperandTyper.typeOf({ ...expr, ops: expr.ops.slice(0, -2) }, context),
    );
    return receiver === null
      ? null
      : (context.symbolTable.getStructFieldTypes(receiver)?.get(field.name) ??
          null);
  }

  /** A call through a value whose type is a C function-pointer typedef */
  private static typedefSignature(
    expr: TPostfix,
    context: IAnalysisContext,
  ): { name: string; signature: ICCalleeSignature } | null {
    const target: TExpression =
      expr.ops.length === 1
        ? expr.primary
        : { ...expr, ops: expr.ops.slice(0, -1) };
    const typeName =
      OperandTyper.typeOf(target, context)?.typeName ??
      CCallee.fieldTypeOf(expr, context);
    if (
      typeName === undefined ||
      typeName === null ||
      !context.symbolTable.isCFunctionPointerTypedef(typeName)
    ) {
      return null;
    }
    const typedef = context.symbolTable.getCSymbol(typeName);
    const parsed =
      typedef?.kind === "type" ? TypedefParamParser.parse(typedef.type) : null;
    if (parsed === null) return null;
    const declared = parsed.params.filter(
      (param) =>
        param.baseType !== "..." &&
        !(param.baseType === "void" && !param.isPointer),
    );
    return {
      name: typeName,
      signature: {
        parameters: declared.map((param, index) => ({
          name: `${index + 1}`,
          // The text up to the last `*` (`uint8_t*buf` is how the grammar
          // spells `uint8_t *buf`), so a parameter's name is never its type
          type: param.isPointer
            ? CCallee.pointerType(param.type)
            : param.baseType,
          isConst: false,
          isArray: false,
        })),
        isVariadic:
          declared.length !== parsed.params.length &&
          parsed.params.some((param) => param.baseType === "..."),
      },
    };
  }
}

export default CCallee;
