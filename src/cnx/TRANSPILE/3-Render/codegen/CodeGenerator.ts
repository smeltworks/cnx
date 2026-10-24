/**
 * cnx Code Generator
 * Transforms cnx AST to clean, readable C code
 */

import PlanQueries from "../../2-Plan/PlanQueries";
import type IFloatBitWrite from "../../types/IFloatBitWrite";
import ReservedCnxName from "../../../utils/ReservedCnxName";

// Issue #60: BITMAP_SIZE and BITMAP_BACKING_TYPE moved to SymbolCollector
import IOrchestrator from "./generators/IOrchestrator";
import IGeneratorInput from "./generators/IGeneratorInput";
import IGeneratorState from "./generators/IGeneratorState";
import TGeneratorEffect from "./generators/TGeneratorEffect";
// Expression generators
// Statement generators
import atomicGenerators from "./generators/statements/AtomicGenerator";
import type IPlannedAtomic from "../../types/IPlannedAtomic";
// Declaration generators
// ADR-065: Extracted utilities
import FormatUtils from "../../../utils/FormatUtils";
import StringUtils from "../../../utils/StringUtils";
import invariant from "../../../utils/invariant";
// Support generators
// ADR-046: which nullable C functions return a struct pointer (#1322: a
// constant lookup, not an analyzer -- see the module header)
// ADR-006: Helper for building member access chains with proper separators
// ADR-065: Assignment decomposition (Phase 2)
// IHandlerDeps removed - handlers now use this.state.generator directly
// Issue #644: Extracted string length counter for strlen caching optimization
// Issue #644: C/C++ mode helper for consolidated mode-specific patterns
// Issue #644: Array dimension parsing helper for consolidation
// Issue #644: Member chain analyzer for bit access pattern detection
// Issue #644: Float bit write helper for shadow variable pattern
import FloatBitHelper from "./helpers/FloatBitHelper";
// Issue #644: String declaration helper for bounded/array/concat strings
// Note: StringDeclHelper is now used via VariableDeclHelper
// Issue #794: Argument generation helper for ADR-006 semantics
// Issue #644: Enum assignment validator for type-safe enum assignments
// Issue #644: Array initialization helper for size inference and fill-all
// Note: ArrayInitHelper is now used via VariableDeclHelper
// Issue #644: Assignment expected type resolution helper
// PR #715: C++ member conversion helper for improved testability
// PR #715: Boolean conversion helper for improved testability
// PR #715: C++ constructor detection helper for improved testability
// PR #715: Set/Map utilities for improved testability
// PR #715: Symbol lookup utilities for improved testability
import SymbolLookupHelper from "../../2-Plan/SymbolLookupHelper";
// Issue #644: Assignment validation coordinator helper
// Issue #696: Variable modifier extraction helper
// Note: VariableModifierBuilder is now used via VariableDeclHelper
// Issue #792: Variable declaration helper
// String operation detection and extraction
// PR #681: Extracted separator and dereference resolution utilities
// SonarCloud S3776: Extracted helpers for assignment target generation
// Issue #707: Expression unwrapping utility for reducing duplication
// Stateless parser utilities extracted from CodeGenerator
// Phase 3: Type generation helper for improved testability
import type IPlannedFunctionParameter from "../../2-Plan/types/IPlannedFunctionParameter";
// Phase 5: Cast validation helper for improved testability
// Issue #793: Function context lifecycle and parameter processing helper
import FunctionContextManager from "./helpers/FunctionContextManager";
// Global state for code generation (simplifies debugging, eliminates DI complexity)
import CallbackTypedefFormatter from "../../../utils/CallbackTypedefFormatter";
// Issue #269: Pass-by-value analysis extracted from CodeGenerator
// Unified parameter generation (Phase 1)
// Issue #895: Parse typedef signatures to determine pointer vs value params
// Extracted resolvers that use CodeGenState
// Issue #797: Centralized C-style name generation
import type IRecordedRequirement from "../../../types/IRecordedRequirement";
import EmissionPlan from "../../2-Plan/EmissionPlan";
import TranspileState from "../../TranspileState";
import StructDefaultInitializer from "./helpers/StructDefaultInitializer";
import StructDefault from "../../../utils/StructDefault";
import ElementCount from "../../../utils/ElementCount";
import type IProgram from "../../../types/IProgram";

/**
 * Code Generator - Transpiles cnx to C
 *
 * Implements IOrchestrator to support modular generator extraction.
 */
export default class CodeGenerator implements IOrchestrator {
  /**
   * 2.3 Render's per-file working state (#1452 box 4). Owned here because the
   * walker reaches this object as `this.host`, so one instance serves both
   * without a global between them.
   */
  readonly state = new TranspileState();

  private readonly planQueries = new PlanQueries(this.state);

  // ===========================================================================
  // IOrchestrator Implementation
  // ===========================================================================

  /**
   * Get read-only input context for generators.
   * Contains all the information generators need to produce code.
   */
  getInput(): IGeneratorInput {
    return {
      symbolTable: this.state.symbolTable,
      symbols: this.state.symbols,
      functionSignatures: this.state.functionSignatures,
      knownFunctions: this.state.knownFunctions,
      knownStructs: this.state.symbols?.knownStructs ?? new Set(),
      callbackTypes: this.state.callbackTypes,
      callbackFieldTypes: this.state.callbackFieldTypes,
      program: this.state.program,
    };
  }

  /**
   * Get a snapshot of the current generation state.
   * Represents where we are in the AST traversal.
   */
  getState(): IGeneratorState {
    return {
      currentScopePath: this.state.currentScopePath,
      indentLevel: this.state.indentLevel,
      inFunctionBody: this.state.inFunctionBody,
      currentParameters: this.state.currentParameters,
      expectedType: this.state.expectedType,
      headerOwnsTypeDefinitions:
        this.state.declarationPlan().headerOwnsTypeDefinitions, // #369/#1450
      // Issue #644: Postfix expression state
      scopeMembers: this.state.getAllScopeMembers(),
      mainArgsName: this.state.mainArgsName,
      floatBitShadows: this.state.floatBitShadows,
      floatShadowCurrent: this.state.floatShadowCurrent,
      lengthCache: this.state.lengthCache,
    };
  }

  /**
   * Process effects returned by generators, updating internal state.
   * This centralizes all side-effect handling.
   */
  applyEffects(effects: readonly TGeneratorEffect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        // #1452 box 2: three "type registration" effects stood here --
        // `register-type`, `register-local`, `register-const-value` -- and NO
        // generator emitted any of them (`grep` for each literal outside this
        // switch and the union: 0). They were a render-side write path into the
        // per-file type registry that never ran, so they read as 2.3 authoring
        // a plan fact while authoring nothing at all. Removed with their union
        // members; the two effects that ARE emitted keep their arms.

        // Scope effects (ADR-016)
        case "set-scope":
          this.state.setCurrentScopeByPath(effect.name);
          break;

        // Function body effects
        case "enter-function-body":
          this.state.enterFunctionBody();
          break;
        case "exit-function-body":
          this.state.exitFunctionBody();
          break;
        case "set-parameters":
          this.state.currentParameters = new Map(effect.params);
          break;
        case "clear-parameters":
          this.state.currentParameters.clear();
          break;

        // Callback effects
        case "register-struct-init":
          this.state.generatedStructInits.add(effect.structName);
          break;

        // Array initializer effects
        case "set-array-init-count":
          this.state.lastArrayInitCount = effect.count;
          break;
        case "set-array-fill-value":
          this.state.lastArrayFillValue = effect.value;
          break;
      }
    }
  }

  /**
   * Issue #1143: what the last generate() call's output requires.
   *
   * Read off the emission plan, which decides every key (#1928, #1997);
   * Render records none. The banner and the file result both read this one
   * list.
   *
   * Must be read before the next file's this.state.reset(), which clears the
   * plan.
   */
  getToolchainRequirements(): readonly IRecordedRequirement[] {
    return EmissionPlan.requirements(this.state.emissionPlan());
  }

  /**
   * Get the current indentation string.
   */
  getIndent(): string {
    return FormatUtils.indent(this.state.indentLevel);
  }

  // === Expression Generation ===

  // === Type Utilities ===

  /**
   * Check if a type name is a known struct.
   * Part of IOrchestrator interface.
   */
  isKnownStruct(typeName: string): boolean {
    return this.planQueries.isKnownStruct(typeName);
  }

  /**
   * Check if a type is a float type.
   * Part of IOrchestrator interface - delegates to TypeCheckUtils.
   */
  isFloatType(typeName: string): boolean {
    return this.planQueries.isFloatType(typeName);
  }

  /**
   * Check if a type is an integer type.
   * Part of IOrchestrator interface - delegates to TypeCheckUtils.
   */
  isIntegerType(typeName: string): boolean {
    return this.planQueries.isIntegerType(typeName);
  }

  /**
   * Check if a function is defined in cnx.
   * Part of IOrchestrator interface.
   */
  isCnxFunction(name: string): boolean {
    return this.planQueries.isCnxFunction(name);
  }

  // === Expression Analysis ===

  // === Validation ===

  // === Function Call Helpers ===

  /**
   * Get known enums set for pass-by-value detection.
   * Part of IOrchestrator interface.
   */
  getKnownEnums(): ReadonlySet<string> {
    return this.planQueries.getKnownEnums();
  }

  /**
   * Issue #304: Check if we're generating C++ output.
   * Part of IOrchestrator interface.
   */
  isCppMode(): boolean {
    return this.planQueries.isCppMode();
  }

  /**
   * Part of IOrchestrator interface. See `StructDefault` for the decision and
   * `StructDefaultInitializer` for its spelling.
   */
  renderStructDefault(
    structName: string,
    counts: readonly (number | null)[],
  ): string | null {
    const symbols = this.state.symbols;
    const program = this.state.program;
    invariant(
      symbols && program,
      "an ADR-029 default is rendered from the resolved program and its symbols, which generate() sets before any declaration (#1283)",
    );
    return StructDefaultInitializer.render(structName, counts, {
      ...StructDefault.factsOf(symbols),
      fieldElementCounts: (owner, fieldName) =>
        CodeGenerator.fieldElementCounts(program, owner, fieldName),
      cppMode: this.state.cppMode,
    });
  }

  /** #1283 review: a struct field's element counts, from its symbol */
  private static fieldElementCounts(
    program: IProgram,
    structName: string,
    fieldName: string,
  ): readonly (number | null)[] {
    const struct = program.symbolByCName(structName);
    const field =
      struct?.kind === "struct" ? struct.fields.get(fieldName) : undefined;
    if (!field?.dimensions) {
      return [];
    }
    return field.dimensions.map((dimension, i) => {
      if (typeof dimension === "number") return dimension;
      const expr = field.dimensionExprs?.[i] ?? null;
      return expr === null
        ? null
        : ElementCount.of(expr, program, field.sourceFile);
    });
  }

  /**
   * Issue #304: Check if a type is a C++ enum class (scoped enum).
   * These require explicit casts to integer types in C++.
   * Part of IOrchestrator interface.
   */
  isCppEnumClass(typeName: string): boolean {
    return this.planQueries.isCppEnumClass(typeName);
  }

  /**
   * Issue #250: Flush pending temp variable declarations.
   * Returns declarations as a single string and clears the pending list.
   * Part of IOrchestrator interface.
   */
  flushPendingTempDeclarations(): string {
    if (this.state.pendingTempDeclarations.length === 0) {
      return "";
    }
    const decls = this.state.pendingTempDeclarations.join("\n");
    this.state.pendingTempDeclarations = [];
    return decls;
  }

  /**
   * Get indentation string for current level.
   * Part of IOrchestrator interface.
   */
  indent(text: string): string {
    return FormatUtils.indentAllLines(text, this.state.indentLevel);
  }

  // === strlen Optimization ===

  /**
   * Setup length cache and return declarations.
   * Part of IOrchestrator interface.
   */
  setupLengthCache(
    counts: Map<string, number>,
    renderOperand: (name: string) => string,
  ): string {
    const declarations: string[] = [];
    const cache = new Map<string, string>();

    for (const [varName, count] of counts) {
      if (count >= 2) {
        const tempVar = ReservedCnxName.stringLengthCache(varName);
        const operand = renderOperand(varName);
        cache.set(operand, tempVar);
        declarations.push(`size_t ${tempVar} = strlen(${operand});`);
      }
    }

    if (declarations.length > 0) {
      this.state.lengthCache = cache;
      return declarations.join("\n") + "\n";
    }

    return "";
  }

  /**
   * Clear length cache.
   * Part of IOrchestrator interface.
   */
  clearLengthCache(): void {
    this.state.lengthCache = null;
  }

  // === Declaration Generation ===

  // #1322: the `Validation (IOrchestrator A4)` section that stood here held
  // ADR-024's `validateLiteralFitsType` and `validateTypeConversion`. Both are
  // E0868/E0869 in pass 2.1, and no generator asks the orchestrator for them.

  // === String Helpers (IOrchestrator A4) ===

  /** Get the length of a string literal */
  getStringLiteralLength(literal: string): number {
    return StringUtils.literalLength(literal);
  }

  // #1445 box 3: `getStringConcatOperands` and `getSubstringOperands` stood
  // here as public delegates to the `_`-prefixed pair below. Their only
  // reachable caller was `IOrchestrator`, and no generator ever called either
  // -- so removing the declarations left them dead, which `knip` reported
  // (#1556's `classMembers`, doing exactly what it was added for). The private
  // originals keep their in-file callers.

  // === Parameter Management (IOrchestrator A4) ===

  /** Set current function parameters */
  setParameters(parameters: readonly IPlannedFunctionParameter[] | null): void {
    FunctionContextManager.processParameterList(parameters, this.state);
  }

  /** Clear current function parameters */
  clearParameters(): void {
    this._clearParameters();
  }

  /**
   * Issue #1200: the `_fp` typedef name for a callback type, or null if the
   * name is not one. Exposed so renderers do not re-derive the `${name}_fp`
   * convention that `CodeGenWalker.callbackTypedefName` owns.
   */
  getCallbackTypedefName(typeName: string): string | null {
    return this.planQueries.getCallbackTypedefName(typeName);
  }

  /**
   * ADR-029 / Issues #1201, #1212: record that this function needs a callback
   * `_fp` typedef, if it does.
   *
   * The single owner of that decision. It was previously spelled out at each of
   * the four sites that emit a function -- two here, plus FunctionGenerator and
   * ScopeGenerator -- so deferring the typedefs meant changing all four, and
   * missing one left a whole construct still emitting inline. Every caller now
   * states the intent ("this function was emitted") and nothing re-derives the
   * consequences.
   */
  recordCallbackTypedef(funcName: string): void {
    if (funcName === "main") {
      return;
    }
    if (!this.isCallbackTypeReferenced(funcName)) {
      return;
    }
    const typedef = this.generateCallbackTypedef(funcName);
    if (typedef) {
      this.state.pendingCallbackTypedefs.push(typedef);
      this.state.emittedCallbackTypedefs.add(funcName);
    }
  }

  private isCallbackTypeReferenced(funcName: string): boolean {
    return this.state.callbackTypeReferences.has(funcName);
  }

  // #1322: `isCallbackTypeUsedAsFieldType` stood here, answering ADR-029's
  // nominal-typing question by scanning `this.state.callbackFieldTypes`.
  // That map holds the structs emitted SO FAR in the current file, so a struct
  // declared below the assignment, in an enclosing scope, or in an include did
  // not count -- the identity of a type depending on emission order. Pass 2.1
  // asks `this.state.symbols.structFields`, the per-file view, which holds
  // every struct the file can see before any code is generated.

  // === Scope Management (A4) ===

  setCurrentScope(name: string | null): void {
    // The assignment was written twice on main; the second was dead.
    this.state.setCurrentScopeByPath(name);
  }

  /**
   * Issue #269: Set the current function name for pass-by-value lookup.
   * Part of IOrchestrator interface.
   */
  setCurrentFunctionName(name: string | null): void {
    this.state.currentFunctionName = name;
  }

  /**
   * #1277: the facts a function body is generated against, set and
   * cleared as one. See `IOrchestrator` for why this is a pair rather than
   * calls repeated at each site.
   */
  enterFunctionContext(
    name: string,
    parameters: readonly IPlannedFunctionParameter[] | null,
  ): void {
    this.setCurrentFunctionName(name);
    this.setParameters(parameters);
    this.enterFunctionBody();
  }

  movedParameterComments(): string {
    return FunctionContextManager.movedParameterComments(this.state);
  }

  exitFunctionContext(): void {
    this.exitFunctionBody();
    this.setCurrentFunctionName(null);
    this.clearParameters();
  }

  // === Function Body Management (A4) ===

  /**
   * Enter function body - clears local variables and sets inFunctionBody flag.
   * Issue #793: Delegates to FunctionContextManager.
   */
  enterFunctionBody(): void {
    FunctionContextManager.enterFunctionBody(this.state);
  }

  /**
   * Exit function body - clears local variables and inFunctionBody flag.
   * Issue #793: Delegates to FunctionContextManager.
   */
  exitFunctionBody(): void {
    FunctionContextManager.exitFunctionBody(this.state);
  }

  /**
   * ADR-029: Generate typedef for callback type
   */
  generateCallbackTypedef(funcName: string): string | null {
    const callbackInfo = this.state.callbackTypes.get(funcName);
    if (!callbackInfo) {
      return null;
    }

    // Issue #1164: the included header already declares this one.
    if (
      this.state.declarationPlan().headerOwnsTypeDefinitions &&
      this.state.headerOwnsCallbackTypedef(funcName)
    ) {
      return null;
    }

    // Bare, with no padding of its own: the splice in generateAllDeclarations
    // decides the blank lines around the whole block, so one place owns the
    // layout instead of each typedef guessing at it.
    return CallbackTypedefFormatter.format(
      callbackInfo.returnType,
      callbackInfo.typedefName,
      callbackInfo.parameters,
      this.isCppMode(),
    );
  }

  // === Postfix Expression Helpers (Issue #644) ===

  /**
   * Check if a name is a known scope.
   * Part of IOrchestrator interface.
   */
  isKnownScope(name: string): boolean {
    return SymbolLookupHelper.isKnownScope(
      this.state.symbols?.knownScopes,
      this.state.symbolTable,
      name,
    );
  }

  /**
   * Check if a symbol is a C++ scope symbol (namespace, class, enum).
   * Part of IOrchestrator interface.
   */
  isCppScopeSymbol(name: string): boolean {
    return this.planQueries.isCppScopeSymbol(name);
  }

  /**
   * Get the separator for scope access (:: for C++, _ for cnx).
   * Part of IOrchestrator interface - delegates to FormatUtils.
   */
  getScopeSeparator(isCppAccess: boolean): string {
    return FormatUtils.getScopeSeparator(isCppAccess);
  }

  /**
   * Add a pending temp variable declaration (for float bit indexing).
   * Part of IOrchestrator interface.
   */
  addPendingTempDeclaration(declaration: string): void {
    this.state.pendingTempDeclarations.push(declaration);
  }

  /**
   * A name no other temporary in the file has.
   * Part of IOrchestrator interface.
   */
  nextTempName(): string {
    return this.state.getNextTempVarName();
  }

  /**
   * Register a float bit shadow variable.
   * Part of IOrchestrator interface.
   */
  registerFloatBitShadow(shadowName: string): void {
    this.state.floatBitShadows.add(shadowName);
  }

  /**
   * Mark a float shadow as having current value (skip redundant memcpy).
   * Part of IOrchestrator interface.
   */
  markFloatShadowCurrent(shadowName: string): void {
    this.state.floatShadowCurrent.add(shadowName);
  }

  /**
   * Check if a float shadow has been declared.
   * Part of IOrchestrator interface.
   */
  hasFloatBitShadow(shadowName: string): boolean {
    return this.state.floatBitShadows.has(shadowName);
  }

  /**
   * Check if a float shadow has current value.
   * Part of IOrchestrator interface.
   */
  isFloatShadowCurrent(shadowName: string): boolean {
    return this.state.floatShadowCurrent.has(shadowName);
  }

  /**
   * ADR-030: whether a declaration of this type is held through a pointer.
   * Part of IOrchestrator interface.
   */
  isHeldThroughPointer(typeName: string): boolean {
    return this.state.isHeldThroughPointer(typeName);
  }

  // ===========================================================================
  // End IOrchestrator Implementation
  // ===========================================================================

  // Issue #63: validateIncludeNotImplementationFile moved to TypeValidator

  // Issue #60: collectEnum and collectBitmap methods removed - now in SymbolCollector

  // Issue #63: validateBitmapFieldLiteral moved to TypeValidator
  // Issue #60: evaluateConstantExpression method removed - now in SymbolCollector

  /**
   * Clear parameter tracking when leaving a function.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _clearParameters(): void {
    FunctionContextManager.clearParameters(this.state);
  }

  // ========================================================================
  // ADR-024: Type Classification and Validation Helpers
  // ========================================================================

  // NOTE: Public isIntegerType and isFloatType moved to IOrchestrator interface
  // Private versions kept for internal use

  // ========================================================================
  // Declarations
  // ========================================================================

  // ========================================================================
  // Scope (ADR-016: Organization with visibility control)
  // ========================================================================

  // ========================================================================
  // Register Bindings (ADR-004)
  // ========================================================================

  // ========================================================================
  // Struct
  // ========================================================================

  // ========================================================================
  // Enum (ADR-017: Type-safe enums)
  // ========================================================================

  // ========================================================================
  // Functions
  // ========================================================================

  // ========================================================================
  // Variables
  // ========================================================================

  // ========================================================================
  // Variable declaration planning (#1445 box 3)
  // ========================================================================

  // Issue #792 extracted a batch of variable-declaration methods to
  // `VariableDeclHelper`. #1445 box 3 split that batch again, by what each one
  // does: the tree-reading half came back as the `plan*` methods above and the
  // rendering half stayed there.
  //
  // The list this comment used to enumerate named nine methods, one of which
  // (`_validateArrayDeclarationSyntax`) had not existed since its rejection
  // moved to 2.1 as E0874. A list of names is wrong the moment anything moves,
  // and nothing checks it -- which is why it is a sentence now.

  /**
   * Brace initializer that zero-initializes an aggregate (struct or array).
   * Issue #379 / #1004: C++ uses value-initialization ({}), which is valid for
   * any aggregate element type (POD, struct, class) including enum-first
   * structs where {0} is an invalid int->enum narrowing; C uses {0}.
   */
  getAggregateZeroInitBrace(): string {
    return this.state.cppMode ? "{}" : "{0}";
  }

  /**
   * Generate float bit write using shadow variable + memcpy.
   * Issue #644: Delegates to FloatBitHelper.
   */
  /** Public for handler access via this.state.generator */
  /**
   * Dispatched through `ICodeGenApi` via `this.state.requireGenerator()`, so
   * no call site ever names this class. knip cannot follow that indirection.
   *
   * @public
   */
  generateFloatBitWrite(bitWrite: IFloatBitWrite): string {
    return FloatBitHelper.generateFloatBitWrite(bitWrite, this.state);
  }

  // ADR-001: <- becomes = in C, with compound assignment operators
  /**
   * ADR-049: Generate atomic Read-Modify-Write operation
   * Uses LDREX/STREX on platforms that support it, otherwise PRIMASK
   */
  /** Public for handler access via this.state.generator */
  /**
   * Dispatched through `ICodeGenApi` via `this.state.requireGenerator()`, so
   * no call site ever names this class. knip cannot follow that indirection.
   *
   * @public
   */
  generateAtomicRMW(
    target: string,
    cOp: string,
    value: string,
    atomic: IPlannedAtomic,
    clampOp: string | null,
  ): string {
    const result = atomicGenerators.generateAtomicRMW(
      target,
      cOp,
      value,
      atomic,
      clampOp,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  /**
   * ADR-049 (#2200): a bit write to an `atomic` value, in the planned form.
   * Dispatched through `ICodeGenApi`, as `generateAtomicRMW` is.
   *
   * @public
   */
  generateAtomicStore(
    target: string,
    value: string,
    atomic: IPlannedAtomic,
    newValue: (read: string, value: string) => string,
  ): string {
    const result = atomicGenerators.generateAtomicStore(
      target,
      value,
      atomic,
      newValue,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  // #1322: ADR-016's access rules are E0435-E0437 in pass 2.1; `ScopeResolver`
  // is gone with them.

  // Issue #387: Dead methods removed (generateGlobalMemberAccess, generateGlobalArrayAccess,
  // generateThisMemberAccess, generateThisArrayAccess) - now handled by unified doGenerateAssignmentTarget

  // ========================================================================
  // ADR-025/027/036/068 control-flow planning (#1445 box 3)
  // ========================================================================

  // ========================================================================
  // Critical Statements (ADR-050)
  // ========================================================================

  // Issue #63: validateNoEarlyExits moved to TypeValidator

  // ========================================================================
  // Switch Statements (ADR-025)
  // ========================================================================

  // ========================================================================
  // Expressions
  // ========================================================================

  // #1322: the shift-amount check (MISRA 12.2, E0873) that Issue #63 moved
  // to TypeValidator is in pass 2.1, with the additive-type helpers that
  // existed only to feed it.

  // NOTE: generateMemberAccess and generateArrayAccess removed in grammar consolidation
  // These methods referenced MemberAccessContext and ArrayAccessContext which no longer
  // exist after unifying to assignmentTarget: IDENTIFIER postfixTargetOp*

  // ========================================================================
  // strlen Optimization - Cache repeated .length accesses
  // Issue #644: Walker methods extracted to StringLengthCounter class
  // ========================================================================

  // ========================================================================
  // Preprocessor Directive Handling (ADR-037)
  // ========================================================================
}
