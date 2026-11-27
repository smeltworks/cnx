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
   * #2234, #2263: whether the value is built from its parts rather than
   * copied whole by one `cnx_string_copy`: a concatenation, a substring, or
   * a ternary with either as an arm (E0710 nests no ternary in another)
   */
  static isBuilt(value: TExpression, ctx: ITypingContext): boolean {
    const unwrapped = StringValueForm.unwrapped(value);
    if (unwrapped.kind === "ternary") {
      return [unwrapped.whenTrue, unwrapped.whenFalse].some((arm) =>
        StringValueForm.isBuilt(arm, ctx),
      );
    }
    return StringValueForm.builds(StringValueForm.of(unwrapped, ctx));
  }

  /**
   * The forms built from their parts, which are never one C expression: the
   * one place that names them, for 2.1, 2.2 and 2.3 alike
   */
  static builds(
    form: TStringValueForm,
  ): form is Extract<TStringValueForm, { kind: "concat" | "substring" }> {
    return form.kind === "concat" || form.kind === "substring";
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

  static unwrapped(value: TExpression): TExpression {
    return value.kind === "parenthesized"
      ? StringValueForm.unwrapped(value.expression)
      : value;
  }
}

export default StringValueForm;
