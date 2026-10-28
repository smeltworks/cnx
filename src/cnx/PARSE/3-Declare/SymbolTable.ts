/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 *
 * ADR-055 Phase 7: Fully typed symbol storage using discriminated unions.
 * - TSymbol: cnx symbols (rich type system with TType)
 * - TCSymbol: C header symbols (string types)
 * - TCppSymbol: C++ header symbols (string types)
 */

import DeclarationSite from "../../utils/DeclarationSite";
import OpaqueTypeResolution from "../../utils/OpaqueTypeResolution";
import { produce, enableMapSet } from "immer";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import IConflict from "../../types/IConflict";
import IStructFieldInfo from "../../types/symbols/IStructFieldInfo";
import type TStructLayout from "../../types/TStructLayout";
import IStructSymbolState from "../../types/symbols/IStructSymbolState";
import TJsonSafe from "../../utils/types/TJsonSafe";
import TSymbol from "../../types/symbols/TSymbol";
import TCSymbol from "../../types/symbols/c/TCSymbol";
import TCppSymbol from "../../types/symbols/cpp/TCppSymbol";
import TAnySymbol from "../../types/symbols/TAnySymbol";
import IStructSymbol from "../../types/symbols/IStructSymbol";
import TypeResolver from "../../utils/TypeResolver";
import type ITargetDescription from "../../types/ITargetDescription";
import invariant from "../../utils/invariant";
import type IResolvedSymbols from "../../types/IResolvedSymbols";

// Enable immer support for Map and Set (must be called once at module scope)
enableMapSet();

const STRUCT_LAYOUTS: ReadonlySet<string> = new Set<TStructLayout>([
  "union",
  "bit-packed",
  "unrecorded-member",
  "derived",
  "virtual",
]);

/** Create a fresh initial struct symbol state */
function createInitialStructState(): IStructSymbolState {
  return {
    opaqueTypes: new Set(),
    typedefToTag: new Map(),
    structTagsWithBodies: new Set(),
    pointerTypedefs: new Set(),
    structLayouts: new Map(),
  };
}

/**
 * Central symbol table for cross-language interoperability
 *
 * Per user requirement: Symbol conflicts between cnx and C/C++ are ERRORS.
 * - ERROR: Same symbol defined in cnx and C/C++
 * - OK: Multiple `extern` declarations in C (declaration, not definition)
 * - OK: Function overloads in C++ (different signatures)
 */
class SymbolTable implements IResolvedSymbols {
  // ========================================================================
  // cnx Symbol Storage (TSymbol)
  // ========================================================================

  /** All cnx TSymbols indexed by bare name (ADR-055: `init`, not `Motor__init`) */
  private readonly tSymbols: Map<string, TSymbol[]> = new Map();

  /**
   * All cnx TSymbols indexed by transpiled C name — their canonical identity.
   *
   * ADR-063 makes the qualified name injective, so it identifies a symbol
   * without needing a scope to interpret it. The bare-name index above answers
   * a different question ("what does `init` mean *here*?", which needs ADR-057
   * local->scope->global context); this one answers "which symbol is
   * `Motor__init`?". Codegen holds the latter, and before this index existed it
   * had to ask the former and got a silent empty result.
   *
   * For a global symbol both indexes share a key, since its bare name already
   * is its canonical identity.
   */
  private readonly tSymbolsByCName: Map<string, TSymbol[]> = new Map();

  /** cnx TSymbols indexed by source file */
  private readonly tSymbolsByFile: Map<string, TSymbol[]> = new Map();

  // ========================================================================
  // C Symbol Storage (TCSymbol)
  // ========================================================================

  /** All C symbols indexed by name */
  private readonly cSymbols: Map<string, TCSymbol[]> = new Map();

  /** C symbols indexed by source file */
  private readonly cSymbolsByFile: Map<string, TCSymbol[]> = new Map();

  // ========================================================================
  // C++ Symbol Storage (TCppSymbol)
  // ========================================================================

  /** All C++ symbols indexed by name */
  private readonly cppSymbols: Map<string, TCppSymbol[]> = new Map();

  /** C++ symbols indexed by source file */
  private readonly cppSymbolsByFile: Map<string, TCppSymbol[]> = new Map();

  /** C++ symbols by owner (`""` at file scope), then unqualified name (#2116) */
  private readonly cppMembers: Map<string, Map<string, TCppSymbol[]>> =
    new Map();

  // ========================================================================
  // Auxiliary Data (shared across languages)
  // ========================================================================

  /** Struct field information: struct name -> (field name -> field info) */
  private readonly structFields: Map<string, Map<string, IStructFieldInfo>> =
    new Map();

  /**
   * Issue #196 Bug 3: Track C struct names that need the 'struct' keyword
   * These are structs defined as 'struct Name { ... }' without typedef
   * In C, they must be referred to as 'struct Name', not just 'Name'
   */
  private readonly needsStructKeyword: Set<string> = new Set();

  /**
   * Issue #985 recovery: names of external function-like MACROS recovered by
   * translation-unit preprocessing (ExternalDeclarationOracle) for headers cnx
   * could not preprocess standalone. Macros have no declaration to parse, so
   * only their names are known; consulted by the undeclared-`global.`-call check
   * so it does not false-positive on a real macro (e.g. FreeRTOS pdMS_TO_TICKS).
   * Recovered FUNCTIONS are registered as full symbols (with signatures) instead.
   */
  private readonly externalDeclarationNames: Set<string> = new Set();

  /**
   * Issue #958: Immutable struct symbol state — additive only, query-time resolution.
   * Replaces the separate opaqueTypes field.
   */
  private structState: IStructSymbolState = createInitialStructState();

  /**
   * Issue #208: Track enum backing type bit widths
   * C++14 typed enums: enum Name : uint8_t { ... } have explicit bit widths
   */
  private readonly enumBitWidth: Map<string, number> = new Map();

  // ========================================================================
  // cnx Symbol Methods (TSymbol)
  // ========================================================================

  /**
   * Append a symbol to one of the multi-value indexes, creating the bucket on
   * first use.
   *
   * Every index in this class is `Map<string, T[]>` and was maintained by its
   * own copy of this get/push-or-set block. Adding an index meant writing the
   * block again and remembering `clear()` — the "edit it in two places"
   * anti-pattern CLAUDE.md calls the worst in the project.
   */
  private static appendToIndex<T>(
    index: Map<string, T[]>,
    key: string,
    symbol: T,
  ): void {
    const existing = index.get(key);
    if (existing) {
      existing.push(symbol);
    } else {
      index.set(key, [symbol]);
    }
  }

  /**
   * Add a cnx TSymbol to the table
   */
  addTSymbol(symbol: TSymbol): void {
    // #1285: read the identity the symbol was built with rather than deriving
    // it again. The symbol and its index key can no longer disagree, because
    // there is no second derivation to disagree with -- previously this called
    // the encoder a second time and stayed correct only because it happened to
    // be the same encoder.
    const cName = symbol.fullyQualifiedCName;

    SymbolTable.appendToIndex(this.tSymbols, symbol.name, symbol);
    SymbolTable.appendToIndex(this.tSymbolsByCName, cName, symbol);
    SymbolTable.appendToIndex(this.tSymbolsByFile, symbol.sourceFile, symbol);

    // Auto-register struct fields for the operand typer's field lookups
    if (symbol.kind === "struct") {
      this.registerStructFields(symbol, cName);
    }
  }

  /**
   * Register struct fields in structFields map for cross-file type resolution.
   * Called automatically when adding struct symbols.
   * Issue #981: Now preserves string dimensions (macro names) for proper array detection.
   *
   * @param cName The struct's transpiled C name, already computed by the caller —
   *   passed in rather than re-derived so this symbol's identity has one producer
   *   per call, matching the canonical-identity rule the index above relies on.
   */
  private registerStructFields(struct: IStructSymbol, cName: string): void {
    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for structFields map
      const typeString = TypeResolver.getTypeName(fieldInfo.type);

      this.addStructField(
        cName,
        fieldName,
        typeString,
        fieldInfo.dimensions && fieldInfo.dimensions.length > 0
          ? fieldInfo.dimensions
          : undefined,
      );
    }
  }

  /**
   * Add multiple cnx TSymbols at once
   */
  addTSymbols(symbols: readonly TSymbol[]): void {
    for (const symbol of symbols) {
      this.addTSymbol(symbol);
    }
  }

  /**
   * Get a TSymbol by name (returns first match, or undefined)
   */
  getTSymbol(name: string): TSymbol | undefined {
    const symbols = this.tSymbols.get(name);
    return symbols?.[0];
  }

  /**
   * Get all TSymbols with a given name (for overload detection)
   */
  getTOverloads(name: string): TSymbol[] {
    return this.tSymbols.get(name) ?? [];
  }

  /**
   * Get TSymbols by source file
   */
  getTSymbolsByFile(file: string): TSymbol[] {
    return this.tSymbolsByFile.get(file) ?? [];
  }

  /**
   * Get all TSymbols
   */
  getAllTSymbols(): TSymbol[] {
    const result: TSymbol[] = [];
    for (const symbols of this.tSymbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

  /**
   * Get TSymbol count
   */
  getTSize(): number {
    let count = 0;
    for (const symbols of this.tSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  // ========================================================================
  // C Symbol Methods (TCSymbol)
  // ========================================================================

  /**
   * Add a C symbol to the table
   * Issue #981: Also register struct fields for type resolution
   */
  addCSymbol(symbol: TCSymbol): void {
    SymbolTable.appendToIndex(this.cSymbols, symbol.name, symbol);
    SymbolTable.appendToIndex(this.cSymbolsByFile, symbol.sourceFile, symbol);

    // Issue #981: Register struct fields for the operand typer's field lookups
    if (symbol.kind === "struct" && symbol.fields) {
      this.registerCStructFields(symbol.name, symbol.fields);
    }
  }

  /**
   * Register C struct fields in structFields map for cross-file type resolution.
   * Issue #981: Required for macro-sized array field detection on local struct variables.
   */
  private registerCStructFields(
    structName: string,
    fields: ReadonlyMap<
      string,
      import("../../types/symbols/c/ICFieldInfo").default
    >,
  ): void {
    for (const [fieldName, fieldInfo] of fields) {
      this.addStructField(
        structName,
        fieldName,
        fieldInfo.type,
        fieldInfo.arrayDimensions,
        fieldInfo.bitWidth,
      );
    }
  }

  /**
   * Add multiple C symbols at once
   */
  addCSymbols(symbols: TCSymbol[]): void {
    for (const symbol of symbols) {
      this.addCSymbol(symbol);
    }
  }

  /**
   * Register external declaration names recovered via TU preprocessing.
   * @see externalDeclarationNames
   */
  addExternalDeclarationNames(names: ReadonlySet<string>): void {
    for (const name of names) {
      this.externalDeclarationNames.add(name);
    }
  }

  /** Whether a name was recovered as an external function / function-like macro. */
  hasExternalDeclaration(name: string): boolean {
    return this.externalDeclarationNames.has(name);
  }

  /**
   * Get a C symbol by name (returns first match, or undefined)
   */
  getCSymbol(name: string): TCSymbol | undefined {
    const symbols = this.cSymbols.get(name);
    return symbols?.[0];
  }

  /**
   * Whether `typeName` is a C typedef of a function pointer: its underlying
   * type contains "(*)".
   *
   * One rule for two readers (#1825): 1.4 recognizes a function assigned to
   * such a typedef as an ADR-029 callback, and 2.1 treats a variable of one as
   * callable (ADR-040).
   */
  isCFunctionPointerTypedef(typeName: string): boolean {
    const sym = this.getCSymbol(typeName);
    if (sym?.kind !== "type") return false;
    // ICTypedefSymbol has a `type` field with the underlying C type string
    return (
      "type" in sym && typeof sym.type === "string" && sym.type.includes("(*)")
    );
  }

  /**
   * #1610: whether a C typedef names a pointer type -- `T *` or a function
   * pointer `R (*)(...)` -- read from the typedef's declared type, as
   * `isCFunctionPointerTypedef` reads `(*)`. Unlike `isPointerTypedef`
   * (#957's include predicate, struct pointers only), this is every pointer,
   * including a typedef of one (`typedef vhandle_t vh2_t;`): the chain is
   * followed, qualifiers stripped, until a declared type spells the pointer.
   */
  isCPointerTypedef(typeName: string): boolean {
    const seen = new Set<string>();
    let name = typeName;
    while (!seen.has(name)) {
      seen.add(name);
      const sym = this.getCSymbol(name);
      if (sym?.kind !== "type") return false;
      if (!("type" in sym) || typeof sym.type !== "string") return false;
      const type = sym.type.trimEnd();
      if (type.endsWith("*") || type.includes("(*)")) return true;
      name = type.replaceAll(/\b(?:const|volatile)\b/g, "").trim();
    }
    return false;
  }

  /**
   * Get all C symbols with a given name
   */
  getCOverloads(name: string): TCSymbol[] {
    return this.cSymbols.get(name) ?? [];
  }

  /**
   * Get C symbols by source file
   */
  getCSymbolsByFile(file: string): TCSymbol[] {
    return this.cSymbolsByFile.get(file) ?? [];
  }

  /**
   * Get all C symbols
   */
  getAllCSymbols(): TCSymbol[] {
    const result: TCSymbol[] = [];
    for (const symbols of this.cSymbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

  // ========================================================================
  // C++ Symbol Methods (TCppSymbol)
  // ========================================================================

  /**
   * Add a C++ symbol to the table
   */
  addCppSymbol(symbol: TCppSymbol): void {
    SymbolTable.appendToIndex(this.cppSymbols, symbol.name, symbol);
    SymbolTable.appendToIndex(this.cppSymbolsByFile, symbol.sourceFile, symbol);
    const owner = symbol.parent ?? "";
    let members = this.cppMembers.get(owner);
    if (members === undefined) {
      members = new Map();
      this.cppMembers.set(owner, members);
    }
    SymbolTable.appendToIndex(members, symbol.unqualifiedName, symbol);
  }

  /**
   * Add multiple C++ symbols at once
   */
  addCppSymbols(symbols: TCppSymbol[]): void {
    for (const symbol of symbols) {
      this.addCppSymbol(symbol);
    }
  }

  /**
   * Get a C++ symbol by name (returns first match, or undefined)
   */
  getCppSymbol(name: string): TCppSymbol | undefined {
    const symbols = this.cppSymbols.get(name);
    return symbols?.[0];
  }

  /**
   * Get all C++ symbols with a given name
   */
  getCppOverloads(name: string): TCppSymbol[] {
    return this.cppSymbols.get(name) ?? [];
  }

  /**
   * The C++ symbols `owner` declares as `member` -- `owner` the stored name of
   * a namespace or class, undefined at file scope. Asked by identity, so no
   * caller spells `owner::member` to find them (#2116).
   */
  getCppMembers(owner: string | undefined, member: string): TCppSymbol[] {
    return this.cppMembers.get(owner ?? "")?.get(member) ?? [];
  }

  /**
   * Get C++ symbols by source file
   */
  getCppSymbolsByFile(file: string): TCppSymbol[] {
    return this.cppSymbolsByFile.get(file) ?? [];
  }

  /**
   * Get all C++ symbols
   */
  getAllCppSymbols(): TCppSymbol[] {
    const result: TCppSymbol[] = [];
    for (const symbols of this.cppSymbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

  // ========================================================================
  // Cross-Language Methods
  // ========================================================================

  /**
   * Get all symbols across all languages
   */
  getAllSymbols(): TAnySymbol[] {
    return [
      ...this.getAllTSymbols(),
      ...this.getAllCSymbols(),
      ...this.getAllCppSymbols(),
    ];
  }

  /**
   * Get first symbol matching a name across all languages.
   * Searches TSymbol, then C, then C++ collections.
   * Used by ISymbolLookup interface for constructor detection.
   */
  /**
   * Supplied to `ISymbolLookup` by STRUCTURAL conformance -- `SymbolTable` is
   * passed where that interface is expected, so this is used without ever
   * being named. `tsc` enforces it; knip cannot see it.
   *
   * @public
   */
  getSymbol(name: string): TAnySymbol | undefined {
    return (
      this.getTSymbol(name) ?? this.getCSymbol(name) ?? this.getCppSymbol(name)
    );
  }

  /**
   * Get all overloads for a name across all languages.
   *
   * cnx symbols are matched on their **bare** name, so a scoped member is
   * found by the name it carries inside its scope (`readValue`), not by its
   * transpiled C name. Callers holding a transpiled C name want
   * getOverloadsByCName instead.
   */
  getOverloads(name: string): TAnySymbol[] {
    return [
      ...this.getTOverloads(name),
      ...this.getCOverloads(name),
      ...this.getCppOverloads(name),
    ];
  }

  /**
   * Get all cnx overloads whose canonical identity is the given transpiled
   * C name (e.g. "Motor__init").
   *
   * The inverse of ScopeUtils.getTranspiledCName: that builds the name, this
   * resolves it back to the symbol. Exact match — no decomposition, so nothing
   * has to re-derive how a qualified name is spelled.
   */
  getTOverloadsByCName(cName: string): TSymbol[] {
    return this.tSymbolsByCName.get(cName) ?? [];
  }

  /**
   * Get all overloads across all languages for a transpiled C name.
   *
   * Use this wherever the caller already holds a generated C identifier —
   * codegen and anything downstream of it. C and C++ symbols have no scopes,
   * so their name is already their identity and they are matched directly;
   * cnx symbols are matched through the canonical-identity index.
   */
  getOverloadsByCName(cName: string): TAnySymbol[] {
    return [
      ...this.getTOverloadsByCName(cName),
      ...this.getCOverloads(cName),
      ...this.getCppOverloads(cName),
    ];
  }

  /**
   * Get symbols by source file across all languages
   */
  getSymbolsByFile(file: string): TAnySymbol[] {
    return [
      ...this.getTSymbolsByFile(file),
      ...this.getCSymbolsByFile(file),
      ...this.getCppSymbolsByFile(file),
    ];
  }

  /**
   * Get total symbol count
   */
  get size(): number {
    return this.getTSize() + this.getCSize() + this.getCppSize();
  }

  /**
   * Get C symbol count
   */
  getCSize(): number {
    let count = 0;
    for (const symbols of this.cSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  /**
   * Get C++ symbol count
   */
  getCppSize(): number {
    let count = 0;
    for (const symbols of this.cppSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  // ========================================================================
  // MISRA C:2012 Rule 5.1 - External Identifier Length
  // ========================================================================

  /**
   * Reject two external identifiers that are indistinguishable within the
   * target's significant-character limit (MISRA C:2012 Rule 5.1, issue #1307).
   *
   * C99 5.2.4.1 guarantees only 31 significant initial characters in an
   * external identifier, and `Scope__member` spends that budget on the
   * *encoding* rather than on the author's names -- the `__` separator costs two
   * characters per level and the scope name costs its full length. Two members
   * of `TemperatureSensorController` agree for 29 characters before their own
   * names begin, so a conforming implementation may treat them as one
   * identifier. On a hosted GCC nothing happens; on the minimal embedded
   * toolchain that is cnx's target audience the two variables silently
   * become one, and `cppcheck --addon=misra` does not report it.
   *
   * Scoped to identifiers cnx itself generates, and among those to the ones
   * with external linkage:
   * - A C or C++ header's identifiers are not this transpiler's to rename, and
   *   C++ names are mangled rather than truncated.
   * - `static` members (ADR-016 emits `private` as `static`) have internal
   *   linkage, which C99 gives a 63-character budget under a different rule.
   * - Types (struct/enum/bitmap/register) have no linkage at all.
   * - Two identifiers that are equal outright are `detectConflict`'s job
   *   (ADR-063, #1117), not this one.
   *
   * @param target The target, whose identifier significance limits apply
   * @returns One conflict per group of identifiers sharing a truncated prefix
   */
  detectMISRA51Conflicts(target: ITargetDescription): IConflict[] {
    const limit = target.external_identifier_chars;

    const byPrefix = SymbolTable.groupExternalCnxSymbolsByPrefix(
      this.getAllSymbols(),
      limit,
    );

    const conflicts: IConflict[] = [];
    for (const group of byPrefix.values()) {
      if (group.length < 2) {
        continue;
      }
      conflicts.push(SymbolTable.buildMISRA51Conflict(group, limit));
    }
    return conflicts;
  }

  /**
   * Bucket every externally-linked cnx identifier by its truncated prefix.
   *
   * Deduplicated by `fullyQualifiedCName`: one declaration can be registered
   * more than once when a file is reached along two include paths, and identity
   * -- not arrival count -- is what a linker sees.
   */
  private static groupExternalCnxSymbolsByPrefix(
    symbols: TAnySymbol[],
    limit: number,
  ): Map<string, TSymbol[]> {
    const byPrefix = new Map<string, TSymbol[]>();
    const seen = new Set<string>();

    for (const symbol of symbols) {
      if (!SymbolTable.hasExternalLinkage(symbol)) {
        continue;
      }

      const cnxSymbol = symbol as TSymbol;
      const identifier = cnxSymbol.fullyQualifiedCName;
      if (seen.has(identifier)) {
        continue;
      }
      seen.add(identifier);

      const prefix = identifier.slice(0, limit);
      const group = byPrefix.get(prefix);
      if (group) {
        group.push(cnxSymbol);
      } else {
        byPrefix.set(prefix, [cnxSymbol]);
      }
    }

    return byPrefix;
  }

  /**
   * True when the symbol is a cnx declaration emitted with external linkage.
   *
   * Only variables and functions have linkage in C; a typedef or an enumeration
   * constant names nothing the linker resolves.
   */
  private static hasExternalLinkage(symbol: TAnySymbol): boolean {
    if (symbol.sourceLanguage !== ESourceLanguage.Cnx) {
      return false;
    }
    if (symbol.kind !== "variable" && symbol.kind !== "function") {
      return false;
    }
    return symbol.visibility === "public";
  }

  /**
   * Build the Rule 5.1 diagnostic for one group of colliding identifiers.
   *
   * Names the cnx names the author wrote (`cnxScopedName`) rather than the
   * generated identifiers, per #1292 -- reporting `Scope__member` names
   * something that appears in no source file.
   */
  private static buildMISRA51Conflict(
    group: TSymbol[],
    limit: number,
  ): IConflict {
    const shared = group[0].fullyQualifiedCName.slice(0, limit);
    // Rendered through DeclarationSite like every other conflict location. This
    // producer landed concurrently with #1342 and carried its own `basename`
    // copy, which is ambiguous for the `can/config.cnx` + `uart/config.cnx`
    // layout #1133 supports -- both render as `config.cnx`.
    const locations = group
      .map(
        (symbol) =>
          `  ${symbol.cnxScopedName} (${DeclarationSite.display(symbol.sourceFile, symbol.span.line)})`,
      )
      .join("\n");

    return {
      code: "E0204",
      symbolName: group[0].name,
      definitions: [...group],
      severity: "error",
      sourceFile: group[0].sourceFile,
      line: group[0].span.line,
      // #1318: the symbol's own column, not a hardcoded 0.
      column: group[0].span.column,
      message:
        `External identifiers are not distinct within the target's ` +
        `${limit} significant characters (MISRA C:2012 Rule 5.1). ` +
        `All of these generate an identifier beginning '${shared}':\n${locations}\n` +
        `  Shorten the scope name or the member names so the first ${limit} ` +
        `characters differ.`,
    };
  }

  // ========================================================================
  // Struct Field Information
  // ========================================================================

  /**
   * Add struct field information.
   * Issue #981: Accept (number | string)[] for arrayDimensions to support macro-sized arrays.
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @param fieldType Type of the field (e.g., "uint32_t")
   * @param arrayDimensions Optional array dimensions - numbers for resolved, strings for macros
   * @param bitWidth A bit-field's declared width (#1975 review)
   */
  addStructField(
    structName: string,
    fieldName: string,
    fieldType: string,
    arrayDimensions?: readonly (number | string)[],
    bitWidth?: number | string,
  ): void {
    let fields = this.structFields.get(structName);
    if (!fields) {
      fields = new Map();
      this.structFields.set(structName, fields);
    }

    // Copy to mutable array for storage
    fields.set(fieldName, {
      type: fieldType,
      arrayDimensions: arrayDimensions ? [...arrayDimensions] : undefined,
      ...(bitWidth !== undefined && { bitWidth }),
    });
  }

  /**
   * Get struct field info (type and array dimensions)
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Field info or undefined if not found
   * @public reached by structural conformance through IForeignSymbolLookup; no caller names SymbolTable
   */
  getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): IStructFieldInfo | undefined {
    const fields = this.structFields.get(structName);
    return fields?.get(fieldName);
  }

  /**
   * Get all fields for a struct
   * @param structName Name of the struct
   * @returns Map of field names to field info, or undefined if struct not found
   * @public reached by structural conformance through IForeignSymbolLookup and IStructFieldLookup; no caller names SymbolTable
   */
  getStructFields(
    structName: string,
  ): Map<string, IStructFieldInfo> | undefined {
    return this.structFields.get(structName);
  }

  /**
   * Get struct field types as a simple map (fieldName -> typeName).
   * Used by code generation for nested struct initializers.
   * @param structName Name of the struct
   * @returns Map of field names to type strings, or undefined if struct not found
   */
  getStructFieldTypes(structName: string): Map<string, string> | undefined {
    const fields = this.structFields.get(structName);
    if (!fields) return undefined;

    const result = new Map<string, string>();
    for (const [fieldName, info] of fields) {
      result.set(fieldName, info.type);
    }
    return result;
  }

  /**
   * Get all struct fields for cache serialization
   * @returns Map of struct name -> (field name -> field info)
   */
  getAllStructFields(): Map<string, Map<string, IStructFieldInfo>> {
    return this.structFields;
  }

  /**
   * Restore struct fields from cache
   * Merges cached fields into the existing structFields map
   * @param fields Map of struct name -> (field name -> field info)
   */
  restoreStructFields(
    fields: Map<string, Map<string, IStructFieldInfo>>,
  ): void {
    for (const [structName, fieldMap] of fields) {
      let existingFields = this.structFields.get(structName);
      if (!existingFields) {
        existingFields = new Map();
        this.structFields.set(structName, existingFields);
      }

      for (const [fieldName, fieldInfo] of fieldMap) {
        existingFields.set(fieldName, fieldInfo);
      }
    }
  }

  /**
   * Get struct names defined in a specific source file
   * @param file Source file path
   * @returns Array of struct names defined in that file
   */
  getStructNamesByFile(file: string): string[] {
    const fileSymbols = this.getSymbolsByFile(file);
    const symbolNames = fileSymbols.map((s) => s.name);
    return symbolNames.filter((name) => this.structFields.has(name));
  }

  // ========================================================================
  // Struct Keyword Tracking
  // ========================================================================

  /**
   * Issue #196 Bug 3: Mark a struct as requiring 'struct' keyword in C
   * @param structName Name of the struct (e.g., "NamedPoint")
   */
  markNeedsStructKeyword(structName: string): void {
    this.needsStructKeyword.add(structName);
  }

  /**
   * Issue #196 Bug 3: Check if a struct requires 'struct' keyword in C
   * @param structName Name of the struct
   * @returns true if the struct was defined as 'struct Name { ... }' without typedef
   */
  checkNeedsStructKeyword(structName: string): boolean {
    return this.needsStructKeyword.has(structName);
  }

  /**
   * Issue #196 Bug 3: Get all struct names requiring 'struct' keyword
   * @returns Array of struct names
   */
  getAllNeedsStructKeyword(): string[] {
    return Array.from(this.needsStructKeyword);
  }

  /**
   * Issue #196 Bug 3: Restore needsStructKeyword from cache
   * @param structNames Array of struct names requiring 'struct' keyword
   */
  restoreNeedsStructKeyword(structNames: string[]): void {
    for (const name of structNames) {
      this.needsStructKeyword.add(name);
    }
  }

  // ========================================================================
  // Struct Symbol State (Issue #948, #958) — immer-managed, additive only
  // ========================================================================

  /**
   * Issue #1225: capture the whole struct state for the cache.
   *
   * The return type is derived from `IStructSymbolState`, so a field added
   * there makes this method fail to compile until it is written here. That
   * replaces a hand-maintained capture list which silently omitted
   * `pointerTypedefs` when #1164 added it — a warm-cache build then emitted a
   * header that contradicted the real typedef.
   */
  serializeStructState(): TJsonSafe<Required<IStructSymbolState>> {
    return {
      opaqueTypes: Array.from(this.structState.opaqueTypes),
      typedefToTag: Array.from(this.structState.typedefToTag),
      structTagsWithBodies: Array.from(this.structState.structTagsWithBodies),
      pointerTypedefs: Array.from(this.structState.pointerTypedefs),
      structLayouts: Array.from(this.structState.structLayouts),
    };
  }

  /**
   * Issue #1225: the keys `serializeStructState` produces.
   *
   * Derived by running the serializer rather than listing them, so it cannot
   * fall behind the interface. Two callers need it and must agree: the reader
   * that validates an entry's struct state, and the cache-config fingerprint
   * that invalidates entries written under an older shape.
   */
  static structStateKeys(): string[] {
    return Object.keys(new SymbolTable().serializeStructState());
  }

  /**
   * Issue #1225: restore struct state from the cache.
   *
   * Additive, like every other mutation of this state: a warm build merges
   * cached facts into whatever the current run has already learned.
   *
   * Coverage is enforced twice. The `IStructSymbolState` annotation below
   * fails to compile if a field is not revived, and `mergeStructState` walks
   * the object rather than naming fields, so it cannot skip one.
   */
  restoreStructState(state: TJsonSafe<Required<IStructSymbolState>>): void {
    const revived: Required<IStructSymbolState> = {
      opaqueTypes: new Set(state.opaqueTypes),
      typedefToTag: new Map(state.typedefToTag),
      structTagsWithBodies: new Set(state.structTagsWithBodies),
      pointerTypedefs: new Set(state.pointerTypedefs),
      structLayouts: new Map(
        state.structLayouts.filter(SymbolTable.isLayoutEntry),
      ),
    };

    this.structState = produce(this.structState, (draft) => {
      SymbolTable.mergeStructState(draft, revived);
    });
  }

  /** #1975: a cached layout entry, read back from JSON */
  private static isLayoutEntry(
    entry: readonly [string, string],
  ): entry is [string, TStructLayout] {
    return STRUCT_LAYOUTS.has(entry[1]);
  }

  /**
   * Merge every field of `incoming` into `draft`.
   *
   * Deliberately generic: it reads the keys off the object instead of listing
   * them, so a new field is merged without anyone editing this method. The
   * throw is the counterpart — a field that is neither a Set nor a Map has no
   * merge rule, and failing loudly beats the silent skip that produced #1225.
   */
  private static mergeStructState(
    draft: IStructSymbolState,
    incoming: IStructSymbolState,
  ): void {
    // Safe: `incoming` is built from an IStructSymbolState-annotated literal
    // directly above, so its own keys are exactly the interface's keys.
    const keys = Object.keys(incoming) as Array<keyof IStructSymbolState>;

    for (const key of keys) {
      const target = draft[key];
      const source = incoming[key];

      if (target instanceof Set && source instanceof Set) {
        for (const member of source) {
          target.add(member);
        }
      } else if (target instanceof Map && source instanceof Map) {
        // Each key's Map holds one value type, the one `source`'s holds
        const into = target as Map<string, unknown>;
        for (const [entryKey, entryValue] of source) {
          into.set(entryKey, entryValue);
        }
      } else {
        // A field with no merge rule would be skipped in silence, which is how
        // #1225 happened. Add the rule above.
        invariant(
          false,
          `every struct-state field has a merge rule, "${key}" included`,
        );
      }
    }
  }

  /**
   * Issue #948: Mark a typedef as aliasing an opaque (forward-declared) struct type.
   * @param typeName Typedef name (e.g., "widget_t")
   */
  markOpaqueType(typeName: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.opaqueTypes.add(typeName);
    });
  }

  /**
   * Issue #957/#1164: record a typedef of a pointer to a struct.
   */
  markPointerTypedef(typeName: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.pointerTypedefs.add(typeName);
    });
  }

  /**
   * Issue #957/#1164: is this typedef a pointer to a struct?
   *
   * Such a type must never be forward-declared as `typedef struct X X;` -- the
   * header has to include the one that defines it.
   */
  isPointerTypedef(typeName: string): boolean {
    return this.structState.pointerTypedefs.has(typeName);
  }

  /**
   * Issue #948/#958: Check if a typedef aliases a truly opaque struct type.
   * Query-time resolution: if the underlying struct tag has a body, it's not opaque.
   * @param typeName Typedef name
   * @returns true if the type is opaque (forward-declared with no body found)
   */
  isOpaqueType(typeName: string): boolean {
    // #1511: the rule is shared with 1.4 Resolve, which authors this as a fact
    // of the whole program; 1.4's parameter stamp (#1722) reads that. This is
    // the same rule over the same marks, for the readers that hold a table:
    // #985 phantom-body recovery (a throwaway table), `ForeignTypeFacts`'
    // struct checks, and `DeclaredPointer.isHandleType` (ADR-030). There used
    // to be a second mark, `typedefStructTypes`, set under the identical
    // condition and resolved by a copy of this rule; one mark and one rule
    // mean a handle parameter's signature and call site cannot disagree.
    return OpaqueTypeResolution.isOpaque(
      typeName,
      this.structState.opaqueTypes,
      this.structState.typedefToTag,
      this.structState.structTagsWithBodies,
    );
  }

  /**
   * Every typedef-to-struct-tag pairing, for whoever must resolve opacity.
   *
   * #1511: the resolution moved to 1.4 Resolve, which needs the mapping rather
   * than one lookup at a time. Exposed as the pairs it is stored as.
   */
  getAllTypedefToTag(): Array<[string, string]> {
    return [...this.structState.typedefToTag.entries()];
  }

  /**
   * Issue #948: Get all opaque type names for cache serialization.
   * Returns the raw set — resolution happens at query time via isOpaqueType().
   * @returns Array of opaque typedef names
   */
  getAllOpaqueTypes(): string[] {
    return Array.from(this.structState.opaqueTypes);
  }

  /**
   * Issue #948: Register a struct tag -> typedef name relationship.
   * Called when processing: typedef struct _foo foo_t;
   * Stored typedef→tag: every decision reads it that way (#1418 deleted the
   * tag→typedef copy, which nothing in production read).
   * @param structTag The struct tag name (e.g., "_foo")
   * @param typedefName The typedef alias name (e.g., "foo_t")
   */
  registerStructTagAlias(structTag: string, typedefName: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.typedefToTag.set(typedefName, structTag);
    });
  }

  /**
   * Issue #958: Record that a struct tag has a full definition (body).
   * Used by query-time resolution: opaque types with bodies are not truly opaque.
   * @param structTag The struct tag name (e.g., "_widget_t")
   */
  markStructTagHasBody(structTag: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.structTagsWithBodies.add(structTag);
    });
  }

  /**
   * Issue #985: Clear a struct tag's recorded body. Used by external-declaration
   * recovery to undo a PHANTOM body — one fabricated by ANTLR error-recovery when
   * the normal pass parsed a header's huge preprocessed blob — so a type the
   * clean per-file re-parse proves opaque (e.g. lvgl `lv_obj_t`) resolves as
   * opaque again (and codegen uses a pointer).
   * @param structTag The struct tag name (e.g., "_lv_obj_t")
   */
  clearStructTagHasBody(structTag: string): void {
    if (!this.structState.structTagsWithBodies.has(structTag)) return;
    this.structState = produce(this.structState, (draft) => {
      draft.structTagsWithBodies.delete(structTag);
    });
  }

  /** #1975: record why `structName`'s members do not sum to its length */
  setStructLayout(structName: string, layout: TStructLayout): void {
    this.structState = produce(this.structState, (draft) => {
      draft.structLayouts.set(structName, layout);
    });
  }

  /** #1975: why `structName` has no length, or null when its fields sum */
  getStructLayout(structName: string): TStructLayout | null {
    return this.structState.structLayouts.get(structName) ?? null;
  }

  /** Issue #985: The struct tag a typedef aliases, if any (e.g. lv_obj_t -> _lv_obj_t). */
  getStructTagForTypedef(typedefName: string): string | undefined {
    return this.structState.typedefToTag.get(typedefName);
  }

  /**
   * Issue #958: Get all struct tags with bodies for cache serialization.
   * @returns Array of struct tag names
   */
  getAllStructTagsWithBodies(): string[] {
    return Array.from(this.structState.structTagsWithBodies);
  }

  // ========================================================================
  // Issue #958: Typedef Struct Type Tracking
  // ========================================================================

  // ========================================================================
  // Enum Bit Width Tracking
  // ========================================================================

  /**
   * Issue #208: Add enum bit width for a typed enum
   * @param enumName Name of the enum (e.g., "EPressureType")
   * @param bitWidth Bit width from backing type (e.g., 8 for uint8_t)
   */
  addEnumBitWidth(enumName: string, bitWidth: number): void {
    this.enumBitWidth.set(enumName, bitWidth);
  }

  /**
   * Issue #208: Get enum bit width for a typed enum
   * @param enumName Name of the enum
   * @returns Bit width or undefined if not a typed enum
   */
  getEnumBitWidth(enumName: string): number | undefined {
    return this.enumBitWidth.get(enumName);
  }

  /**
   * Issue #208: Get all enum bit widths for cache serialization
   * @returns Map of enum name -> bit width
   */
  getAllEnumBitWidths(): Map<string, number> {
    return this.enumBitWidth;
  }

  /**
   * Issue #208: Restore enum bit widths from cache
   * @param bitWidths Map of enum name -> bit width
   */
  restoreEnumBitWidths(bitWidths: Map<string, number>): void {
    for (const [enumName, width] of bitWidths) {
      this.enumBitWidth.set(enumName, width);
    }
  }

  // ========================================================================
  // External Array Dimension Resolution
  // ========================================================================

  // ========================================================================
  // Clear / Reset
  // ========================================================================
}

export default SymbolTable;
