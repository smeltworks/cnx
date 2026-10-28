/**
 * TSymbolInfoAdapter - Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 *
 * ADR-055 Phase 5: This adapter enables CodeGenerator to use pre-collected
 * symbols from CnxResolver instead of creating its own SymbolCollector.
 *
 * The conversion extracts and restructures the rich discriminated union types
 * into the flat map format that CodeGenerator expects via ISymbolInfo.
 */

import type IBitmapFieldLayout from "../../../../types/IBitmapFieldLayout";
import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import CNX_TO_C_TYPE_MAP from "../../../../utils/constants/TypeMappings";
import TSymbol from "../../../../types/symbols/TSymbol";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import TypeResolver from "../../../../utils/TypeResolver";
import ScopeUtils from "../../../../utils/ScopeUtils";
import type TExpression from "../../../../types/syntax/TExpression";

/**
 * Groups register-related maps for processRegister method.
 * Reduces parameter count for SonarCloud compliance.
 */
interface IRegisterMaps {
  knownRegisters: Set<string>;
  scopedRegisters: Map<string, TExpression>;
  registerMemberAccess: Map<string, string>;
  registerBaseAddresses: Map<string, TExpression>;
  registerMemberOffsets: Map<string, TExpression>;
  registerMemberCTypes: Map<string, string>;
  memberCNames: Map<string, Map<string, string>>;
}

/**
 * Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 * Replaces the need for SymbolCollector during code generation.
 */
class TSymbolInfoAdapter {
  /**
   * Convert TSymbol[] to ISymbolInfo for CodeGenerator consumption.
   *
   * @param symbols Array of discriminated union symbols from CnxResolver
   * @returns ISymbolInfo compatible with CodeGenerator
   */
  static convert(symbols: readonly TSymbol[]): ICodeGenSymbols {
    // === Known Type Sets ===
    const knownScopes = new Set<string>();
    const knownStructs = new Set<string>();
    const knownEnums = new Set<string>();
    const knownBitmaps = new Set<string>();
    const knownRegisters = new Set<string>();

    // === Scope Information ===
    const scopeMembers = new Map<string, Set<string>>();
    const scopeMemberVisibility = new Map<
      string,
      Map<string, "public" | "private">
    >();

    // === Struct Information ===
    const structFields = new Map<string, Map<string, string>>();
    const structFieldArrays = new Map<string, Set<string>>();
    const structFieldDimensions = new Map<
      string,
      Map<string, (number | string)[]>
    >();

    // === Enum Information ===
    const enumMembers = new Map<string, Map<string, number>>();
    const memberCNames = new Map<string, Map<string, string>>();

    // === Bitmap Information ===
    const bitmapFields = new Map<string, Map<string, IBitmapFieldLayout>>();
    const bitmapBackingType = new Map<string, string>();
    const bitmapBitWidth = new Map<string, number>();

    // === Register Information ===
    const scopedRegisters = new Map<string, TExpression>();
    const registerMemberAccess = new Map<string, string>();
    const registerBaseAddresses = new Map<string, TExpression>();
    const registerMemberOffsets = new Map<string, TExpression>();
    const registerMemberCTypes = new Map<string, string>();

    // === Function Return Types ===
    const functionReturnTypes = new Map<string, string>();

    // Process each symbol
    for (const symbol of symbols) {
      switch (symbol.kind) {
        case "struct":
          TSymbolInfoAdapter.processStruct(
            symbol,
            knownStructs,
            structFields,
            structFieldArrays,
            structFieldDimensions,
          );
          break;

        case "enum":
          TSymbolInfoAdapter.processEnum(
            symbol,
            knownEnums,
            enumMembers,
            memberCNames,
          );
          break;

        case "bitmap":
          TSymbolInfoAdapter.processBitmap(
            symbol,
            knownBitmaps,
            bitmapFields,
            bitmapBackingType,
            bitmapBitWidth,
          );
          break;

        case "scope":
          TSymbolInfoAdapter.processScope(
            symbol,
            knownScopes,
            scopeMembers,
            scopeMemberVisibility,
          );
          break;

        case "register":
          TSymbolInfoAdapter.processRegister(symbol, {
            knownRegisters,
            scopedRegisters,
            registerMemberAccess,
            registerBaseAddresses,
            registerMemberOffsets,
            registerMemberCTypes,
            memberCNames,
          });
          break;

        case "variable":
          // Track scope membership and file-scope names
          TSymbolInfoAdapter.processVariable(symbol, scopeMembers);
          break;

        // Track function return types for enum validation
        case "function":
          TSymbolInfoAdapter.processFunction(symbol, functionReturnTypes);
          break;
      }
    }

    // Build the ISymbolInfo result
    const result: ICodeGenSymbols = {
      // Type sets
      knownScopes,
      knownStructs,
      knownEnums,
      knownBitmaps,
      knownRegisters,

      // Scope info
      scopeMembers,
      scopeMemberVisibility,

      // Struct info
      structFields,
      structFieldArrays,
      structFieldDimensions,

      // Enum info
      enumMembers,
      memberCNames,

      // Bitmap info
      bitmapFields,
      bitmapBackingType,
      bitmapBitWidth,

      // Register info
      scopedRegisters,
      registerMemberAccess,
      registerBaseAddresses,
      registerMemberOffsets,
      registerMemberCTypes,

      // Function return types
      functionReturnTypes,
    };

    return result;
  }

  // === Private Processing Methods ===

  private static processStruct(
    struct: IStructSymbol,
    knownStructs: Set<string>,
    structFields: Map<string, Map<string, string>>,
    structFieldArrays: Map<string, Set<string>>,
    structFieldDimensions: Map<string, Map<string, (number | string)[]>>,
  ): void {
    // Use transpiled C name for lookups (e.g., "Geometry_Point")
    const cName = struct.fullyQualifiedCName;
    knownStructs.add(cName);

    const fields = new Map<string, string>();
    const arrayFields = new Set<string>();
    const dimensions = new Map<string, (number | string)[]>();

    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for legacy ISymbolInfo format
      const typeStr = TypeResolver.getTypeName(fieldInfo.type);
      fields.set(fieldName, typeStr);

      if (fieldInfo.isArray) {
        arrayFields.add(fieldName);

        if (fieldInfo.dimensions && fieldInfo.dimensions.length > 0) {
          // Issue #1127: keep non-numeric dimensions. Filtering them out
          // dropped enum-qualified counts, so `u8[EColor.COUNT] slots` reached
          // the header as a scalar and the body as a bit-indexed value.
          // Filtering also shifted any dimension that followed a dropped one.
          dimensions.set(fieldName, [...fieldInfo.dimensions]);
        }
      }
    }

    structFields.set(cName, fields);
    structFieldArrays.set(cName, arrayFields);
    if (dimensions.size > 0) {
      structFieldDimensions.set(cName, dimensions);
    }
  }

  private static processEnum(
    enumSym: IEnumSymbol,
    knownEnums: Set<string>,
    enumMembers: Map<string, Map<string, number>>,
    memberCNames: Map<string, Map<string, string>>,
  ): void {
    const cName = enumSym.fullyQualifiedCName;
    knownEnums.add(cName);
    // #1318: members are symbols now. `ICodeGenSymbols.enumMembers` is the
    // name-to-value view codegen wants, so project rather than widen it --
    // handing codegen a symbol here would put a second symbol vocabulary in
    // the per-file view for no consumer that asked for one.
    // #1669: a member with no value has its enum rejected by 2.1 (E0909,
    // E0910, E0911) before codegen reads this, so it is left out rather than
    // handed on as a number it does not have
    enumMembers.set(
      cName,
      new Map(
        [...enumSym.members].flatMap(([name, member]) =>
          member.value === null ? [] : [[name, member.value] as const],
        ),
      ),
    );
    memberCNames.set(
      cName,
      TSymbolInfoAdapter.memberCNamesOf(enumSym.members.values()),
    );
  }

  /** Each member's name to the C name 3-Declare gave it (#2116) */
  private static memberCNamesOf(
    members: Iterable<{ name: string; fullyQualifiedCName: string }>,
  ): Map<string, string> {
    return new Map(
      [...members].map((member) => [member.name, member.fullyQualifiedCName]),
    );
  }

  private static processBitmap(
    bitmap: IBitmapSymbol,
    knownBitmaps: Set<string>,
    bitmapFields: Map<string, Map<string, IBitmapFieldLayout>>,
    bitmapBackingType: Map<string, string>,
    bitmapBitWidth: Map<string, number>,
  ): void {
    const cName = bitmap.fullyQualifiedCName;
    knownBitmaps.add(cName);
    bitmapBackingType.set(cName, bitmap.backingType);
    bitmapBitWidth.set(cName, bitmap.bitWidth);

    const fields = new Map<string, IBitmapFieldLayout>();
    for (const [fieldName, fieldInfo] of bitmap.fields) {
      fields.set(fieldName, {
        offset: fieldInfo.offset,
        width: fieldInfo.width,
      });
    }
    bitmapFields.set(cName, fields);
  }

  private static processScope(
    scope: IScopeSymbol,
    knownScopes: Set<string>,
    scopeMembers: Map<string, Set<string>>,
    scopeMemberVisibility: Map<string, Map<string, "public" | "private">>,
  ): void {
    // #1295: keyed by the scope's IDENTITY, never its leaf. `cnxScopedName` is
    // the dotted source path -- `Motor`, `Outer.Inner` -- which is the same
    // string every reader already holds (`currentScopePath`, a symbol's
    // `scopePath`), so no site converts. Keyed by the leaf, `Outer.Inner` and
    // `Other.Inner` collide and the second write silently replaces the first.
    knownScopes.add(scope.cnxScopedName);

    // Use scope.members as the authoritative list of member names
    // This includes functions, variables, enums, structs, etc.
    //
    // MERGED, not replaced. `processVariable` writes into the same key with
    // get-or-create-and-add, so an unconditional `set` here dropped every
    // variable that happened to be processed first. That was invisible because
    // `_collectScopeDeclaration` pushes the scope before its members -- an
    // emission-order coincidence nothing asserted, which is the shape this
    // whole line of work exists to remove.
    //
    // `scopeMemberVisibility` below needs no equivalent: `processScope` is its
    // only writer, and a reopened scope (ADR-016) is ONE symbol carrying many
    // `declarationSites` (#1334), not two symbols to merge.
    const members = scopeMembers.get(scope.cnxScopedName) ?? new Set<string>();
    for (const member of scope.members) {
      members.add(member);
    }
    scopeMembers.set(scope.cnxScopedName, members);

    // Copy visibility map
    scopeMemberVisibility.set(
      scope.cnxScopedName,
      new Map(scope.memberVisibility),
    );
  }

  private static processRegister(
    register: IRegisterSymbol,
    maps: IRegisterMaps,
  ): void {
    const cName = register.fullyQualifiedCName;
    maps.knownRegisters.add(cName);
    maps.registerBaseAddresses.set(cName, register.baseAddress);
    maps.memberCNames.set(
      cName,
      TSymbolInfoAdapter.memberCNamesOf(register.members.values()),
    );

    // Check if this is a scoped register (has non-global scope)
    const isScoped = !ScopeUtils.isGlobalScopePath(register.scopePath);
    if (isScoped) {
      maps.scopedRegisters.set(cName, register.baseAddress);
    }

    for (const memberInfo of register.members.values()) {
      const fullName = memberInfo.fullyQualifiedCName;

      maps.registerMemberAccess.set(fullName, memberInfo.access);
      maps.registerMemberOffsets.set(fullName, memberInfo.offset);
      // #1514: a bitmap member's C type IS the bitmap's C name, which is
      // what `knownBitmaps` is keyed by -- so whether the member is a bitmap
      // is asked of this map and the VISIBLE view's bitmaps, once, where the
      // include closure is known, not decided here from one file's.
      maps.registerMemberCTypes.set(
        fullName,
        TSymbolInfoAdapter.cnxTypeToCType(
          TypeResolver.getTypeName(memberInfo.type),
        ),
      );
    }
  }

  private static processVariable(
    variable: IVariableSymbol,
    scopeMembers: Map<string, Set<string>>,
  ): void {
    // #1295: `scopeMembers` is keyed by the scope's dotted source path, which is
    // exactly what `scopePath` already holds -- no conversion here, and no
    // collision at depth two.
    const scopeName = variable.scopePath;
    const isScoped = !ScopeUtils.isGlobalScopePath(variable.scopePath);

    // Track scoped variables as scope members (needed for name resolution)
    if (isScoped) {
      let members = scopeMembers.get(scopeName);
      if (!members) {
        members = new Set<string>();
        scopeMembers.set(scopeName, members);
      }
      members.add(variable.name); // Add local name (e.g., "value"), not transpiled C name
    }
  }

  private static processFunction(
    func: IFunctionSymbol,
    functionReturnTypes: Map<string, string>,
  ): void {
    // Track function return types for enum validation in assignments
    // This enables recognizing that Motor.getMode() returns Motor_EMode
    // Use transpiled C name (e.g., "Motor_getMode") for lookup consistency
    const cName = func.fullyQualifiedCName;
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);
    functionReturnTypes.set(cName, returnTypeStr);
  }

  private static cnxTypeToCType(typeName: string): string {
    return CNX_TO_C_TYPE_MAP[typeName] || typeName;
  }
}

export default TSymbolInfoAdapter;
