import ZeroValue from "./ZeroValue";
import ExpressionShape from "../../../utils/ExpressionShape";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import type TExpression from "../../../types/syntax/TExpression";
import type IArrayDeclarationError from "../types/IArrayDeclarationError";
import type IAnalysisContext from "../types/IAnalysisContext";

type TArrayInitializer = Extract<TExpression, { kind: "arrayInitializer" }>;
type TSize = number | string | null;

/** The position a list is checked against: its sizes and its element type */
interface IListPosition {
  readonly sizes: readonly TSize[];
  readonly elementType: string | null;
  readonly context: IAnalysisContext;
}

/**
 * ADR-035, E0866: a list has one element per slot at every level, or the
 * fill-all form `[v*]` for a level. A declaration's list and a field's, an
 * assignment target's or an argument's are checked by this one rule (#1782),
 * each against the sizes its own position takes; a size that does not fold is
 * not counted. A row is a whole array (ADR-014), so an element at a level
 * with dimensions left is a list too -- or, for a `u8` row, a string literal
 * -- and a string array's slot is a string literal (#2195). A size is a
 * folded number, the spelling of one that does not fold (a C macro), or null
 * for none. C has no initializer that repeats a value an unknown number of
 * times, only one that zero-fills what it leaves out, so a fill-all for a size
 * that does not fold must be zero: `0` (`false`, a zero const) or, for a
 * string array, `""` (#2196).
 */
class ArrayListCount {
  static mismatches(
    initializer: TArrayInitializer,
    sizes: readonly TSize[],
    elementType: string | null,
    context: IAnalysisContext,
  ): IArrayDeclarationError[] {
    const found: IArrayDeclarationError[] = [];
    ArrayListCount.checkLevel(
      initializer,
      { sizes, elementType, context },
      0,
      found,
    );
    return found;
  }

  /** An array (or a row) given something other than ADR-035's list */
  static notAList(value: TExpression): IArrayDeclarationError {
    return {
      code: "E0866",
      span: value.span,
      message: `An array must be given a list, not '${value.written}'`,
      helpText:
        "Write the elements out in brackets, or set them one at a time (ADR-035).",
    };
  }

  /** A fill-all other than `[0*]` for a size that does not fold */
  private static unfoldedFill(
    fill: TExpression,
    size: string,
  ): IArrayDeclarationError {
    return {
      code: "E0866",
      span: fill.span,
      message: `A fill-all [${fill.written}*] other than zero needs a size cnx can fold, and '${size}' does not`,
      helpText:
        "Write the elements out, fill with zero, or size the array with a cnx constant (ADR-035).",
    };
  }

  /**
   * A fill-all whose value stands in each row's slot, which takes a list
   * (#2195): `u8[4][4] g <- [0*]`. ADR-036's `[0*][4*]` does not parse (#2206).
   */
  private static rowFill(fill: TExpression): IArrayDeclarationError {
    return {
      code: "E0866",
      span: fill.span,
      message: `A fill-all for an array of rows fills each row with a list, not '${fill.written}'`,
      helpText: `Give each row its own fill-all, such as [[${fill.written}*], [${fill.written}*]] (ADR-035).`,
    };
  }

  /** A string array's slot given something other than a string literal */
  private static notAStringLiteral(
    value: TExpression,
    isFill: boolean,
  ): IArrayDeclarationError {
    return {
      code: "E0866",
      span: value.span,
      message: `A string array's element in a list must be a string literal, not '${value.written}'`,
      helpText: isFill
        ? 'Fill a string array with a string literal, such as [""*] (ADR-035).'
        : "Write the string out as a literal, or set the element on its own (ADR-035).",
    };
  }

  /** Count one level of a nested list against its dimension, then descend. */
  private static checkLevel(
    initializer: TArrayInitializer,
    at: IListPosition,
    level: number,
    found: IArrayDeclarationError[],
  ): void {
    const fill = initializer.fill;
    const elements = fill === null ? initializer.elements : [fill];
    const declared = at.sizes[level];
    if (
      fill !== null &&
      typeof declared === "string" &&
      !ArrayListCount.fillsWithZero(fill, at)
    ) {
      found.push(ArrayListCount.unfoldedFill(fill, declared));
      return;
    }
    if (
      fill === null &&
      typeof declared === "number" &&
      elements.length !== declared
    ) {
      const where = level > 0 ? ` at nesting level ${level + 1}` : "";
      found.push({
        code: "E0866",
        span: initializer.span,
        message: `Array size mismatch: declared [${declared}] but the initializer has ${elements.length} element(s)${where}`,
        helpText:
          "Give one element per slot, or use the fill-all form such as [0*] (ADR-035).",
      });
      return;
    }
    for (const element of elements) {
      if (element.kind === "arrayInitializer") {
        ArrayListCount.checkLevel(element, at, level + 1, found);
      } else if (level + 1 < at.sizes.length) {
        if (!ExpressionShape.givesWholeArray(element, at.elementType)) {
          found.push(
            element === fill
              ? ArrayListCount.rowFill(fill)
              : ArrayListCount.notAList(element),
          );
        }
      } else if (
        at.elementType !== null &&
        TypeCheckUtils.isSizedStringName(at.elementType) &&
        !ExpressionShape.isStringLiteral(element)
      ) {
        found.push(ArrayListCount.notAStringLiteral(element, element === fill));
      }
    }
  }

  /** What C's `{v}` gives every slot it leaves out: zero, or a string's `""` */
  private static fillsWithZero(fill: TExpression, at: IListPosition): boolean {
    if (ExpressionShape.isStringLiteral(fill)) return fill.written === '""';
    return ZeroValue.of(fill, at.context);
  }
}

export default ArrayListCount;
