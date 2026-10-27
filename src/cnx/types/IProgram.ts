import type IFunctionSymbol from "./symbols/IFunctionSymbol";
import type IFoldedConstant from "./IFoldedConstant";
import type TConstExpr from "./TConstExpr";
import type TConstResult from "./TConstResult";
import type IConstTarget from "./IConstTarget";
import type TSettledConst from "./TSettledConst";
import type TEnumMemberValue from "./TEnumMemberValue";
import type ISourcePosition from "../utils/types/ISourcePosition";
import type ILexicalFrame from "./ILexicalFrame";
import type ILocalDeclaration from "./ILocalDeclaration";
import type ISourceSpan from "./ISourceSpan";
import type TChainRoot from "./TChainRoot";
import type TValueBinding from "./TValueBinding";
import type TRunTarget from "./TRunTarget";
import type IScopeSymbol from "./symbols/IScopeSymbol";
import type TSymbol from "./symbols/TSymbol";
import type IConflict from "./IConflict";
import type ICodeGenSymbols from "./ICodeGenSymbols";
import type THeaderMacro from "./THeaderMacro";
import type IResolvedSymbols from "./IResolvedSymbols";

/**
 * `Program` — the artifact 1.4 Resolve emits, and the only place a cross-file
 * fact may be read from after it.
 *
 * **The raw tables are deliberately absent from this type.** They exist at
 * runtime, inside the builder's closure, and are simply not declared here. That
 * is the cheapest enforcement available and it costs nothing at runtime:
 * `docs/architecture/symbol-store-prior-art.md` measured it as "the answer to
 * 118 of 163 sites", with four attempted bypasses failing under `--strict` with
 * TS2339. A gate over a store whose collections are reachable would be a
 * backstop for a hole that does not need to exist.
 *
 * It is an interface of functions over plain data rather than a class, and that
 * is a measured constraint rather than a style choice: immer's
 * `freeze(x, true)` is a silent no-op on class instances and does not recurse
 * into one nested in a plain object, so "every artifact is deep-frozen" and
 * "`Program` is a class with `#private` fields" cannot both hold.
 *
 * Every symbol reachable from here is SETTLED: no `TDeferredType` survives
 * `Program.build`, which is what "complete before 2.1 begins" means for the
 * type layer.
 */
interface IProgram {
  /**
   * ADR-057: is this QUALIFIED name a type declared inside a scope that
   * `sourceFile` can see -- declared by that file or by a file in its include
   * closure?
   *
   * The cross-file fact 1.3 Declare is not allowed to hold, and the ONE answer
   * both of ADR-057's resolution points read: 1.4 settles each file's deferred
   * types with it, and codegen asks it about the file being generated, so the
   * `.h` and the `.c` cannot disagree. It asks for the file because the
   * whole-program question has the wrong answer: a scope type from a sibling
   * the file never includes captured a bare name the file could only mean as
   * a C typedef, in both halves at once (#1724).
   */
  isScopeTypeVisibleFrom(sourceFile: string, qualifiedName: string): boolean;

  /**
   * The cnx symbol whose canonical identity is this transpiled C name.
   *
   * Exact identity, never the bare-name index: asking a bare-name lookup with a
   * transpiled name returns empty for every scoped symbol, which reads as "no
   * such symbol" rather than "wrong question" (#1139).
   */
  symbolByCName(cName: string): TSymbol | undefined;

  /**
   * The symbol declared as `name` directly in `scopePath` ("" for file
   * scope), found by the identity 3-Declare gave it rather than by an encoded
   * C name (#2116). Read `.fullyQualifiedCName` from the result.
   */
  memberOf(scopePath: string, name: string): TSymbol | undefined;

  /** The settled symbols a file declares. */
  symbolsInFile(sourceFile: string): ReadonlyArray<TSymbol>;
  /** The run's symbol table, complete: 1.3's header symbols plus the cnx ones 1.4 resolved (#1991). */
  symbolTable(): IResolvedSymbols;

  /** Every file the program declared, in the order they were declared. */
  sourceFiles(): ReadonlyArray<string>;

  /**
   * Every enum the program declares, by transpiled C name.
   *
   * Header generation asks this to avoid forward-declaring an enum that an
   * include already defines (#478). Whole-program by nature, and derived from
   * the artifact rather than accumulated as files are transpiled -- the latter
   * made the answer depend on topological order.
   */
  knownEnums(): ReadonlySet<string>;

  /**
   * The non-array fields of each struct declared in a C or C++ header.
   *
   * ADR-016 initialization analysis asks whether an initializer names every
   * field, and an array field is not one it must name (#355). Cross-file by
   * definition: the struct is declared in a header this program includes.
   */
  externalStructFields(): ReadonlyMap<string, ReadonlySet<string>>;

  /**
   * What a binding is worth at compile time, with the declared type that
   * holds it: a const local's or a folded global's or scope member's value.
   * Null for anything else -- a variable, a parameter, an unfolded const, a
   * scope, a header name. Asked of a binding, so the answer is about the
   * declaration the spelling means (#1538, #1664 review).
   */
  constantOf(binding: TValueBinding): IFoldedConstant | null;

  /**
   * What a const declaration, by its C name, settled to in 1.4 -- its value,
   * or why it has none -- or null for a name that is not a const with an
   * initializer (#1739). The one value every use of the const reads.
   */
  settledConstOf(cName: string): TSettledConst | null;

  /**
   * Every symbol conflict in the program.
   *
   * Cross-file by construction — a conflict exists only when two files define
   * the same name — and one of the three facts that also needs the C and C++
   * header symbols, not just cnx's. It was previously derived from an
   * accumulator mid-run, so the answer depended on how much had been inserted
   * when it was asked (#1511).
   */
  conflicts(): ReadonlyArray<IConflict>;

  /**
   * The type names a file declares — struct, type, enum and class — by the C
   * name a generated signature uses: a cnx scope's `Point` is `Lib__Point`.
   *
   * "Which C header declares this type", asked from the file's side. Header
   * generation includes the header that defines a type rather than forward
   * declaring it (#497), and picking WHICH header wins belongs to whoever holds
   * the include order, so this answers only what each file declares (#1511).
   */
  typesDeclaredIn(sourceFile: string): ReadonlySet<string>;

  /**
   * Whether this typedef names a struct nothing in the program ever defines.
   *
   * Cross-file by nature: a header may forward-declare a struct and typedef it
   * while the body arrives from another header entirely, so "opaque" is only
   * decidable once every header has been read. Variables of such a type are
   * generated as pointers (#948), which makes a wrong answer a codegen bug
   * rather than a cosmetic one.
   */
  isOpaqueType(typeName: string): boolean;

  /** Every truly opaque typedef, resolved. */
  opaqueTypes(): ReadonlySet<string>;

  /**
   * #1688: an object-like macro a header defines, typed from its replacement
   * tokens (ADR-024), or null when no header defines one of the name.
   */
  headerMacro(sourceFile: string, name: string): THeaderMacro | null;

  /**
   * #1688: whether some of the file's C includes' macros could not be read,
   * so a name `headerMacro` does not know may still be one.
   */
  headerMacrosUnread(sourceFile: string): boolean;

  /**
   * #1619: the C type the run's header compiler gives a `<stdint.h>` or
   * `<stddef.h>` integer name (`uint32_t`, `size_t`), from its predefined
   * macros, or null for any other name or when no compiler read the run's
   * headers.
   */
  headerIntegerType(name: string): string | null;

  /** Each function's parameter names, in declaration order. */
  functionParamLists(): ReadonlyMap<string, ReadonlyArray<string>>;

  /**
   * The symbol view a file's code generation reads: what it declares, plus
   * everything its include closure reaches, with its own names shadowing.
   *
   * Composed here because it is a cross-file question. It was previously built
   * per file and patched during rendering, from a map that filled as the run
   * proceeded — so a file rendered early saw less than the same file rendered
   * late (#1301, #1511).
   */
  codeGenSymbolsFor(sourceFile: string): ICodeGenSymbols | undefined;

  /**
   * Which parameters of each function are passed by value (ADR-006): a
   * read-only scalar. Keyed by transpiled C name (#1511).
   */
  passByValueParams(): ReadonlyMap<string, ReadonlySet<string>>;

  /**
   * Functions used as an ADR-029 callback, to the typedef they are used as.
   *
   * A function assigned to a callback typedef must keep that typedef's parameter
   * shape, so it takes neither auto-const nor pass-by-value. The use can sit in
   * a different file from the declaration, which makes this cross-file — and it
   * was previously accumulated as files rendered, so an early file decided its
   * signatures on a partial answer (#1511).
   */
  callbackCompatibleFunctions(): ReadonlyMap<string, string>;

  /**
   * ADR-071: every cnx function used as a callback at all (a type, or a
   * value placed in a slot), by C name. Its `mut` parameters are part of the
   * callback type, so E0899 does not ask them to be written.
   */
  callbackFunctions(): ReadonlySet<string>;

  /**
   * #1668 / #1664: the innermost lexical frame of `sourceFile` containing
   * `at`, or its file frame. Settled and frozen with the program.
   */
  lexicalFrameAt(
    sourceFile: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): ILexicalFrame;

  /**
   * The local, parameter or `for` variable `name` binds to at `at`, or null.
   * The lexical half of binding only; `bindValue` is the whole decision.
   */
  lexicalDeclarationAt(
    sourceFile: string,
    name: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): ILocalDeclaration | null;

  /**
   * What a value name, written bare, as `this.name` or as `global.name`,
   * means at `at` -- the one place a spelling becomes a declaration, for
   * typing and emission alike.
   */
  bindValue(
    sourceFile: string,
    root: TChainRoot,
    name: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): TValueBinding | null;

  /**
   * #1643 review: what a use of the declaration whose declarator `name` is at
   * `declarator` binds to once it closes -- the declaration itself, found by
   * identity, never by binding a position rebuilt from its syntax
   */
  declarationOf(
    sourceFile: string,
    name: string,
    declarator: Pick<ISourceSpan, "line" | "column">,
  ): TValueBinding | null;

  /**
   * ADR-030 / #2019: whether a spelling nothing binds at `at` may be a
   * header's `#define`: the file reaches a C or C++ header, and no
   * declaration of its own would bind the spelling there once closed
   */
  mayBeHeaderName(
    sourceFile: string,
    root: TChainRoot,
    name: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): boolean;

  /**
   * What a name in a constant expression is worth where it is written: the
   * whole chain (`N`, `this.N`, `Scope.N`, `EColor.COUNT`), from what
   * `bindValue` binds its head to. The one question every constant fold asks,
   * so a parameter, a variable or an unfolded const shadows a folded const of
   * the same name exactly as it does for typing (#1664 review), and 1.4's own
   * settling asked it with the same facts (#1175).
   */
  constantValueOf(
    sourceFile: string,
    name: Extract<TConstExpr, { kind: "name" }>,
  ): TConstResult;

  /**
   * The binding a name in a constant expression reads where it is written, by
   * the walk `constantValueOf` folds: `Scope.N` reads the member, `this.N`
   * and `N` what they bind (#1735 review)
   */
  constantTargetOf(
    sourceFile: string,
    name: Extract<TConstExpr, { kind: "name" }>,
  ): IConstTarget | null;

  /**
   * A cnx type name as C spells it at `at` in `sourceFile` (ADR-057), for a
   * constant expression C evaluates (a cast) -- the same answer 1.4
   * wrote into the header (#1863 review)
   */
  cTypeNameAt(
    sourceFile: string,
    typeName: string,
    at: ISourcePosition,
  ): string;

  /** `IConstantEnvironment.isTypeName`, at `at` in `sourceFile` */
  isTypeNameAt(
    sourceFile: string,
    typeName: string,
    at: ISourcePosition,
  ): boolean;

  /**
   * What each member of the enum with C name `enumCName` settled to, in
   * declaration order (#1669, ADR-017 "Member Values") -- for 2.1 to report
   * a value that has none, overflows, or leaves `i32`. Empty for a name that
   * is not a cnx enum.
   */
  enumMemberValues(enumCName: string): ReadonlyArray<TEnumMemberValue>;

  /**
   * ADR-049: the run's one target, settled from every file's pragmas and the
   * target option. Asking a program built without target inputs is a caller
   * error: only a test builds one, and only a test that never asks.
   */
  target(): TRunTarget;

  /**
   * #1428: does this run emit C++? 1.1 Discover settled it (#1844); the program
   * carries it so codegen, the header generator and 2.1 all read one answer.
   * Asking a program built without it is a caller error, never "C".
   */
  cppMode(): boolean;

  /**
   * The run's scope graph, for the passes after 1.4 (#1452 box 3).
   *
   * A fact needed to BUILD this artifact cannot be reached through it, so
   * `Program.build` takes the registry directly.
   */
  scope(path: string): IScopeSymbol | null;

  /**
   * The full scope PATH for a scope named `name`, or `name` itself when none
   * exists.
   *
   * This is the question 2.1 and 2.3 were asking through
   * `ScopeUtils.pathOf(getOrCreateScope(name))` -- a name-to-path lookup where
   * the create arm was never taken. Measured across 120 fixtures: those passes
   * produced ZERO creations, and the probe fires from 1.3, so the zero is real.
   * Stated once, with the fallback explicit, instead of four times.
   */
  scopePathOf(name: string): string;

  /**
   * The function a bare call to `name` means from inside `fromScopePath`
   * (`""` at file scope), walking current -> parent -> global (ADR-057). A
   * path that names no scope resolves from the global scope.
   *
   * It takes the PATH, not a scope, so where a lookup starts is decided here
   * once. The typer (#1698) and the C name a call is emitted under each
   * derived the start scope themselves, the same expression twice; the key a
   * call is typed by and the name it is emitted under now share one
   * resolution rather than two that agreed.
   */
  resolveFunction(name: string, fromScopePath: string): IFunctionSymbol | null;
}

export default IProgram;
