/**
 * Parse C/C++ header source and extract symbols for IDE features
 * ADR-055 Phase 7: Direct TCSymbol → ISymbolInfo conversion (no ISymbol intermediate)
 */

import Discover from "../cnx/PARSE/1-Discover/Discover";
import TreePasses from "../cnx/TRANSPILE/1-Analyze/TreePasses";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbolKind from "./types/TSymbolKind";
import TCSymbol from "../cnx/types/symbols/c/TCSymbol";
import SymbolPathUtils from "./utils/SymbolPathUtils";
import CaughtError from "../cnx/utils/CaughtError";

/**
 * Map TCSymbol kind to library TSymbolKind
 */
function mapCSymbolKind(kind: TCSymbol["kind"]): TSymbolKind {
  switch (kind) {
    case "struct":
      return "struct";
    case "function":
      return "function";
    case "variable":
      return "variable";
    case "enum":
      return "enum";
    case "enum_member":
      return "enumMember";
    case "type":
      return "type";
    default:
      return "variable";
  }
}

/**
 * ADR-055 Phase 7: Convert TCSymbol directly to ISymbolInfo.
 * Handles the discriminated union by extracting common fields and type-specific fields.
 */
function convertTCSymbolsToISymbolInfo(
  symbols: TCSymbol[],
  filePath?: string,
): ISymbolInfo[] {
  return symbols.map((sym) => {
    // Extract type and parent based on symbol kind
    let type: string | undefined;
    let parent: string | undefined;

    switch (sym.kind) {
      case "function":
        type = sym.type;
        break;
      case "variable":
        type = sym.type;
        break;
      case "enum_member":
        parent = sym.parent ?? undefined;
        break;
      case "type":
        type = sym.type;
        break;
      // struct and enum have no type field
    }

    const id = SymbolPathUtils.buildSimpleDotPath(parent, sym.name);
    return {
      name: sym.name,
      fullName: SymbolPathUtils.buildSimpleDotPath(parent, sym.name),
      kind: mapCSymbolKind(sym.kind),
      id,
      parentId: parent,
      type,
      parent,
      line: sym.span.line,
      sourceFile: filePath,
      language: "c",
    };
  });
}

/**
 * Parse C/C++ header source and extract symbols for IDE features
 *
 * Unlike transpilation, this function attempts to extract symbols even when
 * there are parse errors, making it suitable for autocomplete during typing.
 *
 * @param source - C/C++ header source code string
 * @param filePath - Optional file path for symbol source tracking
 * @returns Parse result with symbols
 *
 * @example
 * ```typescript
 * import parseCHeader from './lib/parseCHeader';
 *
 * const result = parseCHeader(headerSource, 'config.h');
 * // Find all functions defined in the header
 * const functions = result.symbols.filter(s => s.kind === 'function');
 * ```
 */
function parseCHeader(
  source: string,
  filePath?: string,
): IParseWithSymbolsResult {
  const errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning";
  }> = [];

  try {
    // ONE C-header parse for the project -- see `HeaderParser.parseC` for why the
    // error listeners are removed, measured rather than assumed. This function
    // used to rebuild the pipeline itself, and the copies had already drifted:
    // this one silenced the lexer too, so a token the C lexer cannot recognize
    // printed to stderr on the transpiler path and was silent here (#1306
    // review). Two paths that must agree is the bug, not the symptom.
    const result = TreePasses.resolveCHeader(
      Discover.inMemoryCHeader(source),
      filePath ?? "<header>",
    );
    if (result === null) {
      errors.push({
        line: 1,
        column: 0,
        message: "C header could not be parsed",
        severity: "error",
      });
      return { success: false, errors, symbols: [] };
    }

    // ADR-055 Phase 7: Direct TCSymbol → ISymbolInfo conversion
    const symbols = convertTCSymbolsToISymbolInfo(result.symbols, filePath);

    return {
      success: true,
      errors,
      symbols,
    };
  } catch (err) {
    errors.push({
      line: 1,
      column: 0,
      message: CaughtError.messageOf(err),
      severity: "error",
    });

    return {
      success: false,
      errors,
      symbols: [],
    };
  }
}

export default parseCHeader;
