/**
 * HeaderSymbolAdapter - Converts TSymbol to IHeaderSymbol.
 *
 * ADR-055 Phase 7: This adapter converts the TSymbol discriminated union
 * to IHeaderSymbol for header generation.
 */

import DeclaredTypeInfo from "../../../../PARSE/3-Declare/DeclaredTypeInfo";
import TSymbol from "../../../../types/symbols/TSymbol";
import IHeaderSymbol from "../types/IHeaderSymbol";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import TypeResolver from "../../../../utils/TypeResolver";
import ScopeUtils from "../../../../utils/ScopeUtils";
import type TType from "../../../../types/TType";
import type TranspileState from "../../../TranspileState";
import invariant from "../../../../utils/invariant";
import UNRESOLVED_DIMENSION from "../../../../types/UNRESOLVED_DIMENSION";

/**
 * Adapter to convert TSymbol to IHeaderSymbol
 */
class HeaderSymbolAdapter {
  /**
   * Convert a TSymbol to IHeaderSymbol
   */
  static fromTSymbol(symbol: TSymbol, state: TranspileState): IHeaderSymbol {
    switch (symbol.kind) {
      case "function":
        return HeaderSymbolAdapter.convertFunction(symbol);
      case "variable":
        return HeaderSymbolAdapter.convertVariable(symbol, state);
      case "struct":
        return HeaderSymbolAdapter.convertStruct(symbol);
      case "enum":
        return HeaderSymbolAdapter.convertEnum(symbol);
      case "bitmap":
        return HeaderSymbolAdapter.convertBitmap(symbol);
      case "register":
        return HeaderSymbolAdapter.convertRegister(symbol);
      case "scope":
        return HeaderSymbolAdapter.convertScope(symbol);
    }
  }

  // ========================================================================
  // Private conversion methods for each TSymbol kind
  // ========================================================================

  private static convertFunction(
    func: import("../../../../types/symbols/IFunctionSymbol").default,
  ): IHeaderSymbol {
    // Convert TType return type to string
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);

    // Get transpiled C name (scope-prefixed)
    const cName = func.fullyQualifiedCName;
    const isGlobal = ScopeUtils.isGlobalScopePath(func.scopePath);

    // ADR-057: type names arrive already scope-qualified from the symbol
    // layer (CnxResolver pre-pass), so no qualification is needed here.
    const parameters: IParameterSymbol[] = func.parameters.map((p) => {
      const type = TypeResolver.getTypeName(p.type);
      // #1290: the C name 1.4 settled, which the `.c` signature reads too
      invariant(
        p.emittedName !== null,
        `1.4 settled the C name of ${cName}'s parameter '${p.name}'`,
      );
      return {
        name: p.name,
        emittedName: p.emittedName,
        type,
        isConst: p.isConst,
        isArray: p.isArray,
        arrayDimensions: HeaderSymbolAdapter.headerArrayDimensions(p),
        // ADR-030 / #1722: the stamp 1.4 set on the parameter, which the `.c`
        // prototype and its call sites read too. This asked
        // `isHeldThroughPointer` itself, a second decision that agreed with the
        // `.c`'s only because both called one predicate.
        isOpaqueHandle: p.isOpaqueHandle || undefined,
      };
    });

    // Build signature with return type and param types
    const qualifiedReturn = returnTypeStr;
    const paramTypes = parameters.map((p) => p.type);
    const signature = `${qualifiedReturn} ${cName}(${paramTypes.join(", ")})`;

    return {
      name: cName,
      kind: "function",
      type: qualifiedReturn,
      parameters,
      signature,
      parent: isGlobal ? undefined : func.scopePath,
      sourceFile: func.sourceFile,
      sourceLine: func.span.line,
    };
  }

  private static convertVariable(
    variable: import("../../../../types/symbols/IVariableSymbol").default,
    state: TranspileState,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(variable);
    const isGlobal = ScopeUtils.isGlobalScopePath(variable.scopePath);

    // ADR-057: the symbol layer already qualified scope-local type names.
    // ADR-029 (#1562): a function-as-type is spelled by its `_fp` typedef, the
    // name the .c declares the same variable with
    const declared = TypeResolver.getTypeName(variable.type);
    const typeStr = state.callbackTypes.get(declared)?.typedefName ?? declared;

    // #1175: 1.4 settled each dimension to its value, or, for one only C can
    // evaluate (a header macro), to its C -- there is nothing left to resolve
    const arrayDimensions = HeaderSymbolAdapter.settled(
      variable.arrayDimensions,
      cName,
    );

    return {
      name: cName,
      kind: "variable",
      type: typeStr,
      isConst: variable.isConst,
      isAtomic: variable.isAtomic,
      isVolatile: variable.isVolatile,
      isArray: variable.isArray,
      isPointer:
        DeclaredTypeInfo.of(
          { kind: "variable", symbol: variable },
          state.symbols,
          state.symbolTable,
          state.targetDescription,
        )?.isPointer ?? false,
      arrayDimensions,
      parent: isGlobal ? undefined : variable.scopePath,
      sourceFile: variable.sourceFile,
      sourceLine: variable.span.line,
    };
  }

  /**
   * A parameter's array dimensions as the C declaration needs them.
   *
   * A bounded string array carries its capacity as the innermost dimension --
   * `string<32>[5]` is `char[5][33]`. ParameterSignatureBuilder documents that
   * "dimensions include capacity" and the .c path supplies it; the header did
   * not, so it declared `char arr[5]` against a `char arr[5][33]` definition
   * (#1164).
   */
  private static headerArrayDimensions(parameter: {
    readonly type: TType;
    readonly arrayDimensions?: ReadonlyArray<number | string>;
  }): string[] | undefined {
    // #1664 box 7: 1.4 folded each dimension it could, with the const values
    // visible at the function; what is left (a C macro) is the C compiler's
    const dimensions = HeaderSymbolAdapter.settled(
      parameter.arrayDimensions,
      "a parameter",
    );
    if (!dimensions) {
      return undefined;
    }

    const capacityMatch = /^string<(\d+)>$/.exec(
      TypeResolver.getTypeName(parameter.type),
    );
    if (!capacityMatch) {
      return dimensions;
    }

    // Whether the capacity is present is structural, not something to infer
    // from the trailing value: a guard comparing it to `capacity + 1` misfires
    // for any `string<N>[N+1]` and silently declares a different type than the
    // .c defines. IParameterSymbol.arrayDimensions never carries the capacity --
    // FunctionCollector.collectParameters records only the declared dimensions --
    // so it is always appended here.
    return [...dimensions, String(Number.parseInt(capacityMatch[1], 10) + 1)];
  }

  private static convertStruct(
    struct: import("../../../../types/symbols/IStructSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = struct.fullyQualifiedCName;
    const isGlobal = ScopeUtils.isGlobalScopePath(struct.scopePath);

    return {
      name: cName,
      kind: "struct",
      parent: isGlobal ? undefined : struct.scopePath,
      sourceFile: struct.sourceFile,
      sourceLine: struct.span.line,
    };
  }

  private static convertEnum(
    enumSym: import("../../../../types/symbols/IEnumSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = enumSym.fullyQualifiedCName;
    const isGlobal = ScopeUtils.isGlobalScopePath(enumSym.scopePath);

    return {
      name: cName,
      kind: "enum",
      parent: isGlobal ? undefined : enumSym.scopePath,
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.span.line,
    };
  }

  private static convertBitmap(
    bitmap: import("../../../../types/symbols/IBitmapSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = bitmap.fullyQualifiedCName;
    const isGlobal = ScopeUtils.isGlobalScopePath(bitmap.scopePath);

    return {
      name: cName,
      kind: "bitmap",
      type: bitmap.backingType,
      parent: isGlobal ? undefined : bitmap.scopePath,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.span.line,
    };
  }

  private static convertRegister(
    register: import("../../../../types/symbols/IRegisterSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = register.fullyQualifiedCName;
    const isGlobal = ScopeUtils.isGlobalScopePath(register.scopePath);

    return {
      name: cName,
      kind: "register",
      parent: isGlobal ? undefined : register.scopePath,
      sourceFile: register.sourceFile,
      sourceLine: register.span.line,
    };
  }

  private static convertScope(
    scope: import("../../../../types/symbols/IScopeSymbol").default,
  ): IHeaderSymbol {
    return {
      name: scope.name,
      kind: "scope",
      // #1298: a scope states where it sits, like every other kind converted
      // here. This literal used to omit `parent` entirely -- the shape with no
      // parent that `getScopePath`'s guard existed to catch, built deliberately,
      // and the one kind that could not say which scope contained it.
      parent: ScopeUtils.isGlobalScopePath(scope.scopePath)
        ? undefined
        : scope.scopePath,
      sourceFile: scope.sourceFile,
      sourceLine: scope.span.line,
    };
  }

  /**
   * #1874: each dimension as 1.4 settled it, as the header writes it. A real
   * zero is E0913 now, so the sentinel 0 here would be a size 1.4 never
   * settled, written into the header as `[0]`.
   */
  private static settled(
    dimensions: ReadonlyArray<number | string> | undefined,
    owner: string,
  ): string[] | undefined {
    return dimensions?.map((dimension) => {
      invariant(
        dimension !== UNRESOLVED_DIMENSION,
        `1.4 settles every dimension of ${owner} before a header is written`,
      );
      return String(dimension);
    });
  }
}

export default HeaderSymbolAdapter;
