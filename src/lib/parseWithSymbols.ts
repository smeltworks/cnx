/**
 * Parse cnx source and extract symbols for IDE features
 * ADR-055 Phase 7: Direct TSymbol → ISymbolInfo conversion (no ISymbol intermediate)
 */

import SymbolRegistry from "../cnx/PARSE/3-Declare/SymbolRegistry";
import Discover from "../cnx/PARSE/1-Discover/Discover";
import TreePasses from "../cnx/TRANSPILE/1-Analyze/TreePasses";
import Program from "../cnx/PARSE/4-Resolve/Program";
import invariant from "../cnx/utils/invariant";
import ScopeUtils from "../cnx/utils/ScopeUtils";
import TypeResolver from "../cnx/utils/TypeResolver";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbol from "../cnx/types/symbols/TSymbol";
import SymbolPathUtils from "./utils/SymbolPathUtils";

// Re-export helpers for use in this module
const getParentId = SymbolPathUtils.getParentId;

/**
 * ADR-055 Phase 7: Convert TSymbol directly to ISymbolInfo array.
 * Expands compound symbols (bitmaps, enums, structs, registers) into multiple ISymbolInfo entries.
 */
function convertTSymbolsToISymbolInfo(
  symbols: readonly TSymbol[],
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];

  for (const symbol of symbols) {
    switch (symbol.kind) {
      case "bitmap":
        result.push(...convertBitmap(symbol));
        break;
      case "enum":
        result.push(...convertEnum(symbol));
        break;
      case "struct":
        result.push(...convertStruct(symbol));
        break;
      case "function":
        result.push(...convertFunction(symbol));
        break;
      case "variable":
        result.push(convertVariable(symbol));
        break;
      case "register":
        result.push(...convertRegister(symbol));
        break;
      case "scope":
        result.push(convertScope(symbol));
        break;
    }
  }

  return result;
}

function convertBitmap(
  bitmap: import("../cnx/types/symbols/IBitmapSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = bitmap.fullyQualifiedCName;
  const parent = ScopeUtils.leafOf(bitmap.scopePath) || undefined;
  const bitmapId = bitmap.cnxScopedName;
  const bitmapParentId = getParentId(bitmap.scopePath);

  result.push({
    name: bitmap.name,
    fullName: cName,
    kind: "bitmap",
    type: bitmap.backingType,
    parent,
    id: bitmapId,
    parentId: bitmapParentId,
    line: bitmap.span.line,
  });

  // Add bitmap fields
  for (const [fieldName, fieldInfo] of bitmap.fields) {
    result.push({
      name: fieldName,
      fullName: `${cName}.${fieldName}`,
      kind: "bitmapField",
      parent: cName,
      id: `${bitmapId}.${fieldName}`,
      parentId: bitmapId,
      // #1318: the MEMBER's line, not its parent's. Members carry their own
      // span now, so reporting the parent's was the consumer ignoring data
      // it already had -- the same defect fixed for enum members above.
      line: fieldInfo.span.line,
      size: fieldInfo.width,
    });
  }

  return result;
}

function convertEnum(
  enumSym: import("../cnx/types/symbols/IEnumSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = enumSym.fullyQualifiedCName;
  const parent = ScopeUtils.leafOf(enumSym.scopePath) || undefined;
  const enumId = enumSym.cnxScopedName;
  const enumParentId = getParentId(enumSym.scopePath);

  result.push({
    name: enumSym.name,
    fullName: cName,
    kind: "enum",
    parent,
    id: enumId,
    parentId: enumParentId,
    line: enumSym.span.line,
  });

  // Add enum members
  for (const [memberName, member] of enumSym.members) {
    result.push({
      name: memberName,
      // #1318/#1285: read from the symbol that carries it. This rebuilt the
      // qualified name by hand and reported `enumSym`'s line for EVERY member,
      // so an IDE jumping to `EColor.BLUE` landed on `enum EColor`.
      fullName: member.fullyQualifiedCName,
      kind: "enumMember",
      parent: cName,
      id: `${enumId}.${memberName}`,
      parentId: enumId,
      line: member.span.line,
    });
  }

  return result;
}

function convertStruct(
  struct: import("../cnx/types/symbols/IStructSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = ScopeUtils.getTranspiledCName(struct);
  const parent = ScopeUtils.leafOf(struct.scopePath) || undefined;
  const structId = struct.cnxScopedName;
  const structParentId = getParentId(struct.scopePath);

  result.push({
    name: struct.name,
    fullName: cName,
    kind: "struct",
    parent,
    id: structId,
    parentId: structParentId,
    line: struct.span.line,
  });

  // Add struct fields
  for (const [fieldName, fieldInfo] of struct.fields) {
    result.push({
      name: fieldName,
      fullName: `${cName}.${fieldName}`,
      kind: "field",
      type: TypeResolver.getTypeName(fieldInfo.type),
      parent: cName,
      id: `${structId}.${fieldName}`,
      parentId: structId,
      // #1318: the MEMBER's line, not its parent's. Members carry their own
      // span now, so reporting the parent's was the consumer ignoring data
      // it already had -- the same defect fixed for enum members above.
      line: fieldInfo.span.line,
    });
  }

  return result;
}

function convertFunction(
  func: import("../cnx/types/symbols/IFunctionSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = func.fullyQualifiedCName;
  const parent = ScopeUtils.leafOf(func.scopePath) || undefined;
  const returnType = TypeResolver.getTypeName(func.returnType);

  // Build signature
  const paramTypes = func.parameters.map((p) =>
    TypeResolver.getTypeName(p.type),
  );
  const signature = `${returnType} ${cName}(${paramTypes.join(", ")})`;

  result.push({
    name: func.name,
    fullName: cName,
    kind: "function",
    type: returnType,
    parent,
    id: func.cnxScopedName,
    parentId: getParentId(func.scopePath),
    signature,
    accessModifier: func.visibility,
    line: func.span.line,
  });

  return result;
}

function convertVariable(
  variable: import("../cnx/types/symbols/IVariableSymbol").default,
): ISymbolInfo {
  const cName = ScopeUtils.getTranspiledCName(variable);
  const parent = ScopeUtils.leafOf(variable.scopePath) || undefined;
  const typeStr = TypeResolver.getTypeName(variable.type);

  return {
    name: variable.name,
    fullName: cName,
    kind: "variable",
    type: typeStr,
    parent,
    id: variable.cnxScopedName,
    parentId: getParentId(variable.scopePath),
    line: variable.span.line,
  };
}

function convertRegister(
  register: import("../cnx/types/symbols/IRegisterSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = ScopeUtils.getTranspiledCName(register);
  const parent = ScopeUtils.leafOf(register.scopePath) || undefined;
  const registerId = register.cnxScopedName;
  const registerParentId = getParentId(register.scopePath);

  result.push({
    name: register.name,
    fullName: cName,
    kind: "register",
    parent,
    id: registerId,
    parentId: registerParentId,
    line: register.span.line,
  });

  // Add register members
  for (const [memberName, memberInfo] of register.members) {
    result.push({
      name: memberName,
      fullName: `${cName}.${memberName}`,
      kind: "registerMember",
      parent: cName,
      id: `${registerId}.${memberName}`,
      parentId: registerId,
      // #1318: the MEMBER's line, not its parent's. Members carry their own
      // span now, so reporting the parent's was the consumer ignoring data
      // it already had -- the same defect fixed for enum members above.
      accessModifier: memberInfo.access,
      line: memberInfo.span.line,
    });
  }

  return result;
}

function convertScope(
  scope: import("../cnx/types/symbols/IScopeSymbol").default,
): ISymbolInfo {
  const scopeId = ScopeUtils.pathOf(scope);
  const scopeParentId = getParentId(scope.scopePath);

  return {
    name: scope.name,
    fullName: scope.name,
    kind: "namespace",
    id: scopeId,
    parentId: scopeParentId,
    line: scope.span.line,
  };
}

/**
 * Parse cnx source and extract symbols for IDE features
 *
 * Unlike transpile(), this function attempts to extract symbols even when
 * there are parse errors, making it suitable for autocomplete during typing.
 *
 * @param source - cnx source code string
 * @returns Parse result with symbols
 *
 * @example
 * ```typescript
 * import parseWithSymbols from './lib/parseWithSymbols';
 *
 * const result = parseWithSymbols(source);
 * // Find namespace members for autocomplete
 * const ledMembers = result.symbols.filter(s => s.parent === 'LED');
 * ```
 */
function parseWithSymbols(source: string): IParseWithSymbolsResult {
  // ADR-055 Phase 7: Direct TSymbol → ISymbolInfo conversion (no ISymbol intermediate)
  //
  // #1472: both passes, because this API has the same obligation the pipeline
  // does. 1.3 Declare defers a bare type name it cannot settle, and reading one
  // of those as a type name throws -- so a caller that ran Declare alone would
  // get an internal error on any scope that names a type bare.
  // #2036: and 1.4's own settling, not a copy of it. This path called
  // `DeferredTypes.settle` with both predicates written by hand, which settled
  // the type names and nothing else: every const-sized array kept 1.3's
  // placeholder dimension `0`. It has one file and no mode or target, so it
  // cannot build a program; `Program.settleFiles` is the step `build` begins
  // with. Given no includes and no headers, the file sees only itself and no
  // typedef can be opaque (ADR-030, #1722).
  // #1378, closed by construction (#1452 box 3): this path never reset the
  // global registry, so scopes from a previously parsed source leaked into the
  // next call. There is no global to reset now -- each call gets its own.
  const registry = new SymbolRegistry();
  const resolved = TreePasses.declareFile(
    Discover.inMemoryFile(source, "<source>"),
    registry,
  );
  const errors = resolved.parseErrors;
  const tSymbols = Program.settleFiles([resolved.symbols], {
    registry,
  }).symbolsByFile.get(resolved.symbols.sourceFile);
  invariant(tSymbols, "1.4 settles every file it is given");
  const symbols = convertTSymbolsToISymbolInfo(tSymbols);

  return {
    success: errors.length === 0,
    // A fresh ARRAY, so a caller who sorts or splices what it is handed does
    // not reach into 1.2's artifact. The elements are still shared -- this is
    // not a deep copy and does not make the errors detached, so do not stamp
    // fields onto them in place (#1445).
    errors: [...errors],
    symbols,
  };
}

export default parseWithSymbols;
