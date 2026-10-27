/**
 * Factory functions and type guards for IScopeSymbol.
 *
 * Provides utilities for creating and inspecting cnx scopes.
 */
import type TChainRoot from "../types/TChainRoot";
import type IScopeSymbol from "../types/symbols/IScopeSymbol";
import type TVisibility from "../types/TVisibility";
import ESourceLanguage from "./types/ESourceLanguage";
import QualifiedCName from "./QualifiedCName";
import UNSET_SOURCE_SPAN from "../types/UNSET_SOURCE_SPAN";

class ScopeUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create the global scope.
   *
   * The global scope has an empty name and an empty `scopePath`, which together
   * are what `isGlobalScope` identifies. It no longer points at itself: #1298
   * replaced the scope REFERENCE with a path, so the self-reference that made the
   * symbol graph cyclic -- and made `JsonCodec` recurse until the stack was
   * exhausted -- has nothing to be written into.
   *
   * That also removes the two `null as unknown as IScopeSymbol` casts and the
   * post-construction `Object.assign` this used to need: the identity could not
   * be computed until the self-references were patched in, because the encoder
   * walked the chain those references formed.
   */
  static createGlobalScope(): IScopeSymbol {
    // #1285: built by the same constructor as every other scope, so the global
    // scope cannot become the one whose identity was derived a second way. It
    // has no name and no enclosing scope, which is what makes a global symbol
    // keep its bare name.
    return ScopeUtils.createScope("", "");
  }

  /**
   * Create a named scope inside `parentPath`.
   *
   * Takes the enclosing scope's PATH rather than the scope object (#1298). A
   * scope is identified by where it sits, and a path is the whole answer: the
   * object added nothing but a cycle, since the only thing every consumer ever
   * read from it was the chain of names a path already spells out.
   */
  static createScope(name: string, parentPath: string): IScopeSymbol {
    return {
      kind: "scope",
      name,
      scopePath: parentPath,
      // #1285: a nested scope's own identity comes from its enclosing path, so
      // `Inner` inside `Outer` is `Outer__Inner` without any site knowing how
      // deep it sits.
      ...ScopeUtils.identityOf({ name, scopePath: parentPath }),
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      // #1334: filled by ScopeCollector, one entry per declaring block.
      declarationSites: new Set<string>(),
      sourceFile: "",
      span: UNSET_SOURCE_SPAN,
      sourceLanguage: ESourceLanguage.Cnx,
      visibility: "public",
    };
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Is this scope path the global (file) scope?
   *
   * The one place `""` is read as "no enclosing scope", rather than the same
   * comparison written at every call site. `null` used to be a second spelling of
   * the same state -- every helper here guarded `if (!scope || isGlobalScope(scope))`
   * -- and both now collapse into the empty path.
   */
  static isGlobalScopePath(scopePath: string): boolean {
    return scopePath === "";
  }

  /**
   * Is this scope the global scope?
   *
   * The global scope is the only scope with no name, so it is also the only one
   * whose own path (`cnxScopedName`) is empty. This used to compare
   * `parent === scope`, which is exactly the identity test that could not fire on
   * a proxy chain (#1298).
   */
  static isGlobalScope(scope: IScopeSymbol): boolean {
    return scope.name === "" && ScopeUtils.isGlobalScopePath(scope.scopePath);
  }

  /**
   * The dotted path of a scope's own position -- `""` for global, `"Outer.Inner"`
   * for a scope named `Inner` declared inside `Outer`.
   *
   * This is what a member of the scope carries as its `scopePath`.
   */
  static pathOf(scope: IScopeSymbol): string {
    return scope.cnxScopedName;
  }

  /**
   * The leaf name of a scope path -- `"Inner"` for `"Outer.Inner"`, `""` for the
   * global scope.
   */
  static leafOf(scopePath: string): string {
    return scopePath.split(QualifiedCName.SOURCE_SEPARATOR).at(-1) ?? "";
  }

  /**
   * The path of the scope enclosing `scopePath` -- `"Outer"` for `"Outer.Inner"`,
   * `""` for a top-level scope.
   */
  static parentOf(scopePath: string): string {
    const index = scopePath.lastIndexOf(QualifiedCName.SOURCE_SEPARATOR);
    return index === -1 ? "" : scopePath.slice(0, index);
  }

  // ============================================================================
  // Visibility Utilities
  // ============================================================================

  /**
   * ADR-016: Get the default visibility for a scope member based on its type.
   *
   * Member-type-aware defaults reduce boilerplate:
   * - Functions: public by default (API surface)
   * - Variables/types: private by default (internal state)
   *
   * @param isFunction - Whether the member is a function declaration
   * @returns The default visibility for this member type
   */
  static getDefaultVisibility(isFunction: boolean): TVisibility {
    return isFunction ? "public" : "private";
  }

  /**
   * ADR-016: visibility of a declaration that has no enclosing scope.
   *
   * A top-level declaration is unconditionally part of the file's interface --
   * scopes are how cnx expresses privacy, and neither `public` nor `private`
   * parses at top level.
   *
   * This is deliberately NOT `getDefaultVisibility(false)`. That answers a
   * different question -- what an UNMARKED SCOPE MEMBER means -- and for every
   * non-function kind it answers "private". Reusing it here would make every
   * top-level struct and enum private and drop it from the header, which is
   * #1300 inverted. Two rules, two names, so neither can be reached by the
   * other's caller.
   */
  static getTopLevelVisibility(): TVisibility {
    return "public";
  }

  /**
   * ADR-016 visibility of one scope member: the written one, else its kind's
   * default.
   *
   * THE single decision. Three places used to compute this independently --
   * the symbol collector, the early bitmap/struct pass whose symbols are the
   * ones that survive, and codegen -- so "is this member private" had three
   * answers that happened to agree. #1300 is what that costs: the collectors
   * for four kinds could not reach the answer at all and hardcoded `public`.
   */
  static memberVisibility(
    written: TVisibility | null,
    isFunction: boolean,
  ): TVisibility {
    return written ?? ScopeUtils.getDefaultVisibility(isFunction);
  }

  // ============================================================================
  // Transpiled C Names
  // ============================================================================

  /**
   * Build the transpiled C name for a symbol from its scope chain.
   *
   * This is the single encoder for symbol identity: `Motor__init` for `init`
   * in scope `Motor`, `Outer__Inner__process` for a nested scope, and the bare
   * name for a global symbol. ADR-063 makes the result injective, so it is also
   * the canonical identity a symbol can be looked up by.
   *
   * Takes the whole enclosing PATH rather than a scope's leaf name -- the latter
   * silently drops outer scopes. The two agree on every program cnx can
   * express, and ADR-016 makes that a DECISION rather than the coincidence #1285
   * called it: scopes never nest, permanently, so a leaf is always the whole path
   * in source. The encoder is still written at the path level because it is handed
   * paths, not source: `SymbolRegistry.getOrCreateScope` accepts a dotted path and
   * builds the chain, so correctness here cannot be argued from what the grammar
   * admits.
   *
   * `fromSourceName` expands a dotted component and drops empties, so the path goes in
   * as one element and needs no splitting: `["Outer.Inner", "process"]` joins to
   * `Outer__Inner__process`, and `["", "init"]` to `init`.
   *
   * @param symbol Any symbol carrying a bare name and its declaring scope path
   * @returns The C identifier, e.g. "Motor__init"
   */
  static getTranspiledCName(symbol: {
    name: string;
    scopePath: string;
  }): string {
    return QualifiedCName.fromSourceName([symbol.scopePath, symbol.name]);
  }

  /**
   * Build the SOURCE-language qualified name for a symbol from its scope chain.
   *
   * `Motor.init`, `Outer.Inner.process`, and the bare name for a global symbol --
   * the spelling a cnx author would recognize. The counterpart to
   * getTranspiledCName, which builds the identifier the C compiler sees.
   *
   * Takes the same whole enclosing path, for the same reason: a scope's leaf name
   * drops every outer scope.
   */
  static getCnxScopedName(symbol: { name: string; scopePath: string }): string {
    return QualifiedCName.fromSourceParts([symbol.scopePath, symbol.name]);
  }

  /**
   * The C name a bare member of `scope` is emitted under, or the bare name at
   * file scope.
   *
   * The drop-in for `QualifiedCName.fromSourceName([currentScopeName, name])`, which is the
   * leaf-only encoder #1285 exists to remove. Identical at depth one -- a
   * top-level scope's leaf name IS its whole chain -- and correct beyond it,
   * where the string version dropped every outer component.
   *
   * The empty path means "no qualification": a global symbol keeps its bare name,
   * which is what makes `global.x` reachable. `null` used to be a second spelling
   * of that state and is now the empty string (#1298).
   */
  static qualifyInScope(name: string, scopePath: string): string {
    return ScopeUtils.qualifyPathInScope([name], scopePath);
  }

  /**
   * The C name of the type a member chain starts from, in each of ADR-016's
   * spellings: `this.State` is the enclosing scope's, `global.EMode` the
   * file's, and a bare head the scope's own when it declares one (ADR-057),
   * else the file's.
   *
   * One decision for every chain that names an enum member by its type: a
   * const expression's `EColor.COUNT` and a case label's `State.STOPPED`
   * asked it separately, and the label's copy dropped the scope (#2052).
   */
  static typeHeadCName(
    root: TChainRoot,
    head: string,
    scopePath: string,
    isScopeTypeVisible: (qualifiedName: string) => boolean,
  ): string {
    if (root === "this") {
      return ScopeUtils.getTranspiledCName({ name: head, scopePath });
    }
    if (root === "global") {
      return head;
    }
    return ScopeUtils.qualifyScopeType(head, scopePath, isScopeTypeVisible);
  }

  /**
   * Qualify a bare type name against a scope, if the scope declares it.
   *
   * ADR-057: a bare name inside a scope resolves local -> scope -> global. The
   * predicate is asked about the QUALIFIED name so that only actual type
   * declarations capture it -- a scope function or variable sharing a leaf name
   * with a global type must not shadow that type at a type position.
   *
   * Takes the whole enclosing PATH, not a scope's leaf name. The leaf version
   * this replaces joined one level, so at depth two it asked about
   * `Inner__Config` for a type whose name is `Outer__Inner__Config` and got
   * "no" -- silently falling through to the bare name, which is the #1200
   * failure shape (#1285).
   *
   * `isKnownType` is injected rather than read from CodeGenState so this stays
   * usable from the symbols layer, which must not depend on codegen.
   */
  static qualifyScopeType(
    typeName: string,
    scopePath: string,
    isKnownType: (qualifiedName: string) => boolean,
  ): string {
    if (ScopeUtils.isGlobalScopePath(scopePath)) {
      return typeName;
    }
    const qualified = ScopeUtils.getTranspiledCName({
      name: typeName,
      scopePath,
    });
    return isKnownType(qualified) ? qualified : typeName;
  }

  /**
   * The C name a multi-part member path takes inside `scopePath`, or the bare
   * joined path at file scope. The one implementation; `qualifyInScope` is the
   * single-component spelling of it.
   *
   * #1385 review: the two used to branch on the same guard and then both build
   * the C name from `[scopePath, ...]`, which is one decision written twice -- in the
   * file whose entire purpose is being the one encoder.
   *
   * Collapsing them settles a divergence rather than introducing one. The old
   * `qualifyInScope` returned a DOTTED name verbatim at file scope but expanded
   * it inside a scope, because only the second path reached the encoder:
   *
   *     qualifyInScope("a.b", null)   -> "a.b"      <- did not expand
   *     qualifyInScope("a.b", Motor)  -> "Motor__a__b"
   *
   * Both now expand. Nothing passes a dotted name today -- every one of the 21
   * call sites hands over a bare identifier or an already-split component -- so
   * this is behavior-preserving in practice and consistent for the first time.
   */
  static qualifyPathInScope(
    path: readonly string[],
    scopePath: string,
  ): string {
    return QualifiedCName.fromSourceName([scopePath, ...path]);
  }

  /**
   * Both qualified names for a symbol, computed together.
   *
   * Returned as a pair rather than as two separate calls so a construction site
   * cannot produce half an identity. Setting one and forgetting the other leaves
   * a symbol whose C name and source name disagree about where it lives, which
   * is the shape of defect this whole line of work exists to remove.
   *
   * Spread into every cnx symbol literal, so both names are a property of the
   * symbol from the moment it exists rather than something each consumer
   * re-derives from `scope`.
   */
  static identityOf(symbol: { name: string; scopePath: string }): {
    fullyQualifiedCName: string;
    cnxScopedName: string;
  } {
    return {
      fullyQualifiedCName: ScopeUtils.getTranspiledCName(symbol),
      cnxScopedName: ScopeUtils.getCnxScopedName(symbol),
    };
  }
}

export default ScopeUtils;
