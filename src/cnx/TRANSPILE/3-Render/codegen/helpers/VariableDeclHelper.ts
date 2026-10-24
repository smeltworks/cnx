/**
 * VariableDeclHelper - Renders variable declarations
 *
 * Issue #792: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Variable declarations with initializers
 * - Array declarations with dimension placement
 * - C++ constructor declarations
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * This module used to take a `VariableDeclarationContext` and ask it the same
 * questions repeatedly -- is there an initializer, is there an arrayType, what
 * are the trailing dimensions -- across four helpers behind FOUR callback
 * interfaces, each naming its own subset of grammar types. The questions are
 * answered once now, by `CodeGenerator.planVariableDecl`, and what crosses is
 * `TPlannedVariableDecl`.
 *
 * ## The planner writes state, and that is not an accident
 *
 * Building the plan records the local, marks it as a pointer when its type
 * was inferred as one, and resolves its emitted name. What the name is typed
 * as is not written here: it binds through the lexical frames 1.4 settled
 * (#1668, C8, which deleted the render-time registry this once filled). The
 * plan is built immediately before it is rendered, in the same call. What is left here is assembly: prefixes, dimension placement, the
 * MISRA Rule 10.3 cast, and the C++ assignment queue.
 */

import invariant from "../../../../utils/invariant";
import ArrayInitHelper from "./ArrayInitHelper";
import NarrowingCastHelper from "../../../2-Plan/NarrowingCastHelper";
import StringDeclHelper from "./StringDeclHelper";
import IPlannedArrayDeclaration from "../types/IPlannedArrayDeclaration";
import TPlannedVariableDecl from "../types/TPlannedVariableDecl";
import TPlannedVariableInitializer from "../types/TPlannedVariableInitializer";
import type TranspileState from "../../../TranspileState";

/**
 * Result from rendering the array half of a declaration.
 */
interface IArrayDeclResult {
  /** Whether array init was fully handled (early return) */
  handled: boolean;
  /** Generated code if handled */
  code: string;
  /** Updated declaration string */
  decl: string;
  /** Whether this is an array type */
  isArray: boolean;
}

/**
 * Renders variable declarations in C.
 */
class VariableDeclHelper {
  // ========================================================================
  // Tier 1: Pure Operations (CodeGenState only)
  // ========================================================================

  // ========================================================================
  // Tier 2: Rendering one half of a declaration
  // ========================================================================

  /**
   * Render the array half: dimensions, or a complete ADR-035 initializer.
   */
  static renderArrayDeclaration(
    plan: IPlannedArrayDeclaration,
    sourceName: string,
    decl: string,
    state: TranspileState,
  ): IArrayDeclResult {
    if (!plan.isArray) {
      return { handled: false, code: "", decl, isArray: false };
    }

    // ADR-035: Handle array initializers with size inference
    if (plan.init) {
      // MISRA C:2012 Rule 9.3: an array declaration initializer is a declaration
      // initializer for its ELEMENTS too, so 2.2 plans its struct elements
      // plain exactly as the scalar path below (#1991). Without it a struct element formatted as a
      // compound literal -- `Point pair[2] = {(Point){ .x = 1 }, ...}` -- which
      // cppcheck reads as a partially initialized array, while the scalar
      // `Point single = { .x = 1 }` on the next line was already plain. One
      // declaration-initializer decision, previously made in two places.
      const init = plan.init;
      const arrayInitResult = ArrayInitHelper.processArrayInit(
        sourceName,
        plan.hasEmptyDimension,
        plan.declaredSize,
        {
          // Lazy, not pre-generated: the helper decides when each renders
          generateExpression: init.renderExpression,
          generateArrayDimensions: init.renderDimensions,
        },
        state,
      );
      if (arrayInitResult) {
        // When size inference happens and the empty dim is in arrayType,
        // dimensionSuffix already contains the inferred size - don't duplicate
        const fullDimSuffix = plan.hasEmptyArrayTypeDimension
          ? arrayInitResult.dimensionSuffix
          : plan.arrayTypeDimensions + arrayInitResult.dimensionSuffix;
        return {
          handled: true,
          code: `${decl}${fullDimSuffix} = ${arrayInitResult.initValue};`,
          decl,
          isArray: true,
        };
      }
    }

    // Generate dimensions: arrayType dimension first, then arrayDimension dimensions
    const newDecl =
      decl + plan.arrayTypeDimensions + plan.renderCStyleDimensions();

    return { handled: false, code: "", decl: newDecl, isArray: true };
  }

  /**
   * Render a variable's initializer, with the MISRA Rule 10.3 cast.
   */
  static renderVariableInitializer(
    plan: TPlannedVariableInitializer,
    decl: string,
    isArray: boolean,
    state: TranspileState,
  ): string {
    if (plan.kind === "zero") {
      // ADR-015: Zero initialization for uninitialized variables
      return `${decl} = ${plan.render(isArray)}`;
    }
    if (plan.kind === "cppClass") {
      return `${decl} = {}`;
    }

    const typeName = plan.renderTypeName();

    // #1322: ADR-024's initializer rules are E0868/E0869 in pass 2.1.

    // Issue #872: 2.2 planned the value against `typeName`, for MISRA 7.2's
    // U suffix (#1991)
    let exprCode = plan.renderExpression();

    // MISRA 10.3: Check for cross-type-category conversions (int <-> float).
    // Asked AFTER the render, because the question is what the expression
    // turned out to be.
    const exprType = plan.resolveExpressionType();
    if (
      exprType &&
      NarrowingCastHelper.isCrossTypeCategoryConversion(exprType, typeName)
    ) {
      // Int to float: add explicit cast
      if (
        NarrowingCastHelper.isIntegerCategory(exprType) &&
        NarrowingCastHelper.isFloatCategory(typeName)
      ) {
        exprCode = NarrowingCastHelper.wrapIntToFloat(
          exprCode,
          typeName,
          state,
        );
      }
      // Float to int is E0891 in pass 2.1 (#1800): the author writes the
      // cast, which saturates. This emitted a raw C conversion instead,
      // undefined for NaN and past the target's range.
      invariant(
        !(
          NarrowingCastHelper.isFloatCategory(exprType) &&
          NarrowingCastHelper.isIntegerCategory(typeName)
        ),
        "an implicit float-to-integer conversion is rejected in pass 2.1 (E0891)",
      );
    }

    return `${decl} = ${exprCode}`;
  }

  // ========================================================================
  // Tier 3: Orchestrator
  // ========================================================================

  /**
   * Render the declaration a plan describes.
   */
  static renderVariableDecl(
    plan: TPlannedVariableDecl,
    state: TranspileState,
  ): string {
    switch (plan.kind) {
      // Issue #375: C++ constructor syntax.
      //
      // ADR-057: emitted under the name registration decided on, not the
      // source one -- the planner did the registering.
      case "constructor":
        return `${plan.type} ${plan.emittedName}(${plan.args.join(", ")});`;

      // ADR-045: string types have their own three forms.
      case "string":
        return StringDeclHelper.generateStringDecl(
          plan.string,
          plan.emittedName,
          plan.modifiers,
          plan.isConst,
          state,
        );

      case "plain":
        return VariableDeclHelper.renderPlainDecl(plan, state);
    }
  }

  /**
   * Render everything that is neither a constructor nor a string.
   */
  private static renderPlainDecl(
    plan: Extract<TPlannedVariableDecl, { kind: "plain" }>,
    state: TranspileState,
  ): string {
    // ADR-057: the DECLARED identifier is the emitted one -- a local shadowing a
    // file-scope name carries a distinct C name so `global.x` still reaches
    // past it. References in the source say the bare name, and bind to this
    // declaration through the lexical frames; only the text moves.
    const base = `${plan.modifierPrefix}${plan.type} ${plan.emittedName}`;

    // Array declarations can complete the whole declaration themselves.
    const arrayResult = VariableDeclHelper.renderArrayDeclaration(
      plan.array,
      plan.sourceName,
      base,
      state,
    );
    if (arrayResult.handled) {
      return arrayResult.code;
    }

    const decl = VariableDeclHelper.renderVariableInitializer(
      plan.initializer,
      arrayResult.decl,
      arrayResult.isArray,
      state,
    );

    // #1534: the fill is written against the emitted object, by name (ADR-057)
    const initializer = plan.initializer;
    if (initializer.kind === "cppClass") {
      return [`${decl};`, ...initializer.renderFill(plan.emittedName)].join(
        "\n",
      );
    }
    return `${decl};`;
  }
}

export default VariableDeclHelper;
