import type ITypingContext from "../types/ITypingContext";
import type TType from "../types/TType";
import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import ExpressionShape from "./ExpressionShape";
import OperandTyper from "./OperandTyper";
import CArrayDimensions from "./CArrayDimensions";
import cTypeName from "./cTypeName";
import TypeResolver from "./TypeResolver";
import type IStructKeywordFacts from "./types/IStructKeywordFacts";

/**
 * #1209 (owner ruling, 2026-11-13): C returns no array, so a function whose
 * cnx return type is a `string<N>` or an array fills a buffer its caller
 * supplies -- `void greet(char cnx_return[17])` -- and its `return` copies
 * into it. The caller's buffer outlives the call, so returning a local is
 * memory safe. This is the one place that says which return types do.
 */
class ReturnBuffer {
  /**
   * #1209: each call in `expr`'s own chain to a function returning a buffer
   * (a `string<N>` or an array), and its return type. A function, or an
   * ADR-029 callback: 1.4 settled its type as the function (#1984)
   */
  static callsOf(
    expr: TExpression,
    typing: ITypingContext,
  ): ReadonlyMap<TPostfixOpSyntax, TType> {
    const calls = new Map<TPostfixOpSyntax, TType>();
    if (ExpressionShape.postfixView(expr) === null) return calls;
    const head = ExpressionShape.headOf(expr);
    const steps = OperandTyper.chainOf(expr, typing).steps;
    head.ops.forEach((op, i) => {
      const step = steps[i - head.opsConsumed];
      if (op.kind !== "call" || step === undefined) return;
      const callee = step.callee ?? step.before?.callbackTypeName ?? null;
      if (callee === null) return;
      const symbol = typing.program.symbolByCName(callee);
      if (symbol?.kind !== "function") return;
      if (ReturnBuffer.dimensionsOf(symbol.returnType) === null) return;
      calls.set(op, symbol.returnType);
    });
    return calls;
  }

  /** The parameter the buffer is passed as, ahead of the declared ones */
  static readonly NAME = "cnx_return";

  /** Above a function that fills a buffer instead of returning its value */
  static readonly SIGNATURE_COMMENT =
    "/* ADR-045 / Issue #1209: C returns no array, so the result is written into a buffer the caller supplies. */";

  /** Above a `return` that copies into the caller's buffer */
  static readonly RETURN_COMMENT =
    "/* ADR-045 / Issue #1209: the result is copied into the caller's buffer, which outlives the call. */";

  /** Above the temporary a caller supplies for a call to fill */
  static readonly TEMPORARY_COMMENT =
    "/* ADR-045 / Issue #1209: C returns no array, so the call fills a temporary its caller supplies. */";

  /**
   * The C dimensions of the buffer a function returning `type` fills --
   * `[17]` for a `string<16>`, `[4]` for a `u8[4]`, `[2][17]` for a
   * `string<16>[2]` -- or null when the type is returned by value
   */
  static dimensionsOf(type: TType): string | null {
    if (type.kind !== "string" && type.kind !== "array") return null;
    const element = type.kind === "array" ? type.elementType : type;
    return CArrayDimensions.of(
      type.kind === "array" ? type.dimensions : [],
      element.kind === "string" ? element.capacity : null,
    )
      .map((size) => `[${size}]`)
      .join("");
  }

  /**
   * The C type of one element of the buffer a function returning `type`
   * fills, spelled by `cTypeName` like any other type the .h and .c name (#1944)
   */
  static elementCType(type: TType, facts: IStructKeywordFacts): string {
    const element = type.kind === "array" ? type.elementType : type;
    return element.kind === "string"
      ? "char"
      : cTypeName(TypeResolver.getTypeName(element), facts);
  }

  /** The buffer parameter of a function returning `type`, or null */
  static parameterFor(type: TType, facts: IStructKeywordFacts): string | null {
    const dimensions = ReturnBuffer.dimensionsOf(type);
    return dimensions === null
      ? null
      : ReturnBuffer.parameter(
          ReturnBuffer.elementCType(type, facts),
          dimensions,
        );
  }

  /**
   * A function returning a `string<N>` or an array is `void`, and the buffer
   * it fills is its first parameter: its prototype and its callback typedef
   * both say so through here
   */
  static signature(
    returnType: string,
    params: string,
    returnBuffer: string | null,
  ): { returnType: string; params: string } {
    if (returnBuffer === null) return { returnType, params };
    return {
      returnType: "void",
      params: params === "void" ? returnBuffer : `${returnBuffer}, ${params}`,
    };
  }

  /**
   * A caller's temporary for a call returning `type`, or null. `zero` is the
   * file's aggregate zero: C++ cannot write an enum element `{0}`
   */
  static temporaryFor(
    type: TType,
    name: string,
    zero: string,
    facts: IStructKeywordFacts,
  ): string | null {
    const dimensions = ReturnBuffer.dimensionsOf(type);
    return dimensions === null
      ? null
      : ReturnBuffer.temporary(
          ReturnBuffer.elementCType(type, facts),
          name,
          dimensions,
          zero,
        );
  }

  /** A caller's temporary of the buffer's shape, zero-filled */
  private static temporary(
    cElementType: string,
    name: string,
    dimensions: string,
    zero: string,
  ): string {
    return `${cElementType} ${name}${dimensions} = ${zero};`;
  }

  /** The buffer parameter, written with the element's C type */
  private static parameter(cElementType: string, dimensions: string): string {
    return `${cElementType} ${ReturnBuffer.NAME}${dimensions}`;
  }
}

export default ReturnBuffer;
