/**
 * CacheManager
 *
 * Manages persistent cache for parsed C/C++ header symbols, read through the
 * port and written by 3.1 Write (#1653).
 * Cache is stored in .cnx/ directory (similar to .git/).
 *
 * Cache structure:
 *   .cnx/
 *     config.json     - Cache metadata (version, timestamps)
 *     cache/
 *       symbols.json  - Cached symbols per file, one JSON object keyed by path
 */

import { join } from "node:path";
import CacheKeyGenerator from "./CacheKeyGenerator";
import JsonCodec from "./JsonCodec";
import CachedSymbolReader from "./CachedSymbolReader";
import IStructFieldInfo from "../../cnx/types/symbols/IStructFieldInfo";
import SymbolTable from "../../cnx/PARSE/3-Declare/SymbolTable";
import type IHeaderDeclarationRecord from "../../cnx/PARSE/1-Discover/types/IHeaderDeclarationRecord";
import ICacheConfig from "../types/ICacheConfig";
import ICachedFileEntry from "../types/ICachedFileEntry";
import IStructSymbolState from "../../cnx/types/symbols/IStructSymbolState";
import TJsonSafe from "../../cnx/utils/types/TJsonSafe";
import TJsonValue from "../../cnx/utils/types/TJsonValue";
import IFileSystem from "../../cnx/types/IFileSystem";
import packageJson from "../../../package.json" with { type: "json" };
import Write from "../../cnx/WRITE/1-Write/Write";

/** Current cache format version - increment when serialization format changes */
// Bump when the ENTRY shape changes in a way no fingerprint can see -- the
// TCSymbol/TCppSymbol unions are types, so their keys cannot be enumerated at
// runtime. Struct-state drift no longer needs a bump: STRUCT_STATE_SHAPE below
// is derived and invalidates on its own.
// 12: a C declarator's pointer DEPTH is recorded now -- `Dev** out` was
// stored as `Dev*` -- so an entry written before means a different type
// under an unchanged shape, which no fingerprint above can see.
// 13: Issue #1668 -- a C struct/enum specifier is spelled `enum tag` / `foo`,
// not with the keyword run into the tag. Same entry shape, different values.
// Both changes took 12 on their own branches, so an entry either one wrote
// under 12 lacks the other change: the merge takes 13.
// 14: #1760 review -- a C variable's and a typedef's spelling keeps
// `volatile`, so an entry written before reads as non-volatile under an
// unchanged shape: a saturating cast of it would read it three times.
// 15: #1760 review -- a C struct field records its declarator's type
// (`uint8_t*`, `float (*)(void)`), where it recorded its specifiers alone.
// 16: #1653 -- the entries are plain JSON in `symbols.json`, read through the
// port; flat-cache wrote `flatted` to `symbols`, which invalidation removes.
// 17: #1975 review -- a C struct field records whether its struct is a union
// or packs bit-fields, and a bit-field (`uint32_t a : 3`) is recorded where it
// was dropped, so an entry written before sums a union's fields as a size.
// 18: #1975 review 2 -- a struct's layout (union, bit-packed, ...) is
// recorded once on the struct, where it was recorded on each field.
// 19: #1975 review (owner ruling) -- a C/C++ struct field records a
// bit-field's declared width, so an entry written before measures
// `uint32_t a : 3` as its storage type's 32 bits.
// 20: #2103 -- `typedef struct _w {...} w;` records w's tag as it does for a
// forward-declared tag, so an entry written before reads `w` and `_w` as two
// types under an unchanged shape, and E0895 rejects one passed for the other.
// 21: #2116 -- a C++ symbol records its unqualified name, which the
// (owner, member) index reads; an entry written before has none.
const CACHE_VERSION = 21;

const TRANSPILER_VERSION = packageJson.version;

/**
 * Fingerprint of the struct-state shape, derived from the serializer itself.
 *
 * Issue #1225 review: `TJsonSafe<Required<IStructSymbolState>>` forces the
 * writer to persist a new field, but nothing forced already-written entries to
 * be discarded -- that was CACHE_VERSION, bumped by hand, so the compile error
 * told the next person to write the field without mentioning a second step.
 * Deriving it closes the loop for exactly the change that needs it.
 *
 * Not sorted. `Object.keys` returns string keys in insertion order, which for
 * an object literal is the order written in `serializeStructState` -- already
 * deterministic. Sorting would need a comparator to satisfy SonarCloud S2871,
 * and the obvious one, `localeCompare`, makes a cache fingerprint depend on the
 * reader's locale. Reordering that literal changes the fingerprint and
 * invalidates once, which costs a re-parse and nothing else.
 */
const STRUCT_STATE_SHAPE = SymbolTable.structStateKeys().join(",");

/**
 * Manages symbol cache for faster incremental builds
 */
class CacheManager {
  private readonly cacheDir: string;
  private readonly cacheSubdir: string;
  private readonly configPath: string;
  private readonly fs: IFileSystem;

  /** Cached entries by file path; null until `initialize` or `invalidateAll` */
  private cache: Map<string, unknown> | null = null;

  /** Where the entries persist */
  private readonly symbolsPath: string;

  /** Whether the cache has been modified and needs flushing */
  private dirty = false;

  constructor(projectRoot: string, fs: IFileSystem) {
    this.fs = fs;
    this.cacheDir = join(projectRoot, ".cnx");
    this.cacheSubdir = join(this.cacheDir, "cache");
    this.configPath = join(this.cacheDir, "config.json");
    this.symbolsPath = join(this.cacheSubdir, "symbols.json");
  }

  /**
   * Initialize the cache directory and load existing cache
   */
  initialize(): void {
    // Create .cnx directory structure
    Write.directory(this.fs, this.cacheDir);
    Write.directory(this.fs, this.cacheSubdir);

    // Load or create config
    const config = this.loadOrCreateConfig();

    // Check if cache should be invalidated
    if (this.shouldInvalidateCache(config)) {
      // Remove the file flat-cache wrote before #1653, if one is left
      const legacyCacheFile = join(this.cacheSubdir, "symbols");
      if (this.fs.exists(legacyCacheFile)) {
        try {
          Write.remove(this.fs, legacyCacheFile);
        } catch {
          // Ignore if we can't delete
        }
      }
      // Start fresh; the next flush replaces symbols.json
      this.cache = new Map();
      this.saveConfig();
      return;
    }

    this.cache = this.readEntries();

    // Issue #1225: drop anything written in an older entry shape
    this.discardOutdatedEntries();
  }

  /**
   * Check if a file's cache is valid (not modified since cached)
   */
  isValid(filePath: string): boolean {
    if (!this.cache) return false;

    const entry = this.cache.get(filePath);
    if (!entry) {
      return false;
    }

    return CacheKeyGenerator.isValid(
      filePath,
      (entry as ICachedFileEntry).cacheKey,
      this.fs,
    );
  }

  /**
   * Get cached symbols and struct fields for a file.
   *
   * Issue #1225: `symbols` comes back as the JSON the file holds; callers run
   * it through `CachedSymbolReader` to validate and revive it.
   */
  getSymbols(filePath: string): {
    symbols: TJsonValue[];
    structFields: Map<string, Map<string, IStructFieldInfo>>;
    needsStructKeyword: string[];
    enumBitWidth: Map<string, number>;
    structState: TJsonSafe<Required<IStructSymbolState>>;
  } | null {
    if (!this.cache) return null;

    const entry = this.cache.get(filePath);
    if (!entry) {
      return null;
    }
    const cachedEntry = entry as ICachedFileEntry;

    // Issue #1225: entries come off disk, so the type annotation above is a
    // claim rather than a guarantee. Struct state is validated the same way
    // symbols are -- an entry whose struct state is the wrong shape, or is
    // merely missing a key, reads as a miss rather than throwing out of the
    // transpile or restoring a silently empty Set.
    const structState = CachedSymbolReader.readStructState(
      cachedEntry.structState,
    );
    if (structState === null) {
      return null;
    }

    const symbols = cachedEntry.symbols;

    // Convert struct fields from plain objects to Maps
    const structFields = new Map<string, Map<string, IStructFieldInfo>>();
    for (const [structName, fields] of Object.entries(
      cachedEntry.structFields,
    )) {
      const fieldMap = new Map<string, IStructFieldInfo>();
      for (const [fieldName, fieldInfo] of Object.entries(fields)) {
        fieldMap.set(fieldName, fieldInfo);
      }
      structFields.set(structName, fieldMap);
    }

    // Issue #208: Convert enum bit widths from plain object to Map
    const enumBitWidth = new Map<string, number>();
    if (cachedEntry.enumBitWidth) {
      for (const [enumName, width] of Object.entries(
        cachedEntry.enumBitWidth,
      )) {
        enumBitWidth.set(enumName, width);
      }
    }

    return {
      symbols,
      structFields,
      needsStructKeyword: cachedEntry.needsStructKeyword ?? [],
      enumBitWidth,
      structState,
    };
  }

  /**
   * Store symbols and struct fields for a file.
   *
   * Issue #1225: `structState` is required rather than optional. An entry that
   * cannot carry the struct state is exactly the half-written entry this bug
   * was made of, so the type refuses to express one.
   */
  setSymbols(
    filePath: string,
    symbols: TJsonValue[],
    structFields: Map<string, Map<string, IStructFieldInfo>>,
    options: {
      structState: TJsonSafe<Required<IStructSymbolState>>;
      needsStructKeyword?: string[];
      enumBitWidth?: Map<string, number>;
      reader?: string;
    },
  ): void {
    if (!this.cache) return;

    // Generate cache key for current file state
    let cacheKey: string;
    try {
      cacheKey = CacheKeyGenerator.generate(filePath, this.fs);
    } catch {
      // If we can't stat the file, don't cache it
      return;
    }

    // Convert struct fields from Maps to plain objects
    const serializedFields: Record<
      string,
      Record<string, IStructFieldInfo>
    > = {};
    for (const [structName, fields] of structFields) {
      serializedFields[structName] = {};
      for (const [fieldName, fieldInfo] of fields) {
        serializedFields[structName][fieldName] = fieldInfo;
      }
    }

    // Issue #208: Convert enum bit widths from Map to plain object
    const serializedEnumBitWidth: Record<string, number> = {};
    if (options.enumBitWidth) {
      for (const [enumName, width] of options.enumBitWidth) {
        serializedEnumBitWidth[enumName] = width;
      }
    }

    // Create entry
    const entry: ICachedFileEntry = {
      filePath,
      cacheKey,
      symbols,
      structFields: serializedFields,
      needsStructKeyword: options.needsStructKeyword,
      enumBitWidth: serializedEnumBitWidth,
      structState: options.structState,
      reader: options.reader,
    };

    this.cache.set(filePath, entry);
    this.dirty = true;
  }

  /** #1991: cache what 1.3 declared for the header at `filePath` */
  setHeaderDeclarations(
    filePath: string,
    record: IHeaderDeclarationRecord,
    reader: string,
  ): void {
    this.setSymbols(
      filePath,
      record.symbols.map((symbol) => JsonCodec.encode(symbol)),
      record.structFields,
      {
        structState: record.structState,
        needsStructKeyword: record.needsStructKeyword,
        enumBitWidth: record.enumBitWidth,
        reader,
      },
    );
  }

  /**
   * #1991: what an earlier run recorded for the header at `filePath`, or null
   * on a miss. Validated (#1225), so an entry of the wrong shape is a miss,
   * and so is one another compiler read (#1713: `reader`).
   */
  headerDeclarations(
    filePath: string,
    reader: string,
  ): IHeaderDeclarationRecord | null {
    if (!this.isValid(filePath)) {
      return null;
    }
    const recorded = this.cache?.get(filePath) as ICachedFileEntry | undefined;
    if (recorded?.reader !== reader) {
      return null;
    }
    const entry = this.getSymbols(filePath);
    if (!entry) {
      return null;
    }
    const symbols = CachedSymbolReader.read(entry.symbols);
    return symbols === null ? null : { ...entry, symbols };
  }

  /**
   * Flush cache to disk if modified
   */
  flush(): void {
    if (!this.dirty || !this.cache) {
      return;
    }

    Write.file(
      this.fs,
      this.symbolsPath,
      JSON.stringify(Object.fromEntries(this.cache)),
    );
    this.dirty = false;
  }

  /**
   * The entries `symbols.json` holds, or none when there is no file or it does
   * not parse as an object: a cache that cannot be read is re-derived, never
   * trusted.
   */
  private readEntries(): Map<string, unknown> {
    if (!this.fs.exists(this.symbolsPath)) {
      return new Map();
    }
    try {
      const parsed: unknown = JSON.parse(this.fs.readFile(this.symbolsPath));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return new Map(Object.entries(parsed));
      }
    } catch {
      // Unreadable: fall through to an empty cache
    }
    return new Map();
  }

  /**
   * Load or create config file
   */
  private loadOrCreateConfig(): ICacheConfig {
    if (this.fs.exists(this.configPath)) {
      try {
        const content = this.fs.readFile(this.configPath);
        return JSON.parse(content) as ICacheConfig;
      } catch {
        // Config is corrupted, create new one
      }
    }

    // Create new config
    const config: ICacheConfig = {
      version: CACHE_VERSION,
      created: Date.now(),
      transpilerVersion: TRANSPILER_VERSION,
      structStateShape: STRUCT_STATE_SHAPE,
    };

    this.saveConfig(config);
    return config;
  }

  /**
   * Save config file
   */
  private saveConfig(config?: ICacheConfig): void {
    const configToSave = config ?? {
      version: CACHE_VERSION,
      created: Date.now(),
      transpilerVersion: TRANSPILER_VERSION,
      structStateShape: STRUCT_STATE_SHAPE,
    };

    Write.file(this.fs, this.configPath, JSON.stringify(configToSave, null, 2));
  }

  /**
   * Check if cache should be invalidated based on version
   */
  private shouldInvalidateCache(config: ICacheConfig): boolean {
    // Invalidate if cache version changed
    if (config.version !== CACHE_VERSION) {
      return true;
    }

    // Invalidate if transpiler version changed
    if (config.transpilerVersion !== TRANSPILER_VERSION) {
      return true;
    }

    // Issue #1225: struct state gained or lost a field, so every stored entry
    // describes a shape this build does not have.
    if (config.structStateShape !== STRUCT_STATE_SHAPE) {
      return true;
    }

    return false;
  }

  /**
   * Drop cache entries written in an older entry shape.
   *
   * Issue #1225: this used to rebuild a pre-`cacheKey` entry from whatever
   * fields it happened to have, which produced an entry missing struct state
   * and typed symbols -- a half-written cache of exactly the kind this issue
   * is about. Re-parsing the file costs milliseconds; trusting a partial entry
   * costs a wrong header.
   */
  private discardOutdatedEntries(): void {
    if (!this.cache) return;

    // Deleting from a Map while iterating it is defined: an entry removed
    // before it is reached is not visited, and the current one may go.
    for (const [key, value] of this.cache) {
      // Anything but an object carrying a string cacheKey is outdated,
      // including null: the file is plain JSON and can hold anything (#1826).
      if (
        value !== null &&
        typeof value === "object" &&
        typeof (value as Record<string, unknown>).cacheKey === "string"
      ) {
        continue;
      }

      this.cache.delete(key);
      this.dirty = true;
    }
  }
}

export default CacheManager;
