/**
 * ScopeCollector - Extracts scope declarations and their nested members.
 * ADR-016: Scopes group related functions and control member visibility.
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 * Uses SymbolRegistry for scope management.
 */

import type TDeclarationSyntax from "../../../../types/syntax/TDeclarationSyntax";
import DeclarationSite from "../../../../utils/DeclarationSite";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TSymbol from "../../../../types/symbols/TSymbol";
import TVisibility from "../../../../types/TVisibility";
import IScopeCollectorResult from "../types/IScopeCollectorResult";
import SymbolRegistry from "../../SymbolRegistry";
import BitmapCollector from "./BitmapCollector";
import EnumCollector from "./EnumCollector";
import StructCollector from "./StructCollector";
import FunctionCollector from "./FunctionCollector";
import VariableCollector from "./VariableCollector";
import RegisterCollector from "./RegisterCollector";
import type ISourceSpan from "../../../../types/ISourceSpan";
import UNSET_SOURCE_SPAN from "../../../../types/UNSET_SOURCE_SPAN";
import type IDeclareTypeFacts from "../../types/IDeclareTypeFacts";

type TScopeSyntax = Extract<TDeclarationSyntax, { kind: "scope" }>;
type TScopeMemberSyntax = Exclude<
  TScopeSyntax["members"][number]["declaration"],
  { kind: "missing" }
>;

class ScopeCollector {
  /**
   * Collect a scope declaration and all its nested members.
   *
   * Uses SymbolRegistry to get/create the scope, ensuring proper scope
   * references in all member symbols.
   *
   * **Side-effect**: This method calls registry.getOrCreateScope(),
   * which creates the scope in global state if it doesn't exist. Tests
   * constructs its own registry, so there is nothing to reset (#1452 box 3).
   *
   * @param syntax The scope declaration, as 1.2 lowered it
   * @param sourceFile Source file path
   * @param typeFacts ADR-057: predicate answering whether a *qualified* name
   *                    is a type declared in a scope. Supplied by CnxResolver
   *                    from a pre-pass so the answer is complete before any
   *                    member's types are resolved.
   * @returns The scope symbol and all member symbols
   */
  static collect(
    registry: SymbolRegistry,
    syntax: TScopeSyntax,
    sourceFile: string,
    typeFacts?: IDeclareTypeFacts,
  ): IScopeCollectorResult {
    const scopeName = syntax.name;
    const span = syntax.span;

    // Get or create the scope via SymbolRegistry
    const scope = registry.getOrCreateScope(scopeName);

    // #1298: members carry the scope's PATH, not the scope object. Derived once
    // here so the six member collectors below cannot disagree about it.
    const scopePath = ScopeUtils.pathOf(scope);

    // Update scope metadata (cast to mutable for initialization)
    const mutableScope = scope as unknown as {
      sourceFile: string;
      span: ISourceSpan;
      sourceLanguage: ESourceLanguage;
      visibility: TVisibility;
      declarationSites: Set<string>;
    };

    // #1334: RECORD this block; do not overwrite the previous one. ADR-016 lets a
    // scope be reopened, getOrCreateScope caches by path, and this method used
    // to assign sourceFile/sourceLine unconditionally -- so a scope declared in
    // four files reported only the fourth, and a conflict naming two definitions
    // printed one location twice because there was only ever one position.
    //
    // Set membership is keyed on the rendered `file:line`, so re-collecting the
    // same textual block is a no-op rather than a duplicate entry.
    //
    // #1301 removed the only thing that presented a duplicate: `CnxResolver.resolve`
    // ran twice per file while Transpiler stages 3 and 5 each declared every file,
    // and now runs once. A scope REOPENED across files does NOT present one either --
    // each declaring block contributes a DISTINCT `file:line`. So this dedup is now
    // a ratchet with nothing exercising it, kept so that a reintroduced second pass
    // is absorbed rather than silently duplicating. Stated plainly because the
    // alternative is a comment claiming coverage the code no longer has.
    mutableScope.declarationSites.add(
      DeclarationSite.format(sourceFile, span.line),
    );

    // The scalars keep the FIRST site. Lossless now that declarationSites holds
    // the rest: UNSET_SOURCE_SPAN is createScope's initial value and its line is
    // 0, which no real position can be because ANTLR lines are 1-based -- so an
    // unset span is distinguishable from a real one.
    if (mutableScope.span.line === UNSET_SOURCE_SPAN.line) {
      mutableScope.sourceFile = sourceFile;
      mutableScope.span = span;
    }
    mutableScope.sourceLanguage = ESourceLanguage.Cnx;
    // A scope is a container, not a declaration -- it is never marked private,
    // and `PublicInterface` excludes kind "scope" from the header regardless.
    mutableScope.visibility = "public";

    // Cast readonly collections to mutable (scope is being populated)
    const memberVisibility = scope.memberVisibility as unknown as Map<
      string,
      TVisibility
    >;
    const members = scope.members as unknown as string[];
    const memberSymbols: TSymbol[] = [];

    // #1334: `scope.members` is a shared mutable array on the cached scope, and
    // `CnxResolver.resolve` USED TO run more than once per file, so every member
    // was re-pushed on each pass -- measured, a four-block scope grew to
    // [Point, Mode, fromC, runAll, Point, Mode, fromC]. #1301 removed that pass.
    //
    // Like the `declarationSites` dedup above, this one is now UNEXERCISED: a
    // reopened scope contributes distinct names, and two members sharing a name in
    // one scope are rejected as E0425 before this list is read. Kept as a ratchet
    // against a reintroduced second pass, not because anything reaches it today.
    //
    // Harmless today only by coincidence: the one real consumer wraps it in a Set
    // (TSymbolInfoAdapter.ts:395). That is a latent divergence, not a working
    // path, so the duplication is stopped at the source instead. A scope cannot
    // legitimately hold two members of one name -- that case is a conflict, and
    // conflict detection reads the TSymbols, not this array.
    const addMember = (memberName: string): void => {
      if (!members.includes(memberName)) {
        members.push(memberName);
      }
    };

    for (const member of syntax.members) {
      const declaration = member.declaration;
      // Error recovery's repaired member declares nothing
      if (declaration.kind === "missing") continue;
      const visibility = ScopeUtils.memberVisibility(
        member.visibility,
        declaration.kind === "function",
      );
      memberVisibility.set(declaration.name, visibility);
      addMember(declaration.name);
      memberSymbols.push(
        ScopeCollector.memberSymbol(
          registry,
          declaration,
          sourceFile,
          scopePath,
          visibility,
          typeFacts,
        ),
      );
    }

    return { scopeSymbol: scope, memberSymbols };
  }

  /** One member's symbol, from the collector for its kind */
  private static memberSymbol(
    registry: SymbolRegistry,
    declaration: TScopeMemberSyntax,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    typeFacts?: IDeclareTypeFacts,
  ): TSymbol {
    switch (declaration.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        return VariableCollector.collect(
          declaration,
          sourceFile,
          scopePath,
          visibility,
          typeFacts,
        );
      case "function":
        // collectAndRegister populates both memberSymbols and SymbolRegistry
        return FunctionCollector.collectAndRegister(
          registry,
          declaration,
          sourceFile,
          scopePath,
          visibility,
          typeFacts,
        );
      case "enum":
        return EnumCollector.collect(
          declaration,
          sourceFile,
          scopePath,
          visibility,
        );
      case "bitmap":
        return BitmapCollector.collect(
          declaration,
          sourceFile,
          scopePath,
          visibility,
        );
      case "struct":
        return StructCollector.collect(
          declaration,
          sourceFile,
          scopePath,
          visibility,
          typeFacts,
        );
      case "register":
        return RegisterCollector.collect(
          declaration,
          sourceFile,
          scopePath,
          visibility,
          typeFacts,
        );
    }
  }
}

export default ScopeCollector;
