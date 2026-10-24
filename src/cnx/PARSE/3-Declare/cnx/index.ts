/**
 * CnxResolver - Orchestrates symbol collection from cnx parse trees.
 * Records every scope's type names first, then collects every declaration in
 * source order (#1332): the header defines types in symbol order.
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 */

import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import LexicalScopeCollector from "./collectors/LexicalScopeCollector";
import ParameterListCollector from "./collectors/ParameterListCollector";
import CallbackUseCollector from "./collectors/CallbackUseCollector";
import ScopeUtils from "../../../utils/ScopeUtils";
import TSymbol from "../../../types/symbols/TSymbol";
import IFileSymbols from "../../../types/IFileSymbols";
import SymbolRegistry from "../SymbolRegistry";
import BitmapCollector from "./collectors/BitmapCollector";
import EnumCollector from "./collectors/EnumCollector";
import StructCollector from "./collectors/StructCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import VariableCollector from "./collectors/VariableCollector";
import RegisterCollector from "./collectors/RegisterCollector";
import ScopeCollector from "./collectors/ScopeCollector";
import TYPE_FORMING_KINDS from "../TYPE_FORMING_KINDS";
import TSymbolKindCnx from "../../../types/symbol-kinds/TSymbolKindCnx";

/** A declaration a scope may hold */
type TScopeMemberSyntax = Extract<
  TDeclarationSyntax,
  { kind: "scope" }
>["members"][number]["declaration"];

/** The symbol kind each lowered member declares; "missing" declares none */
const MEMBER_SYMBOL_KIND: Readonly<
  Record<TScopeMemberSyntax["kind"], TSymbolKindCnx | null>
> = {
  enum: "enum",
  struct: "struct",
  bitmap: "bitmap",
  function: "function",
  variableDeclaration: "variable",
  constructorDeclaration: "variable",
  register: "register",
  missing: null,
};

class CnxResolver {
  /**
   * Resolve all symbols from a cnx program, as 1.2 lowered it.
   *
   * @param program The file as 1.2 lowered it; 1.3 reads no parse tree
   * @param sourceFile Source file path
   * @returns `IFileSymbols` -- the symbols this file declares, plus the scope
   *   types it declares. The latter is a per-file fact and travels on the
   *   artifact; the seed it is merged with is cross-file and does not.
   */
  static resolve(
    program: IProgramSyntax,
    sourceFile: string,
    registry: SymbolRegistry,
  ): IFileSymbols {
    const symbols: TSymbol[] = [];
    // There is no const pass. A dimension naming a const keeps its text here
    // and 1.4 folds it, once, with the consts visible where it is declared:
    // the scope's own over file scope's, and a block's locals over both
    // (#1664 box 7). A fold here saw one file, one bare key for every scope
    // (#1538), and no local at all.

    // Pass 0b: Collect the qualified names of every type declared inside a
    // scope (ADR-057). This must complete before any type is resolved, so that
    // a bare type name is qualified the same way no matter where its
    // declaration appears relative to its use.
    // #1333: seed with the scope types declared in INCLUDED files. Pass 0b walks
    // one parse tree, which was sufficient only while a scope could not be
    // reopened -- now the other half of a spanned scope lives in another file and
    // this pass cannot see it. Without the seed the symbols layer resolves a bare
    // `Point` unqualified while codegen resolves it to `Lib__Point`, so the `.h`
    // and the `.c` disagree about a function's signature and the file does not
    // compile (CLAUDE.md, "Two resolution points, one decision").
    // #1472: what THIS FILE declares is collected on its own, into its own set.
    // It is the per-file half of the question, so it is the half that can travel
    // on `IFileSymbols`; the seed cannot, being a union across an include
    // closure. Collecting into one shared set made "declared here" and "visible
    // here" the same object, so neither could be read back afterwards.
    const declaredScopeTypes = new Set<string>();
    CnxResolver.collectScopeTypesPass0b(registry, program, declaredScopeTypes);

    // What this file can SEE: its own declarations plus its includes'. Same set
    // as before the split, built in the other order -- union is commutative, so
    // every resolution below is unchanged.
    // #1472: what this file DECLARES is the whole answer available here. A
    // bare name this set does not contain is not "not a scope type" -- it may
    // name one declared in an included file -- so `TypeUtils.resolveType`
    // records it as deferred and 1.4 Resolve settles it. Answering `false`
    // here and moving on is what the seed existed to prevent, and it is the
    // guess ADR-057 cannot recover from once the name is a string.
    const isScopeType = (qualifiedName: string): boolean =>
      declaredScopeTypes.has(qualifiedName);

    // Pass 1: Collect every declaration in source order. Whether a register
    // member's type IS a bitmap is not decided here: the bitmap may be another
    // file's, which only 1.4 Resolve can see (#1514).
    CnxResolver.collectInSourceOrder(
      registry,
      program,
      sourceFile,
      symbols,
      isScopeType,
    );

    // #1668: the lexical frames, over the same ADR-057 predicate the symbols
    // were collected with.
    const lexicalScopes = LexicalScopeCollector.collect(
      program,
      registry,
      isScopeType,
    );

    // #1825: ADR-006's and ADR-029's per-file halves. Each records what this
    // file spells; resolving a callee and deciding a callback need every file,
    // so 1.4 does both.
    const parameterLists = ParameterListCollector.collect(
      program,
      (scopeName) => registry.scopePathOf(scopeName),
    );
    const callbackUses = CallbackUseCollector.collect(program, (scopeName) =>
      registry.scopePathOf(scopeName),
    );

    return {
      sourceFile,
      symbols,
      declaredScopeTypes,
      lexicalScopes,
      parameterLists,
      callbackUses,
    };
  }

  /**
   * The name a scope member introduces as a TYPE, or null.
   *
   * The kind of each member is MEMBER_SYMBOL_KIND's; whether that kind forms a
   * type is TYPE_FORMING_KINDS' answer, asked rather than restated. Adding a
   * kind to that set is therefore the whole change -- there is no second list
   * to update. Every member kind is mapped, so TYPE_FORMING_KINDS is the ONLY
   * thing that excludes one: adding "variable" to the set changes behavior,
   * and a fixture can fail on it.
   */
  private static typeFormingName(
    declaration: TScopeMemberSyntax,
  ): string | null {
    const kind = MEMBER_SYMBOL_KIND[declaration.kind];
    return kind !== null &&
      declaration.kind !== "missing" &&
      TYPE_FORMING_KINDS.has(kind)
      ? declaration.name
      : null;
  }

  /**
   * Pass 0b: Collect the qualified name of every *type* declared inside a
   * scope (ADR-057).
   *
   * Which kinds form a type is NOT decided here. It is read from
   * TYPE_FORMING_KINDS, which is the single owner of that question -- this pass
   * previously hardcoded enum/struct/bitmap, and #1281 proposed a fifth
   * parallel set (`knownCallbackTypes`) for the one kind it had missed. ADR-029
   * makes a function definition create a callback type, so `function` is a
   * type-forming kind and belongs in the same answer rather than in a set of
   * its own (#1285).
   *
   * Only type declarations are collected. A scope VARIABLE sharing a leaf name
   * with a global type must not capture that name at a type position, which is
   * why this cannot key on scope membership generally -- `variable` is
   * deliberately absent from TYPE_FORMING_KINDS.
   *
   * Runs before any collector resolves a type so the answer does not depend on
   * whether the declaration appears above or below its use.
   */
  private static collectScopeTypesPass0b(
    registry: SymbolRegistry,
    program: IProgramSyntax,
    scopeTypes: Set<string>,
  ): void {
    for (const { declaration: scopeDecl } of program.declarations) {
      if (scopeDecl.kind !== "scope") continue;

      // #1285: resolve the scope through the registry -- the one thing that
      // builds a real parent chain -- rather than joining one level from the
      // parse-tree identifier. The set this fills is queried with chain-built
      // names, so a leaf-built key here never matched at depth two and the
      // lookup fell silently through to the bare name.
      const scopePath = ScopeUtils.pathOf(
        registry.getOrCreateScope(scopeDecl.name),
      );
      for (const member of scopeDecl.members) {
        const typeName = CnxResolver.typeFormingName(member.declaration);
        if (typeName !== null) {
          scopeTypes.add(ScopeUtils.qualifyInScope(typeName, scopePath));
        }
      }
    }
  }

  /**
   * Pass 1: Collect every declaration, in source order.
   *
   * #1332: source order is the order the header defines types in, so it is a
   * rule of this pass, pinned by the "source order" tests. ADR-030 (define
   * before use, E0426) is what makes it a valid definition order.
   */
  private static collectInSourceOrder(
    registry: SymbolRegistry,
    program: IProgramSyntax,
    sourceFile: string,
    symbols: TSymbol[],
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    for (const { declaration: syntax } of program.declarations) {
      CnxResolver._collectDeclaration(
        registry,
        syntax,
        sourceFile,
        symbols,
        isScopeType,
      );
    }
  }

  /**
   * Collect symbols from a single declaration.
   *
   * Top-level declarations are outside any scope, so ADR-057 scope
   * qualification only applies on the scope path.
   */
  private static _collectDeclaration(
    registry: SymbolRegistry,
    syntax: TDeclarationSyntax,
    sourceFile: string,
    symbols: TSymbol[],
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    // #1298: file scope is the empty path.
    const globalScopePath = "";

    // Scopes (ScopeCollector handles nested members)
    if (syntax.kind === "scope") {
      CnxResolver._collectScopeDeclaration(
        registry,
        syntax,
        sourceFile,
        symbols,
        isScopeType,
      );
      return;
    }

    // Top-level bitmaps
    if (syntax.kind === "bitmap") {
      const symbol = BitmapCollector.collect(
        syntax,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level structs
    if (syntax.kind === "struct") {
      const symbol = StructCollector.collect(
        syntax,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level enums
    if (syntax.kind === "enum") {
      const symbol = EnumCollector.collect(
        syntax,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level registers
    if (syntax.kind === "register") {
      const symbol = RegisterCollector.collect(
        syntax,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level functions
    if (syntax.kind === "function") {
      // Use collectAndRegister to populate both old symbols and SymbolRegistry
      const symbol = FunctionCollector.collectAndRegister(
        registry,
        syntax,
        sourceFile,
        "",
        // ADR-016 (#1161): not a literal that can drift from the ADR. #1300
        // renamed the rule -- a top-level declaration is public because it has
        // no enclosing scope, not because it is a function.
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level variables
    if (
      syntax.kind === "variableDeclaration" ||
      syntax.kind === "constructorDeclaration"
    ) {
      const symbol = VariableCollector.collect(
        syntax,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
    }
  }

  /**
   * Collect a scope declaration and its members, in source order.
   */
  private static _collectScopeDeclaration(
    registry: SymbolRegistry,
    scopeSyntax: Extract<TDeclarationSyntax, { kind: "scope" }>,
    sourceFile: string,
    symbols: TSymbol[],
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const result = ScopeCollector.collect(
      registry,
      scopeSyntax,
      sourceFile,
      isScopeType,
    );

    symbols.push(result.scopeSymbol);

    // #1332 / #2338: a scope's members join the one source-order stream here,
    // not in an earlier pass ahead of every top-level declaration.
    symbols.push(...result.memberSymbols);
  }
}

export default CnxResolver;
