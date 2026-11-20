import ParameterPassing from "./ParameterPassing";
import ParameterByValue from "../../utils/ParameterByValue";
import RegisterInstance from "../../utils/RegisterInstance";
import type TParameterInfo from "../../types/TParameterInfo";
import type IFunctionContextCallbacks from "./types/IFunctionContextCallbacks";
import type IPlannedFunctionParameter from "./types/IPlannedFunctionParameter";
import type IPlannedType from "./types/IPlannedType";
import type TranspileState from "../TranspileState";

/** A parameter type's name and the kind of value it holds */
interface IParameterTypeInfo {
  typeName: string;
  isStruct: boolean;
  isCallback: boolean;
  isString: boolean;
}

/**
 * #1991: how each parameter of a function is used in its body, decided by 2.2
 * for every function of the file before 2.3 renders one. 2.3 enters a
 * function with these answers rather than working them out as it goes, so
 * 2.2 reads the same answers 2.3 does when it plans an argument.
 */
class ParameterInfoPlanner {
  /** Parameter `paramIndex` of the function emitted as `functionName` */
  static infoOf(
    param: IPlannedFunctionParameter,
    paramIndex: number,
    functionName: string,
    callbacks: IFunctionContextCallbacks,
    state: TranspileState,
  ): TParameterInfo {
    const { name, isArray, isConst } = param;

    const typeInfo = ParameterInfoPlanner.resolveParameterTypeInfo(
      param.type,
      callbacks,
    );

    // #1639: pointer or value, as the signature, the prototype and every
    // call read it
    const passing = ParameterPassing.of(functionName, paramIndex, state);
    const isCallbackPointerParam = passing.typedefPointer;

    // ADR-030 / #1722: whether this parameter holds opaque handles -- read from
    // the stamp 1.4 set on the function's settled parameter, the one decision
    // the `.h` prototype reads too. An opaque type reaches `isStruct` through
    // it (#958's "C-header typedef struct needs pointer semantics" is the same
    // fact: StructCollector marks both under one condition), and a complete
    // one through its known fields, so `isStruct` alone cannot tell the two
    // apart -- and they differ in exactly the fact that matters: a complete
    // struct's value is `(*p)`, while an opaque handle's value is `p`, because
    // the pointer IS the handle. The signature (`ParameterInputAdapter.fromAST`)
    // and every whole-value use of the parameter read this answer rather than
    // asking again. No shape of the parameter is excepted: an array of handles
    // is an array of pointers (#996), and the `!isArray` this once carried is
    // what left `Dev[2] arr` as `Dev arr[2]`.
    const isOpaqueHandle =
      ParameterByValue.settledParameters(functionName, state)[paramIndex]
        ?.isOpaqueHandle === true;

    // Determine isStruct: for callback-compatible params, both typedef AND type info matter
    // - If typedef says pointer AND it's actually a struct, use -> access (isStruct=true)
    // - If typedef says pointer BUT it's a primitive (like u8), don't treat as struct
    //   (primitives use forcePointerSemantics for dereference instead)
    // Issue #958: C-header typedef struct types are always treated as struct (pointer semantics)
    // ADR-072: a register parameter is a pointer to its layout in C and C++
    const isRegister = RegisterInstance.isType(
      state.program?.symbolByCName(typeInfo.typeName),
    );

    const isStruct =
      (typeInfo.isStruct && !passing.byValue) || isOpaqueHandle || isRegister;

    // Issue #895: Primitive types that become pointers need dereferencing when used as values
    // e.g., "u8 buf" becoming "uint8_t* buf" requires "*buf" when accessing the value
    // #1600: a string<N> is ALREADY a char* -- it is not a primitive that
    // became a pointer to match the typedef, so it needs no dereference when
    // used as a value. Without this term ParameterDereferenceResolver returns
    // `(*msg)` for every whole-value use, and the ADR-045 string rule fifteen
    // lines into isPassByValue is unreachable because this flag returns first.
    //
    // An OPAQUE handle is the same case one type over: `widget_t` is an
    // incomplete typedef, so it is only ever a pointer and `(*w)` is
    // `error: invalid use of incomplete typedef`. It is not caught by
    // `typeInfo.isStruct`, which needs fields the forward declaration does not
    // have -- so it is named here beside the other already-a-pointer shapes.
    const isCallbackPointerPrimitive =
      isCallbackPointerParam &&
      !typeInfo.isStruct &&
      !isArray &&
      !typeInfo.isString &&
      !isOpaqueHandle;

    // Issue #958: a C-header typedef struct -- an opaque handle, the same fact --
    // needs pointer semantics, like a callback pointer param
    const forcePointerSemantics =
      isCallbackPointerParam || isOpaqueHandle || isRegister;

    return {
      name,
      baseType: typeInfo.typeName,
      isArray,
      isStruct,
      isConst,
      isCallback: typeInfo.isCallback,
      isString: typeInfo.isString,
      isCallbackPointerPrimitive,
      // Issue #895/#958: Force pointer semantics for callback-compatible and typedef struct params
      forcePointerSemantics,
      isOpaqueHandle,
      isPassByValue: passing.byValue,
      isRegister,
    };
  }

  /**
   * Resolve type name and flags from a planned type.
   *
   * Strings are special and stay explicit: a top-level `string<32>` parameter
   * reports the bare "string" (its capacity travels separately through
   * stringCapacities), while a string ARRAY element keeps "string<32>". That
   * asymmetry is load-bearing, so it is preserved rather than folded in.
   *
   * #1285: one ladder for the NAME, then ONE derivation of its consequences.
   * Previously each of the six branches decided isStruct/isCallback for
   * itself, so `isCallback` was hardcoded false in the scoped, qualified and
   * global branches, and `arrayType().userType()` skipped the ADR-057
   * qualification that the bare `userType()` branch applied -- `Mode[4] p`
   * and `Mode p` in the same scope resolved to different names.
   *
   * #1445: that ladder is `TypeNameLadder`'s, asked once by the planner, so this
   * reads its answer rather than being a fourth caller of it. What is left is
   * the string asymmetry above, the primitive, and the consequences.
   */
  static resolveParameterTypeInfo(
    type: IPlannedType,
    callbacks: IFunctionContextCallbacks,
  ): IParameterTypeInfo {
    if (type.isString) {
      return {
        typeName: type.isArray ? (type.stringTypeText ?? "string") : "string",
        isStruct: false,
        isCallback: false,
        isString: true,
      };
    }

    if (type.primitiveName !== null) {
      return {
        typeName: type.primitiveName,
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    // What is left when no branch named the type is `templateType` and `void`.
    // Neither is a symbol name, and querying knownStructs/callbackTypes with
    // mangled template text (`FlexCAN_T4<CAN1,RX_SIZE_256,TX_SIZE_16>`) only
    // fails to match by construction of those lookups rather than by intent.
    const typeName = type.named?.name;
    if (typeName === undefined) {
      return {
        typeName: type.text,
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    return {
      typeName,
      isStruct: callbacks.isKnownStruct(typeName),
      isCallback: type.isCallback,
      isString: false,
    };
  }
}

export default ParameterInfoPlanner;
