/**
 * Initialization Analyzer
 * Detects use of uninitialized variables (Rust-style E0381 errors)
 *
 * Phases:
 * 1. Linear code tracking
 * 2. Control flow (if/else branches)
 * 3. Loop analysis
 * 4. Bindings from 1.4 (`IProgram.bindValue`, #2004)
 * 5. Function parameters (always initialized)
 * 7. Per-field struct tracking
 */

import LengthProperty from "../../utils/LengthProperty";
import ProgramExpressions from "../../utils/ProgramExpressions";
import type ISourceSpan from "../../types/ISourceSpan";
import IInitializationError from "./types/IInitializationError";
import IDeclarationInfo from "./types/IDeclarationInfo";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import ScopeUtils from "../../utils/ScopeUtils";
import ExpressionShape from "../../utils/ExpressionShape";
import StatementChildren from "../../utils/StatementChildren";
import StatementWrites from "../../utils/StatementWrites";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionChildren from "../../utils/ExpressionChildren";
import TypeParts from "../../utils/TypeParts";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type IFunctionDeclarationSyntax from "../../types/syntax/IFunctionDeclarationSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type TExpression from "../../types/syntax/TExpression";
import invariant from "../../utils/invariant";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type TChainRoot from "../../types/TChainRoot";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TStatement from "../../types/syntax/TStatement";
import type IAnalysisContext from "./types/IAnalysisContext";

/**
 * #2004: what initialization state is kept for -- the declaration 1.4 binds a
 * spelling to: a function-local declaration itself, or a file-scope variable
 * or scope member by its C name
 */
type TInitKey = ILocalDeclaration | string;

/**
 * Tracks the initialization state of a variable
 */
interface IVariableState {
  /** Where the variable was declared */
  declaration: IDeclarationInfo;
  /** Whether the variable has been initialized */
  initialized: boolean;
  /** Type of the variable (for struct field tracking) */
  typeName: string | null;
  /** For structs: which fields have been initialized */
  initializedFields: Set<string>;
  /** Is this a struct type? */
  isStruct: boolean;
  /** Is this a string type? (string<N> or string) */
  isStringType: boolean;
}

/**
 * Walks 1.2's syntax, not the parse tree (#1991), in source order. A
 * declaration or assignment is recorded before its own parts are read, and
 * each `if`, `while` and `for` saves the state before it and decides after it
 * which of its body's assignments to keep.
 */
class InitializationWalk {
  private readonly analyzer: InitializationAnalyzer;

  /** Inside a call's arguments, reads are not checked: a call may initialize them */
  private inFunctionCallArgs: number = 0;

  constructor(analyzer: InitializationAnalyzer) {
    this.analyzer = analyzer;
  }

  declaration(declaration: TMemberDeclaration): void {
    switch (declaration.kind) {
      case "function":
        this.function(declaration);
        return;
      default:
        for (const part of DeclarationParts.of(declaration)) {
          this.part(part);
        }
    }
  }

  private function(fn: IFunctionDeclarationSyntax): void {
    for (const part of DeclarationParts.signature(fn)) this.part(part);
    this.statements(fn.body.statements);
  }

  private statements(statements: readonly TStatement[]): void {
    for (const statement of statements) {
      this.statement(statement);
    }
  }

  private statement(statement: TStatement): void {
    switch (statement.kind) {
      case "variableDeclaration":
        this.declare(statement);
        this.variableParts(statement);
        return;
      case "assignment":
        this.recordAssignment(statement);
        this.assignmentParts(statement);
        return;
      case "if": {
        const stateBefore = this.analyzer.cloneScopeState();
        this.expression(statement.condition);
        this.statement(statement.whenTrue);
        if (statement.whenFalse === null) {
          // No else: the branch may not run, so its assignments don't count
          this.analyzer.restoreFromState(stateBefore);
        } else {
          // Optimistic, and unsound (#2059): what EITHER arm assigned is kept,
          // so a variable assigned in one arm only reads as initialized. A
          // precise analysis would keep what both arms assigned.
          this.statement(statement.whenFalse);
        }
        return;
      }
      case "while": {
        const stateBeforeLoop = this.analyzer.cloneScopeState();
        this.expression(statement.condition);
        this.statement(statement.body);
        // The body may not run at all
        this.analyzer.restoreFromState(stateBeforeLoop);
        return;
      }
      case "for":
        this.forStatement(statement);
        return;
      case "doWhile":
        // The body runs before the condition is read
        this.statements(statement.body.statements);
        this.expression(statement.condition);
        return;
      default:
        for (const part of DeclarationParts.statement(statement)) {
          this.part(part);
        }
        this.statements(StatementChildren.of(statement));
    }
  }

  private forStatement(loop: Extract<TStatement, { kind: "for" }>): void {
    const stateBeforeLoop = this.analyzer.cloneScopeState();
    // The init and update are not declarations or assignments this tracks;
    // only what they read is checked
    if (loop.init?.kind === "variableDeclaration") {
      this.variableParts(loop.init);
    } else if (loop.init) {
      this.assignmentParts(loop.init);
    }
    if (loop.condition) {
      this.expression(loop.condition);
    }
    if (loop.update) {
      this.assignmentParts(loop.update);
    }
    this.statement(loop.body);
    // A loop that certainly runs keeps what its body assigned
    if (InitializationWalk.isDeterministicForLoop(loop)) {
      this.analyzer.mergeInitializationState(stateBeforeLoop);
    } else {
      this.analyzer.restoreFromState(stateBeforeLoop);
    }
  }

  /** `for (i <- 0; i < N; ...)` with a literal N > 0: the body runs at least once */
  private static isDeterministicForLoop(
    loop: Extract<TStatement, { kind: "for" }>,
  ): boolean {
    const init = loop.init;
    const condition = loop.condition;
    if (!init || !condition) return false;
    const start = init.kind === "assignment" ? init.value : init.initializer;
    if (!InitializationWalk.isLiteral(start, /^0$/)) return false;
    if (
      condition.kind !== "binary" ||
      condition.operators.length !== 1 ||
      condition.operators[0] !== "<"
    ) {
      return false;
    }
    const left = condition.operands[0];
    const bound = condition.operands[1];
    return (
      left.kind === "identifier" &&
      InitializationWalk.isLiteral(bound, /^\d+$/) &&
      Number.parseInt(bound.written, 10) > 0
    );
  }

  private static isLiteral(
    expression: TExpression | null,
    text: RegExp,
  ): boolean {
    return expression?.kind === "literal" && text.test(expression.text);
  }

  // ========================================================================
  // Declarations and assignments
  // ========================================================================

  /** A local; globals and scope members are declared before the walk */
  private declare(
    statement: Extract<TStatement, { kind: "variableDeclaration" }>,
  ): void {
    const key = this.analyzer.framedDeclaration(statement.nameSpan);
    invariant(
      key !== null,
      `1.4 frames every declaration in a function body ('${statement.name}')`,
    );
    this.analyzer.declareVariable(
      key,
      {
        name: statement.name,
        line: statement.span.line,
        column: statement.span.column,
      },
      statement.initializer !== null,
      InitializationAnalyzer.userTypeName(statement.type),
      statement.type.kind === "string",
    );
  }

  private variableParts(declaration: IVariableDeclarationSyntax): void {
    this.part({ kind: "type", type: declaration.type });
    for (const part of TypeParts.dimensions(declaration.dimensions)) {
      this.part(part);
    }
    if (declaration.initializer) {
      this.expression(declaration.initializer);
    }
  }

  private recordAssignment(assignment: IAssignmentSyntax): void {
    const head = ExpressionShape.headOf(assignment.target);
    if (!head.identifier) return;
    const name = head.identifier.name;
    const key = this.analyzer.bindingKey(
      head.root,
      name,
      assignment.target.span,
    );
    if (key === null) return;
    const fieldName = InitializationWalk.fieldOf(
      head.ops.slice(head.opsConsumed),
    );
    // A compound assignment (`+<-`) reads the target first
    if (assignment.operator !== "<-") {
      this.analyzer.checkRead(key, name, assignment.span, fieldName);
    }
    this.analyzer.recordAssignment(key, fieldName);
  }

  /** `s.field <- v` assigns that field; through a subscript, the whole variable */
  private static fieldOf(ops: readonly TPostfixOpSyntax[]): string | undefined {
    const first = ops[0];
    if (first?.kind !== "member") return undefined;
    return ops.every((op) => op.kind === "member") ? first.name : undefined;
  }

  /** What an assignment reads: its target's subscripts, then its value */
  private assignmentParts(assignment: IAssignmentSyntax): void {
    const head = ExpressionShape.headOf(assignment.target);
    this.ops(head.ops.slice(head.opsConsumed));
    this.expression(assignment.value);
  }

  // ========================================================================
  // Reads
  // ========================================================================

  private part(part: TSyntaxPart): void {
    for (const expr of ProgramExpressions.inPart(part)) this.expression(expr);
  }

  private expression(expr: TExpression): void {
    if (expr.kind === "identifier") {
      this.read(expr.name, expr.span, []);
      return;
    }
    if (expr.kind === "postfix") {
      if (expr.primary.kind === "identifier") {
        this.read(expr.primary.name, expr.primary.span, expr.ops);
      } else {
        this.expression(expr.primary);
      }
      this.ops(expr.ops);
      return;
    }
    for (const child of ExpressionChildren.of(expr)) {
      this.expression(child);
    }
    if (expr.kind === "cast") {
      this.part({ kind: "type", type: expr.type });
    }
  }

  private ops(ops: readonly TPostfixOpSyntax[]): void {
    for (const op of ops) {
      if (op.kind === "subscript") {
        for (const index of op.indexes) {
          this.expression(index);
        }
      } else if (op.kind === "call") {
        this.callArguments(op.arguments);
      }
    }
  }

  /** A bare variable passed to a call counts as initialized after it */
  private callArguments(args: readonly TExpression[]): void {
    this.inFunctionCallArgs++;
    for (const arg of args) {
      this.expression(arg);
    }
    this.inFunctionCallArgs--;
    for (const arg of args) {
      if (arg.kind !== "identifier") continue;
      const key = this.analyzer.bindingKey(null, arg.name, arg.span);
      if (key !== null) {
        this.analyzer.recordAssignment(key);
      }
    }
  }

  /** A read of `name`, followed by `ops`: the whole variable, or its first field */
  private read(
    name: string,
    at: ISourceSpan,
    ops: readonly TPostfixOpSyntax[],
  ): void {
    if (this.inFunctionCallArgs > 0) return;
    const key = this.analyzer.bindingKey(null, name, at);
    if (key === null) return;
    if (ops.length > 0) {
      if (this.isCompileTimeLength(key, ops)) return;
      const first = ops[0];
      if (first.kind === "member") {
        this.analyzer.checkRead(key, name, at, first.name);
        return;
      }
    }
    this.analyzer.checkRead(key, name, at);
  }

  /**
   * `arr.length` or `arr[i].length` is a compile-time size, not a read; so is
   * ADR-058's length property of anything, `cfg.a.type_byte_length` (#1867): it
   * reads the declared shape, never the value
   */
  private isCompileTimeLength(
    key: TInitKey,
    ops: readonly TPostfixOpSyntax[],
  ): boolean {
    const last = ops.at(-1)!;
    if (last.kind !== "member") return false;
    if (LengthProperty.isLength(last.name)) return true;
    if (this.analyzer.lookupVariableState(key)?.isStringType) return false;
    if (last.name !== "length") return false;
    return ops.length === 1 || ops[0].kind === "subscript";
  }
}

/**
 * Analyzes cnx AST for use-before-initialization errors
 */
class InitializationAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IInitializationError[] = [];

  private states = new Map<TInitKey, IVariableState>();

  /**
   * cnx struct fields from current file (collected at analysis time).
   * External struct fields from C/C++ headers are accessed via CodeGenState.
   */
  private cnxStructFields: Map<string, Set<string>> = new Map();

  /**
   * Get struct fields for a given struct type.
   * Checks cnx structs first, then falls back to CodeGenState for external structs.
   */
  private getStructFields(structName: string): ReadonlySet<string> | undefined {
    // Check cnx structs from current file first
    const cnxFields = this.cnxStructFields.get(structName);
    if (cnxFields) {
      return cnxFields;
    }

    // Check external structs from CodeGenState
    return this.context.program.externalStructFields().get(structName);
  }

  /**
   * Check if a type name is a known struct.
   */
  private isKnownStruct(typeName: string): boolean {
    return this.getStructFields(typeName) !== undefined;
  }

  /**
   * Issue #503: Check if a type name is a C++ class/struct
   * C++ classes with default constructors are automatically initialized.
   *
   * @param typeName The type name to check
   * @returns true if the type is from C++ (has constructor-based init)
   */
  private isCppClass(typeName: string): boolean {
    const symbols = this.context.symbolTable.getOverloads(typeName);
    for (const sym of symbols) {
      if (sym.sourceLanguage === ESourceLanguage.Cpp) {
        // C++ classes and structs have default constructors
        if (sym.kind === "struct" || sym.kind === "class") {
          return true;
        }
      }
    }

    return false;
  }

  /** Analyze 1.2's syntax for reads before initialization (E0381) */
  public analyze(program: IProgramSyntax): IInitializationError[] {
    this.errors = [];
    this.states = new Map();
    this.cnxStructFields = new Map();
    this.collectStructDefinitions(program);
    this.createGlobalScope(program);
    const walk = new InitializationWalk(this);
    for (const member of program.members) {
      walk.declaration(member.declaration);
    }
    return this.errors;
  }

  /** The name of a plain user type (`Point`), the only kind tracked by field */
  public static userTypeName(type: TTypeSyntax): string | null {
    return type.kind === "user" ? type.name : null;
  }

  /**
   * Globals count as initialized (C zero-initializes them). A scope member
   * does when it has an initializer or one of the scope's functions assigns it.
   */
  private createGlobalScope(program: IProgramSyntax): void {
    const assignedIn = new Map<string, Set<TInitKey>>();
    for (const { declaration, scope } of program.members) {
      if (declaration.kind !== "variableDeclaration") continue;
      const scopePath =
        scope === null ? "" : this.context.program.scopePathOf(scope);
      const fullName = ScopeUtils.qualifyInScope(declaration.name, scopePath); // Transpiled C name
      if (scope !== null && !assignedIn.has(scope)) {
        assignedIn.set(scope, this._findAssignedScopeMembers(program, scope));
      }
      this.declareVariable(
        fullName,
        {
          name: declaration.name,
          line: declaration.span.line,
          column: declaration.span.column,
        },
        scope === null ||
          declaration.initializer !== null ||
          assignedIn.get(scope)!.has(fullName),
        InitializationAnalyzer.userTypeName(declaration.type),
      );
    }
  }

  /**
   * Scan all functions in a scope to find which members are assigned.
   * Issue #1019: A member assigned in ANY function is considered initialized
   * for reads in other functions within the same scope.
   */
  private _findAssignedScopeMembers(
    program: IProgramSyntax,
    scope: string,
  ): Set<TInitKey> {
    const assigned = new Set<TInitKey>();
    for (const member of program.members) {
      if (member.scope !== scope || member.declaration.kind !== "function") {
        continue;
      }
      // Scan the function body for assignments to scope members
      this._collectAssignments(member.declaration.body.statements, assigned);
    }
    return assigned;
  }

  /**
   * Recursively collect the members assigned in statements, and in every
   * statement nested inside them (#2003: `critical` and `forever` included).
   */
  private _collectAssignments(
    statements: readonly TStatement[],
    assigned: Set<TInitKey>,
  ): void {
    for (const statement of statements) {
      this._collectDirectAssignment(statement, assigned);
      this._collectAssignments(StatementChildren.of(statement), assigned);
    }
  }

  /**
   * Collect the assignments the statement itself performs: an assignment
   * statement, or a `for` header's init and update (#2010).
   */
  private _collectDirectAssignment(
    statement: TStatement,
    assigned: Set<TInitKey>,
  ): void {
    for (const { target } of StatementWrites.of(statement)) {
      const head = ExpressionShape.headOf(target);
      if (!head.identifier) continue;

      // #2004: what 1.4 binds the target to -- a local, parameter or `for`
      // variable of the name, or `global.x`, is not this scope's member
      const key = this.bindingKey(head.root, head.identifier.name, target.span);
      if (key !== null) {
        assigned.add(key);
      }
    }
  }

  /** The fields of each struct the file declares at file level */
  private collectStructDefinitions(program: IProgramSyntax): void {
    for (const member of program.declarations) {
      const declaration = member.declaration;
      if (declaration.kind !== "struct") continue;
      this.cnxStructFields.set(
        declaration.name,
        new Set(declaration.fields.map((field) => field.name)),
      );
    }
  }

  /** The declaration 1.4 framed for a declaring identifier, by its span */
  public framedDeclaration(identifier: {
    line: number;
    column: number;
  }): ILocalDeclaration | null {
    const frame = this.context.program.lexicalFrameAt(
      this.context.sourceFile,
      identifier,
    );
    return (
      frame.declarations.find(
        (d) =>
          d.span.line === identifier.line &&
          d.span.column === identifier.column,
      ) ?? null
    );
  }

  /**
   * What `IProgram.bindValue` binds a spelling to at a position, as a state
   * key; null for a name with no state here (a function, a scope, a header's)
   */
  public bindingKey(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TInitKey | null {
    const binding = this.context.program.bindValue(
      this.context.sourceFile,
      root,
      name,
      at,
    );
    if (binding?.kind === "local") return binding.declaration;
    if (binding?.kind === "variable") return binding.symbol.fullyQualifiedCName;
    return null;
  }

  // ========================================================================
  // Variable Tracking
  // ========================================================================

  /**
   * Start tracking a declaration. A parameter or `for` variable is never
   * tracked: its caller or its header initializes it, and an untracked key
   * reads as initialized.
   */
  public declareVariable(
    key: TInitKey,
    declaration: IDeclarationInfo,
    hasInitializer: boolean,
    typeName: string | null,
    isStringType: boolean = false,
  ): void {
    const isStruct = typeName !== null && this.isKnownStruct(typeName);
    const fields = isStruct
      ? this.getStructFields(typeName)!
      : new Set<string>();

    // Issue #503: C++ classes with default constructors are automatically initialized
    const isCppClassType = typeName !== null && this.isCppClass(typeName);
    const isInitialized = hasInitializer || isCppClassType;

    this.states.set(key, {
      declaration,
      initialized: isInitialized,
      typeName,
      isStruct,
      isStringType,
      // If initialized with full struct initializer or C++ class, all fields are initialized
      initializedFields: isInitialized ? new Set(fields) : new Set(),
    });
  }

  /**
   * Record that a variable (or field) has been assigned
   */
  public recordAssignment(key: TInitKey, field?: string): void {
    const state = this.states.get(key);
    if (!state) return;
    if (field) {
      this.recordFieldAssignment(state, field);
    } else {
      this.recordWholeAssignment(state);
    }
  }

  /**
   * Handle field-level assignment.
   */
  private recordFieldAssignment(state: IVariableState, field: string): void {
    state.initializedFields.add(field);
    // Check if all fields are now initialized
    if (!state.isStruct || !state.typeName) return;

    const allFields = this.getStructFields(state.typeName);
    if (!allFields) return;

    const allInitialized = [...allFields].every((f) =>
      state.initializedFields.has(f),
    );
    if (allInitialized) {
      state.initialized = true;
    }
  }

  /**
   * Handle whole-variable assignment.
   */
  private recordWholeAssignment(state: IVariableState): void {
    state.initialized = true;
    // Mark all fields as initialized too
    if (!state.isStruct || !state.typeName) return;

    const fields = this.getStructFields(state.typeName);
    if (fields) {
      state.initializedFields = new Set(fields);
    }
  }

  /**
   * Check if a variable (or field) is used before initialization
   * SonarCloud S3776: Refactored to use helper methods.
   */
  public checkRead(
    key: TInitKey,
    name: string,
    span: ISourceSpan,
    field?: string,
  ): void {
    const state = this.states.get(key);

    if (!state) {
      // Variable not found - let undefined variable handling deal with it
      return;
    }

    if (field) {
      this.checkFieldRead(name, span, field, state);
    } else if (!state.initialized) {
      this.addError(name, span, state.declaration, false);
    }
  }

  /**
   * Check field read for uninitialized access.
   * SonarCloud S3776: Extracted from checkRead().
   */
  private checkFieldRead(
    name: string,
    span: ISourceSpan,
    field: string,
    state: IVariableState,
  ): void {
    if (state.isStruct && state.typeName) {
      this.checkStructFieldRead(name, span, field, state);
      return;
    }

    if (state.isStringType) {
      this.checkStringPropertyRead(name, span, field, state);
    }
    // Other types: .field is a compile-time property, no check needed
  }

  /**
   * Check struct field read for initialization.
   */
  private checkStructFieldRead(
    name: string,
    span: ISourceSpan,
    field: string,
    state: IVariableState,
  ): void {
    const structFieldSet = this.getStructFields(state.typeName!);
    if (!structFieldSet?.has(field)) return;

    if (!state.initializedFields.has(field)) {
      this.addError(`${name}.${field}`, span, state.declaration, false);
    }
  }

  /**
   * Check string property read for initialization.
   */
  private checkStringPropertyRead(
    name: string,
    span: ISourceSpan,
    field: string,
    state: IVariableState,
  ): void {
    const runtimeProperties = ["length", "capacity", "size"];
    if (runtimeProperties.includes(field) && !state.initialized) {
      this.addError(name, span, state.declaration, false);
    }
  }

  /**
   * Public method to look up variable state
   * Issue #196 Bug 2: Used by visitor to check if variable is string type
   */
  public lookupVariableState(key: TInitKey): IVariableState | null {
    return this.states.get(key) ?? null;
  }

  // ========================================================================
  // Control Flow
  // ========================================================================

  /**
   * Clone the current scope state for branch analysis
   */
  public cloneScopeState(): Map<TInitKey, IVariableState> {
    return new Map(
      [...this.states].map(([key, state]) => [
        key,
        { ...state, initializedFields: new Set(state.initializedFields) },
      ]),
    );
  }

  /**
   * Restore initialization state from a saved snapshot
   * Used for control flow analysis to "undo" branch changes
   */
  public restoreFromState(savedState: Map<TInitKey, IVariableState>): void {
    for (const [key, saved] of savedState) {
      this.states.set(key, {
        ...saved,
        initializedFields: new Set(saved.initializedFields),
      });
    }
  }

  /**
   * Merge initialization state from a saved snapshot
   * Used for deterministic loops where initialization inside the loop
   * should be preserved (the loop WILL run at least once)
   */
  public mergeInitializationState(
    beforeState: Map<TInitKey, IVariableState>,
  ): void {
    for (const [key, beforeVar] of beforeState) {
      const current = this.states.get(key);
      if (!current) continue;
      for (const field of beforeVar.initializedFields) {
        current.initializedFields.add(field);
      }
    }
  }

  // ========================================================================
  // Error Reporting
  // ========================================================================

  private addError(
    variable: string,
    span: ISourceSpan,
    declaration: IDeclarationInfo,
    mayBeUninitialized: boolean,
  ): void {
    const certainty = mayBeUninitialized ? "possibly " : "";
    this.errors.push({
      code: "E0381",
      variable,
      span,
      declaration,
      mayBeUninitialized,
      message: `use of ${certainty}uninitialized variable '${variable}'`,
    });
  }
}

export default InitializationAnalyzer;
