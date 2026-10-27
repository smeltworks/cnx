/**
 * What each file can SEE — 1.4 Resolve's half of the symbol view.
 *
 * `convert()` in 1.3 Declare answers "what does this file declare?", which is a
 * per-file question. What codegen actually needs is "what may this file use?",
 * and that is the file plus everything its include closure reaches — a
 * cross-file question no per-file pass can answer.
 *
 * The composition is local-wins: a name the file declares itself shadows the
 * same name from an include, and among includes the first one walked wins. That
 * rule IS the visibility decision, which is why it belongs to the pass that owns
 * cross-file facts rather than to the adapter that builds the per-file view
 * (#1511).
 *
 * It used to run per file during rendering, merging into a view that had been
 * built per file — so the answer depended on how much of the run had gone
 * before, and `TransitiveEnumCollector` silently skipped any file not yet
 * published. Composed once now, while the whole program is in hand.
 */

import type IBitmapFieldLayout from "../../types/IBitmapFieldLayout";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type TExpression from "../../types/syntax/TExpression";

/**
 * The mutable collections mergeExternalSymbols accumulates into.
 *
 * Grouped into one object rather than passed as eight parameters: adding the
 * three type-forming sets for #1333 took the parameter list past what is
 * readable, and a positional list of eight same-shaped collections is a
 * transposition waiting to happen.
 */
interface IMergeAccumulator {
  readonly knownEnums: Set<string>;
  readonly knownScopes: Set<string>;
  readonly enumMembers: Map<string, Map<string, number>>;
  readonly memberCNames: Map<string, Map<string, string>>;
  readonly functionReturnTypes: Map<string, string>;
  readonly scopeMemberVisibility: Map<
    string,
    Map<string, "public" | "private">
  >;
  readonly knownStructs: Set<string>;
  readonly knownBitmaps: Set<string>;
  readonly bitmapFields: Map<string, Map<string, IBitmapFieldLayout>>;
  readonly bitmapBackingType: Map<string, string>;
  readonly knownRegisters: Set<string>;
  readonly scopedRegisters: Map<string, TExpression>;
  readonly registerMemberAccess: Map<string, string>;
  readonly registerBaseAddresses: Map<string, TExpression>;
  readonly registerMemberOffsets: Map<string, TExpression>;
  readonly registerMemberCTypes: Map<string, string>;
  readonly bitmapBitWidth: Map<string, number>;
  readonly structFields: Map<string, Map<string, string>>;
  readonly structFieldArrays: Map<string, Set<string>>;
  readonly structFieldDimensions: Map<
    string,
    Map<string, ReadonlyArray<number | string>>
  >;
}

class VisibleSymbols {
  /**
   * Issue #465: Merge external symbol info into an existing ISymbolInfo.
   *
   * When a file includes other .cnx files, the enum types and scopes from those
   * external files need to be available for code generation. This enables:
   * - Enum member prefixing for external enums
   * - Cross-scope method calls like global.Scope.method() returning enums
   * - Visibility enforcement on members of included scopes (#1190)
   *
   * This method creates a new ISymbolInfo that includes both the base symbols
   * and merged info from external sources.
   *
   * @param base The ISymbolInfo from the current file
   * @param externalSources Array of ISymbolInfo from included .cnx files
   * @returns New ISymbolInfo with merged enum, scope and visibility data
   */
  static mergeExternalSymbols(
    base: ICodeGenSymbols,
    externalSources: readonly ICodeGenSymbols[],
  ): ICodeGenSymbols {
    // If no external sources, return base unchanged
    if (externalSources.length === 0) {
      return base;
    }

    // Create mutable copies of enum-related data and scope info
    const mergedKnownEnums = new Set(base.knownEnums);
    const mergedKnownScopes = new Set(base.knownScopes);
    const mergedKnownStructs = new Set(base.knownStructs);
    const mergedKnownBitmaps = new Set(base.knownBitmaps);
    const mergedBitmapFields = VisibleSymbols._copyNestedMap(base.bitmapFields);
    const mergedBitmapBackingType = new Map(base.bitmapBackingType);
    const mergedBitmapBitWidth = new Map(base.bitmapBitWidth);
    const mergedEnumMembers = VisibleSymbols._copyNestedMap(base.enumMembers);
    const mergedMemberCNames = VisibleSymbols._copyNestedMap(base.memberCNames);
    const mergedFunctionReturnTypes = new Map(base.functionReturnTypes);
    const mergedScopeMemberVisibility = VisibleSymbols._copyNestedMap(
      base.scopeMemberVisibility,
    );
    const mergedKnownRegisters = new Set(base.knownRegisters);
    const mergedScopedRegisters = new Map(base.scopedRegisters);
    const mergedRegisterMemberAccess = new Map(base.registerMemberAccess);
    const mergedRegisterBaseAddresses = new Map(base.registerBaseAddresses);
    const mergedRegisterMemberOffsets = new Map(base.registerMemberOffsets);
    const mergedRegisterMemberCTypes = new Map(base.registerMemberCTypes);
    const mergedStructFields = VisibleSymbols._copyNestedMap(base.structFields);
    const mergedStructFieldArrays = new Map(
      [...base.structFieldArrays].map(([name, fields]) => [
        name,
        new Set(fields),
      ]),
    );
    const mergedStructFieldDimensions = VisibleSymbols._copyNestedMap(
      base.structFieldDimensions,
    );

    // Merge in external enum info, function return types, scopes and visibility
    for (const external of externalSources) {
      VisibleSymbols._mergeExternalSource(external, {
        knownEnums: mergedKnownEnums,
        knownScopes: mergedKnownScopes,
        enumMembers: mergedEnumMembers,
        memberCNames: mergedMemberCNames,
        functionReturnTypes: mergedFunctionReturnTypes,
        scopeMemberVisibility: mergedScopeMemberVisibility,
        knownStructs: mergedKnownStructs,
        knownBitmaps: mergedKnownBitmaps,
        bitmapFields: mergedBitmapFields,
        bitmapBackingType: mergedBitmapBackingType,
        bitmapBitWidth: mergedBitmapBitWidth,
        knownRegisters: mergedKnownRegisters,
        scopedRegisters: mergedScopedRegisters,
        registerMemberAccess: mergedRegisterMemberAccess,
        registerBaseAddresses: mergedRegisterBaseAddresses,
        registerMemberOffsets: mergedRegisterMemberOffsets,
        registerMemberCTypes: mergedRegisterMemberCTypes,
        structFields: mergedStructFields,
        structFieldArrays: mergedStructFieldArrays,
        structFieldDimensions: mergedStructFieldDimensions,
      });
    }

    // Return new ICodeGenSymbols with merged enum data and scope info
    return {
      ...base,
      knownScopes: mergedKnownScopes,
      knownEnums: mergedKnownEnums,
      knownStructs: mergedKnownStructs,
      knownBitmaps: mergedKnownBitmaps,
      bitmapFields: mergedBitmapFields,
      bitmapBackingType: mergedBitmapBackingType,
      bitmapBitWidth: mergedBitmapBitWidth,
      enumMembers: mergedEnumMembers,
      memberCNames: mergedMemberCNames,
      functionReturnTypes: mergedFunctionReturnTypes,
      scopeMemberVisibility: mergedScopeMemberVisibility,
      knownRegisters: mergedKnownRegisters,
      scopedRegisters: mergedScopedRegisters,
      registerMemberAccess: mergedRegisterMemberAccess,
      registerBaseAddresses: mergedRegisterBaseAddresses,
      registerMemberOffsets: mergedRegisterMemberOffsets,
      registerMemberCTypes: mergedRegisterMemberCTypes,
      structFields: mergedStructFields,
      structFieldArrays: mergedStructFieldArrays,
      structFieldDimensions: mergedStructFieldDimensions,
    };
  }

  private static _mergeExternalSource(
    external: ICodeGenSymbols,
    into: IMergeAccumulator,
  ): void {
    // #1333: every type-forming kind crosses the include boundary on the same
    // terms. Only knownEnums did, so ADR-057 qualification was kind-dependent: in
    // a scope spanning two files, an enum declared in the other file qualified and
    // a struct did not. Adjacent lines in one function emitted `Lib__Mode m` and
    // bare `Point p` -- the second does not compile. The asymmetry was invisible
    // while a scope could not span files at all, which is the bug this shipped with.
    VisibleSymbols._mergeNames(external.knownEnums, into.knownEnums);
    VisibleSymbols._mergeNames(external.knownStructs, into.knownStructs);
    VisibleSymbols._mergeNames(external.knownBitmaps, into.knownBitmaps);

    // Issue #1190: the visibility map travels with the scope name. Registering a
    // scope as known while leaving its visibility unknown makes every member of an
    // included scope look public, because the access check reads `undefined` and
    // only rejects an explicit "private".
    VisibleSymbols._mergeNames(external.knownScopes, into.knownScopes);

    // A type's NAME is not enough; its detail travels with it. enumMembers already
    // moved with knownEnums, which is exactly why enums were the only kind that
    // ever worked -- carrying knownBitmaps alone let a cross-file bitmap type
    // resolve and then hard-error on the field behind it ("Unknown bitmap field
    // 'Mode' on type 'Lib__Flags'"). Same asymmetry, one level down.
    const cloneMap = <K, V>(m: ReadonlyMap<K, V>): Map<K, V> => new Map(m);

    VisibleSymbols._mergePreferringLocal(
      external.enumMembers,
      into.enumMembers,
      cloneMap,
    );
    VisibleSymbols._mergePreferringLocal(
      external.memberCNames,
      into.memberCNames,
      cloneMap,
    );
    VisibleSymbols._mergePreferringLocal(
      external.bitmapFields,
      into.bitmapFields,
      cloneMap,
    );
    VisibleSymbols._mergePreferringLocal(
      external.bitmapBackingType,
      into.bitmapBackingType,
    );
    VisibleSymbols._mergePreferringLocal(
      external.bitmapBitWidth,
      into.bitmapBitWidth,
    );
    VisibleSymbols._mergePreferringLocal(
      external.scopeMemberVisibility,
      into.scopeMemberVisibility,
      cloneMap,
    );
    VisibleSymbols._mergePreferringLocal(
      external.functionReturnTypes,
      into.functionReturnTypes,
    );
    // A struct's fields travel with its name on the same terms (#1760 second
    // review): only the name crossed, so a field of an included struct had no
    // type, and `{ f: { A: 1 } }` for an included struct's bitmap field
    // reached C as a designated initializer on a scalar.
    VisibleSymbols._mergePreferringLocal(
      external.structFields,
      into.structFields,
      cloneMap,
    );
    VisibleSymbols._mergePreferringLocal(
      external.structFieldArrays,
      into.structFieldArrays,
      (fields) => new Set(fields),
    );
    VisibleSymbols._mergePreferringLocal(
      external.structFieldDimensions,
      into.structFieldDimensions,
      cloneMap,
    );

    // #1322: a register crosses on the same terms as every kind above. It never
    // did -- a board file declaring `register HW @ ...` and an application
    // file including it is ADR-004's whole use case, and the importer reported
    // `'HW' is not defined` (E0427) because nothing carried the name across.
    // Its detail travels with it, as the bitmap maps do: the access modifiers
    // are what E0870-E0872 read, and the offsets, C types and base addresses
    // are what codegen spells the access with.
    VisibleSymbols._mergeNames(external.knownRegisters, into.knownRegisters);
    VisibleSymbols._mergePreferringLocal(
      external.scopedRegisters,
      into.scopedRegisters,
    );
    VisibleSymbols._mergePreferringLocal(
      external.registerMemberAccess,
      into.registerMemberAccess,
    );
    VisibleSymbols._mergePreferringLocal(
      external.registerBaseAddresses,
      into.registerBaseAddresses,
    );
    VisibleSymbols._mergePreferringLocal(
      external.registerMemberOffsets,
      into.registerMemberOffsets,
    );
    VisibleSymbols._mergePreferringLocal(
      external.registerMemberCTypes,
      into.registerMemberCTypes,
    );
  }

  /**
   * Add every member of `from` into `into`. A name-only set: no precedence
   * question arises because the sets carry no payload.
   */
  private static _mergeNames(
    from: ReadonlySet<string>,
    into: Set<string>,
  ): void {
    for (const name of from) {
      into.add(name);
    }
  }

  /**
   * Merge `from` into `into`, **local wins**: an entry already present is never
   * overwritten by an external one.
   *
   * The nine merges in _mergeExternalSource were nine copies of this loop, which
   * is both the duplication and the cognitive complexity SonarCloud flagged
   * (S3776, 22 against 15). More to the point, "local takes precedence" was
   * restated nine times, so a tenth merge could silently choose otherwise.
   *
   * `clone` exists because half the values are Maps that must not be aliased
   * between the base and the merged result.
   */
  private static _mergePreferringLocal<K, V>(
    from: ReadonlyMap<K, V>,
    into: Map<K, V>,
    clone: (value: V) => V = (value) => value,
  ): void {
    for (const [key, value] of from) {
      if (!into.has(key)) {
        into.set(key, clone(value));
      }
    }
  }

  /**
   * Deep-copy an outer -> (inner -> value) map so the merged result never
   * aliases the base's inner maps.
   *
   * One decision, spelled three times -- inline for `bitmapFields`, and as
   * `_copyEnumMembers` and `_copyScopeMemberVisibility` -- unified, so a fourth
   * nested field cannot be added by copying whichever spelling sat nearest.
   *
   * `tsc` holds the deep copy in place, which is the interesting part and the
   * reason no test covers it: the SHALLOW `new Map(...)` the flat fields use
   * sits right beside these and reads equally idiomatic, but substituting it
   * here is rejected -- `Map<K, ReadonlyMap<IK, V>>` is not assignable to
   * `Map<K, Map<IK, V>>`. An earlier version of this comment justified the
   * helper with the aliasing bug that would follow instead, which the types
   * forbid and `_mergePreferringLocal` never reaches anyway; naming an
   * unreachable failure mode is the thing the rest of this change removes.
   */
  private static _copyNestedMap<K, IK, V>(
    source: ReadonlyMap<K, ReadonlyMap<IK, V>>,
  ): Map<K, Map<IK, V>> {
    const copy = new Map<K, Map<IK, V>>();
    for (const [key, inner] of source) {
      copy.set(key, new Map(inner));
    }
    return copy;
  }
}

export default VisibleSymbols;
