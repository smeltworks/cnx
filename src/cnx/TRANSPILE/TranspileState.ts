import type EFileType from "../PARSE/1-Discover/types/EFileType";
import type ITargetDescription from "../types/ITargetDescription";
import type IResolvedSymbols from "../types/IResolvedSymbols";
import ReservedCnxName from "../utils/ReservedCnxName";
import ICodeGenSymbols from "../types/ICodeGenSymbols";
import TTypeInfo from "../types/TTypeInfo";
import type TChainRoot from "../types/TChainRoot";
import type TValueBinding from "../types/TValueBinding";
import type ISourcePosition from "../utils/types/ISourcePosition";
import DeclaredTypeInfo from "../PARSE/3-Declare/DeclaredTypeInfo";
import TParameterInfo from "../types/TParameterInfo";
import ICallbackTypeInfo from "../types/ICallbackTypeInfo";
import type ICodeGenApi from "./types/ICodeGenApi";
import DeclaredTypeFacts from "../utils/DeclaredTypeFacts";
import DeclaredPointer from "../utils/DeclaredPointer";
import OutputExtensions from "../utils/OutputExtensions";
import type IOutputExtensions from "../types/IOutputExtensions";
import ScopeUtils from "../utils/ScopeUtils";
import type ITypeBindingDeps from "../types/ITypeBindingDeps";
import type IProgram from "../types/IProgram";
import type ITypingContext from "../types/ITypingContext";
import type IDeclarationPlan from "../types/IDeclarationPlan";
import type IEmissionPlan from "../types/IEmissionPlan";
import type IFunctionSignature from "../types/IFunctionSignature";
import invariant from "../utils/invariant";
import emittedLocalName from "../utils/emittedLocalName";
import AdrProvenance from "../instrumentation/AdrProvenance";
import type ILocalDeclaration from "../types/ILocalDeclaration";
import type IVariableDeclarationSyntax from "../types/syntax/IVariableDeclarationSyntax";
import type IBoundParameter from "./types/IBoundParameter";
import type IFileSetup from "./types/IFileSetup";
import type IFunctionCatalog from "./types/IFunctionCatalog";
import type TPlanInputs from "./types/TPlanInputs";

/**
 * 2.3 Render's per-file working state, as an INSTANCE.
 *
 * ## Why (#1452 boxes 1 and 4)
 *
 * Box 1 forbids `src/transpiler/state/`; box 4 forbids a module reachable from
 * the pipeline holding mutable state. Those pull against each other, because
 * the obvious way to satisfy box 1 -- relocate `this.ts` into a pass
 * root -- moves 58 mutable statics INSIDE one.
 * `passes-hold-no-mutable-state.test.ts` was written first precisely to catch
 * that. So the statics dissolve BEFORE the file moves, and this is where they
 * go.
 *
 * Owned by `CodeGenerator`, which the walker reaches as `this.host`, so both
 * read one object instead of one global.
 */
class TranspileState {
  /**
   * How the `.c` names each include, as 1.1 spelled it
   * (`IFileIncludes.includeRewrites`); codegen reads it and derives nothing.
   */
  includeRewrites: ReadonlyMap<string, string> = new Map<string, string>();
  /**
   * #1444, owner ruling 1: the kind of file each `#include` directive of this
   * file names, as 1.1 Discover classified it. Codegen rewrites a directive by
   * this answer and classifies nothing itself.
   */
  includeKinds: ReadonlyMap<string, EFileType> = new Map<string, EFileType>();
  /** Debug mode generates panic-on-overflow helpers (ADR-044) */
  debugMode: boolean = false;
  /**
   * Callback typedefs this file has already emitted, so the sweep for types it
   * does NOT declare cannot emit one twice.
   */
  emittedCallbackTypedefs: Set<string> = new Set();
  /** Current indentation level */
  indentLevel: number = 0;
  /** strlen optimization: the measured C operand -> temp variable name */
  lengthCache: Map<string, string> | null = null;
  /**
   * Issue #1212: callback `_fp` typedefs awaiting placement.
   *
   * They used to be appended after the function each was derived from, which
   * only works when every use appears later in the file. A parameter naming a
   * callback declared further down got a typedef after its first use, and the
   * generated C did not compile.
   *
   * They cannot simply be hoisted into the prelude either: a callback typedef
   * inherits its parameters' dependencies, so `typedef void (*onReceive_fp)(const
   * Message*)` must follow `Message`'s definition. Collecting them here lets
   * generateAllDeclarations place the whole block after the type declarations
   * and before the first function.
   */
  pendingCallbackTypedefs: string[] = [];
  /** ADR-040: For ISR function pointer type */
  needsISR: boolean = false;

  /**
   * #1668: the operand typer's context for this file, over the facts 1.4
   * settled -- the same artifact 2.1's analyzers read, so 2.2 types an operand
   * exactly as 2.1 did. Null for a render with no program behind it (a unit
   * test that builds codegen state alone).
   */
  /**
   * #1668 (C7): a name's declared type where it is used -- `bindValue` at
   * `at`, then `DeclaredTypeInfo.of`. This replaces the per-file registry,
   * whose one flat key space per function could not tell an inner block's
   * `x` from its sibling's, nor `global.x` from a local `x`. `root` is the
   * chain's `this`/`global`, as the source spelled it, and so is `name`:
   * the parse tree's names are never emitted ones (E0201 keeps `__`, the
   * rename separator, out of source identifiers).
   */
  declarationTypeInfo(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TTypeInfo | undefined {
    return DeclaredTypeInfo.of(
      this.bindingAt(root, name, at),
      this.typingContext().symbols,
      this.symbolTable,
      this.targetDescription,
    );
  }

  /**
   * #1643 review: a declaration's own facts -- the declaration itself, found
   * by its declarator's identity, so it never reads one it shadows
   */
  ownTypeInfo(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): TTypeInfo | undefined {
    return DeclaredTypeInfo.of(
      this.ownBinding(decl),
      this.typingContext().symbols,
      this.symbolTable,
      this.targetDescription,
    );
  }

  /**
   * #1610 review: whether a declaration is declared as a pointer -- its
   * `DeclaredPointer` answer, the one fact its `*` and its null zero are both
   * planned from
   */
  isDeclaredPointer(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): boolean {
    return this.ownTypeInfo(decl)?.isPointer ?? false;
  }

  /**
   * #1610: whether a declaration's C value is a pointer, so its zero is the
   * null pointer -- declared as one (`isDeclaredPointer`), or of a typedef
   * that already is one and is spelled with no `*`: a C typedef whose
   * declared type is a pointer (`void *`, `int *`, `void (*)(void)`, #957's
   * `struct X *`), or a C++ header's `typedef T *name;`
   */
  holdsPointer(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): boolean {
    if (this.isDeclaredPointer(decl)) return true;
    const baseType = this.ownTypeInfo(decl)?.baseType;
    return (
      baseType !== undefined &&
      (this.symbolTable.isCPointerTypedef(baseType) ||
        this.symbolTable.isPointerTypedef(baseType))
    );
  }

  /**
   * #1643 review: the local a declaration declares, found by its declarator's
   * identity -- undefined for a file-scope one
   */
  ownLocalDeclaration(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): ILocalDeclaration | undefined {
    const binding = this.ownBinding(decl);
    return binding?.kind === "local" ? binding.declaration : undefined;
  }

  /** The C identifier a declaration is emitted under (ADR-057) */
  ownEmittedName(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): string {
    const binding = this.ownBinding(decl);
    return binding?.kind === "local"
      ? this.localCName(binding.declaration, decl.nameSpan)
      : decl.name;
  }

  private ownBinding(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): TValueBinding | null {
    const typing = this.typingContext();
    return typing.program.declarationOf(
      typing.sourceFile,
      decl.name,
      decl.nameSpan,
    );
  }

  /**
   * #1668 (C7): which declaration a name means where it is used -- the
   * binder's local -> scope -> global order (ADR-057), for a name as the
   * source spelled it.
   */
  bindingAt(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TValueBinding | null {
    const typing = this.typingContext();
    return typing.program.bindValue(typing.sourceFile, root, name, at);
  }

  /**
   * The C name a local or parameter is emitted under at `at`: the one place
   * a bound local's name is decided for the body. A moved name IS ADR-057's
   * shadowing rule firing, so it is recorded; a local that shadows nothing is
   * the rule declining to act, which is not evidence of it.
   */
  localCName(declaration: ILocalDeclaration, at: ISourcePosition): string {
    const emitted = emittedLocalName(declaration);
    if (emitted !== declaration.name) {
      AdrProvenance.record("057", at.line);
    }
    return emitted;
  }

  /**
   * #1969: the current function's parameter a name means where it is used,
   * answered from `parameters` (2.2's, #1991). Bound at `at`, so a
   * block-local that shadows a parameter is the local inside its block, and
   * the parameter again after it.
   */
  parameterIn(
    parameters: ReadonlyMap<string, TParameterInfo>,
    name: string,
    at: ISourcePosition,
  ): TParameterInfo | undefined {
    const declaration = this.parameterDeclarationAt(name, at);
    return declaration === null
      ? undefined
      : TranspileState.plannedParameterIn(parameters, declaration.span);
  }

  /**
   * `parameterIn`'s parameter with the C name it is emitted under there, for
   * a site that writes it (#1290 review)
   */
  parameterBindingAt(
    name: string,
    at: ISourcePosition,
  ): IBoundParameter | undefined {
    const declaration = this.parameterDeclarationAt(name, at);
    const info =
      declaration === null
        ? undefined
        : this.plannedParameterAt(declaration.span);
    if (declaration === null || info === undefined) {
      return undefined;
    }
    return { info, emittedName: this.localCName(declaration, at) };
  }

  /** The key of 2.2's answer for the parameter declared at `nameSpan` */
  static parameterKey(nameSpan: ISourcePosition): string {
    return `${nameSpan.line}:${nameSpan.column}`;
  }

  /** 2.2's answer for the parameter declared at `nameSpan` (#1991) */
  plannedParameterAt(nameSpan: ISourcePosition): TParameterInfo {
    return TranspileState.plannedParameterIn(this.plannedParameters, nameSpan);
  }

  private static plannedParameterIn(
    parameters: ReadonlyMap<string, TParameterInfo>,
    nameSpan: ISourcePosition,
  ): TParameterInfo {
    const info = parameters.get(TranspileState.parameterKey(nameSpan));
    invariant(
      info !== undefined,
      `2.2 planned the parameter declared on line ${nameSpan.line}`,
    );
    return info;
  }

  private parameterDeclarationAt(
    name: string,
    at: ISourcePosition,
  ): ILocalDeclaration | null {
    const binding = this.bindingAt(null, name, at);
    return binding?.kind === "local" && binding.declaration.kind === "parameter"
      ? binding.declaration
      : null;
  }

  /**
   * What the one operand typer reads for the file being rendered. Render
   * always runs against a program (#1668 review: fifteen sites carried a
   * default for a missing one, guards that could not fire in production and
   * would have answered wrongly if they had).
   */
  typingContext(): ITypingContext {
    invariant(
      this.program !== null &&
        this.symbols !== null &&
        this.sourcePath !== null,
      "render runs against a program: set program, symbols and sourcePath first",
    );
    return {
      sourceFile: this.sourcePath,
      symbols: this.symbols,
      program: this.program,
      symbolTable: this.symbolTable,
    };
  }

  /**
   * 2.2 Plan's declaration decisions for the file being generated.
   *
   * Frozen, and set once before any declaration renders. Held here rather than
   * on `CodeGenerator` because CLAUDE.md gives this class sole ownership of
   * per-file state; it sits beside `symbols` for the same reason -- a decided
   * artifact the whole file's generation reads and nothing re-derives.
   *
   * Null before `assembleGeneratedOutput` reaches the declarations, which is
   * also every unit test that drives a generator directly. `declarationPlan()`
   * is the accessor that refuses the null rather than letting a site read a
   * silently-wrong default.
   */
  declarationPlanOrNull: IDeclarationPlan | null = null;
  /**
   * 2.2 Plan's emission decisions for the file being generated.
   *
   * Held for the rest of the file's turn so the requirements its planned
   * blocks carry are read off the plan, never copied into
   * `PlannedRequirements` (#1928, #1991). Null until 2.3 takes the file's plan.
   */
  emissionPlanOrNull: IEmissionPlan | null = null;
  /** ADR-013: Track function parameter const-ness for call-site validation */
  functionSignatures: Map<string, IFunctionSignature> = new Map();
  /** Callback field types: "Struct.field" -> callbackTypeName */
  callbackFieldTypes: Map<string, string> = new Map();
  /**
   * ADR-029 / Issues #1200, #1201: every type name referenced by a field or a
   * parameter, wherever it appears -- top-level struct, scope-nested struct,
   * scope member, or function parameter.
   *
   * Emitting a callback's `_fp` typedef is one decision, and it used to be
   * derived from callbackFieldTypes alone. That map is populated only while
   * walking TOP-LEVEL struct declarations, so a callback used anywhere else was
   * registered as known, referenced in the output, and never given a typedef --
   * generated C that does not compile.
   *
   * Names go in unfiltered: a parameter may name a callback declared later in
   * the file, so membership is intersected with callbackTypes at query time
   * rather than at collection time.
   */
  callbackTypeReferences: Set<string> = new Set();
  /**
   * #1491: the subset of `callbackTypeReferences` named by a declaration that
   * APPEARS IN THE HEADER -- a struct field, a scope member variable, or a
   * parameter.
   *
   * A local variable inside a function body names a callback type too (#1484),
   * and that reference must still produce a typedef -- but in the `.c`, not the
   * header. Treating the two alike put a type in the public interface because
   * one function body happened to use it, which is neither what C does nor
   * safe: two files that both named an INCLUDED function-as-type locally each
   * exported the same typedef, and anything including both headers saw it
   * twice, which C99 rejects.
   *
   * The C practice this follows: a library header typedefs the callback types
   * ITS OWN API uses -- POSIX's signal-handler typedef, `curl_write_callback`, `sqlite3_callback`
   * -- and nothing else. `stdlib.h` does not typedef `qsort`'s comparator; it
   * writes the pointer inline, because no caller needs to name it.
   */
  publicCallbackTypeReferences: Set<string> = new Set();
  /**
   * 2.2 Plan's declaration decisions, asserted present.
   *
   * A decision read before it was made is a defect, not a default: answering
   * `false` for "does the header own the type?" emits a duplicate definition
   * rather than failing, and the C compiler is the first thing that notices.
   */
  declarationPlan(): IDeclarationPlan {
    const plan = this.declarationPlanOrNull;
    invariant(
      plan !== null,
      "2.2 Plan decides declarations before 2.3 Render reads them",
    );
    return plan;
  }
  /**
   * 2.2 Plan's emission decisions, asserted present.
   *
   * Same reason as `declarationPlan()`: answering "no planned block costs
   * anything" before the plan exists would drop the interrupt-masking and C11
   * lines from the banner without failing.
   */
  emissionPlan(): IEmissionPlan {
    const plan = this.emissionPlanOrNull;
    invariant(
      plan !== null,
      "2.2 Plan builds the emission plan before its requirements are read",
    );
    return plan;
  }
  /**
   * Issue #1164: does the generated header own this callback's typedef?
   *
   * When the `.c` includes its own header, whichever typedefs the header emits
   * must not be emitted a second time -- C99 rejects even an identical typedef
   * redefinition. Both sides ask this one question so they cannot disagree
   * about who owns a given typedef.
   *
   * Keyed on callbackTypeReferences (#1200/#1201) rather than a set of its own:
   * that already records every site naming a callback type, so ownership and
   * emission cannot drift apart.
   */
  headerOwnsCallbackTypedef(functionName: string): boolean {
    return this.publicCallbackTypeReferences.has(functionName);
  }

  /** Expected type for struct initializers and enum inference */
  expectedType: string | null = null;
  /**
   * Suppress bare enum resolution even when expectedType is set.
   * Issue #872: MISRA 7.2 requires expectedType for U suffix on function args,
   * but bare enum resolution in function args was never allowed and changing
   * that would require ADR approval.
   */
  suppressBareEnumResolution: boolean = false;

  /**
   * Execute fn writing a value against the type 2.2 planned for it, restoring
   * the outer value's on exit (#1991). 2.2 already resolved what a value
   * inherits from the site around it, so this sets both fields exactly.
   */
  withPlannedExpectedType<T>(
    type: string | null,
    suppressBareEnumResolution: boolean,
    fn: () => T,
  ): T {
    const savedType = this.expectedType;
    const savedSuppress = this.suppressBareEnumResolution;
    this.expectedType = type;
    this.suppressBareEnumResolution = suppressBareEnumResolution;
    try {
      return fn();
    } finally {
      this.expectedType = savedType;
      this.suppressBareEnumResolution = savedSuppress;
    }
  }
  // ===========================================================================
  // GENERATOR REFERENCE (for handler access)
  // ===========================================================================

  /**
   * Reference to the CodeGenerator instance for handlers to call its methods,
   * typed to the method subset they use (ICodeGenApi).
   *
   * #1297 moved `ICodeGenApi` out of `output/` into the shared types root, which
   * both sides may depend on, and #1653 moved it on to `TRANSPILE/types/`,
   * since only TRANSPILE names it. The previous note here argued the edge
   * was harmless because it was `import type` and CodeGenState already imported
   * siblings from `output/codegen/types` -- but that was the whole problem:
   * `logic/ -> state/ -> output/` was live through exactly those imports while
   * `logic-cannot-import-output` reported clean, because it matched only direct
   * edges. The rule was made transitive and `state/` got one of its own; #1444
   * retired the `logic-` rule with the layer, when `logic/` joined 1.1 Discover
   * and `parse-cannot-import-transpile` covered it -- since #1443,
   * `1-1-discover-reads-no-later-pass`.
   *
   * The reference itself is still a `state/` object holding a codegen contract.
   * That coupling is by design today and is #1323's to move; what this removes
   * is the layer VIOLATION, not the dependency.
   */
  generator: ICodeGenApi | null = null;

  /**
   * The CodeGenerator instance, asserted present. Handlers call this instead of
   * each casting `generator` themselves — one source of truth for the access and
   * null-check (the generator is always set before any handler runs).
   */
  requireGenerator(): ICodeGenApi {
    invariant(this.generator, "the generator is set before any handler runs");
    return this.generator;
  }

  // ===========================================================================
  // SYMBOL DATA (read-only after initialization)
  // ===========================================================================

  /** ADR-055: Pre-collected symbol info from CnxResolver + TSymbolInfoAdapter */
  symbols: ICodeGenSymbols | null = null;

  /** External symbol table for cross-language interop (C headers).
   * Held by CodeGenState; persists across per-file reset() calls.
   * REPLACED at the start of each Transpiler run (#1452 box 5).
   */
  /**
   * The artifact 1.4 Resolve emitted for this run (#1447).
   *
   * Run-wide, so it is NOT cleared by `reset()` -- that runs per file. The
   * Transpiler clears it at the start of each run. It used to share that
   * treatment with `callbackCompatibleFunctions`, which #1452 removed: an
   * artifact reference and an accumulator needed the same clearing for
   * different reasons, and only one of them still exists.
   */
  program: IProgram | null = null;

  /**
   * The run's symbol table, read off 1.4's `Program` -- the only place a pass
   * after 1.4 may take it from (#1991).
   */
  get symbolTable(): IResolvedSymbols {
    invariant(
      this.program !== null,
      "1.4 Resolve built Program before a pass read its symbol table",
    );
    return this.program.symbolTable();
  }

  // ===========================================================================
  // TYPE TRACKING
  // ===========================================================================

  // ===========================================================================
  // FUNCTION & CALLBACK TRACKING
  // ===========================================================================

  /** Track cnx defined functions */
  knownFunctions: Set<string> = new Set();

  /** ADR-029: Callback types registry (function-as-type pattern) */
  callbackTypes: Map<string, ICallbackTypeInfo> = new Map();

  /**
   * Issue #1205: structs whose ADR-029 init function this file's `.c` emitted.
   *
   * The generated `<Struct>_init(void)` is a definition with external linkage,
   * so MISRA C:2012 Rule 8.4 needs a visible declaration -- and the header is
   * the only place to put one. Recorded at the single site that decides to
   * emit the definition, and read by header generation, which must not work
   * the answer out again: its `structFields` view also holds scope-nested
   * structs, which get no init function at all (#1283), so a header-side
   * re-derivation would declare functions nobody defines.
   *
   * Same shape as `needsISR` (ADR-040) and `headerOwnsCallbackTypedef`
   * (#1164): one fact, recorded by the `.c`, consulted by the `.h`.
   */
  generatedStructInits: Set<string> = new Set();

  /**
   * #1453 / ADR-004: the accessor `#define` blocks of every register this
   * file's header defines, rendered by the `.c` generator and printed by the
   * header verbatim.
   *
   * A `#define` cannot be exported from a `.c`, so a register reaches an
   * including file only through the header. The text is rendered once, where
   * the ADR-057 type qualification and the address expressions are available
   * (the register generators), and handed over rather than re-derived from the
   * symbol -- a header-side renderer would be a second copy of that
   * resolution. Same shape as `generatedStructInits`: one fact, recorded by the
   * `.c`, consulted by the `.h`. Cleared per file by `reset()`.
   */
  exportedRegisterBlocks: string[] = [];

  /**
   * Functions that are assigned to C callback typedefs.
   * Maps function name -> typedef name (e.g., "my_flush" -> "flush_cb_t")
   * Issue #895: We need the typedef name to look up parameter types.
   */

  // ===========================================================================
  // PASS-BY-VALUE ANALYSIS (Issue #269)
  // ===========================================================================

  /** Parameters that should pass by value (small, unmodified primitives) */

  // ===========================================================================
  // OVERFLOW & DIVISION HELPERS (ADR-044, ADR-051)
  // ===========================================================================

  // ===========================================================================
  // CURRENT CONTEXT (changes during AST traversal)
  // ===========================================================================

  /**
   * ADR-016: path of the scope currently being generated, `""` at file scope.
   *
   * #1298: a PATH, not a scope object. Every consumer passed this straight into
   * the qualifier helpers, which used it for exactly one thing -- the chain of
   * names a path already spells out -- so holding the object meant ~45 sites
   * would each have had to re-derive the path from it.
   */
  currentScopePath = "";

  /** Issue #269: Current function for modification tracking */
  currentFunctionName: string | null = null;

  /** ADR-006: Current function parameters for pointer semantics */
  currentParameters: Map<string, TParameterInfo> = new Map();

  /** 2.2's answer for every parameter of the file being rendered (#1991) */
  plannedParameters: ReadonlyMap<string, TParameterInfo> = new Map();

  /** Scope member names: scope -> Set of member names */
  private scopeMembers: Map<string, Set<string>> = new Map();

  /** Float bit indexing: declared shadow variables */
  floatBitShadows: Set<string> = new Set();

  /** Float bit indexing: shadows with current value (skip redundant reads) */
  floatShadowCurrent: Set<string> = new Set();

  // ===========================================================================
  // GENERATION STATE
  // ===========================================================================

  /** Whether we're inside a function body */
  inFunctionBody: boolean = false;

  /** Track args parameter name for main() translation */
  mainArgsName: string | null = null;

  /** ADR-035: Element count for array size inference */
  lastArrayInitCount: number = 0;

  /** ADR-035: Fill-all value for array initialization */
  lastArrayFillValue: string | undefined = undefined;

  /**
   * ADR-035: clear the array-initializer tracking before generating one.
   *
   * The two fields above are written by the expression generator as a side
   * effect and read back afterwards, so a caller that does not clear them
   * first can read the PREVIOUS declaration's answer. Both callers cleared
   * both fields by hand; naming the operation is what stops the next one
   * clearing only the count, which is the half that reads as "no array".
   */
  resetArrayInitTracking(): void {
    this.lastArrayInitCount = 0;
    this.lastArrayFillValue = undefined;
  }

  /**
   * ADR-035: whether the initializer just generated was an array initializer.
   *
   * Derived from both fields, never one: `[0*]` sets only the fill value and
   * leaves the count at zero, so a predicate asking only about the count reads
   * the fill-all form as "not an array initializer". Two sites derived this
   * independently and agreed -- one of them `private`, so the other could not
   * have reused it even knowing it was there.
   */
  wasArrayInit(): boolean {
    return this.lastArrayInitCount > 0 || this.lastArrayFillValue !== undefined;
  }

  /**
   * ADR-049: the target this file is generated for. Set by `reset()` from the
   * description 1.4 settled; null only before the first file.
   */
  targetDescription: ITargetDescription | null = null;

  // ===========================================================================
  // INCLUDE FLAGS (track required standard library includes)
  // ===========================================================================

  // ===========================================================================
  // OPAQUE TYPE SCOPE VARIABLES (Issue #948)
  // ===========================================================================

  // ===========================================================================
  // C++ MODE STATE (Issue #250)
  // ===========================================================================

  /** Use temp vars instead of compound literals */
  cppMode: boolean = false;

  /**
   * Issue #1319: the extensions this run emits, derived from the mode rather
   * than stored beside it. A stored copy would be a second holder of the same
   * fact and could drift from `cppMode`; a getter cannot.
   *
   * Codegen sites that only need a filename ask for this. `cppMode` itself is
   * still read directly for genuine mode decisions -- pointer vs reference,
   * `.` vs `->`, `NULL` vs `nullptr` -- which are not filenames and are not
   * this decision.
   */
  get outputExtensions(): IOutputExtensions {
    return OutputExtensions.forCppMode(this.cppMode);
  }

  /** Pending temp variable declarations for C++ mode */
  pendingTempDeclarations: string[] = [];

  /** Counter for unique temp variable names */
  private tempVarCounter: number = 0;

  // ===========================================================================
  // SOURCE PATHS (ADR-010, Issue #349)
  // ===========================================================================

  /** Source file path for validating includes */
  sourcePath: string | null = null;

  // ===========================================================================
  // LIFECYCLE METHODS
  // ===========================================================================

  /**
   * Exit a function body context.
   * Clears local tracking and sets inFunctionBody to false.
   */
  exitFunctionBody(): void {
    this.inFunctionBody = false;
    this.clearFunctionLocals();
  }

  /**
   * Enter a function body context.
   * Clears local tracking and sets inFunctionBody flag.
   */
  enterFunctionBody(): void {
    this.inFunctionBody = true;
    this.clearFunctionLocals();
  }

  /**
   * Clear every per-function local register.
   *
   * One owner for the whole family. Four copies of this block existed, and they
   * had already diverged: one of them cleared three of the four registers and
   * left a local-array set (since deleted, #1668) to leak between functions. A fifth member
   * at four call sites would have made that five. (The copy that diverged lived on
   * `FunctionContextManager`, which #1450 deleted as production-dead; the point
   * survives it, so it is stated without the name.)
   */
  private clearFunctionLocals(): void {
    this.floatBitShadows.clear();
    this.floatShadowCurrent.clear();
  }

  // ===========================================================================
  // CONVENIENCE LOOKUP METHODS
  // ===========================================================================

  /**
   * Check if a type name is a known struct.
   * Also includes bitmaps since they're struct-like (Issue #551).
   */
  isKnownStruct(name: string): boolean {
    return DeclaredTypeFacts.isStruct(this.symbols, this.symbolTable, name);
  }

  /**
   * Check if a type name is a known scope.
   */
  isKnownScope(name: string): boolean {
    return DeclaredTypeFacts.isScope(this.symbols, name);
  }

  /**
   * Check if a *qualified* name is a type declared in a scope that the file
   * being generated can see.
   * Used by `ScopeUtils.qualifyScopeType()`, through `typeBindingDeps`, to
   * ensure only actual type declarations (enum/struct/bitmap/function) capture
   * the name at a type position. ADR-029 makes a function definition create a
   * callback type, so a scope function is a type declaration for this purpose;
   * a scope VARIABLE is not, and deliberately does not capture (ADR-057).
   *
   * @param qualifiedName The already-joined C name (e.g. "A__B")
   * @returns true if the qualified name is an enum, struct, bitmap, or
   *          function-as-type (ADR-029) declared in a scope, by this file or a
   *          file it includes
   */
  isScopeType(qualifiedName: string): boolean {
    // #1724: the answer 1.4 settled this file's symbols with, asked about the
    // same file, so the `.c` and the `.h` cannot disagree. This read the
    // run-wide symbol table, which also holds the scope types of files this
    // one never includes: a bare `Config` in a reopened scope became a
    // sibling's `Motor__Config` here while 1.4, reading a run-wide union, made
    // the same mistake in the header -- two lookups agreeing by coincidence.
    //
    // Which kinds form a type is still TYPE_FORMING_KINDS' answer (#1285): 1.3
    // Declare's pass 0b asks it when it collects each file's scope types.
    const sourcePath = this.sourcePath;
    if (this.program === null || sourcePath === null) {
      return false;
    }
    return this.program.isScopeTypeVisibleFrom(sourcePath, qualifiedName);
  }

  /**
   * ADR-010: does this transpiled C name refer to a declaration that lives in
   * a DIFFERENT file from the one being generated?
   *
   * #1508: ADR-010 promises that a declaration reached through an `#include` is
   * usable wherever a local one would be. When that promise is KEPT nothing is
   * diagnosed -- the code simply compiles -- so the matrix had no source
   * position to derive occupancy from and every cross-file cell read as
   * unoccupied however many fixtures exercised it. That is the observability
   * gap #1241 describes, not a coverage gap.
   *
   * Asks the run-wide table, deliberately. The per-file `known*` sets carry
   * names only, so they cannot answer "which file did this come from"; the
   * run-wide table indexes symbols by their canonical C name and each symbol
   * carries its own `sourceFile`. This is the "which symbol IS this?" question,
   * which CLAUDE.md pairs with `getOverloadsByCName` rather than the bare-name
   * index.
   *
   * `every` rather than `some`: a name that resolves to declarations in several
   * files includes a local one, and a local declaration is what the caller
   * actually binds to. Reporting that as cross-file would credit an include for
   * a symbol the file defines itself.
   */
  isCrossFileDeclaration(qualifiedCName: string): boolean {
    const current = this.sourcePath;
    if (!current) {
      return false;
    }
    const found = this.symbolTable.getOverloadsByCName(qualifiedCName);
    return (
      found.length > 0 && found.every((symbol) => symbol.sourceFile !== current)
    );
  }

  /**
   * `isScopeType` as a VALUE, bound to this class.
   *
   * `isScopeType` is an instance method reading `this.program`, so a bare
   * reference to it loses its receiver and throws. Six sites each wrote the
   * same closure to work around that -- five feeding `ITypeBindingDeps`, one
   * feeding `ITypeGenerationDeps`, which CLAUDE.md keeps separate so
   * `TypeGenerationHelper` stays unit-testable. The two CONTRACTS are
   * different and stay different; the BINDING was the same six times.
   *
   * An arrow property rather than a method precisely because a method cannot
   * be passed unbound -- that is the whole problem it solves.
   */
  readonly scopeTypePredicate = (qualifiedName: string): boolean =>
    this.isScopeType(qualifiedName);

  /**
   * ADR-057: bind this state's type sets to `TypeNameLadder`'s injected deps.
   *
   * THE binding, for the sites that resolve a whole `TypeContext`.
   * `isScopeType` is an instance method reading `this.program`, so it cannot be
   * passed unbound -- which is why five call sites each wrote the same closure,
   * paired with `currentScopePath`, and why the rule against re-pairing them
   * needed something to call instead of only saying not to.
   *
   * It had a bare-name sibling, `qualifyScopeType`, which CLAUDE.md told codegen
   * to call. Nothing did: the bare-name path resolves in the symbols layer
   * (`utils/TypeNameLadder`), and codegen reaches the same decision through
   * this method. Deleted under #1452 with the rule that named it.
   *
   * `resolveQualifiedType` stays the caller's: it is the one half that really
   * does differ, routing to a generator's C++ namespace resolution or to a
   * callback's, and binding it here would invent a dependency from `state/` on
   * whichever one happened to be first.
   *
   * @param resolveQualifiedType the caller's `Scope.Type` resolver, if it has one
   */
  typeBindingDeps(
    resolveQualifiedType?: (identifiers: string[]) => string,
  ): ITypeBindingDeps {
    return {
      isScopeType: this.scopeTypePredicate,
      resolveQualifiedType,
    };
  }

  /**
   * ADR-030: is a cnx declaration of this type held through a pointer?
   *
   * An incomplete type can only be held through a pointer, so a declaration of
   * one is `T*` wherever cnx declares it -- a scope member, a file-scope or
   * local variable, a parameter, a callback typedef's parameter -- and an array
   * of them is an array of pointers (#996). This is the ONE answer each of
   * those sites reads. A declaration's own pointer-ness (`DeclaredPointer.of`,
   * which the `.c` definition and the header's `extern` both follow) asks the
   * same predicate, `DeclaredPointer.isHandleType`, so the two cannot differ.
   */
  isHeldThroughPointer(typeName: string): boolean {
    return DeclaredPointer.isHandleType(typeName, this.symbolTable);
  }

  /**
   * Convert a TSymbol IVariableSymbol to TTypeInfo for unified type lookups.
   * ADR-055 Phase 7: Works with typed TSymbol instead of ISymbol.
   */

  /**
   * Issue #895: Get the typedef type string for a C typedef by name.
   * Used to look up function pointer typedef signatures for callback-compatible functions.
   *
   * @param typedefName - Name of the typedef (e.g., "flush_cb_t")
   * @returns The type string (e.g., "void (*)(widget_t *, const rect_t *, uint8_t *)") or undefined
   */
  /**
   * The C callback typedef TYPE a function is assigned to, or undefined.
   *
   * #1545 review: "is this function callback-compatible?" was answered in
   * three places with three spellings -- the header asked the two steps and
   * consumed them as truthiness, the body asked them and consumed `!==
   * undefined`, and the pass-by-value decision asked only `.has()` and never
   * resolved the typedef at all. The first two disagree on `""`, which
   * getTypedefType can return because it forwards `symbol.type` unchecked; the
   * third disagrees whenever the map holds a function whose typedef does not
   * resolve.
   *
   * One home, so the predicate cannot be spelled a fourth way. Whether an
   * unresolvable typedef should suppress auto-const at all is #1603, and this
   * is the single place that question now has to be answered.
   */
  callbackTypedefTypeFor(functionName: string): string | undefined {
    const typedefName = this.program
      ?.callbackCompatibleFunctions()
      .get(functionName);
    if (!typedefName) return undefined;

    return this.getTypedefType(typedefName);
  }

  getTypedefType(typedefName: string): string | undefined {
    const symbol = this.symbolTable.getCSymbol(typedefName);
    if (symbol?.kind === "type") {
      return symbol.type;
    }
    return undefined;
  }

  /**
   * Get members of a scope.
   */
  getScopeMembers(scopePath: string): Set<string> | undefined {
    return this.scopeMembers.get(scopePath);
  }

  /**
   * Set members of a scope.
   */
  setScopeMembers(scopePath: string, members: Set<string>): void {
    this.scopeMembers.set(scopePath, members);
  }

  /**
   * Get all scope members (for IGeneratorState).
   */
  getAllScopeMembers(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.scopeMembers;
  }

  // ===========================================================================
  // TYPE REGISTRATION HELPERS
  // ===========================================================================

  /**
   * Enter a scope by its DOTTED PATH.
   *
   * The parameter is a path (`Outer.Inner`), not a leaf, because that is what
   * `SymbolRegistry.getOrCreateScope` takes. Pass a leaf for a nested scope and
   * it does not fail -- it CREATES a fresh scope parented to global and
   * registers it under the leaf, after which every qualification through
   * `currentScopePath` silently returns a one-level name.
   *
   * Every codegen caller passes a leaf, and that is correct for every program
   * cnx can express: `scopeMember` admits no `scopeDeclaration`
   * (grammar/Cnx.g4:81-89), so a scope's leaf IS its whole path. ADR-016 makes
   * that permanent, so no future grammar change retires the gap.
   *
   * #1304: what remains is that a leaf passed where a path is expected used to
   * be UNDETECTABLE. `getOrCreateScope` minted a fresh scope parented to global
   * and registered it under the leaf, after which `currentScopePath` was that
   * orphan's one-level name -- so #1295's producer key (`scope.cnxScopedName`,
   * the whole path) missed, and the member generated as a bare C identifier at
   * exit 0. The two halves of the same decision disagreed silently.
   *
   * The registry is the authority. A path it does not know is a broken promise
   * about the symbols pass, not something to create here, so this looks up and
   * asserts instead of creating. Measured before changing it: the whole fixture
   * corpus (1247/1247) enters only scopes that are already registered, so
   * nothing reachable relied on the creating behavior.
   *
   * Reading the path back off the registered scope is what makes producer and
   * reader agree BY CONSTRUCTION rather than by coincidence -- both are that
   * scope's `cnxScopedName`, not two strings that happen to match.
   */
  setCurrentScopeByPath(name: string | null): void {
    this.currentScopePath = this.scopePathOf(name);
  }

  /** The path of the scope named `name`, or "" for none */
  scopePathOf(name: string | null): string {
    if (name === null) {
      return "";
    }
    const scope = this.program?.scope(name) ?? null;
    invariant(
      scope !== null,
      `a scope entered during generation was registered by the symbols pass (got "${name}")`,
    );
    return ScopeUtils.pathOf(scope);
  }

  // ===========================================================================
  // OPAQUE SCOPE VARIABLE HELPERS (Issue #948)
  // ===========================================================================

  // ===========================================================================
  // C++ MODE HELPERS
  // ===========================================================================

  /**
   * Get a unique temp variable name.
   */
  getNextTempVarName(): string {
    return ReservedCnxName.temporary(this.tempVarCounter++);
  }

  /** Cleared per file, at the top of `generate()`. */
  /**
   * #1991: 2.2 starts a file from what it read off the options; the walker
   * calls this, so 2.2 itself writes nothing here.
   */
  beginPlan(inputs: TPlanInputs, generator: ICodeGenApi): void {
    this.clearFileData(inputs.targetDescription);
    this.useInputs(inputs);
    this.generator = generator;
  }

  private useInputs(inputs: TPlanInputs): void {
    this.program = inputs.program;
    this.symbols = inputs.symbols;
    this.sourcePath = inputs.sourcePath;
    this.debugMode = inputs.debugMode;
    this.cppMode = inputs.cppMode;
    this.includeRewrites = inputs.includeRewrites;
    this.includeKinds = inputs.includeKinds;
    for (const [scope, members] of inputs.scopeMembers) {
      this.setScopeMembers(scope, new Set(members));
    }
  }

  /** ADR-029: the callback types 2.2 planned for the file */
  useCallbackTypes(
    callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>,
  ): void {
    this.callbackTypes = new Map(callbackTypes);
  }

  /** The functions and callback references 2.2's pre-pass found */
  useFunctionCatalog(catalog: IFunctionCatalog): void {
    this.knownFunctions = new Set(catalog.knownFunctions);
    this.functionSignatures = new Map(catalog.functionSignatures);
    this.callbackFieldTypes = new Map(catalog.callbackFieldTypes);
    this.callbackTypeReferences = new Set(catalog.callbackTypeReferences);
    this.publicCallbackTypeReferences = new Set(
      catalog.publicCallbackTypeReferences,
    );
  }

  /**
   * 2.2's setup for this file, copied so the plan carries it and 2.3 can
   * start from it alone (#1991).
   */
  fileSetup(
    decided: Pick<
      IFileSetup,
      "parameters" | "selfIncludeAdded" | "needsISR" | "declarationPlan"
    >,
  ): IFileSetup {
    invariant(this.program, "2.1 hands 2.2 the program");
    invariant(this.symbols, "2.2 sets the file's symbols before planning it");
    invariant(
      this.sourcePath !== null,
      "2.2 sets the file's source path before planning it",
    );
    invariant(
      this.targetDescription !== null,
      "2.2 sets the file's target before planning it",
    );
    return {
      program: this.program,
      symbols: this.symbols,
      sourcePath: this.sourcePath,
      debugMode: this.debugMode,
      cppMode: this.cppMode,
      targetDescription: this.targetDescription,
      includeRewrites: this.includeRewrites,
      includeKinds: this.includeKinds,
      selfIncludeAdded: decided.selfIncludeAdded,
      needsISR: decided.needsISR,
      declarationPlan: decided.declarationPlan,
      knownFunctions: new Set(this.knownFunctions),
      functionSignatures: new Map(this.functionSignatures),
      callbackTypes: new Map(this.callbackTypes),
      callbackFieldTypes: new Map(this.callbackFieldTypes),
      callbackTypeReferences: new Set(this.callbackTypeReferences),
      publicCallbackTypeReferences: new Set(this.publicCallbackTypeReferences),
      scopeMembers: new Map(
        [...this.scopeMembers].map(([scope, members]) => [
          scope,
          new Set(members),
        ]),
      ),
      parameters: decided.parameters,
    };
  }

  /**
   * 2.3 starts each file from the plan alone: everything 2.2 left here is
   * cleared, then the plan's setup and emission are installed (#1991).
   */
  beginRender(setup: IFileSetup, emission: IEmissionPlan): void {
    this.clearFileData(setup.targetDescription);
    this.useInputs(setup);
    this.useCallbackTypes(setup.callbackTypes);
    this.useFunctionCatalog(setup);
    this.needsISR = setup.needsISR;
    this.declarationPlanOrNull = setup.declarationPlan;
    this.plannedParameters = setup.parameters;
    this.emissionPlanOrNull = emission;
  }

  private clearFileData(targetDescription: ITargetDescription): void {
    // Generator reference
    this.generator = null;

    // Symbol data
    this.symbols = null;
    // Note: symbolTable is NOT reset here — it persists across per-file
    // generates. The Transpiler replaces it at the start of each run (#1452
    // box 5); there is no `clear()` to call.

    // Type tracking

    // Function & callback tracking
    this.knownFunctions = new Set();
    this.callbackTypes = new Map();
    this.generatedStructInits = new Set();
    this.exportedRegisterBlocks = [];

    // Current context
    this.currentScopePath = "";
    this.currentFunctionName = null;
    this.currentParameters = new Map();
    this.plannedParameters = new Map();
    this.scopeMembers = new Map();
    this.floatBitShadows = new Set();
    this.floatShadowCurrent = new Set();

    // Generation state
    this.inFunctionBody = false;
    this.mainArgsName = null;
    this.lastArrayInitCount = 0;
    this.lastArrayFillValue = undefined;
    this.targetDescription = targetDescription;

    // Include flags

    // C++ mode state
    this.cppMode = false;
    this.pendingTempDeclarations = [];
    this.tempVarCounter = 0;

    // Issue #948: Opaque scope variables (reset per-file)

    // Source paths
    this.sourcePath = null;
    this.expectedType = null;
    this.suppressBareEnumResolution = false;
    this.functionSignatures = new Map();
    this.callbackFieldTypes = new Map();
    this.callbackTypeReferences = new Set();
    this.publicCallbackTypeReferences = new Set();
    this.declarationPlanOrNull = null;
    this.emissionPlanOrNull = null;
    this.needsISR = false;
    this.emittedCallbackTypedefs = new Set();
    this.pendingCallbackTypedefs = [];
    this.indentLevel = 0;
    this.lengthCache = null;
    this.debugMode = false;
    this.includeRewrites = new Map<string, string>();
    this.includeKinds = new Map<string, EFileType>();
  }
}

export default TranspileState;
