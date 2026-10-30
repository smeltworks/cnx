/**
 * FunctionCollector - Extracts function declarations from parse trees.
 * Handles return types, parameters, visibility, and signature generation.
 *
 * Produces TType-based IFunctionSymbol with proper IScopeSymbol references.
 */

import type IFunctionDeclarationSyntax from "../../../../types/syntax/IFunctionDeclarationSyntax";
import type IParameterSyntax from "../../../../types/syntax/IParameterSyntax";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IParameterInfo from "../../../../types/symbols/IParameterInfo";
import TypeUtils from "../utils/TypeUtils";
import SymbolRegistry from "../../SymbolRegistry";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import DimensionResolver from "../utils/DimensionResolver";
import type IDeclareTypeFacts from "../../types/IDeclareTypeFacts";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";

class FunctionCollector {
  /**
   * Collect a function declaration and return an IFunctionSymbol.
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this function belongs to (dotted path, "" at file scope)
   * @param visibility Required: #1161 — a default here is a third source
   *   of truth for ADR-016 and drifted from it. Callers pass
   *   ScopeUtils.getDefaultVisibility() or an explicit keyword.
   * @param typeFacts ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The function symbol with TType-based types and scope reference
   */
  static collect(
    syntax: IFunctionDeclarationSyntax,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    typeFacts?: IDeclareTypeFacts,
  ): IFunctionSymbol {
    const name = syntax.name;
    const span = syntax.span;

    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    // #1472: `resolveType` defers a bare name this file cannot settle instead
    // of guessing it, so 1.4 Resolve can apply ADR-057 with the whole-program
    // scope-type set. Everything it can settle resolves exactly as before.
    const returnType = TypeUtils.resolveType(
      syntax.returnType,
      scopePath,
      typeFacts,
    );

    const parameters = FunctionCollector.collectParameters(
      syntax.parameters ?? [],
      scopePath,
      typeFacts,
    );

    return {
      kind: "function",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      ...ScopeUtils.identityOf({ name, scopePath }),
      parameters,
      returnType,
      returnOverflowBehavior: OverflowBehaviorUtils.fromModifier(
        syntax.returnOverflow,
      ),
      visibility,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cnx,
    };
  }

  /**
   * Collect a function declaration and register it in SymbolRegistry.
   *
   * This method:
   * 1. Gets or creates the appropriate scope in SymbolRegistry
   * 2. Collects the function with TType-based types
   * 3. Registers the function in that scope
   *
   * @param syntax The function declaration, as 1.2 lowered it
   * @param sourceFile Source file path
   * @param scopePath Declaring scope path; carries every outer component
   * @param visibility Required: #1161 — a default here is a third source
   *   of truth for ADR-016 and drifted from it. Callers pass
   *   ScopeUtils.getDefaultVisibility() or an explicit keyword.
   * @param typeFacts ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The function symbol
   */
  static collectAndRegister(
    registry: SymbolRegistry,
    syntax: IFunctionDeclarationSyntax,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    typeFacts?: IDeclareTypeFacts,
  ): IFunctionSymbol {
    // 1. Get or create the scope in SymbolRegistry

    // 2. Collect function with TType-based types and scope reference
    const symbol = FunctionCollector.collect(
      syntax,
      sourceFile,
      scopePath,
      visibility,
      typeFacts,
    );

    // 3. Register in SymbolRegistry
    registry.registerFunction(symbol);

    return symbol;
  }

  /**
   * Extract parameter information from 1.2's lowered parameters.
   * Converts type strings to TType.
   */
  static collectParameters(
    params: readonly IParameterSyntax[],
    scopePath = "",
    typeFacts?: IDeclareTypeFacts,
  ): IParameterInfo[] {
    return params.map((p) => {
      const name = p.name;
      const type = TypeUtils.resolveType(p.type, scopePath, typeFacts);
      // ADR-071: read-only unless declared `mut`
      const isConst = !p.mut;

      // Check for cnx style array type (u8[8] param, u8[4][4] param, u8[] param)
      const arrayTypeDimensions =
        p.type.kind === "array" ? p.type.dimensions : null;
      // #1668: and the C-style dimensions E0874 admits for `main(string
      // args[])`, which this dropped -- so the declaration read `args` as a
      // scalar while the function's own plan read it as an array
      const cStyleDimensions = p.dimensions;
      const isArray =
        arrayTypeDimensions !== null || cStyleDimensions.length > 0;

      // Each dimension folds as a declaration's does (#1760 review): parseInt
      // read `2*BUF` as 2 and `0x10` as 0, so the prototype disagreed with
      // the definition and a subscript was checked against the wrong size.
      // An unsized `[]` keeps its slot as "".
      const declared = [
        ...(arrayTypeDimensions ?? []),
        ...cStyleDimensions,
      ].map((sizeExpr) =>
        sizeExpr
          ? DimensionResolver.resolve(sizeExpr)
          : { size: "", expr: null },
      );
      const arrayDimensions = declared.map((dim) => dim.size);
      const arrayDimensionExprs = declared.map((dim) => dim.expr);

      return {
        name,
        emittedName: null,
        type,
        isConst,
        isArray,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
        arrayDimensionExprs:
          arrayDimensions.length > 0 ? arrayDimensionExprs : undefined,
      };
    });
  }
}

export default FunctionCollector;
