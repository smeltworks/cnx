/**
 * Cached entry for a single header file
 */

import IStructFieldInfo from "../../cnx/types/symbols/IStructFieldInfo";
import IStructSymbolState from "../../cnx/types/symbols/IStructSymbolState";
import TJsonSafe from "../../cnx/utils/types/TJsonSafe";
import TJsonValue from "../../cnx/utils/types/TJsonValue";

interface ICachedFileEntry {
  /** Absolute path to the header file */
  filePath: string;
  /** Cache key for invalidation (format: "mtime:<timestamp>" or future "hash:<sha256>") */
  cacheKey: string;
  /**
   * Symbols extracted from this file, encoded by `JsonCodec`.
   *
   * ADR-055 Phase 7 removed the legacy flat `ISymbol` model everywhere except
   * here, where it survived as `ISerializedSymbol` plus an adapter in each
   * direction. Because those adapters named fields one at a time, every fact
   * the symbol model gained had to be re-taught to them by hand — and four
   * bugs (#985, #1104, #1214, #1225) were fields nobody added.
   *
   * Issue #1225 finishes that migration: the real `TCSymbol`/`TCppSymbol` go
   * through a generic encoder that never enumerates fields, so it cannot drop
   * one. Typed as JSON because that is what the file honestly holds until
   * `CachedSymbolReader` validates it.
   */
  symbols: TJsonValue[];
  /** Struct fields: struct name -> (field name -> field info) */
  structFields: Record<string, Record<string, IStructFieldInfo>>;
  /** Issue #196 Bug 3: Struct names requiring 'struct' keyword in C */
  needsStructKeyword?: string[];
  /** Issue #208: Enum bit widths from typed enums (enum name -> bit width) */
  enumBitWidth?: Record<string, number>;
  /** #2494 review: the macros a header `#undef`s; a header entry without it is a miss */
  undefinedMacros?: string[];
  /**
   * Issue #1225: the whole struct symbol state, captured as one value.
   *
   * Previously four of its six fields were listed here individually, which is
   * why `pointerTypedefs` could be added by #1164 and silently not persisted.
   * The type is derived from `IStructSymbolState`, so a new field there is a
   * compile error until it is captured.
   */
  structState: TJsonSafe<Required<IStructSymbolState>>;
  /** #1713: a header's entry is good only for the compiler that read it */
  reader?: string;
}

export default ICachedFileEntry;
