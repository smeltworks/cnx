/**
 * ADR-071 read-only enforcement (was ADR-013's const): E0900 for a write to a
 * binding not declared `mut` (it retired ADR-013's E0877 and E0878), E0899
 * for a `mut` that nothing in the file writes, and E0915 for an argument to a
 * `mut` parameter that is not a variable (ADR-006).
 *
 * #1322. Four throws in `output/` -- three in `AssignmentValidator` (a
 * simple target, an array element, a member access, each asking
 * `TypeValidator.checkConstAssignment` about the ROOT name) and one in
 * `CallExprGenerator` for a const value passed to a non-const parameter --
 * every one reaching the user as `1:0`, across twenty-six fixtures that
 * assert that position.
 *
 * ## The root of the target is the whole question
 *
 * `CONFIG <- 5`, `table[0] <- 1`, `cfg.x <- 2`, `this.K +<- 1`: whatever the
 * form, the target is reached through one declared name, and that name's
 * const-ness decides (ADR-013 "every assignment form, one decision"). The
 * name is a parameter or a variable of the enclosing frames, a scope member
 * through `this.`, or -- a const declared in an included file -- a symbol of
 * the program.
 *
 * ## Two holes closed, probed
 *
 * A `for` header's assignment and update (`for (K <- 0; …; K +<- 1)`) never
 * reached `AssignmentValidator`, so `K += 1` was emitted against a `const`
 * and the C compiler rejected it. They carry an `assignmentTarget` like any
 * statement and are checked here on the same terms.
 */

import OperandTyper from "../../utils/OperandTyper";
import SourceOrder from "../../utils/SourceOrder";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import FunctionReference from "./helpers/FunctionReference";
import CCallee from "./helpers/CCallee";
import CArgumentWrite from "./helpers/CArgumentWrite";
import type ICCallee from "./types/ICCallee";
import BoundDeclaration from "./helpers/BoundDeclaration";
import WrittenBinding from "./helpers/WrittenBinding";
import MutArgument from "./helpers/MutArgument";
import MutSite from "./helpers/MutSite";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type IWrittenBinding from "./types/IWrittenBinding";
import type TValueBinding from "../../types/TValueBinding";
import SafeDivision from "../../utils/SafeDivision";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import type ILexicalFrame from "../../types/ILexicalFrame";
import type TSymbol from "../../types/symbols/TSymbol";
import IConstAssignmentError from "./types/IConstAssignmentError";
import type ISourceSpan from "../../types/ISourceSpan";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";

/** What kind of const binding a name is, or null when it is not const. */
type TConstKind = "parameter" | "variable" | null;

class ConstAssignmentCheck {
  private readonly found: IConstAssignmentError[] = [];
  /** The declarations this file writes: an ILocalDeclaration or a symbol */
  private readonly written = new Set<object>();

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IConstAssignmentError[] {
    return this.found;
  }

  /** Every assignment form -- a statement, a `for` init, a `for` update. */
  public checkSite(site: IAssignmentSyntax): void {
    const target = WrittenBinding.ofExpression(site.target, this.context);
    if (target === null) return;
    this.noteWrite(target.binding);
    const kind = ConstAssignmentCheck.constKind(target.binding);
    if (kind === null) {
      if (site.operator === "<-")
        this.checkHandleStore(site.value, target.name);
      return;
    }

    const suffix = ConstAssignmentCheck.targetSuffix(target.ops);
    this.found.push({
      code: "E0900",
      span: site.target.span,
      message: `cannot assign to read-only ${kind} '${target.name}'${suffix}`,
      helpText:
        kind === "parameter"
          ? "A parameter is read-only unless declared `mut` (ADR-071); declare it `mut` if the function must change it."
          : "A binding is read-only unless declared `mut` (ADR-071); declare it `mut` if the value must change.",
      declaredAt: MutSite.of(target.binding, this.context),
    });
  }

  /**
   * ADR-030 holds an opaque handle through a pointer, so storing one in a
   * `mut` binding hands that binding the object: `this.held <- w` lets
   * `held` write what `w` refers to, which is writing `w`.
   */
  public checkHandleStore(value: TExpression, into: string): void {
    for (const source of ConstAssignmentCheck.storedValues(value)) {
      this.checkHandleSource(source, into);
    }
  }

  /** Each value a store may copy: a ternary's arms, an array literal's elements */
  private static storedValues(value: TExpression): TExpression[] {
    switch (value.kind) {
      case "parenthesized":
        return ConstAssignmentCheck.storedValues(value.expression);
      case "ternary":
        return [value.whenTrue, value.whenFalse].flatMap((arm) =>
          ConstAssignmentCheck.storedValues(arm),
        );
      case "arrayInitializer":
        return [
          ...value.elements,
          ...(value.fill === null ? [] : [value.fill]),
        ].flatMap((element) => ConstAssignmentCheck.storedValues(element));
      default:
        return [value];
    }
  }

  private checkHandleSource(value: TExpression, into: string): void {
    const typeName = OperandTyper.typeOf(value, this.context)?.typeName;
    if (!typeName || !this.context.program.isOpaqueType(typeName)) return;
    const source = WrittenBinding.ofExpression(value, this.context);
    if (source === null) return;
    this.noteWrite(source.binding);
    const kind = ConstAssignmentCheck.constKind(source.binding);
    if (kind === null) return;
    this.found.push({
      code: "E0900",
      span: value.span,
      message: `cannot store read-only ${kind} '${value.written}' in \`mut\` '${into}': a ${typeName} handle refers to its object`,
      helpText:
        "Through the copy, the object may be written (ADR-030); declare the source `mut` (ADR-071).",
      declaredAt: MutSite.of(source.binding, this.context),
    });
  }

  /** How the target's shape is named in E0900's message. */
  private static targetSuffix(ops: readonly TPostfixOpSyntax[]): string {
    if (ops.some((op) => op.kind === "subscript")) return " (array element)";
    if (ops.some((op) => op.kind === "member")) return " (member access)";
    return "";
  }

  /**
   * E0900 at a site that is not an assignment: ADR-051's `safe_div`/`safe_mod`
   * write their result through the FIRST argument, so a const there is written
   * to exactly as `K <- 1` writes to one.
   *
   * The const rule walks assignment targets and a call argument is not one, so
   * this site was invisible to it: `safe_div(K, 10, 2, 0)` emitted `&K` into a
   * non-const pointer parameter and reached the C compiler as
   * `discards 'const' qualifier`, at exit 0. Which argument is the output is
   * ADR-051's fact and is asked of `SafeDivision`, so this rule does not carry
   * a second opinion about the builtins' signature.
   */
  private checkSafeDivisionOutput(expr: TExpression): void {
    const call = SafeDivision.callOf(expr);
    if (call === null) return;
    const output = SafeDivision.outputName(call.args);
    if (output === null) return; // not a variable at all -- E0885's to report
    const written = WrittenBinding.of(
      null,
      output,
      [],
      expr.span,
      this.context,
    );
    this.noteWrite(written.binding);
    // Always a BARE name: `outputName` accepts only a plain identifier, so a
    // `this.`-rooted first argument returns null above and is E0885's to report.
    const kind = ConstAssignmentCheck.constKind(written.binding);
    if (kind === null) return;
    this.found.push({
      code: "E0900",
      span: call.args[0].span,
      message: `cannot assign to read-only ${kind} '${output}' (${call.name} output)`,
      helpText: `${call.name} writes its result through its first argument, so it must be declared \`mut\` (ADR-071).`,
      declaredAt: MutSite.of(written.binding, this.context),
    });
  }

  /**
   * E0900, too: a read-only binding passed to a cnx `mut` parameter; and
   * E0915 for an argument that is no binding at all.
   */
  public checkExpression(expr: TExpression): void {
    if (expr.kind !== "postfix") return;
    const call = expr.ops.find((op) => op.kind === "call");
    if (call?.kind !== "call") return;
    this.checkSafeDivisionOutput(expr);
    this.checkMethodReceiver(expr);
    const cCallee = CCallee.of(expr, this.context);
    if (cCallee !== null) {
      // Its read-only arguments are E0900's too, which CPointerArgumentAnalyzer reports
      this.noteCPointerWrites(cCallee);
      return;
    }
    const scopePath = OperandTyper.scopePathAt(expr.span, this.context);
    const callee = FunctionReference.ofCall(expr, scopePath, this.context);
    if (callee === null) {
      // A function no header the transpiler read declares may write any
      // argument, so none of
      // their `mut`s is unused (Decision 6). The C compiler checks the rest.
      for (const arg of call.arguments) {
        this.noteWrite(
          WrittenBinding.ofExpression(arg, this.context)?.binding ?? null,
        );
      }
      return;
    }
    if (callee.sourceLanguage !== ESourceLanguage.Cnx) return;
    const calledAs =
      FunctionReference.ofCallChain(expr, scopePath, this.context) === null
        ? ConstAssignmentCheck.calleeAsWritten(expr)
        : callee.name;
    call.arguments.forEach((arg, index) => {
      const param = callee.parameters[index];
      if (param === undefined || param.isConst) return;
      const target = WrittenBinding.ofExpression(arg, this.context);
      if (!MutArgument.isWritable(arg, this.context)) {
        this.reportNotWritable(arg, param.name, calledAs);
        return;
      }
      this.noteWrite(target?.binding ?? null);
      const argName = ConstAssignmentCheck.constArgumentName(arg, target);
      if (argName === null) return;
      this.found.push({
        code: "E0900",
        span: arg.span,
        message: `cannot pass read-only '${argName}' to \`mut\` parameter '${param.name}' of function '${calledAs}'`,
        helpText:
          "The callee writes through that parameter, so the argument must be declared `mut` (ADR-071).",
        declaredAt: MutSite.of(target?.binding ?? null, this.context),
      });
    });
  }

  /** E0915 (ADR-006, #1203): an argument a `mut` parameter cannot write */
  private reportNotWritable(
    arg: TExpression,
    parameter: string,
    calledAs: string,
  ): void {
    const passing = `cannot pass '${arg.written}' to \`mut\` parameter '${parameter}' of function '${calledAs}'`;
    if (MutArgument.headerMacro(arg, this.context) === null) {
      this.found.push({
        code: "E0915",
        span: arg.span,
        message: `${passing}: it is not a variable, so the write would be lost`,
        helpText:
          "A `mut` parameter writes its argument (ADR-006); assign the value to a `mut` variable and pass that.",
      });
      return;
    }
    this.found.push({
      code: "E0915",
      span: arg.span,
      message: `${passing}: it is a \`#define\`, not a variable`,
      helpText:
        "A `#define` is text replacement, not a value (ADR-006), so a `mut` parameter cannot take one; pass the variable it names, or a `mut` variable.",
    });
  }

  /** A call through a value, as written: `h.cb`, not the callback's type */
  private static calleeAsWritten(chain: TExpressionOf<"postfix">): string {
    const callAt = chain.ops.findIndex((op) => op.kind === "call");
    return [chain.primary, ...chain.ops.slice(0, callAt)]
      .map((node) => node.written)
      .join("");
  }

  /**
   * E0899 (ADR-071 Decision 6): a `mut` binding nothing in this file writes.
   * Two are exempt because what fixes their `mut` is outside the body: a
   * parameter of a function used as a callback type, whose signature the
   * type decides, and a binding C can see -- a global or a public scope
   * member, which the header exports for C code to write.
   */
  public checkUnusedMut(): void {
    const program = this.context.program;
    const typedefCallbacks = program.callbackCompatibleFunctions();
    const callbacks = program.callbackFunctions();
    const visit = (frame: ILexicalFrame, functionName: string | null): void => {
      const fn = frame.functionCName ?? functionName;
      for (const declaration of frame.declarations) {
        if (declaration.isConst || declaration.kind === "constructor") continue;
        if (this.written.has(declaration)) continue;
        const isCallbackParameter =
          declaration.kind === "parameter" &&
          fn !== null &&
          (callbacks.has(fn) || typedefCallbacks.has(fn));
        if (isCallbackParameter) continue;
        this.reportUnusedMut(
          declaration.span,
          declaration.name,
          declaration.isAtomic,
        );
      }
      for (const child of frame.children) visit(child, fn);
    };
    visit(
      program.lexicalFrameAt(this.context.sourceFile, { line: 0, column: 0 }),
      null,
    );
    for (const symbol of program.symbolsInFile(this.context.sourceFile)) {
      if (ConstAssignmentCheck.isUnwrittenPrivateMember(symbol, this.written)) {
        this.reportUnusedMut(symbol.span, symbol.name, symbol.isAtomic);
      }
    }
  }

  private static isUnwrittenPrivateMember(
    symbol: TSymbol,
    written: ReadonlySet<object>,
  ): symbol is IVariableSymbol {
    return (
      symbol.kind === "variable" &&
      symbol.sourceLanguage === ESourceLanguage.Cnx &&
      !symbol.isConst &&
      !symbol.isConstructed &&
      symbol.scopePath !== "" &&
      symbol.visibility === "private" &&
      !written.has(symbol)
    );
  }

  /** An `atomic` is writable without `mut` (#2233), so it is `atomic` that goes */
  private reportUnusedMut(
    at: ISourceSpan,
    name: string,
    atomic: boolean,
  ): void {
    if (atomic) {
      this.found.push({
        code: "E0899",
        span: at,
        message: `'${name}' is never written; remove \`atomic\``,
        helpText:
          "`atomic` makes a binding writable, and only a value something writes needs a read or write that cannot be torn (ADR-049, ADR-071).",
      });
      return;
    }
    this.found.push({
      code: "E0899",
      span: at,
      message: `'${name}' is never written; remove \`mut\``,
      helpText:
        "A binding is declared `mut` only when something writes it (ADR-071).",
    });
  }

  /**
   * E0900, too: a C++ method not declared `const` may write the object it is
   * called on, so `c.bump()` writes `c`. A `const` overload is the one a
   * read-only object calls, so its existence leaves the object read-only.
   */
  private checkMethodReceiver(
    expr: Extract<TExpression, { kind: "postfix" }>,
  ): void {
    const callAt = expr.ops.findIndex((op) => op.kind === "call");
    const method = expr.ops[callAt - 1];
    if (method?.kind !== "member") return;
    const receiver: TExpression = {
      ...expr,
      ops: expr.ops.slice(0, callAt - 1),
    };
    const methodName = CCallee.methodName(receiver, method.name, this.context);
    if (methodName === null) return;
    const methods = this.context.symbolTable
      .getCppOverloads(methodName)
      .filter((symbol) => symbol.kind === "function");
    if (methods.length === 0) return;
    if (methods.some((m) => m.kind === "function" && m.isConstMember)) return;
    const target = WrittenBinding.ofExpression(receiver, this.context);
    this.noteWrite(target?.binding ?? null);
    const kind = ConstAssignmentCheck.constKind(target?.binding ?? null);
    if (kind === null || target === null) return;
    this.found.push({
      code: "E0900",
      span: expr.span,
      message: `cannot call non-\`const\` method '${method.name}' on read-only ${kind} '${target.name}'`,
      helpText:
        "A C++ method not declared `const` may write its object, so the object must be declared `mut` (ADR-071).",
      declaredAt: MutSite.of(target.binding, this.context),
    });
  }

  /** What a C callee may write through, it may write (CArgumentWrite) */
  private noteCPointerWrites(callee: ICCallee): void {
    callee.arguments.forEach((arg, index) => {
      if (!CArgumentWrite.mayWrite(callee, index, this.context)) return;
      const target = WrittenBinding.ofExpression(arg, this.context);
      this.noteWrite(target?.binding ?? null);
    });
  }

  private noteWrite(binding: TValueBinding | null): void {
    if (binding?.kind === "local") this.written.add(binding.declaration);
    else if (binding?.kind === "variable") this.written.add(binding.symbol);
  }

  // --- The facts -----------------------------------------------------------

  /**
   * The spelling of an argument reached through a read-only binding -- `K`,
   * `this.K`, `S.K`, `cfg.x`, `o.inner.data` -- or null for anything else (an
   * expression has no binding to protect). A `mut` parameter is passed by
   * reference, so the callee may write the member or element it is handed,
   * which is writing its root.
   */
  private static constArgumentName(
    arg: TExpression,
    target: IWrittenBinding | null,
  ): string | null {
    if (target === null) return null;
    return ConstAssignmentCheck.constKind(target.binding) === null
      ? null
      : arg.written;
  }

  /**
   * Whether a binding is a read-only parameter, a read-only variable, or
   * neither.
   *
   * Which declaration a spelling binds to is Program's one binder's
   * decision (#1668), not this rule's: a local, a parameter, a scope member
   * or a global, this file's or an included one's, in ADR-057's order with
   * `this.` and `global.` stating where. #1322 review: this file once had its
   * own, with a `global.` arm and no `this.` arm -- so `this.STEP <- 5` with a
   * local `STEP` shadowing the const member resolved to the local, lost its error,
   * and emitted `Board__STEP = 5U;` at exit 0.
   */
  private static constKind(binding: TValueBinding | null): TConstKind {
    const declared = BoundDeclaration.of(binding);
    if (!declared?.isConst) return null;
    return declared.isParameter ? "parameter" : "variable";
  }
}

class ConstAssignmentAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IConstAssignmentError[] {
    const check = new ConstAssignmentCheck(this.context);
    for (const member of program.members) {
      for (const site of StatementNodes.assignments(member.declaration)) {
        check.checkSite(site);
      }
      for (const statement of StatementNodes.in(member.declaration)) {
        if (
          statement.kind === "variableDeclaration" &&
          statement.modifiers.mut &&
          statement.initializer !== null
        ) {
          check.checkHandleStore(statement.initializer, statement.name);
        }
      }
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part))
          check.checkExpression(expr);
      }
    }
    check.checkUnusedMut();
    // Read off 1.2's syntax (#1991); reported in source order
    return check.errors().sort(SourceOrder.bySpan);
  }
}

export default ConstAssignmentAnalyzer;
