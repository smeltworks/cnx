/**
 * 1.4 Resolve: settle the type names 1.3 Declare could not.
 *
 * Declare owns per-file facts, so for a bare `T` written inside a scope it can
 * only answer when this file declares the scope type. Otherwise the name is
 * either a global type or a scope type from an included file, and telling those
 * apart needs the scope types the file's include closure declares -- a
 * cross-file fact, which is 1.4's to own.
 *
 * Declare records those sites as `TDeferredType`, carrying the identifier as
 * WRITTEN and the scope it was written in. That pair is the input ADR-057
 * needs, and recording it is what keeps the decision at the parse tree:
 * qualifying a resolved name later cannot work, because by then `global.Mode`
 * and a bare `Mode` are the same string.
 *
 * This is a REBUILD everywhere it can be. Every type-bearing field on a symbol
 * is `readonly`, so settling one means constructing a new symbol.
 *
 * `IScopeSymbol.functions` is the one exception, and it is a real one rather
 * than an oversight: it IS type-bearing, and `SymbolRegistry` caches the scope
 * object by path, so a rebuilt scope would leave the registry holding the
 * unsettled functions. That array is written in place, from the same memo the
 * rebuild uses, so both readers end up on one object.
 *
 * #1722: the settle also stamps each function parameter whose type is opaque
 * (`IParameterInfo.isOpaqueHandle`). That too is a fact Declare cannot know --
 * whether a typedef ever received a body is decided over every header -- and
 * stamping here, where the one settled object is made, is what lets the scope's
 * copy carry it: a separate pass would rebuild the function a second time and
 * leave `scope.functions` on the unstamped one. #1744 stamps a struct field
 * of an opaque type the same way (`IStructFieldSymbol.isOpaqueHandle`).
 */

import type TSymbol from "../../types/symbols/TSymbol";
import type TType from "../../types/TType";
import type IParameterInfo from "../../types/symbols/IParameterInfo";
import type IStructFieldSymbol from "../../types/symbols/IStructFieldSymbol";
import type IRegisterMemberSymbol from "../../types/symbols/IRegisterMemberSymbol";
import type IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import TypeResolver from "../../utils/TypeResolver";
import ScopeFunctions from "./ScopeFunctions";

class DeferredTypes {
  /**
   * Settle every deferred type in `symbols` against what their file can see.
   *
   * @param symbols one file's declared symbols, as Declare emitted them
   * @param scopeTypeCName whether a QUALIFIED name is a scope type visible from
   *   the file these symbols belong to: declared there or anywhere in its
   *   include closure. Not Declare's own set, which cannot see an include, and
   *   not the whole program's, which also holds siblings the file never
   *   includes (#1724).
   * @param isOpaqueType whether a settled type name is an opaque C typedef, so
   *   a parameter or struct field of it holds a handle (ADR-030, #1722, #1744)
   */
  static settle(
    symbols: ReadonlyArray<TSymbol>,
    scopeTypeCName: (scopePath: string, name: string) => string | undefined,
    isOpaqueType: (typeName: string) => boolean,
  ): TSymbol[] {
    // Memoized on the ORIGINAL object, so a symbol reached twice yields one
    // settled object rather than two equal ones. A scope's member function is
    // reached twice by construction: `ScopeCollector` pushes it into the file's
    // member symbols AND `SymbolRegistry.registerFunction` pushes the same
    // object onto `scope.functions`.
    const settled = new Map<TSymbol, TSymbol>();
    const settleOnce = (symbol: TSymbol): TSymbol => {
      const existing = settled.get(symbol);
      if (existing) {
        return existing;
      }
      const result = DeferredTypes.settleSymbol(
        symbol,
        scopeTypeCName,
        isOpaqueType,
      );
      settled.set(symbol, result);
      return result;
    };

    const resolved = symbols.map(settleOnce);
    // The single mutation in a pass that is otherwise a rebuild; consulting
    // the memo rather than settling afresh is what limits it to the functions
    // THIS file declared.
    ScopeFunctions.adopt(resolved, settled);
    return resolved;
  }

  /**
   * Does any symbol here still carry a deferred type?
   *
   * The settlement's own negative control. `getTypeName` throws on a deferred
   * type, so an unsettled one would surface as an internal error somewhere in
   * codegen with no indication of which pass dropped it; asking here names the
   * pass instead.
   */
  static hasUnsettled(symbols: ReadonlyArray<TSymbol>): boolean {
    return symbols.some((symbol) =>
      DeferredTypes.typesOf(symbol).some(DeferredTypes.containsDeferred),
    );
  }

  private static settleSymbol(
    symbol: TSymbol,
    scopeTypeCName: (scopePath: string, name: string) => string | undefined,
    isOpaqueType: (typeName: string) => boolean,
  ): TSymbol {
    const settle = (type: TType): TType =>
      DeferredTypes.settleType(type, scopeTypeCName);

    // Identity is preserved wherever nothing was deferred, which is the common
    // case by a wide margin: only a bare name inside a scope can defer, so most
    // symbols have nothing to settle. Rebuilding them regardless would allocate
    // a copy of the whole symbol table on every run and quietly break any
    // consumer comparing by reference.
    if (symbol.kind === "variable") {
      const type = settle(symbol.type);
      return type === symbol.type ? symbol : { ...symbol, type };
    }

    if (symbol.kind === "function") {
      const returnType = settle(symbol.returnType);
      let parametersChanged = false;
      const parameters = symbol.parameters.map((parameter): IParameterInfo => {
        const type = settle(parameter.type);
        // #1722: decided here, once, on the settled type -- a bare name that
        // settles to a scope type is cnx's own and never opaque.
        const isOpaqueHandle = isOpaqueType(TypeResolver.getTypeName(type));
        if (type === parameter.type && !isOpaqueHandle) return parameter;
        parametersChanged = true;
        return isOpaqueHandle
          ? { ...parameter, type, isOpaqueHandle }
          : { ...parameter, type };
      });
      if (returnType === symbol.returnType && !parametersChanged) {
        return symbol;
      }
      return { ...symbol, returnType, parameters };
    }

    if (symbol.kind === "struct") {
      let fieldsChanged = false;
      const fields = new Map<string, IStructFieldSymbol>();
      for (const [name, field] of symbol.fields) {
        const type = settle(field.type);
        // #1744: a field holds a handle on the parameter's terms (#1722)
        const isOpaqueHandle = isOpaqueType(TypeResolver.getTypeName(type));
        if (type === field.type && !isOpaqueHandle) {
          fields.set(name, field);
          continue;
        }
        fieldsChanged = true;
        fields.set(
          name,
          isOpaqueHandle
            ? { ...field, type, isOpaqueHandle }
            : { ...field, type },
        );
      }
      return fieldsChanged ? { ...symbol, fields } : symbol;
    }

    // #1514: a register member's type is settled as a struct field's is --
    // a bare name inside a scope may name an included scope's type.
    if (symbol.kind === "register") {
      let membersChanged = false;
      const members = new Map<string, IRegisterMemberSymbol>();
      for (const [name, member] of symbol.members) {
        const type = settle(member.type);
        if (type === member.type) {
          members.set(name, member);
          continue;
        }
        membersChanged = true;
        members.set(name, { ...member, type });
      }
      return membersChanged ? { ...symbol, members } : symbol;
    }

    // enum and bitmap carry no TType: an enum member holds a value and a
    // bitmap's backing type is a constant. Returned unchanged rather than
    // rebuilt, so identity is preserved for everything with nothing to do.
    //
    // `scope` is NOT in that list, though it was until 37 fixtures proved
    // otherwise: `IScopeSymbol.functions` holds `IFunctionSymbol`s, each with a
    // `returnType` and parameter types. Its members are settled by `settle`
    // above, which is the only place that can see both the scope and the memo
    // of what this file already settled.
    return symbol;
  }

  /**
   * Settle one type, recursing into an array's element.
   *
   * ADR-057 is applied here exactly as Declare would have applied it, from the
   * WRITTEN identifier and the scope it appeared in -- never from the resolved
   * name, which no longer distinguishes a bare reference from a `global.` one.
   */
  static settleType(
    type: TType,
    scopeTypeCName: (scopePath: string, name: string) => string | undefined,
  ): TType {
    if (type.kind === "deferred") {
      // #2116: the scope type's stored C name, found by identity; a name
      // no visible scope type declares stays as written (ADR-057)
      const name = scopeTypeCName(type.scopePath, type.name) ?? type.name;
      // Re-classified from the settled name, because which ARM a name belongs
      // to -- struct, enum, bitmap -- is decided by the name, and Declare could
      // not decide it while the name was still unknown.
      return DeferredTypes.classify(name);
    }

    if (type.kind === "array") {
      const elementType = DeferredTypes.settleType(
        type.elementType,
        scopeTypeCName,
      );
      return elementType === type.elementType ? type : { ...type, elementType };
    }

    return type;
  }

  /** Every TType reachable from a symbol, for `hasUnsettled`. */
  private static typesOf(symbol: TSymbol): TType[] {
    if (symbol.kind === "variable") return [symbol.type];
    if (symbol.kind === "function") {
      return DeferredTypes.functionTypes(symbol);
    }
    if (symbol.kind === "struct") {
      return [...symbol.fields.values()].map((field) => field.type);
    }
    if (symbol.kind === "register") {
      return [...symbol.members.values()].map((member) => member.type);
    }
    // A scope reaches TType only through its member functions -- and that is
    // exactly where an unsettled type survived, because the registry aliases
    // this array. A control that cannot look here cannot fail on the case it
    // exists to catch.
    if (symbol.kind === "scope") {
      return symbol.functions.flatMap(DeferredTypes.functionTypes);
    }
    return [];
  }

  /** A function's own types: its return type and each parameter's. */
  private static functionTypes(func: IFunctionSymbol): TType[] {
    return [func.returnType, ...func.parameters.map((p) => p.type)];
  }

  private static containsDeferred(type: TType): boolean {
    if (type.kind === "deferred") return true;
    if (type.kind === "array") {
      return DeferredTypes.containsDeferred(type.elementType);
    }
    return false;
  }

  /**
   * Turn a settled name back into a `TType` arm.
   *
   * Delegated to the classifier Declare uses for every other name rather than
   * re-derived here: which arm a name belongs to is one decision, and a second
   * copy of that heuristic would drift from it without anything noticing.
   */
  private static classify(name: string): TType {
    return TypeResolver.resolve(name);
  }
}

export default DeferredTypes;
