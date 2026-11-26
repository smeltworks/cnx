/**
 * ADR-045: the form of a value written whole into a `string<N>`, decided once
 * (#2160 round 9). 2.1 checks each form's fit (E0864, E0865) and 2.2 plans
 * its lowering from this answer, for a declaration's initializer and an
 * assignment's value alike (#1257), so neither derives it again. Parentheses
 * are looked through (#2232); a concatenation is every `+` operand, two or
 * more (#1954); a substring's source is any string, a field, an element or a
 * `this.` member among them (#2223, #2237).
 */
import ExpressionShape from "./ExpressionShape";
import OperandTyper from "./OperandTyper";
import StringUtils from "./StringUtils";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";
import type TStringPart from "../types/TStringPart";
import type TStringValueForm from "../types/TStringValueForm";

class StringValueForm {
  static of(value: TExpression, ctx: ITypingContext): TStringValueForm {
    const unwrapped = StringValueForm.unwrapped(value);
    if (ExpressionShape.isStringLiteral(unwrapped)) {
      return { kind: "literal", literal: unwrapped };
    }
    const operands = ExpressionShape.concatenationOperands(unwrapped);
    if (operands !== null) {
      return {
        kind: "concat",
        parts: operands.map((operand) => StringValueForm.partOf(operand, ctx)),
      };
    }
    const part = StringValueForm.partOf(unwrapped, ctx);
    return part.kind === "substring"
      ? { kind: "substring", part }
      : { kind: "copy", value: part.value };
  }

  /**
   * The most characters one part holds: a literal's length, a `string<N>`'s
   * `N`, or a substring's length, which `lengthOf` folds (E0922 made it
   * constant). Null for a part whose length cnx cannot see: a C string or an
   * unsized `string`.
   */
  static partCapacity(
    part: TStringPart,
    ctx: ITypingContext,
    lengthOf: (length: TExpression) => number | null,
  ): number | null {
    if (part.kind === "substring") {
      return part.length === null ? 1 : lengthOf(part.length);
    }
    if (ExpressionShape.isStringLiteral(part.value)) {
      return StringUtils.literalLength(part.value.written);
    }
    return OperandTyper.scalarStringCapacity(
      OperandTyper.typeOf(part.value, ctx),
    );
  }

  /**
   * #2348 review: the capacity a concatenation or a substring is built at
   * when nothing it lands in has one -- a C `char*` parameter: the sum of its
   * parts' (`partCapacity`). Null when a part's is unknown, or the form is
   * neither.
   */
  static builtCapacity(
    form: TStringValueForm,
    ctx: ITypingContext,
    lengthOf: (length: TExpression) => number | null,
  ): number | null {
    const parts =
      form.kind === "concat"
        ? form.parts
        : form.kind === "substring"
          ? [form.part]
          : null;
    if (parts === null) return null;
    let sum = 0;
    for (const part of parts) {
      const capacity = StringValueForm.partCapacity(part, ctx, lengthOf);
      if (capacity === null) return null;
      sum += capacity;
    }
    return sum;
  }

  private static partOf(value: TExpression, ctx: ITypingContext): TStringPart {
    if (value.kind !== "postfix" || !OperandTyper.isSubstring(value, ctx)) {
      return { kind: "whole", value };
    }
    const last = value.ops.at(-1);
    if (last?.kind !== "subscript") return { kind: "whole", value };
    return {
      kind: "substring",
      chain: value,
      start: last.start,
      length: last.length,
    };
  }

  private static unwrapped(value: TExpression): TExpression {
    return value.kind === "parenthesized"
      ? StringValueForm.unwrapped(value.expression)
      : value;
  }
}

export default StringValueForm;
