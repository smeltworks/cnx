/**
 * ArgumentGenerator - Generates function arguments with proper ADR-006 semantics
 *
 * Issue #794: Extracted from CodeGenerator to reduce file size.
 * Uses CodeGenState for state access and callbacks for CodeGenerator methods.
 *
 * Handles argument generation patterns:
 * - Local variables get & (address-of) in C mode
 * - Member access (cursor.x) gets & (address-of)
 * - Array access (arr[i]) gets & (address-of)
 * - Parameters are passed as-is (already pointers)
 * - Arrays are passed as-is (naturally decay to pointers)
 * - Literals use compound literals for pointer params: &(type){value}
 * - Complex expressions are passed as-is
 */

import type TArgumentForm from "../../../2-Plan/types/TArgumentForm";
import CppModeHelper from "../../../2-Plan/CppModeHelper";
import IArgumentGeneratorCallbacks from "../../../2-Plan/types/IArgumentGeneratorCallbacks";
import type TranspileState from "../../../TranspileState";
import type TTypeInfo from "../../../../types/TTypeInfo";
import type TParameterInfo from "../../../../types/TParameterInfo";
import invariant from "../../../../utils/invariant";
import ArrayInitHelper from "./ArrayInitHelper";
import StringUtils from "../../../../utils/StringUtils";
import type TRenderedStringPart from "../../../../types/TRenderedStringPart";

/**
 * Generates function arguments with proper pass-by-reference semantics.
 */
class ArgumentGenerator {
  /**
   * Handle simple identifier argument (parameter, array, pointer, or variable).
   * This is a pure function that only reads from state.
   *
   * @param emitted the C name the one binder gives the identifier (#1760
   *   review), a parameter's too (#1290 review: a moved parameter passed
   *   under the name as written was the global it shadows):
   *   a shadowing local's ADR-057 name, or a scope member's qualified name.
   *   This used to be decided here from `getScopeMembers().has(id)` or the
   *   bare `id`, so a local shadowing a global or a member was passed as the
   *   global or the member, and a scope member array as its bare name.
   */
  static handleIdentifierArg(
    emitted: string,
    parameter: TParameterInfo | undefined,
    declared: TTypeInfo | undefined,
    state: TranspileState,
  ): string {
    // Parameters are already pointers (#1969: the parameter the name binds to
    // where it is passed, not a block-local that shadows it)
    if (parameter) {
      return emitted;
    }

    // Arrays decay to pointers, local or not, strings included (#1668: the
    // declaration's answer, which the `localArrays` set only duplicated): a
    // `char[N]` decays to `char*`
    // exactly like any other array, and a `string<N>` parameter is generated as
    // `char*`. Taking its address instead yields `char (*)[N]`, an incompatible
    // pointer type -- the defect `e3dff5f4` fixed by deleting the `isString`
    // exception this comment used to argue for.
    const typeInfo = declared;
    if (typeInfo?.isArray) {
      return emitted;
    }

    // Issue #895 Bug B: Inferred pointers are already pointers, don't add &
    if (typeInfo?.isPointer) {
      return emitted;
    }

    // A variable - add & (except in C++ mode)
    return CppModeHelper.maybeAddressOf(emitted, state);
  }

  /** A value: in C, a compound literal the pointer parameter can point at */
  static handleRvalueArg(
    compoundLiteral: string | null,
    callbacks: Pick<IArgumentGeneratorCallbacks, "generateExpression">,
  ): string {
    const value = callbacks.generateExpression();
    return compoundLiteral === null ? value : `&(${compoundLiteral}){${value}}`;
  }

  /** C++: a member converted to the parameter's type through a temporary */
  static createCppMemberConversionTemp(
    cType: string,
    callbacks: Pick<IArgumentGeneratorCallbacks, "generateExpression">,
    state: TranspileState,
  ): string {
    const value = callbacks.generateExpression();
    // Issue #1131: one temporary namer for every family. This site previously
    // incremented the shared counter itself and spelled the name a third way
    // (`_cnx_tmp_<N>` alongside `_tmp<N>`), so the two families agreed only by
    // coincidence of drawing from the same counter.
    const tempName = state.getNextTempVarName();
    const castExpr = CppModeHelper.cast(cType, value, state);
    state.pendingTempDeclarations.push(`${cType} ${tempName} = ${castExpr};`);
    return CppModeHelper.maybeAddressOf(tempName, state);
  }

  /** An lvalue by address, cast to `cast*` when `cast` is not null */
  static handleLvalueArg(
    cast: string | null,
    callbacks: Pick<IArgumentGeneratorCallbacks, "generateExpression">,
    state: TranspileState,
  ): string {
    const expr = CppModeHelper.maybeAddressOf(
      callbacks.generateExpression(),
      state,
    );
    if (cast === null) return expr;
    return CppModeHelper.reinterpretCast(`${cast}*`, expr, state);
  }

  static generateArg(
    simpleId: {
      readonly emitted: string;
      readonly parameter: TParameterInfo | undefined;
    } | null,
    declared: TTypeInfo | undefined,
    form: TArgumentForm,
    callbacks: Pick<IArgumentGeneratorCallbacks, "generateExpression"> & {
      readonly renderStringParts: () => readonly TRenderedStringPart[];
    },
    state: TranspileState,
  ): string {
    switch (form.kind) {
      case "identifier":
        invariant(simpleId !== null, "an identifier argument is a bare name");
        return ArgumentGenerator.handleIdentifierArg(
          simpleId.emitted,
          simpleId.parameter,
          declared,
          state,
        );
      case "array":
        return callbacks.generateExpression();
      case "member-temp":
        return ArgumentGenerator.createCppMemberConversionTemp(
          form.cType,
          callbacks,
          state,
        );
      case "lvalue":
        return ArgumentGenerator.handleLvalueArg(form.cast, callbacks, state);
      case "literal-address":
        return `&${callbacks.generateExpression()}`;
      case "register":
        return form.pointer;
      case "rvalue":
        return ArgumentGenerator.handleRvalueArg(
          form.compoundLiteral,
          callbacks,
        );
      case "array-temp":
        return ArrayInitHelper.arrayArgument(
          form.array,
          callbacks.generateExpression(),
          state,
        );
      case "string-built":
        return ArgumentGenerator.builtStringArg(
          form.capacity,
          callbacks.renderStringParts(),
          state,
        );
    }
  }

  /**
   * #2239: the string a concatenation or a substring gives a `string<N>`
   * parameter, built into a temporary before the statement, the way an
   * assignment builds it before copying it in
   */
  private static builtStringArg(
    capacity: number,
    parts: readonly TRenderedStringPart[],
    state: TranspileState,
  ): string {
    const temp = state.getNextTempVarName();
    state.pendingTempDeclarations.push(
      "/* ADR-045 / Issue #2239: a concatenation or a substring argument is built into a string<N> before the call. */",
      `char ${temp}[${capacity + 1}] = "";`,
      ...StringUtils.build(temp, capacity, parts),
    );
    return temp;
  }
}

export default ArgumentGenerator;
