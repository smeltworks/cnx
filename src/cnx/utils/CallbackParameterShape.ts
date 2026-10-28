import type ICallbackTypedefParameter from "../types/ICallbackTypedefParameter";
import type IResolvedSymbols from "../types/IResolvedSymbols";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";
import DeclaredPointer from "./DeclaredPointer";
import DeclaredTypeFacts from "./DeclaredTypeFacts";
import headerCType from "./headerCType";
import type IByValueFacts from "./types/IByValueFacts";
import userCType from "./userCType";
import invariant from "./invariant";
import ParameterByValue from "./ParameterByValue";
import type ICallbackShapeFacts from "./types/ICallbackShapeFacts";
import ParameterConst from "./ParameterConst";
import TypeCheckUtils from "./TypeCheckUtils";
import SymbolTypeResolver from "./TypeResolver";

/**
 * ADR-029 + ADR-006: what a cnx function's `_fp` typedef says -- its return
 * type and what each parameter MEANS, its rendered type and its pointer
 * semantics. 2.2 builds the typedef from this, and 2.1 holds a C header's
 * function to the same answer (#1619), so the two cannot describe the
 * typedef differently.
 *
 * Kept as one decision since two builders shared it (#1491, #1552); one
 * builder is left (#1929).
 */
class CallbackParameterShape {
  /**
   * ADR-029: the typedef name for a function-as-type. One encoder, so the
   * declaration site and every reference cannot spell it differently.
   */
  static typedefName(functionName: string): string {
    return `${functionName}_fp`;
  }

  /** The function a `typedefName` names the type of, or null for any other name */
  static functionOfTypedef(typedefName: string): string | null {
    const suffix = CallbackParameterShape.typedefName("");
    return typedefName.endsWith(suffix)
      ? typedefName.slice(0, -suffix.length)
      : null;
  }

  /**
   * ADR-029: a resolved cnx type name, spelled in a `_fp` typedef the way
   * the function's own prototype spells it -- `headerCType` for the C++
   * namespace (`hw::Dev`, not the C join `hw__Dev`) and the primitive map,
   * then the `struct` keyword a C tag with no typedef needs. A bare primitive
   * lookup lost both (#1942 review).
   */
  static cType(typeName: string, symbolTable: IResolvedSymbols): string {
    return userCType(
      headerCType(typeName),
      symbolTable.checkNeedsStructKeyword(typeName),
    );
  }

  /** ADR-029: a function this file declares or includes is a type too (#1491) */
  static isFunctionType(typeName: string, facts: ICallbackShapeFacts): boolean {
    return facts.symbols.functionReturnTypes.has(typeName);
  }

  static returnType(
    symbol: IFunctionSymbol,
    facts: ICallbackShapeFacts,
  ): string {
    return CallbackParameterShape.cType(
      SymbolTypeResolver.getTypeName(symbol.returnType),
      facts.symbolTable,
    );
  }

  static parameters(
    cName: string,
    symbol: IFunctionSymbol,
    facts: ICallbackShapeFacts,
  ): Array<Required<ICallbackTypedefParameter>> {
    const byValueFacts = CallbackParameterShape.byValueFacts(facts);
    return symbol.parameters.map((param, index) => {
      const typeName = SymbolTypeResolver.getTypeName(param.type);
      // Spread, not re-listed: a field the shape gains reaches the typedef
      // (#1552 was a builder dropping one).
      const shape = CallbackParameterShape.shape(
        typeName,
        param.isArray,
        facts,
      );
      // #1290 review: the typedef names a parameter as its prototype does
      invariant(
        param.emittedName !== null,
        `1.4 settled the C name of ${cName}'s parameter ${param.name}`,
      );
      return {
        name: param.emittedName,
        ...shape,
        isConst: ParameterConst.isWritten(
          param.isConst,
          typeName,
          CallbackParameterShape.isFunctionType(typeName, facts),
        ),
        isArray: param.isArray,
        // ADR-071 Q6: a `mut` scalar is a pointer, as in its prototype
        // #1639: from the declaration, as a call through the type passes it
        isPointer: !ParameterByValue.ofDeclared(
          cName,
          index,
          byValueFacts,
          false,
        ),
        // Already folded to literals by the symbols layer, which is exactly
        // what MISRA Rule 18.8 needs -- a dimension that is still an
        // identifier makes the typedef a variably-modified type.
        arrayDims: (param.arrayDimensions ?? [])
          .map((dimension) => `[${dimension}]`)
          .join(""),
      };
    });
  }

  /** The by-value rule's facts, read off the same data */
  private static byValueFacts(facts: ICallbackShapeFacts): IByValueFacts {
    return {
      program: facts.program,
      callbackTypes: facts.symbols.functionReturnTypes,
      isKnownStruct: (typeName) =>
        DeclaredTypeFacts.isStruct(facts.symbols, facts.symbolTable, typeName),
    };
  }

  private static shape(
    typeName: string,
    isArray: boolean,
    facts: ICallbackShapeFacts,
  ): {
    type: string;
    isStruct: boolean;
    isString: boolean;
    isOpaqueHandle: boolean;
  } {
    // ADR-006: struct-ness drives reference semantics. A C++ namespaced
    // struct arrives in its `::` spelling, the one 1.3 stored (#2116).
    const isStruct = DeclaredTypeFacts.isStruct(
      facts.symbols,
      facts.symbolTable,
      typeName,
    );

    // ADR-029: a parameter whose type is itself a function-as-type.
    if (CallbackParameterShape.isFunctionType(typeName, facts)) {
      // Function pointers are already pointers.
      return {
        type: CallbackParameterShape.typedefName(typeName),
        isStruct,
        isString: false,
        isOpaqueHandle: false,
      };
    }
    // ADR-045: a `string<N>` parameter is `char*` in C. Decided HERE, not in
    // either caller's renderer, because that is where the two disagreed: the
    // parse-tree renderer answered `char` (the ELEMENT type) and the symbol
    // renderer answered `string<8>` (cnx surface syntax, not C at all, and
    // rejected by cc while the transpiler exited 0). Both are now wrong in one
    // place instead of differently wrong in two -- which is the property this
    // method exists to hold, and the one its comment already claimed.
    if (!isArray && TypeCheckUtils.isSizedStringName(typeName)) {
      return {
        type: "char*",
        isStruct: false,
        isString: true,
        isOpaqueHandle: false,
      };
    }

    // ADR-030: an opaque handle is a pointer in the typedef exactly as it is in
    // the prototype -- `Dev*` in C and C++ alike, and an array of them an array
    // of pointers (#996). The typedef IS the function's type, so it reads the
    // decision the prototype reads rather than asking struct-ness, which never
    // answered for an incomplete type: `typedef void (*aPoke_fp)(Dev)` stood
    // beside `void aPoke(Dev* d)`. Not ADR-006 reference semantics, so not
    // `isStruct` -- which is also what keeps an unmodified handle free of the
    // auto-const its prototype never takes.
    if (DeclaredPointer.isHandleType(typeName, facts.symbolTable)) {
      return {
        type: CallbackParameterShape.cType(typeName, facts.symbolTable),
        isStruct: false,
        isString: false,
        isOpaqueHandle: true,
      };
    }

    // ADR-006: a struct parameter is a pointer in C and a reference in C++,
    // which the formatter spells from `isStruct`.
    return {
      type: CallbackParameterShape.cType(typeName, facts.symbolTable),
      isStruct,
      isString: false,
      isOpaqueHandle: false,
    };
  }
}

export default CallbackParameterShape;
