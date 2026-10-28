import JsonCodec from "./JsonCodec";
import ESourceLanguage from "../../cnx/utils/types/ESourceLanguage";
import TJsonValue from "../../cnx/utils/types/TJsonValue";
import TCSymbol from "../../cnx/types/symbols/c/TCSymbol";
import TCppSymbol from "../../cnx/types/symbols/cpp/TCppSymbol";
import SymbolTable from "../../cnx/PARSE/3-Declare/SymbolTable";
import IStructSymbolState from "../../cnx/types/symbols/IStructSymbolState";
import TJsonSafe from "../../cnx/utils/types/TJsonSafe";

/** Kinds a cached C symbol may declare (mirrors TSymbolKindC). */
const C_KINDS: ReadonlySet<string> = new Set([
  "function",
  "variable",
  "struct",
  "enum",
  "enum_member",
  "type",
]);

/** Kinds a cached C++ symbol may declare (mirrors TSymbolKindCpp). */
const CPP_KINDS: ReadonlySet<string> = new Set([
  "function",
  "variable",
  "struct",
  "enum",
  "enum_member",
  "class",
  "namespace",
  "type",
]);

/**
 * CachedSymbolReader
 *
 * Turns the JSON in a cache entry back into real `TCSymbol`/`TCppSymbol`
 * values, or rejects the entry.
 *
 * Validation is deliberately shallow — discriminant, source language, and the
 * fields every symbol has. It does NOT re-check each kind's own fields, and
 * that is the point: re-declaring the symbol model here would recreate exactly
 * the hand-maintained parallel list that issue #1225 exists to remove. Shape
 * fidelity comes from `JsonCodec` copying every field rather than naming any,
 * and staleness is handled by CACHE_VERSION and the transpiler version.
 *
 * What is left to catch is "this file is not symbols at all" — a truncated
 * write, a hand-edited cache, a file from another tool. That warrants
 * discarding the entry, which reads as a cache miss and costs only a re-parse.
 */
class CachedSymbolReader {
  /**
   * Decode a cache entry's symbols.
   *
   * @returns the symbols, or `null` if the entry is not trustworthy — callers
   *   must treat `null` as a cache miss rather than as "no symbols".
   */
  static read(encoded: TJsonValue[]): Array<TCSymbol | TCppSymbol> | null {
    if (!Array.isArray(encoded)) {
      return null;
    }

    const symbols: Array<TCSymbol | TCppSymbol> = [];
    for (const entry of encoded) {
      const decoded = JsonCodec.decode(entry);
      if (!CachedSymbolReader.isCachedSymbol(decoded)) {
        return null;
      }
      symbols.push(decoded);
    }
    return symbols;
  }

  /**
   * Decode a cache entry's struct state.
   *
   * Issue #1225 review: the two halves of an entry used to get very different
   * trust — symbols went through the validation below, struct state got a
   * truthiness check and was handed straight to `new Set(...)` / `new Map(...)`.
   * Both failure modes that follow are real:
   *
   * - `{ opaqueTypes: 5 }` makes `new Map(5)` throw out of `_restoreCachedHeader`,
   *   aborting the transpile instead of reading as a miss.
   * - a *missing key* makes `new Set(undefined)` an empty Set, silently — which
   *   is #1225's own failure mode (a warm build that never heard of a fact the
   *   cold build knows) arriving through the unchecked half. Every entry on
   *   disk looks like that the moment `IStructSymbolState` gains a field.
   *
   * So both halves now fail the same way: as a cache miss, costing a re-parse.
   *
   * The expected keys come from `SymbolTable.structStateKeys()` rather than a
   * list here — a list would be the hand-maintained parallel model this issue
   * exists to remove.
   *
   * @returns the struct state, or `null` if the entry is not trustworthy.
   */
  static readStructState(
    value: TJsonValue | undefined,
  ): TJsonSafe<Required<IStructSymbolState>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, TJsonValue>;
    for (const key of SymbolTable.structStateKeys()) {
      const entry = candidate[key];
      if (!Array.isArray(entry)) {
        return null;
      }
      if (!entry.every(CachedSymbolReader.isStructStateEntry)) {
        return null;
      }
    }

    // Validated structurally above: every expected key is present and holds
    // either Set members (strings) or Map entries (string pairs).
    return value as unknown as TJsonSafe<Required<IStructSymbolState>>;
  }

  /**
   * A serialized struct-state element: a Set member, or a Map entry pair.
   *
   * Shape-based rather than key-based, so a new field of either kind validates
   * without this method being edited.
   */
  private static isStructStateEntry(entry: TJsonValue): boolean {
    if (typeof entry === "string") {
      return true;
    }
    return (
      Array.isArray(entry) &&
      entry.length === 2 &&
      entry.every((part) => typeof part === "string")
    );
  }

  /**
   * Is this value a well-formed `ISourceSpan`?
   *
   * #1318: `sourceLine` was one `typeof` check; a span is four, and they cannot
   * be derived from the type, because `TCSymbol`/`TCppSymbol` are types and
   * their keys are not enumerable at runtime -- the same reason CACHE_VERSION is
   * bumped by hand. A cached entry written before the span existed carries
   * `sourceLine` and no `span`, and is rejected here rather than deserialized
   * into a symbol whose position is `undefined`.
   */
  private static isSpan(value: unknown): boolean {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const span = value as Record<string, unknown>;
    return (
      typeof span.line === "number" &&
      typeof span.column === "number" &&
      typeof span.endLine === "number" &&
      typeof span.endColumn === "number"
    );
  }

  /**
   * Does this decoded value carry the fields every C/C++ symbol has, with a
   * discriminant its language actually defines?
   *
   * cnx symbols are rejected: they are never written to the cache (they are
   * re-parsed from source every run), so one appearing here means the entry is
   * not what it claims to be.
   */
  private static isCachedSymbol(
    value: unknown,
  ): value is TCSymbol | TCppSymbol {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.sourceFile !== "string" ||
      !CachedSymbolReader.isSpan(candidate.span) ||
      (candidate.visibility !== "public" &&
        candidate.visibility !== "private") ||
      typeof candidate.kind !== "string"
    ) {
      return false;
    }

    if (candidate.sourceLanguage === ESourceLanguage.C) {
      return C_KINDS.has(candidate.kind);
    }
    if (candidate.sourceLanguage === ESourceLanguage.Cpp) {
      return (
        CPP_KINDS.has(candidate.kind) &&
        typeof candidate.unqualifiedName === "string"
      );
    }
    return false;
  }
}

export default CachedSymbolReader;
