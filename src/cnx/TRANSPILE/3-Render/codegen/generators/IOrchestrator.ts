import type IPlanQueries from "../../../2-Plan/types/IPlanQueries";
/**
 * Interface that CodeGenerator implements to orchestrate generators.
 *
 * Provides:
 * - Access to read-only input and current state
 * - Effect processing to update mutable state
 * - Utility methods needed by generators
 * - Code generation delegation methods
 *
 * This abstraction enables:
 * - Testing generators with mock orchestrators
 * - Gradual migration via "strangler fig" pattern
 */
import type IPlannedFunctionParameter from "../../../2-Plan/types/IPlannedFunctionParameter";
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import TGeneratorEffect from "./TGeneratorEffect";
import type TranspileState from "../../../TranspileState";

interface IOrchestrator extends IPlanQueries {
  /**
   * 2.3 Render's per-file working state (#1452 box 4).
   *
   * A generator that already receives its orchestrator reads state from it
   * rather than from a static class -- which also keeps the generator
   * testable without installing a global, as `CastExprGenerator`'s unit tests
   * demonstrated when the ambient route was tried there first.
   */
  readonly state: TranspileState;

  // === State Access ===

  /** Get the immutable input context */
  getInput(): IGeneratorInput;

  /** Get a snapshot of the current generation state */
  getState(): IGeneratorState;

  // === Effect Processing ===

  /** Process effects returned by a generator, updating internal state */
  applyEffects(effects: readonly TGeneratorEffect[]): void;

  // === Utilities ===

  /** Get the current indentation string */
  getIndent(): string;

  // === Expression Generation ===
  // These methods allow extracted generators to call back into CodeGenerator
  // for parts not yet extracted, enabling incremental "strangler fig" migration.

  // === Type Utilities ===

  /** Check if a type name is a known struct */
  isKnownStruct(typeName: string): boolean;

  /** Check if a type is a float type (f32, f64, float, double) */
  isFloatType(typeName: string): boolean;

  /** Check if a type is an integer type */
  isIntegerType(typeName: string): boolean;

  /** Check if a function is defined in cnx (vs C headers) */
  isCnxFunction(name: string): boolean;

  /**
   * Brace that zero-initializes a whole aggregate -- `{}` in C++, `{0}` in C.
   * #1568: the ADR-029 init function needs it for the struct as a whole, and
   * this is the one place that decision is made.
   */
  getAggregateZeroInitBrace(): string;

  /**
   * #1283: the ADR-029 default of a struct, repeated over `counts` (each
   * dimension's element count, `ElementCount`) for an array, or null when the
   * struct's default is all zero. One spelling for every declaration site and
   * for the generated `<Struct>_init()`.
   */
  renderStructDefault(
    structName: string,
    counts: readonly (number | null)[],
  ): string | null;

  // === Expression Analysis ===

  // === Function Call Helpers ===

  /** Get known enums set for pass-by-value detection */
  getKnownEnums(): ReadonlySet<string>;

  /** Issue #304: Check if we're generating C++ output */
  isCppMode(): boolean;

  /** Issue #304: Check if a type is a C++ enum class (needs :: syntax and explicit casts) */
  isCppEnumClass(typeName: string): boolean;

  // === Statement Generation ===

  /**
   * Issue #250: Flush pending temp variable declarations.
   * Returns declarations as a single string and clears the pending list.
   * Used by control flow generators to capture temps from conditions
   * before generating loop/if bodies.
   */
  flushPendingTempDeclarations(): string;

  /** Get indentation string for current level */
  indent(text: string): string;

  // === Control Flow Helpers ===

  // === strlen Optimization ===

  // #1445 box 3: the two counting members that stood here --
  // `countStringLengthAccesses(ExpressionContext)` and
  // `countBlockLengthAccesses(BlockContext, ...)` -- were named by this
  // interface only so `ControlFlowGenerator` could ask a tree a question. It
  // plans now, and the planner calls `StringLengthCounter` directly, so two of
  // this interface's parse-typed members are gone with them.

  /**
   * Setup length cache and return declarations. Each counted name is measured,
   * and keyed, as `renderOperand` renders it.
   */
  setupLengthCache(
    counts: Map<string, number>,
    renderOperand: (name: string) => string,
  ): string;

  /** Clear length cache */
  clearLengthCache(): void;

  // === Declaration Generation ===

  /** Get the length of a string literal (excluding quotes and null terminator) */
  getStringLiteralLength(literal: string): number;

  // === Parameter Management ===

  /** Set current function parameters for pointer semantics (ADR-006) */
  setParameters(parameters: readonly IPlannedFunctionParameter[] | null): void;

  /** Clear current function parameters */
  clearParameters(): void;

  /**
   * Issue #1200: the `_fp` typedef name for a callback type, or null if the
   * name is not one. Exposed so renderers do not re-derive the `${name}_fp`
   * convention that `CodeGenWalker.callbackTypedefName` owns.
   */
  getCallbackTypedefName(typeName: string): string | null;

  /**
   * ADR-029 / Issues #1201, #1212: record that this function needs a callback
   * `_fp` typedef, if it does. Callers state that a function was emitted; where
   * the typedef goes and whether it is needed belong to the implementation.
   */
  recordCallbackTypedef(funcName: string): void;

  // === Scope Management ===

  /** Set the current scope name for prefixing */
  setCurrentScope(name: string | null): void;

  /** Issue #269: Set the current function name for pass-by-value lookup */
  setCurrentFunctionName(name: string | null): void;

  /**
   * #1277: enter/leave the context a function body is generated in -- its
   * name and its parameters (2.2 plans what a `return` is written against, #1991).
   *
   * One pair rather than four calls at each site. `FunctionGenerator` and
   * `ScopeGenerator` each open-coded the same four steps in the same order,
   * and the scope copy was missing `setCurrentFunctionReturnType`, so no
   * `return` inside a scope method knew what type it returned: a bare enum
   * member could not resolve there and a struct literal could not be typed.
   * A fifth fact is now one edit, not two that have to be remembered together.
   */
  enterFunctionContext(
    name: string,
    parameters: readonly IPlannedFunctionParameter[] | null,
  ): void;

  /**
   * #1643 review: one comment per parameter of the function being generated
   * whose C name moved (ADR-057), for above its definition
   */
  movedParameterComments(): string;

  exitFunctionContext(): void;

  // === Function Body Management ===

  /** Enter function body - clears local variables and sets inFunctionBody flag */
  enterFunctionBody(): void;

  /** Exit function body - clears local variables and inFunctionBody flag */
  exitFunctionBody(): void;

  /** Generate callback typedef for a function */

  // === Postfix Expression Helpers (Issue #644) ===

  /** Check if a name is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if a symbol is a C++ scope symbol (namespace, class, enum) */
  isCppScopeSymbol(name: string): boolean;

  /** Add a pending temp variable declaration (for float bit indexing) */
  addPendingTempDeclaration(declaration: string): void;

  /** A name no other temporary in the file has */
  nextTempName(): string;

  /** Register a float bit shadow variable */
  registerFloatBitShadow(shadowName: string): void;

  /** Mark a float shadow as having current value (skip redundant memcpy) */
  markFloatShadowCurrent(shadowName: string): void;

  /** Check if a float shadow has been declared */
  hasFloatBitShadow(shadowName: string): boolean;

  /** Check if a float shadow has current value */
  isFloatShadowCurrent(shadowName: string): boolean;

  // === Issue #948: Opaque Type Helpers ===

  /**
   * ADR-030: whether a declaration of this type is held through a pointer.
   * The one answer every declaration site reads -- see
   * `TranspileState.isHeldThroughPointer`.
   */
  isHeldThroughPointer(typeName: string): boolean;
}

export default IOrchestrator;
