/**
 * ParameterInputAdapter - Adapts different input formats to IParameterInput
 *
 * Provides two conversion methods:
 * - fromAST(): For CodeGenerator, converts IPlannedParameter + CodeGenState
 * - fromSymbol(): For HeaderGenerator, converts IParameterSymbol
 *
 * Both produce normalized IParameterInput for use with ParameterSignatureBuilder.
 *
 * #1445: `fromAST` keeps its name and takes a record of facts now rather than
 * a `ParameterContext` and three callbacks that each took another parse node.
 * Everything those callbacks did was turn a node into a string; every decision
 * after that is about strings and `CodeGenState`, which is why this module
 * names no parse type at all.
 *
 * The two methods therefore differ in WHICH record they read, not in kind --
 * which is what makes the remaining problem tractable. They are still two
 * derivations of one parameter, from two sources, and the .c/.h divergences
 * this file keeps recording (#914, #1164, #1545) are three instances of that
 * one defect rather than three bugs. Filed as #1639.
 */

import type ISourceSite from "../../../../types/ISourceSite";
import AdrProvenance from "../../../../instrumentation/AdrProvenance";
import IParameterInput from "../types/IParameterInput";
import type IPlannedParameter from "../types/IPlannedParameter";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import ICallbackTypeInfo from "../../../../types/ICallbackTypeInfo";
import type IParameterPassing from "../../../../types/IParameterPassing";
import invariant from "../../../../utils/invariant";

/**
 * Dependencies required by fromAST() to resolve types and state.
 * These are passed in to avoid direct dependency on CodeGenState,
 * making the adapter more testable.
 */
interface IFromASTDeps {
  /** Map of callback type names to their info */
  callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;

  /** #1639: how C declares the parameter, decided once in 2.2 */
  passing: IParameterPassing;

  /**
   * Issue #995 / #1722: whether this parameter is an opaque handle (an
   * incomplete struct typedef). Pre-computed, like `isPassByValue`: it is the
   * parameter registry's answer (`TParameterInfo.isOpaqueHandle`), so the
   * signature and every whole-value use of the parameter read one decision.
   * An opaque handle takes pointer syntax.
   */
  isOpaqueHandle: boolean;

  /** #1402: where a parameter's type is declared, for ADR-029/030 provenance */
  declarationOf: (typeName: string) => ISourceSite | undefined;
}

/**
 * Dependencies required by fromSymbol() to resolve types.
 * Simpler than AST deps since IParameterSymbol already contains most info.
 */
interface IFromSymbolDeps {
  /** Map cnx type to C type */
  mapType: (type: string) => string;
}

/**
 * Static adapter class for converting different input formats to IParameterInput.
 */
class ParameterInputAdapter {
  /**
   * Convert AST ParameterContext to normalized IParameterInput.
   * Used by CodeGenerator.generateParameter().
   *
   * Note: Validation (C-style array rejection, unbounded dimension rejection)
   * should be done BEFORE calling this method.
   *
   * @param ctx - The parser context for the parameter
   * @param deps - Dependencies for type resolution and state lookup
   * @returns Normalized IParameterInput
   */
  static fromAST(
    planned: IPlannedParameter,
    deps: IFromASTDeps,
  ): IParameterInput {
    const { name, typeName, mappedType, isConst } = planned;

    // Check for callback type
    // #1984: the planned type's answer; the map only spells the typedef
    const callbackInfo = planned.isCallback
      ? deps.callbackTypes.get(typeName)
      : undefined;
    if (callbackInfo) {
      // ADR-029 decided here: a parameter naming a function-as-type is written
      // as its `_fp` typedef. Recorded at the PARAMETER's position so a
      // codegen-only fixture occupies the enclosing function's matrix cell
      // (#1929); ADR-029 had no recording site, so its typedef fixtures were
      // listed as having no derivable context.
      AdrProvenance.record(
        "029",
        planned.line,
        undefined,
        deps.declarationOf(typeName),
      );
      return this._buildCallbackInput(
        name,
        typeName,
        mappedType,
        callbackInfo.typedefName,
      );
    }

    // Check for array type
    if (planned.renderDimensions) {
      return this._buildArrayInputFromAST(planned, deps);
    }

    // Check for string type (non-array)
    if (planned.isString) {
      return this._buildStringInput(planned, deps);
    }

    // Issue #995: Opaque handles — rule applied in ParameterSignatureBuilder.
    // #1722: read, not re-derived; see IFromASTDeps.isOpaqueHandle. It is also
    // #958's "C-header typedef struct needs pointer semantics": that asked
    // `isTypedefStructType`, which StructCollector marks under exactly the
    // condition it marks an opaque type, so it was the same fact decided a
    // second time.
    const isOpaque = deps.isOpaqueHandle;
    if (isOpaque) {
      // ADR-030 decided here: an incomplete type can only be handled through a
      // pointer, which is why #995's `const T*` was wrong. Recorded at the
      // PARAMETER's position so the matrix sees the enclosing function's
      // context.
      //
      // #1511: this is the only thing an occupancy can be derived from for the
      // OPAQUE-HANDLE half of ADR-030, which shapes generated code and reports
      // nothing. The ADR does raise diagnostics -- E0422/E0423/E0426/E0427 --
      // and since #1582 their fixtures occupy cells here too, on their own
      // reported positions. Occupancy is per ADR, not per code, so a cell
      // occupied by one half says nothing about the other: deleting this line
      // leaves `scope method / same file` green.
      //
      // #1445: the position comes from the planned parameter now. It is the
      // same position -- `ctx.start?.line` of the parameter context -- read
      // once by the planner instead of here.
      AdrProvenance.record(
        "030",
        planned.line,
        undefined,
        deps.declarationOf(typeName),
      );
    }
    return this._buildScalarInput(
      name,
      typeName,
      mappedType,
      isConst,
      deps.passing,
      isOpaque,
    );
  }

  /**
   * Convert IParameterSymbol to normalized IParameterInput.
   * Used by BaseHeaderGenerator.generateParameter().
   *
   * The caller pre-computes isPassByValue (ISR, float, enum, passByValueSet).
   * Non-PBV, non-array, non-string types use pass-by-reference.
   *
   * @param param - The parameter symbol
   * @param deps - Dependencies for type mapping
   * @returns Normalized IParameterInput
   */
  static fromSymbol(
    param: IParameterSymbol,
    deps: IFromSymbolDeps,
  ): IParameterInput {
    const mappedType = deps.mapType(param.type);

    // Array parameters
    if (
      param.isArray &&
      param.arrayDimensions &&
      param.arrayDimensions.length > 0
    ) {
      return this._buildArrayInputFromSymbol(param, mappedType);
    }

    // String type detection
    const isString =
      param.type === "string" || param.type.startsWith("string<");

    // Non-array string
    if (isString && !param.isArray) {
      return {
        name: param.emittedName,
        baseType: param.type,
        mappedType: "char",
        isConst: param.isConst,

        isArray: false,
        isCallback: false,
        isString: true,
        isPassByValue: false,
        isPassByReference: false,
        // #1545: the general branch below carries this and the string branch
        // did not, so a typedef declaring `const char *` reached the .c (via
        // forceConst on the AST path) and never reached the .h -- the same
        // .c/.h disagreement as the missing callback term, in the opposite
        // direction.
        forceConst:
          ParameterInputAdapter._passingOf(param).typedefConst || undefined,
      };
    }

    // ADR-029 / #1164: a parameter whose type IS a callback function is written
    // as its typedef, with no added pointer — the typedef is already a function
    // pointer. Hardcoding isCallback false here made the header emit
    // "onReceive_fp* handler" where the .c emits "onReceive_fp handler".
    if (param.isCallback && param.callbackTypedefName) {
      return this._buildCallbackInput(
        param.emittedName,
        param.type,
        mappedType,
        param.callbackTypedefName,
      );
    }

    return this._buildScalarInput(
      param.emittedName,
      param.type,
      mappedType,
      param.isConst,
      ParameterInputAdapter._passingOf(param),
      param.isOpaqueHandle ?? false,
    );
  }

  /**
   * #1639: the one derivation of a scalar parameter's input, from the 2.2
   * passing decision, for both the `.c` and the `.h`. Each used to decide
   * pointer-or-value for itself from different facts.
   */
  private static _buildScalarInput(
    name: string,
    baseType: string,
    mappedType: string,
    isConst: boolean,
    passing: IParameterPassing,
    isOpaqueHandle: boolean,
  ): IParameterInput {
    return {
      name,
      baseType,
      mappedType,
      isConst,
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue: passing.byValue,
      isPassByReference: !passing.byValue,
      // Issue #895/#958: a C typedef or an opaque handle is a pointer in C++ too
      forcePointerSyntax: passing.typedefPointer || isOpaqueHandle || undefined,
      forceConst: passing.typedefConst || undefined,
      isOpaqueHandle: isOpaqueHandle || undefined,
    };
  }

  /** The 2.2 decision HeaderEmissionCapture stamped on the parameter */
  private static _passingOf(param: IParameterSymbol): IParameterPassing {
    invariant(
      param.passing !== undefined,
      `2.2 decided how '${param.name}' is passed before its prototype renders`,
    );
    return param.passing;
  }

  /**
   * Build IParameterInput for a callback parameter.
   */
  private static _buildCallbackInput(
    name: string,
    typeName: string,
    mappedType: string,
    typedefName: string,
  ): IParameterInput {
    return {
      name,
      baseType: typeName,
      mappedType,
      isConst: false,
      isArray: false,
      isCallback: true,
      callbackTypedefName: typedefName,
      isString: false,
      isPassByValue: true, // Callbacks are function pointers, pass by value
      isPassByReference: false,
    };
  }

  /**
   * Build IParameterInput for an array parameter from AST.
   */
  private static _buildArrayInputFromAST(
    planned: IPlannedParameter,
    deps: IFromASTDeps,
  ): IParameterInput {
    const { name, typeName, mappedType, isConst, isString } = planned;

    // ADR-030 / #996 decided here for an array of handles, exactly as the
    // scalar branch records it for one handle: the element is held through a
    // pointer. Recorded at the parameter's position, like that branch.
    if (deps.isOpaqueHandle) {
      AdrProvenance.record(
        "030",
        planned.line,
        undefined,
        deps.declarationOf(typeName),
      );
    }

    // Issue #1159 is decided by the planner: a dimension that is a
    // compile-time constant is folded to its value, because emitting the
    // identifier makes `u8[SIZE] buf` a VLA parameter while the matching local
    // declaration folds to `uint8_t b[6]` -- the same const rendered two ways
    // in one .c, and a construct CLAUDE.md rules out.
    const dims: string[] = [...planned.renderDimensions!()];

    // The null terminator is decided HERE, not by the planner: `string<8>[2]`
    // is two 9-byte rows, and a capacity is a language fact where a dimension
    // is a C one.
    if (isString && planned.stringCapacity !== undefined) {
      dims.push(String(planned.stringCapacity + 1));
    }

    return {
      name,
      baseType: typeName,
      mappedType,
      isConst,
      isArray: true,
      arrayDimensions: dims,
      isCallback: false,
      isString,
      isPassByValue: false, // Arrays are always passed by pointer
      isPassByReference: false,
      // #1545: an array parameter drops the typedef's const exactly as the
      // string branch did. A `void (*)(const uint8_t *)` typedef against
      // `void onData(u8[4] buf)` emitted `uint8_t buf[4]` in BOTH files, so the
      // two agreed with each other and neither matched the typedef --
      // an incompatible-pointer-type warning at the registration, transpiler exit 0.
      forceConst: deps.passing.typedefConst || undefined,
      // ADR-030 / #996: the registry's one answer, which for an array means
      // each element is a handle -- `Dev* arr[2]`, not an array of an
      // incomplete type.
      isOpaqueHandle: deps.isOpaqueHandle || undefined,
    };
  }

  /**
   * Build IParameterInput for an array parameter from symbol.
   */
  private static _buildArrayInputFromSymbol(
    param: IParameterSymbol,
    mappedType: string,
  ): IParameterInput {
    const isString =
      param.type === "string" || param.type.startsWith("string<");
    const isUnboundedString = param.type === "string"; // No capacity specified

    // For header generator, we need to use char for string arrays
    const actualMappedType = isString ? "char" : mappedType;

    return {
      name: param.emittedName,
      baseType: param.type,
      mappedType: actualMappedType,
      isConst: param.isConst,
      isArray: true,
      arrayDimensions: param.arrayDimensions,
      isCallback: false,
      isString,
      isUnboundedString,
      isPassByValue: false,
      isPassByReference: false,
      // #1545: same as the AST array branch -- the typedef's const has to reach
      // the header too, or the .h contradicts the .c it was generated beside.
      forceConst:
        ParameterInputAdapter._passingOf(param).typedefConst || undefined,
      // ADR-030 / #996: same as the AST array branch -- an array of handles is
      // an array of pointers in the header too.
      isOpaqueHandle: param.isOpaqueHandle || undefined,
    };
  }

  /**
   * Build IParameterInput for a non-array string parameter.
   */
  private static _buildStringInput(
    planned: IPlannedParameter,
    deps: IFromASTDeps,
  ): IParameterInput {
    const { name, typeName, isConst } = planned;
    const capacity = planned.stringCapacity;
    // #1545: the same rule the general path uses. This line previously omitted
    // the callback term, so a callback-compatible function's unmodified string
    // parameter took `const char*` in the .c while the .h kept `char*` -- the
    // definition contradicting its own prototype.
    return {
      name,
      baseType: typeName,
      mappedType: "char",
      isConst,
      isArray: false,
      isCallback: false,
      isString: true,
      stringCapacity: capacity,
      isPassByValue: false,
      isPassByReference: false,
      // #1545: the third site that dropped the typedef's const. The general
      // branch of fromAST carries this and the string branch did not, so a
      // `const char *` typedef reached neither file once auto-const stopped
      // supplying the const by accident. Found by the fixture, not by reading.
      forceConst: deps.passing.typedefConst || undefined,
    };
  }
}

export default ParameterInputAdapter;
