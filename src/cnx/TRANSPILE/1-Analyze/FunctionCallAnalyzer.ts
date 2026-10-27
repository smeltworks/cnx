/**
 * Function Call Analyzer
 * Enforces define-before-use for functions (ADR-030)
 *
 * cnx requires functions to be defined before they can be called.
 * This catches errors at cnx compile time rather than deferring to
 * the C compiler or runtime.
 */

import type ISourceSpan from "../../types/ISourceSpan";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IFunctionDeclarationSyntax from "../../types/syntax/IFunctionDeclarationSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TStatement from "../../types/syntax/TStatement";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementChildren from "../../utils/StatementChildren";
import TypeParts from "../../utils/TypeParts";
import IFunctionCallError from "./types/IFunctionCallError";
import AdrProvenance from "../../instrumentation/AdrProvenance";
import DynamicAllocation from "./DynamicAllocation";
import StdlibFunctions from "./StdlibFunctions";
import CalleeNameResolver from "./helpers/CalleeNameResolver";
import ScopeUtils from "../../utils/ScopeUtils";
import IncludeDirective from "./helpers/IncludeDirective";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TSymbol from "../../types/symbols/TSymbol";
import invariant from "../../utils/invariant";

/**
 * cnx built-in functions
 * These are compiler intrinsics that don't need to be defined by the user
 */
const CNX_BUILTINS: Set<string> = new Set(StdlibFunctions.builtinNames());

/**
 * #1991: walks 1.2's syntax, not the parse tree, in source order -- a function
 * is defined from its own declaration onward (ADR-030), and a callable
 * variable from its declaration onward (ADR-040), so each call is checked
 * against only what precedes it.
 */
class FunctionCallWalk {
  constructor(private readonly analyzer: FunctionCallAnalyzer) {}

  declaration(declaration: TMemberDeclaration, scope: string): void {
    switch (declaration.kind) {
      case "function":
        this.function(declaration, scope);
        return;
      case "variableDeclaration":
      case "constructorDeclaration":
        this.statements([declaration], scope);
        return;
      default:
        for (const part of DeclarationParts.of(declaration)) {
          this.part(part, scope);
        }
    }
  }

  private function(fn: IFunctionDeclarationSyntax, scope: string): void {
    const symbol = this.analyzer.memberOf(scope, fn.name);
    invariant(
      symbol !== undefined,
      "3-Declare declares every function defined",
    );
    const fullName = symbol.fullyQualifiedCName;
    this.analyzer.enterFunction(fullName);
    this.analyzer.defineFunction(fullName);
    this.part({ kind: "type", type: fn.returnType }, scope);
    for (const parameter of fn.parameters ?? []) {
      this.defineIfCallable(parameter.type.text, parameter.name, scope);
      this.part({ kind: "type", type: parameter.type }, scope);
      for (const part of TypeParts.dimensions(parameter.dimensions)) {
        this.part(part, scope);
      }
    }
    this.statements(fn.body.statements, scope);
    this.analyzer.exitFunction();
  }

  /** Each declaration defines its callable name before its own initializer */
  private statements(statements: readonly TStatement[], scope: string): void {
    for (const statement of statements) {
      if (statement.kind === "variableDeclaration") {
        this.defineIfCallable(statement.type.text, statement.name, scope);
      }
      if (
        statement.kind === "for" &&
        statement.init?.kind === "variableDeclaration"
      ) {
        this.defineIfCallable(
          statement.init.type.text,
          statement.init.name,
          scope,
        );
      }
      for (const part of DeclarationParts.statement(statement)) {
        this.part(part, scope);
      }
      this.statements(StatementChildren.of(statement), scope);
    }
  }

  private part(part: TSyntaxPart, scope: string): void {
    for (const node of ExpressionNodes.of(part)) {
      if (node.kind === "postfix") this.call(node, scope);
    }
  }

  private call(
    expr: Extract<TExpression, { kind: "postfix" }>,
    scope: string,
  ): void {
    const baseName = CalleeNameResolver.baseName(expr.primary);
    if (!baseName) return;
    const target = CalleeNameResolver.resolveCallTarget(
      expr.ops,
      baseName,
      scope,
      (name) => this.analyzer.isScope(name),
    );
    if (!target.foundCall) return;
    this.analyzer.checkFunctionCall(
      target.resolvedName,
      expr.span,
      scope,
      target.isGlobalCall,
    );
  }

  /** ADR-040: a variable of a callback, ISR or C function-pointer type */
  private defineIfCallable(
    typeName: string,
    name: string,
    scope: string,
  ): void {
    if (
      typeName === "ISR" ||
      this.analyzer.isCallbackMember(scope, typeName) ||
      this.analyzer.isCallbackType(typeName) ||
      this.analyzer.isCFunctionPointerTypedef(typeName)
    ) {
      this.analyzer.defineCallableVariable(name);
    }
  }
}

/**
 * Analyzes cnx AST for function calls before definition
 */
class FunctionCallAnalyzer {
  private errors: IFunctionCallError[] = [];

  /** Functions that have been defined (in order of appearance) */
  private definedFunctions: Set<string> = new Set();

  /** All functions that will be defined in this file (for distinguishing local vs cross-file) */
  private allLocalFunctions: Set<string> = new Set();

  /** Known scopes (for Scope.member -> Scope_member resolution) */
  private knownScopes: Set<string> = new Set();

  /** Included headers (for stdlib function lookup) */
  private includedHeaders: Set<string> = new Set();

  /** Current function being defined (for self-recursion detection) */
  private currentFunctionName: string | null = null;

  /** ADR-040: Variables of type ISR or callback types that can be invoked */
  private callableVariables: Set<string> = new Set();

  /** #1456: the 2.1 context is the one channel to the symbol table (#1659). */
  public constructor(private readonly context: IAnalysisContext) {}

  /**
   * Analyze a parsed program for function call errors
   * @param tree The parsed program AST
   * @param program 1.2's syntax for the same file
   * @returns Array of function call errors
   */
  public analyze(program: IProgramSyntax): IFunctionCallError[] {
    this.errors = [];
    this.definedFunctions = new Set();
    this.allLocalFunctions = new Set();
    this.knownScopes = new Set();
    this.includedHeaders = new Set();
    this.currentFunctionName = null;
    this.callableVariables = new Set();

    // First pass: collect scope names, includes, and all local functions --
    // which ADR-029 also makes the set of callback types (see isCallbackType).
    this.collectScopes(program);
    this.collectIncludes(program);
    this.collectAllLocalFunctions(program);
    const walk = new FunctionCallWalk(this);
    for (const member of program.members) {
      walk.declaration(member.declaration, member.scope ?? "");
    }
    return this.errors;
  }

  /**
   * Collect scope names for member function resolution
   */
  private collectScopes(program: IProgramSyntax): void {
    for (const member of program.declarations) {
      if (member.declaration.kind === "scope") {
        this.knownScopes.add(member.declaration.name);
      }
    }
  }

  /**
   * Collect included headers for stdlib function lookup
   */
  private collectIncludes(program: IProgramSyntax): void {
    // #1322: one parse, shared with ADR-010's own rules. The spelling that
    // stood here matched the two delimiters independently, so `<foo.h"` read
    // as an include.
    for (const path of IncludeDirective.pathsIn(program)) {
      this.includedHeaders.add(path);
    }
  }

  /**
   * Check if a function is from an included standard library header
   */
  private isStdlibFunction(name: string): boolean {
    const header = StdlibFunctions.header(name);
    return header !== null && this.includedHeaders.has(header);
  }

  /**
   * Issue #787: Find which header a stdlib function belongs to (if any).
   * Returns the header name if found, or null if not a known stdlib function.
   * Checks ALL stdlib functions, not just from included headers.
   */
  private findStdlibHeader(name: string): string | null {
    return StdlibFunctions.header(name);
  }

  /**
   * What path a scope NAME has, from the 2.1 context's program. Falling back
   * to the bare name is what the program does for a name it has not seen.
   */
  private scopePathOf(scopeName: string): string {
    return this.context.program.scopePathOf(scopeName);
  }

  /**
   * Issue #786: Pre-collect all function names defined in this file.
   * Used to distinguish between local functions (subject to define-before-use)
   * and cross-file functions from includes (allowed without local definition).
   *
   * Scope members are keyed by their transpiled C name. #1472: the set that
   * preceded this one walked `tree.declaration()` alone and silently omitted
   * every scope member.
   */
  private collectAllLocalFunctions(program: IProgramSyntax): void {
    for (const { declaration, scope } of program.members) {
      if (declaration.kind !== "function") continue;
      this.allLocalFunctions.add(
        scope === null
          ? declaration.name
          : ScopeUtils.qualifyInScope(
              declaration.name,
              this.scopePathOf(scope),
            ),
      );
    }
  }

  /**
   * ADR-029: Check if a type name is a callback type (function-as-type).
   *
   * Reads `allLocalFunctions` rather than a set of its own. ADR-029 makes EVERY
   * function declaration a type, so "the callback types this file declares" and
   * "the functions this file declares" are one fact, and a second derivation of
   * it could only ever agree by coincidence -- which it did not (#1472). The set
   * this replaced walked `tree.declaration()` alone, so it silently omitted
   * every scope member, while the collector it sat beside walked them
   * correctly.
   *
   * #1491: the answer is NOT `allLocalFunctions` alone. That set exists to
   * EXCLUDE cross-file functions, because ADR-030 define-before-use (#786)
   * needs exactly that distinction -- so asking it "is this callable here?"
   * asked one set two questions, and a variable typed by an INCLUDED
   * function-as-type was rejected with E0422 "called before definition" for
   * valid cnx. ADR-029 draws no line at the include boundary.
   *
   * The second reading is the per-file VISIBLE set, not a second derivation of
   * the first: `functionReturnTypes` is authored once by TSymbolInfoAdapter for
   * every function regardless of return type, carried across the include
   * boundary by `mergeExternalSymbols` on the same terms as the type-forming
   * kinds (#1333), and keyed by transpiled C name -- which is the key this
   * method is given. `allLocalFunctions` is left untouched and keeps answering
   * the ordering question it exists for.
   *
   * @param name The lookup key, already qualified by the caller -- see
   *             `FunctionCallListener.isCallbackTypeHere`.
   */
  /**
   * The symbol 3-Declare made for `name` in `scope` ("" for file scope), so a
   * site reads its `fullyQualifiedCName` instead of encoding one (#2116).
   */
  public memberOf(scope: string, name: string): TSymbol | undefined {
    return this.context.program.memberOf(
      scope === "" ? "" : this.scopePathOf(scope),
      name,
    );
  }

  /** ADR-029: `name`, written in `scope`, names a callback type it declares */
  public isCallbackMember(scope: string, name: string): boolean {
    const member = this.memberOf(scope, name);
    return (
      member !== undefined && this.isCallbackType(member.fullyQualifiedCName)
    );
  }

  public isCallbackType(name: string): boolean {
    return (
      this.allLocalFunctions.has(name) ||
      this.context.symbols.functionReturnTypes.has(name)
    );
  }

  /**
   * Check if a type name is a C function pointer typedef.
   * Looks up the type in the symbol table and checks if it's a typedef
   * whose underlying type contains "(*)" indicating a function pointer.
   */
  public isCFunctionPointerTypedef(typeName: string): boolean {
    return this.context.symbolTable.isCFunctionPointerTypedef(typeName);
  }

  /**
   * ADR-040: Register a variable that holds a callable (ISR or callback)
   */
  public defineCallableVariable(name: string): void {
    this.callableVariables.add(name);
  }

  /**
   * Register a function as defined
   */
  public defineFunction(name: string): void {
    this.definedFunctions.add(name);
  }

  /**
   * Track entering a function definition (for self-recursion detection)
   */
  public enterFunction(name: string): void {
    this.currentFunctionName = name;
  }

  /**
   * Track exiting a function definition
   */
  public exitFunction(): void {
    this.currentFunctionName = null;
  }

  /**
   * Check if a function name is a known scope
   */
  public isScope(name: string): boolean {
    return this.knownScopes.has(name);
  }

  /**
   * Whether `name` resolves to something DEFINED IN cnx at this call site.
   *
   * This is the boundary ADR-003's diagnostic keys on. A name answering true
   * here is the author's own code and cannot have been imported from anywhere,
   * so the "importing ... from C/C++" message must never reach it.
   *
   * The branches are grouped rather than left inline so that claim is
   * STRUCTURAL. Spread through `checkFunctionCall` they were four returns among
   * seven, correct only while nobody inserted a check between them -- and the
   * regression this fixes came from a second analyzer asking the ADR-003
   * question with none of this context at all, so a cnx `pool_free` was told
   * it came from a header (#1306 review).
   */
  private resolvesToCnxDefinition(
    name: string,
    line: number,
    currentScopePath: string,
    isGlobalCall: boolean,
  ): boolean {
    if (this.definedFunctions.has(name)) {
      return true; // defined before use
    }
    if (CNX_BUILTINS.has(name)) {
      return true;
    }
    // ADR-040: an ISR or callback variable being invoked.
    if (this.callableVariables.has(name)) {
      return true;
    }

    // ADR-057: an unqualified call to a member of the enclosing scope --
    // `helper()` for `this.helper()`. Skipped for `global.` calls, which
    // explicitly mean global scope.
    const qualifiedName = CalleeNameResolver.scopeQualifiedCandidate(
      name,
      currentScopePath,
      isGlobalCall,
    );
    if (qualifiedName !== null) {
      if (this.definedFunctions.has(qualifiedName)) {
        // #1241: the enclosing scope resolved a bare call -- ADR-057's rule
        // firing at a position. Recorded HERE, where the candidate is
        // CONFIRMED, not at `scopeQualifiedCandidate`, which only proposes one:
        // recording the proposal would credit a cell for a name that went on to
        // resolve somewhere else entirely.
        AdrProvenance.record("057", line);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a function call is valid (function is defined or external)
   * @param name The function name being called
   * @param span Where the call is written
   * @param currentScopePath Path of the scope enclosing the call; `""` at file scope
   * @param isGlobalCall Whether the call used global. prefix
   */
  public checkFunctionCall(
    name: string,
    span: ISourceSpan,
    currentScopePath: string,
    isGlobalCall: boolean = false,
  ): void {
    // Check for self-recursion (MISRA C:2012 Rule 17.2)
    if (this.currentFunctionName && name === this.currentFunctionName) {
      this.errors.push({
        code: "E0423",
        functionName: name,
        span,
        message: `recursive call to '${name}' is forbidden (MISRA C:2012 Rule 17.2)`,
      });
      return;
    }

    // Everything the author wrote themselves, in one group -- see the method.
    if (
      this.resolvesToCnxDefinition(
        name,
        span.line,
        currentScopePath,
        isGlobalCall,
      )
    ) {
      return; // OK - the author's own code
    }

    // ADR-003. THE place this is decided. Below this line the callee is a C or
    // C++ symbol or resolves to nothing at all, so "imported from C/C++" is
    // true by construction rather than by assumption -- which is what the
    // diagnostic's wording claims and what the previous site could not know.
    //
    // It also has to sit above `isStdlibFunction`, or `#include <stdlib.h>`
    // would resolve `malloc` and legalize the heap, and above the E0422 hint
    // below, which otherwise answers an unresolved `malloc` with "available
    // from stdlib.h -- try global.malloc()": the transpiler directing the
    // author to write the include it then rejects them for (#1306 review).
    if (DynamicAllocation.matches(name)) {
      this.errors.push({
        code: DynamicAllocation.CODE,
        functionName: name,
        span,
        message: DynamicAllocation.message(name),
        helpText: DynamicAllocation.helpText(name),
      });
      return;
    }

    // Check if function is from an included standard library header
    if (this.isStdlibFunction(name)) {
      return; // OK - standard library function
    }

    // Check if function is external (from symbol table)
    if (
      this.isExternalFunction(name, span.line, currentScopePath, isGlobalCall)
    ) {
      return; // OK - external C/C++ function
    }

    // Not defined - report error with optional hint
    // If the function is local (defined later in this file), it's a
    // define-before-use error regardless of global. prefix
    const isLocalFunction = this.allLocalFunctions.has(name);
    const header = this.findStdlibHeader(name);
    const message = this.buildUndefinedFunctionMessage(
      name,
      header,
      isGlobalCall && !isLocalFunction,
    );

    this.errors.push({
      code: "E0422",
      functionName: name,
      span,
      message,
    });
  }

  /**
   * Issue #985: Build error message for undefined function calls.
   * Adjusts hint based on whether the call used global. prefix.
   */
  private buildUndefinedFunctionMessage(
    name: string,
    header: string | null,
    isGlobalCall: boolean,
  ): string {
    if (isGlobalCall && header) {
      return `'${name}' is not declared in any included header; add #include <${header}>`;
    }
    if (isGlobalCall) {
      return `'${name}' is not declared in any included header`;
    }
    let message = `function '${name}' called before definition`;
    if (header) {
      message += `; hint: '${name}' is available from ${header} — try global.${name}()`;
    }
    return message;
  }

  /**
   * Check if a function is defined externally (from included files)
   * This includes C/C++ headers AND cnx includes.
   *
   * Issue #786: Only considers a function "external" if it's NOT defined
   * in the current file. Functions defined locally are subject to
   * define-before-use checking, even if they exist in the SymbolTable.
   */
  private isExternalFunction(
    name: string,
    line: number,
    currentScopePath: string,
    isGlobalCall: boolean,
  ): boolean {
    // If the function is defined in this file, it's not external
    // (even if it's also in the SymbolTable from symbol collection)
    if (this.allLocalFunctions.has(name)) {
      return false;
    }

    // Looked up by C name, so a bare `helper` never matches `Test__helper`.
    // ADR-057: a bare call inside a scope may name a member of that scope
    // declared in an included file -- the same rule `resolvesToCnxDefinition`
    // applies to this file's members.
    const scoped = CalleeNameResolver.scopeQualifiedCandidate(
      name,
      currentScopePath,
      isGlobalCall,
    );
    if (scoped !== null) {
      // ADR-030: this file's own member, defined later, is not external (#786)
      if (this.allLocalFunctions.has(scoped)) {
        return false;
      }
      if (this.namesExternalFunction(scoped)) {
        AdrProvenance.record("057", line);
        return true;
      }
    }
    if (this.namesExternalFunction(name)) {
      return true;
    }

    // Issue #985 recovery: a function-like MACRO recovered by translation-unit
    // preprocessing (e.g. FreeRTOS pdMS_TO_TICKS). Recovered functions are
    // registered as full symbols (found above by C name); macros have no
    // declaration to parse, so only their name is known.
    if (this.context.symbolTable.hasExternalDeclaration(name)) {
      return true;
    }

    return false;
  }

  /**
   * Whether the run-wide table holds a function with this C name. That table
   * holds C/C++ headers' functions, included .cnx files', and also this file's
   * own and its includer's: callers rule out this file's own first (#786), and
   * whether an includer's member is reachable is #1865.
   */
  private namesExternalFunction(cName: string): boolean {
    return this.context.symbolTable
      .getOverloadsByCName(cName)
      .some((sym) => sym.kind === "function");
  }
}

export default FunctionCallAnalyzer;
