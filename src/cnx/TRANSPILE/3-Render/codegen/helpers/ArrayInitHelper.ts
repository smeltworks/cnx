/**
 * ArrayInitHelper - Handles array initialization with size inference and fill-all syntax
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Array initializers with size inference: u8[] data <- [1, 2, 3]
 * - Fill-all syntax: u8 data[10] <- [0*]
 * - Array size validation
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import invariant from "../../../../utils/invariant";
import type TranspileState from "../../../TranspileState";
import type IPlannedWholeArrayWrite from "../../../2-Plan/types/IPlannedWholeArrayWrite";

/**
 * Result from processing array initialization.
 */
interface IArrayInitResult {
  /** Whether this was an array initializer (vs regular expression) */
  isArrayInit: boolean;
  /** The dimension suffix to add to declaration (e.g., "[3]") */
  dimensionSuffix: string;
  /** The final initializer value */
  initValue: string;
}

/**
 * Callbacks required for array initialization.
 * These need CodeGenerator context and cannot be replaced with static state.
 *
 * #1445 box 3: these are THUNKS, and the nodes they used to take are closed
 * over by the caller. This module never read anything off those three
 * contexts -- each was received and handed straight back to the callback the
 * caller supplied -- so naming `ExpressionContext`, `TypeContext` and
 * `ArrayDimensionContext` here bought a dependency on the grammar purely to
 * pass values through.
 *
 * Thunks rather than pre-generated strings, deliberately: this helper decides
 * whether, and in what order, each renders.
 */
interface IArrayInitCallbacks {
  /** Generate the initializer expression's code */
  generateExpression: () => string;
  /** Generate the declaration's array dimension suffix */
  generateArrayDimensions: () => string;
}

/**
 * Handles array initialization with size inference and fill-all syntax.
 */
const ARGUMENT_COMMENT =
  "/* ADR-035 / Issue #2157: a list for an array parameter is an array of the parameter's shape, written where the argument stands. */";

class ArrayInitHelper {
  /**
   * Process array initialization expression.
   * Returns null if not an array initializer pattern.
   *
   * @param name - Variable name
   * @param hasEmptyArrayDim - Whether any dimension is empty (for inference)
   * @param declaredSize - First dimension size if explicit, null otherwise
   * @param callbacks - Callbacks to CodeGenerator methods
   */
  static processArrayInit(
    name: string,
    hasEmptyArrayDim: boolean,
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
    state: TranspileState,
  ): IArrayInitResult | null {
    // Reset and generate initializer
    state.resetArrayInitTracking();

    const initValue = callbacks.generateExpression();

    // Check if it was an array initializer
    if (!state.wasArrayInit()) {
      return null;
    }

    const dimensionSuffix = hasEmptyArrayDim
      ? ArrayInitHelper._processSizeInference(name, declaredSize, state)
      : ArrayInitHelper._processExplicitSize(declaredSize, callbacks, state);

    return { isArrayInit: true, dimensionSuffix, initValue };
  }

  /**
   * An inferred size (`u8[] data <- [1, 2, 3]`) is the declaration's: 1.3
   * counted the list and 1.4 settled it, and the `.h` states that number.
   *
   * #1664 box 3: this used to count the elements it had just rendered -- a
   * second derivation of one fact, which agreed with the header only while
   * nothing else shaped the suffix. For `u8[][3] n` it emitted `n[2]` against
   * the header's `n[2][3]` (#1822, now E0892 in pass 1.2). The rendered count
   * survives as the check that the two still agree.
   */
  private static _processSizeInference(
    name: string,
    declaredSize: number | null,
    state: TranspileState,
  ): string {
    // #1322: E0876 rejects the fill-all form on an inferred size in pass 1.2
    // (ADR-035); an inferred size is counted from a list.
    invariant(
      state.lastArrayFillValue === undefined,
      `an inferred array size comes from a list -- E0876 rejects the fill-all ` +
        `form [${state.lastArrayFillValue}*] on '${name}' in pass 1.2, before this runs`,
    );
    ArrayInitHelper.assertInferredSize(name, declaredSize, state);
    return `[${declaredSize}]`;
  }

  /**
   * The rendered list has exactly the elements 1.3 counted for an omitted
   * size. Every declaration renderer that emits an inferred size asks this,
   * right after rendering the list (#1824 review: the scope-member renderer
   * had no check at all).
   */
  static assertInferredSize(
    name: string,
    declaredSize: number | null,
    state: TranspileState,
  ): asserts declaredSize is number {
    invariant(
      declaredSize !== null,
      `an inferred size is its declaration's count, and '${name}' has none ` +
        `here -- a declaration fact that never reached render`,
    );
    invariant(
      state.lastArrayInitCount === declaredSize,
      `an inferred size is its declaration's -- 1.3 counted [${declaredSize}] ` +
        `for '${name}' but ${state.lastArrayInitCount} element(s) rendered`,
    );
  }

  /**
   * Process explicit array size with validation
   */
  private static _processExplicitSize(
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
    state: TranspileState,
  ): string {
    const dimensionSuffix = callbacks.generateArrayDimensions();

    // #1322: the element count is E0866's in pass 2.1 (ADR-035); an
    // initializer shorter than the declaration would be emitted as C's
    // partial initialization, which MISRA 9.3 forbids, so it is asserted.
    invariant(
      declaredSize === null ||
        state.lastArrayFillValue !== undefined ||
        state.lastArrayInitCount === declaredSize,
      `an array initializer has the declared number of elements -- E0866 rejects ` +
        `${state.lastArrayInitCount} for [${declaredSize}] in pass 2.1, before this runs`,
    );

    return dimensionSuffix;
  }

  /**
   * A temporary of a whole array's own type, initialized by its rendered
   * value as a declaration is (#1782, #2157): C can neither assign an array
   * nor pass a list for one.
   */
  static temporaryArray(
    array: IPlannedWholeArrayWrite,
    renderedValue: string,
    state: TranspileState,
  ): { readonly name: string; readonly declaration: string } {
    const name = state.getNextTempVarName();
    return {
      name,
      declaration: `const ${array.elementCType} ${name}${ArrayInitHelper.shapeOf(array)} = ${renderedValue};`,
    };
  }

  /**
   * A list passed for an array parameter (#2157), evaluated where it stands,
   * as any argument is: under `&&`, `||` or `?:` it is not evaluated when
   * its operand is not. C writes it as a compound literal. C++ has none, so
   * the array type is named before the statement -- a typedef evaluates
   * nothing -- and the list is that type's temporary, which lives to the end
   * of the full expression.
   */
  static arrayArgument(
    array: IPlannedWholeArrayWrite,
    renderedValue: string,
    state: TranspileState,
  ): string {
    if (!state.pendingTempDeclarations.includes(ARGUMENT_COMMENT)) {
      state.pendingTempDeclarations.push(ARGUMENT_COMMENT);
    }
    // A compound literal and a functional cast take a braced list; a string
    // in braces initializes a `uint8_t` array (C11 6.7.9p14, C++ [dcl.init.string])
    const init = array.fromList ? renderedValue : `{${renderedValue}}`;
    const shape = ArrayInitHelper.shapeOf(array);
    if (!state.cppMode) return `(const ${array.elementCType}${shape})${init}`;
    const type = `${state.getNextTempVarName()}_t`;
    state.pendingTempDeclarations.push(
      `typedef const ${array.elementCType} ${type}${shape};`,
    );
    return `static_cast<${type}&>(${type}${init})`;
  }

  private static shapeOf(array: IPlannedWholeArrayWrite): string {
    return array.dimensions.map((size) => `[${size}]`).join("");
  }

  /**
   * A fill-all's list (ADR-035): its value once per slot of its level, the
   * count 2.2 planned (#2110). C fills every slot `{v}` leaves out with zero,
   * so a zero or empty-string fill, or a size that does not fold, stays `{v}`.
   */
  static fillAll(value: string, size: number | null): string {
    if (size === null || value === "0" || value === '""') return `{${value}}`;
    return `{${new Array<string>(size).fill(value).join(", ")}}`;
  }
}

export default ArrayInitHelper;
