/**
 * Null Check Analyzer
 * Enforces NULL safety for C library interop (ADR-046)
 *
 * cnx eliminates null bugs by design. This analyzer provides a controlled
 * exception for C interop: Variables storing nullable C pointer returns must
 * use the c_ prefix to indicate they hold C interop values.
 *
 * Rules:
 * - C functions returning nullable pointers require c_ prefix for storage
 * - NULL keyword only valid in equality comparison context (= or !=)
 * - Dynamic allocation functions (malloc, etc.) remain forbidden (ADR-003)
 */

import INullCheckError from "./types/INullCheckError";
import ProgramExpressions from "../../utils/ProgramExpressions";
import type ISourceSpan from "../../types/ISourceSpan";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ExpressionShape from "../../utils/ExpressionShape";
import StatementChildren from "../../utils/StatementChildren";
import type IFunctionDeclarationSyntax from "../../types/syntax/IFunctionDeclarationSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import type TStatement from "../../types/syntax/TStatement";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";

/**
 * Metadata for C library functions that can return NULL
 */
interface ICLibraryFunction {
  header: string;
  nullMeaning: string;
  docsUrl: string;
}

/**
 * C library functions that return nullable pointers
 * These require the c_ prefix when stored in variables (ADR-046)
 */
const NULLABLE_C_FUNCTIONS: Map<string, ICLibraryFunction> = new Map([
  // Stream I/O
  [
    "fgets",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error",
      docsUrl: "https://en.cppreference.com/w/c/io/fgets",
    },
  ],
  [
    "fputs",
    {
      header: "stdio.h",
      nullMeaning: "Write error (EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputs",
    },
  ],
  [
    "fgetc",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error",
      docsUrl: "https://en.cppreference.com/w/c/io/fgetc",
    },
  ],
  [
    "fputc",
    {
      header: "stdio.h",
      nullMeaning: "Write error (EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputc",
    },
  ],
  [
    "gets",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error (DEPRECATED)",
      docsUrl: "https://en.cppreference.com/w/c/io/gets",
    },
  ],
  // File handling (now allowed with c_ prefix)
  [
    "fopen",
    {
      header: "stdio.h",
      nullMeaning: "Failed to open file",
      docsUrl: "https://en.cppreference.com/w/c/io/fopen",
    },
  ],
  [
    "freopen",
    {
      header: "stdio.h",
      nullMeaning: "Failed to reopen",
      docsUrl: "https://en.cppreference.com/w/c/io/freopen",
    },
  ],
  [
    "tmpfile",
    {
      header: "stdio.h",
      nullMeaning: "Failed to create temp file",
      docsUrl: "https://en.cppreference.com/w/c/io/tmpfile",
    },
  ],
  // String functions
  [
    "strstr",
    {
      header: "string.h",
      nullMeaning: "Substring not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strstr",
    },
  ],
  [
    "strchr",
    {
      header: "string.h",
      nullMeaning: "Character not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strchr",
    },
  ],
  [
    "strrchr",
    {
      header: "string.h",
      nullMeaning: "Character not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strrchr",
    },
  ],
  [
    "memchr",
    {
      header: "string.h",
      nullMeaning: "Byte not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/memchr",
    },
  ],
  // Environment
  [
    "getenv",
    {
      header: "stdlib.h",
      nullMeaning: "Variable not found",
      docsUrl: "https://en.cppreference.com/w/c/program/getenv",
    },
  ],
]);

// ============================================================================
// Flow Analysis Data Structures (E0908)
// ============================================================================

/**
 * State of a nullable variable with respect to NULL checking
 */
enum NullCheckState {
  /** Variable has not been checked for NULL */
  Unchecked = "unchecked",
  /** Variable has been verified as not NULL */
  CheckedNotNull = "checked_not_null",
}

/**
 * Tracks the NULL check state of a single nullable variable
 */
interface INullableVariableState {
  /** Variable name (with c_ prefix) */
  name: string;
  /** Line where the variable was declared */
  declarationLine: number;
  /** Type name (e.g., FILE, cstring) */
  typeName: string;
  /** Current NULL check state */
  state: NullCheckState;
}

/**
 * A scope for tracking nullable variable states.
 * Scopes form a stack: function body -> if body -> nested if body, etc.
 */
interface INullCheckScope {
  /** Map of variable name to state within this scope */
  variables: Map<string, INullableVariableState>;
  /** Parent scope (null for function-level scope) */
  parent: INullCheckScope | null;
  /** If this scope is from an if-statement, tracks if it's a guard clause */
  isGuardClause: boolean;
  /** Variable being checked in the if condition (for guard clause detection) */
  guardVariable: string | null;
  /** Whether the condition was == NULL (true) or != NULL (false) */
  isNullEqualityCheck: boolean;
}

/** A bare `c_` name, the only thing a NULL check or E0908 tracks */
const NULLABLE_NAME = /^c_[a-zA-Z_]\w*$/;

/** What an `if` or `while` condition says about one `c_` variable */
interface INullCheckCondition {
  varName: string;
  /** `c_var != NULL`; false for `c_var = NULL` */
  isNotNull: boolean;
}

/**
 * Walks 1.2's syntax, not the parse tree (#1991), in source order: each
 * statement's own check runs before its parts are read, and each part's
 * checks see the comparison or declaration that holds it.
 */
class NullCheckWalk {
  private readonly analyzer: NullCheckAnalyzer;

  /** Whether we're currently inside an equality comparison (= or !=) */
  private inEqualityComparison = false;

  /** Track variable names in the current equality comparison */
  private equalityComparisonVarNames: string[] = [];

  /** Whether we're currently inside a declaration or assignment that stores a nullable call */
  private inVariableDeclarationWithNullable = false;

  /** Current scope for tracking nullable variable states (E0908) */
  private currentScope: INullCheckScope | null = null;

  /** The enclosing `if` statements, innermost last: what each one checks, and whether it returns */
  private readonly ifStack: Array<{
    varName: string | null;
    isNullCheck: boolean;
    hasReturn: boolean;
  }> = [];

  constructor(analyzer: NullCheckAnalyzer) {
    this.analyzer = analyzer;
  }

  // ========================================================================
  // Scope Management (E0908)
  // ========================================================================

  private pushScope(): void {
    this.currentScope = {
      variables: new Map(),
      parent: this.currentScope,
      isGuardClause: false,
      guardVariable: null,
      isNullEqualityCheck: false,
    };
  }

  private popScope(): void {
    if (this.currentScope) {
      this.currentScope = this.currentScope.parent;
    }
  }

  private lookupVariable(name: string): INullableVariableState | null {
    let scope = this.currentScope;
    while (scope) {
      const state = scope.variables.get(name);
      if (state) return state;
      scope = scope.parent;
    }
    return null;
  }

  /** Update a variable's state in the scope where it's defined */
  private updateVariableState(name: string, newState: NullCheckState): void {
    const state = this.lookupVariable(name);
    if (state) {
      state.state = newState;
    }
  }

  private registerNullableVariable(
    name: string,
    typeName: string,
    line: number,
  ): void {
    if (!this.currentScope) return;
    this.currentScope.variables.set(name, {
      name,
      declarationLine: line,
      typeName,
      state: NullCheckState.Unchecked,
    });
  }

  // ========================================================================
  // Declarations and statements
  // ========================================================================

  declaration(declaration: TMemberDeclaration): void {
    switch (declaration.kind) {
      case "function":
        this.function(declaration);
        return;
      case "variableDeclaration":
      case "constructorDeclaration":
        this.statement(declaration);
        return;
      default:
        for (const part of DeclarationParts.of(declaration)) {
          this.part(part);
        }
    }
  }

  private function(fn: IFunctionDeclarationSyntax): void {
    this.pushScope();
    for (const part of DeclarationParts.signature(fn)) this.part(part);
    for (const statement of fn.body.statements) {
      this.statement(statement);
    }
    this.popScope();
  }

  private statement(statement: TStatement): void {
    switch (statement.kind) {
      case "variableDeclaration":
        this.variableDeclaration(statement);
        this.ownParts(statement);
        this.inVariableDeclarationWithNullable = false;
        return;
      case "assignment":
        this.assignment(statement);
        this.ownParts(statement);
        this.inVariableDeclarationWithNullable = false;
        return;
      case "if":
        this.ifStatement(statement);
        return;
      case "while":
        this.whileStatement(statement);
        return;
      case "return":
        // An `if` that returns is a guard clause when it checks `= NULL`
        if (this.ifStack.length > 0) {
          this.ifStack.at(-1)!.hasReturn = true;
        }
        this.ownParts(statement);
        return;
      default:
        this.ownParts(statement);
        for (const child of StatementChildren.of(statement)) {
          this.statement(child);
        }
    }
  }

  private ownParts(statement: TStatement): void {
    for (const part of DeclarationParts.statement(statement)) {
      this.part(part);
    }
  }

  // ========================================================================
  // If/While Flow Analysis (E0908)
  // ========================================================================

  /** `c_var != NULL` or `c_var = NULL`, exactly; anything else checks nothing */
  private static nullCheckIn(
    condition: TExpression,
  ): INullCheckCondition | null {
    if (condition.kind !== "binary" || condition.operands.length !== 2) {
      return null;
    }
    const operator = condition.operators[0];
    const variable = condition.operands[0];
    const nullLiteral = condition.operands[1];
    if (
      (operator !== "=" && operator !== "!=") ||
      variable.kind !== "identifier" ||
      !NULLABLE_NAME.test(variable.name) ||
      nullLiteral.kind !== "literal" ||
      nullLiteral.literalKind !== "null"
    ) {
      return null;
    }
    return { varName: variable.name, isNotNull: operator === "!=" };
  }

  private ifStatement(statement: Extract<TStatement, { kind: "if" }>): void {
    const check = NullCheckWalk.nullCheckIn(statement.condition);
    const ifInfo = {
      varName: check?.varName ?? null,
      isNullCheck: check !== null && !check.isNotNull,
      hasReturn: false,
    };
    this.ifStack.push(ifInfo);
    this.expression(statement.condition);
    // The body of `if (c_var != NULL)` has the variable checked
    if (check?.isNotNull) {
      this.updateVariableState(check.varName, NullCheckState.CheckedNotNull);
    }
    this.statement(statement.whenTrue);
    if (statement.whenFalse !== null) {
      this.statement(statement.whenFalse);
    }
    this.ifStack.pop();
    // Guard clause: after `if (c_var = NULL) { return; }`, with no else, the
    // variable is known to be not null
    if (
      ifInfo.varName !== null &&
      ifInfo.isNullCheck &&
      ifInfo.hasReturn &&
      statement.whenFalse === null
    ) {
      this.updateVariableState(ifInfo.varName, NullCheckState.CheckedNotNull);
    }
  }

  private whileStatement(
    statement: Extract<TStatement, { kind: "while" }>,
  ): void {
    const check = NullCheckWalk.nullCheckIn(statement.condition);
    this.expression(statement.condition);
    // The body of `while (c_var != NULL)` has the variable checked
    if (check?.isNotNull) {
      this.updateVariableState(check.varName, NullCheckState.CheckedNotNull);
    }
    this.statement(statement.body);
  }

  // ========================================================================
  // Expressions
  // ========================================================================

  private part(part: TSyntaxPart): void {
    for (const expr of ProgramExpressions.inPart(part)) this.expression(expr);
  }

  private expression(expr: TExpression): void {
    const isComparison =
      expr.kind === "binary" &&
      expr.operators.some((op) => op === "=" || op === "!=");
    if (isComparison) {
      this.inEqualityComparison = true;
      this.equalityComparisonVarNames = expr.operands.flatMap((operand) =>
        operand.kind === "identifier" ? [operand.name] : [],
      );
    }
    if (expr.kind === "postfix") {
      this.postfix(expr);
    }
    if (expr.kind === "literal" && expr.literalKind === "null") {
      this.nullLiteral(expr);
    }
    for (const read of ProgramExpressions.readsIn(expr)) this.expression(read);
    if (isComparison) {
      this.inEqualityComparison = false;
      this.equalityComparisonVarNames = [];
    }
  }

  private postfix(expr: Extract<TExpression, { kind: "postfix" }>): void {
    if (expr.primary.kind !== "identifier") return;
    const funcName = expr.primary.name;
    if (!expr.ops.some((op) => op.kind === "call")) return;
    const span = expr.span;

    // ADR-003 is NOT decided here. This walk sees a callee's NAME and nothing
    // about what it resolved to, so it answered "you imported this from C/C++"
    // for `pool_free` and `slot_is_free` defined in the same file (#1306
    // review). Call analysis runs first, knows the difference, and halts the
    // step loop before this analyzer is reached.

    if (
      NULLABLE_C_FUNCTIONS.has(funcName) &&
      !this.inEqualityComparison &&
      !this.inVariableDeclarationWithNullable
    ) {
      // Inside a NULL comparison the call is checked; inside a declaration or
      // assignment that stores it, E0905 or the `c_` prefix already decided
      this.analyzer.reportMissingNullCheck(funcName, span);
    }

    this.checkFunctionArgumentsForUncheckedVariables(expr.ops);
  }

  /** E0908: a `c_` variable passed to a call before it is checked */
  private checkFunctionArgumentsForUncheckedVariables(
    ops: Extract<TExpression, { kind: "postfix" }>["ops"],
  ): void {
    // Skip if we're in a NULL comparison context (the check itself)
    if (this.inEqualityComparison) return;
    for (const op of ops) {
      if (op.kind !== "call") continue;
      for (const arg of op.arguments) {
        if (arg.kind !== "identifier" || !NULLABLE_NAME.test(arg.name)) {
          continue;
        }
        const varState = this.lookupVariable(arg.name);
        if (varState?.state === NullCheckState.Unchecked) {
          this.analyzer.reportMissingNullCheckBeforeUse(arg.name, arg.span);
        }
      }
    }
  }

  private nullLiteral(expr: TExpression): void {
    const span = expr.span;
    if (!this.inEqualityComparison) {
      this.analyzer.reportInvalidNullUsage(span);
      return;
    }
    // NULL in a comparison is for c_ prefixed variables or nullable functions
    for (const varName of this.equalityComparisonVarNames) {
      if (
        !NullCheckAnalyzer.hasNullablePrefix(varName) &&
        !NULLABLE_C_FUNCTIONS.has(varName)
      ) {
        this.analyzer.reportNullComparisonOnNonNullable(varName, span);
      }
    }
  }

  // ========================================================================
  // Storing a nullable call's result
  // ========================================================================

  private variableDeclaration(
    statement: Extract<TStatement, { kind: "variableDeclaration" }>,
  ): void {
    const varName = statement.name;
    const typeName = statement.type.text;
    // 1-indexed column
    const span = {
      ...statement.nameSpan,
      column: statement.nameSpan.column + 1,
    };

    // E0908: Register c_ prefixed variables for flow tracking
    if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
      this.registerNullableVariable(varName, typeName, span.line);
    }
    if (!statement.initializer) return;

    const funcName = NullCheckWalk.nullableCallIn(statement.initializer);
    if (funcName !== null) {
      this.inVariableDeclarationWithNullable = true;
      if (!NullCheckAnalyzer.hasNullablePrefix(varName)) {
        this.analyzer.reportMissingCPrefix(varName, typeName, funcName, span);
      }
      return;
    }

    // E0906: a c_ prefix needs a nullable type when no nullable call is stored
    if (
      NullCheckAnalyzer.hasNullablePrefix(varName) &&
      !NullCheckAnalyzer.isNullableCType(typeName)
    ) {
      this.analyzer.reportInvalidCPrefix(varName, typeName, span);
    }
  }

  private assignment(
    statement: Extract<TStatement, { kind: "assignment" }>,
  ): void {
    const funcName = NullCheckWalk.nullableCallIn(statement.value);
    if (funcName === null) return;
    const varName = statement.target.written;
    // ADR-046: Allow reassignment to c_ prefixed variables (e.g., in while loops)
    if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
      this.inVariableDeclarationWithNullable = true;
      // E0908: Reset state to Unchecked on reassignment from nullable function
      this.updateVariableState(varName, NullCheckState.Unchecked);
      return;
    }
    this.analyzer.reportInvalidStorage(varName, funcName, statement.span);
  }

  /**
   * The nullable C function an expression calls, if any: a bare `fgets(...)`
   * or `global.fgets(...)`. A member `obj.fgets()`, `this.fgets()` or
   * `my_fgets()` is not one; matching the joined text found them all (#1991).
   */
  private static nullableCallIn(expr: TExpression): string | null {
    const callees = new Set<string>();
    for (const node of ExpressionNodes.of({
      kind: "expression",
      expression: expr,
      constant: false,
    })) {
      if (node.kind !== "postfix") continue;
      const head = ExpressionShape.headOf(node);
      if (
        head.identifier !== null &&
        head.root !== "this" &&
        head.ops[head.opsConsumed]?.kind === "call"
      ) {
        callees.add(head.identifier.name);
      }
    }
    for (const funcName of NULLABLE_C_FUNCTIONS.keys()) {
      if (callees.has(funcName)) return funcName;
    }
    return null;
  }
}

/**
 * Analyzes cnx AST for NULL safety violations
 */
class NullCheckAnalyzer {
  private errors: INullCheckError[] = [];

  /** Analyze 1.2's syntax for NULL safety errors */
  public analyze(program: IProgramSyntax): INullCheckError[] {
    this.errors = [];
    const walk = new NullCheckWalk(this);
    for (const member of program.members) {
      walk.declaration(member.declaration);
    }
    return this.errors;
  }

  /**
   * Report error: stream function used without NULL check
   */
  public reportMissingNullCheck(funcName: string, span: ISourceSpan): void {
    this.errors.push({
      code: "E0901",
      functionName: funcName,
      span,
      message: `C library function '${funcName}' can return NULL - must check result`,
      helpText: `Use: if (${funcName}(...) != NULL) { ... }`,
    });
  }

  /**
   * Report error: NULL used outside comparison context
   */
  public reportInvalidNullUsage(span: ISourceSpan): void {
    this.errors.push({
      code: "E0903",
      functionName: "NULL",
      span,
      message: "NULL can only be used in comparison context",
      helpText: "Use: if (func(...) != NULL) or if (func(...) = NULL)",
    });
  }

  /**
   * Report error: trying to store stream function result in variable
   */
  public reportInvalidStorage(
    varName: string,
    funcName: string,
    span: ISourceSpan,
  ): void {
    this.errors.push({
      code: "E0904",
      functionName: funcName,
      span,
      message: `Cannot store '${funcName}' return value in variable '${varName}'`,
      helpText: `C library pointer returns cannot be stored. Use direct comparison: if (${funcName}(...) != NULL)`,
    });
  }

  /**
   * Report error: missing c_ prefix for nullable C type (E0905)
   */
  public reportMissingCPrefix(
    varName: string,
    typeName: string,
    funcName: string,
    span: ISourceSpan,
  ): void {
    this.errors.push({
      code: "E0905",
      functionName: funcName,
      span,
      message: `Missing 'c_' prefix for nullable C type '${typeName}'`,
      helpText: `Variable '${varName}' stores nullable pointer from '${funcName}'. Use: ${typeName} c_${varName} <- ${funcName}(...)`,
    });
  }

  /**
   * Report error: c_ prefix on non-nullable type (E0906)
   */
  public reportInvalidCPrefix(
    varName: string,
    typeName: string,
    span: ISourceSpan,
  ): void {
    this.errors.push({
      code: "E0906",
      functionName: varName,
      span,
      message: `Invalid 'c_' prefix on non-nullable type '${typeName}'`,
      helpText: `The 'c_' prefix is only for nullable C pointer types. Use: ${typeName} ${varName.substring(2)} <- ...`,
    });
  }

  /**
   * Report error: NULL comparison on non-nullable variable (E0907)
   */
  public reportNullComparisonOnNonNullable(
    varName: string,
    span: ISourceSpan,
  ): void {
    this.errors.push({
      code: "E0907",
      functionName: varName,
      span,
      message: `NULL comparison on non-nullable variable '${varName}'`,
      helpText: `Only variables with 'c_' prefix can be compared to NULL. cnx variables are never null.`,
    });
  }

  /**
   * Report error: c_ variable used without prior NULL check (E0908)
   */
  public reportMissingNullCheckBeforeUse(
    varName: string,
    span: ISourceSpan,
  ): void {
    this.errors.push({
      code: "E0908",
      functionName: varName,
      span,
      message: `Nullable variable '${varName}' used without NULL check`,
      helpText: `Check for NULL before use: if (${varName} != NULL) { ... }`,
    });
  }

  // ========================================================================
  // c_ Prefix Validation Helpers (ADR-046)
  // ========================================================================

  /**
   * Check if variable name has required c_ prefix for nullable C types
   */
  public static hasNullablePrefix(varName: string): boolean {
    return varName.startsWith("c_");
  }

  /**
   * Check if a type is a nullable C pointer type
   * Currently checks for FILE and pointer returns from NULLABLE_C_FUNCTIONS
   */
  public static isNullableCType(typeName: string): boolean {
    // FILE is always nullable
    if (typeName === "FILE") return true;
    // cstring (char*) from C functions is nullable
    if (typeName === "cstring") return true;
    // Pointer types from C headers
    if (typeName.endsWith("*")) return true;
    return false;
  }
}

export default NullCheckAnalyzer;
