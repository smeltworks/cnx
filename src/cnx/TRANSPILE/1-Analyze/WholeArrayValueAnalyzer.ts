/**
 * ADR-014: an array's whole value is ADR-035's list (E0866) wherever a whole
 * array is taken -- a declaration, a field, an assignment target and a
 * parameter (#1760 review, 2026-09-28). A parameter also takes an array,
 * which is passed by reference; a scalar there was a one-element buffer
 * (#2157). A declaration's is 1.2's `ArrayForm`
 * and `ArrayDeclarationAnalyzer`; every other position is here.
 *
 * #1782: an assignment target was asked only whether a struct initializer
 * stood there. Another array, a scalar, or a list of the wrong length was
 * emitted as a C array assignment (`a = b;`), which C rejects, at exit 0. A
 * field given another array (`{ data: src }`) compiled with a warning and
 * initialized one element from a pointer; a field's short list was C's
 * partial initialization, which MISRA C:2012 Rule 9.3 forbids.
 *
 * What is accepted is `ExpressionShape.givesWholeArray`, the declaration's
 * rule; a list is counted by `ArrayListCount`, the declaration's count.
 */

import ArrayListCount from "./helpers/ArrayListCount";
import SourceOrder from "../../utils/SourceOrder";
import StructInitializerType from "./helpers/StructInitializerType";
import ExpressionChildren from "../../utils/ExpressionChildren";
import ExpressionShape from "../../utils/ExpressionShape";
import OperandTyper from "../../utils/OperandTyper";
import ArrayValueRule from "../../utils/ArrayValueRule";
import ConstantExpression from "./helpers/ConstantExpression";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import ForHeaderVariable from "../../utils/ForHeaderVariable";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import TypeText from "../../utils/TypeText";
import type IValuePosition from "../../types/IValuePosition";
import type IValuePositions from "../../types/IValuePositions";
import type TExpression from "../../types/syntax/TExpression";
import type IArrayDeclarationError from "./types/IArrayDeclarationError";
import type IAnalysisContext from "./types/IAnalysisContext";

class WholeArrayValueAnalyzer {
  public constructor(private readonly context: IAnalysisContext) {}

  public analyze(positions: IValuePositions): IArrayDeclarationError[] {
    const found: IArrayDeclarationError[] = [];
    // A value's operands stand in its position too; only the value is asked
    const asked = new Set<TExpression>();
    for (const [value, at] of positions.positions) {
      if (asked.has(value)) continue;
      const declared = positions.sites.get(value)?.site;
      if (
        declared?.kind === "declaration" &&
        WholeArrayValueAnalyzer.isArrayCopy(value, at)
      ) {
        WholeArrayValueAnalyzer.markAsked(value, at, positions, asked);
        found.push(
          ...this.declarationCopy(
            value,
            at,
            this.declaredDimensions(declared.declaration),
          ),
        );
        continue;
      }
      if (!StructInitializerType.takesWholeArrayAt(at)) continue;
      WholeArrayValueAnalyzer.markAsked(value, at, positions, asked);
      // A string field is an array to the symbol table but takes a string;
      // only a struct initializer is asked there, as before #1782
      if (at.dimensions.length === 0 && value.kind !== "structInitializer") {
        continue;
      }
      // #2157: an argument passes an array by reference, so an array value
      // is one too -- and so is each arm of a ternary of arrays. #1209: an
      // assignment copies one in element by element.
      const site = positions.sites.get(value)?.site;
      const arms =
        site?.kind === "argument" || site?.kind === "assignment"
          ? OperandTyper.arrayArms(value, this.context)
          : null;
      if (arms !== null) {
        const noun = site?.kind === "argument" ? "parameter" : "target";
        for (const arm of arms) {
          found.push(...this.shapeMismatch(arm, at, noun));
        }
        continue;
      }
      found.push(...WholeArrayValueAnalyzer.check(value, at, this.context));
    }
    found.push(...this.forClauseArrays(positions));
    return found.sort(SourceOrder.bySpan);
  }

  /**
   * #1782: a whole array is copied element by element, a block a `for`
   * clause cannot hold, and #1823 keeps a `for` header to scalars (E0917).
   * A clause's assignment has no position, so it is found by its site.
   */
  private forClauseArrays(
    positions: IValuePositions,
  ): IArrayDeclarationError[] {
    const found: IArrayDeclarationError[] = [];
    for (const [value, at] of positions.sites) {
      const site = at.site;
      if (site.kind !== "assignment" || site.assignment.value !== value) {
        continue;
      }
      const assignment = site.assignment;
      if (assignment.operator !== "<-") continue;
      if ((positions.positions.get(value)?.dimensions.length ?? 0) > 0) {
        continue;
      }
      const target = assignment.target;
      if (
        OperandTyper.wholeArrayDimensions(target, this.context).length === 0
      ) {
        continue;
      }
      found.push({
        code: "E0917",
        span: target.span,
        message: ForHeaderVariable.assignmentMessage(target.written),
        helpText: ForHeaderVariable.ASSIGNMENT_HELP,
      });
    }
    return found;
  }

  /**
   * #1209 (ADR-035): a function's array declared from anything but a list
   * or a string literal -- 1.2 left it here, since only its type says
   * whether it is an array. 1.2 rejects one at file scope, or of an
   * inferred size.
   */
  private static isArrayCopy(value: TExpression, at: IValuePosition): boolean {
    return (
      at.isDeclaration &&
      at.isArray &&
      !at.inList &&
      value.kind !== "arrayInitializer" &&
      value.kind !== "structInitializer" &&
      !ExpressionShape.isStringLiteral(value)
    );
  }

  /** #1209: another array of the declaration's element type and shape */
  private declarationCopy(
    value: TExpression,
    at: IValuePosition,
    declared: ReadonlyArray<number | string>,
  ): IArrayDeclarationError[] {
    const arms = OperandTyper.arrayArms(value, this.context);
    if (arms === null) {
      return [
        {
          code: "E0866",
          span: value.span,
          message: ArrayValueRule.notAnArrayMessage(value),
          helpText: ArrayValueRule.NOT_AN_ARRAY_HELP,
        },
      ];
    }
    return arms.flatMap((arm) =>
      this.shapeMismatch(arm, at, "declaration", declared),
    );
  }

  /** A declaration's sizes, folded where they fold, as its list is counted */
  private declaredDimensions(
    declaration: IVariableDeclarationSyntax,
  ): ReadonlyArray<number | string> {
    const type = declaration.type;
    return [
      ...(type.kind === "array" ? type.dimensions : []),
      ...declaration.dimensions,
    ].map((size) =>
      size === null
        ? ""
        : (ConstantExpression.valueAt(size, this.context) ?? size.written),
    );
  }

  /**
   * #2194: the callee reads an array argument with the parameter's shape, so
   * the two agree wherever both sizes fold. #1209: so does an array copied
   * into a declaration or an assignment's target.
   */
  private shapeMismatch(
    value: TExpression,
    at: IValuePosition,
    noun: "parameter" | "target" | "declaration",
    taken: ReadonlyArray<number | string> = at.dimensions,
  ): IArrayDeclarationError[] {
    const given = OperandTyper.typeOf(value, this.context)?.dimensions;
    if (given === undefined) return [];
    const agree =
      given.length === taken.length &&
      given.every(
        (size, i) =>
          typeof size !== "number" ||
          typeof taken[i] !== "number" ||
          size === taken[i],
      );
    if (agree) return this.elementMismatch(value, at, noun);
    const shape = (sizes: ReadonlyArray<number | string>) =>
      sizes.map((size) => `[${size}]`).join("");
    return [
      {
        code: "E0866",
        span: value.span,
        message:
          noun === "parameter"
            ? `An array of shape ${shape(given)} is passed for a parameter of shape ${shape(taken)}`
            : `An array of shape ${shape(given)} is copied into a ${noun} of shape ${shape(taken)}`,
        helpText:
          noun === "parameter"
            ? "Pass an array of the parameter's shape, or write its elements as a list (ADR-014)."
            : "Copy an array of the same shape, or write its elements as a list (ADR-035).",
      },
    ];
  }

  private static check(
    value: TExpression,
    at: IValuePosition,
    context: IAnalysisContext,
  ): IArrayDeclarationError[] {
    const element =
      at.typeText === null ? null : TypeText.withoutDimensions(at.typeText);
    if (value.kind === "arrayInitializer") {
      return ArrayListCount.mismatches(value, at.dimensions, element, context);
    }
    if (ExpressionShape.givesWholeArray(value, element)) return [];
    return [ArrayListCount.notAList(value)];
  }

  /**
   * #2209: the callee reads an array argument with the parameter's element
   * layout, so a primitive or a string element agrees too -- `u16[4]` for
   * `u8[4]`, or `string<4>[2]` for `string<8>[2]`, was misread at exit 0.
   */
  private elementMismatch(
    value: TExpression,
    at: IValuePosition,
    noun: "parameter" | "target" | "declaration",
  ): IArrayDeclarationError[] {
    if (at.typeText === null) return [];
    const taken = TypeText.withoutDimensions(at.typeText);
    const given = OperandTyper.typeOf(value, this.context)?.typeName ?? null;
    if (given === null || given === taken) return [];
    const compared =
      TypeCheckUtils.isInteger(taken) ||
      TypeCheckUtils.isFloat(taken) ||
      taken === "bool" ||
      TypeCheckUtils.isSizedStringName(taken);
    if (!compared) return [];
    return [
      {
        code: "E0866",
        span: value.span,
        message:
          noun === "parameter"
            ? `An array of ${given} is passed for a parameter of ${taken}`
            : `An array of ${given} is copied into a ${noun} of ${taken}`,
        helpText:
          noun === "parameter"
            ? "Pass an array of the parameter's element type; an array is passed by reference and is not converted (ADR-014)."
            : "Copy an array of the same element type; an array's elements are not converted (ADR-035).",
      },
    ];
  }

  private static markAsked(
    value: TExpression,
    at: IValuePosition,
    positions: IValuePositions,
    asked: Set<TExpression>,
  ): void {
    asked.add(value);
    for (const child of ExpressionChildren.of(value)) {
      // Only an operand stands in its value's position; a call's argument is
      // asked at its parameter's
      if (positions.positions.get(child) !== at) continue;
      WholeArrayValueAnalyzer.markAsked(child, at, positions, asked);
    }
  }
}

export default WholeArrayValueAnalyzer;
