/**
 * Which cnx function a spelling denotes.
 *
 * #1322. Three questions in pass 2.1 end at the program's symbol for one
 * function: "what does this call target?" (E0900's callee, E0708's), "which
 * function is this VALUE?" (a function placed into a callback-typed slot,
 * ADR-029) and "which function does this TYPE name?" (the slot itself, whose
 * declared type is a function under ADR-029's function-as-type rule). All
 * three start from the same spellings -- `f`, `this.f`, `global.f`,
 * `Scope.f` -- and `CalleeNameResolver` owns turning a spelling into a
 * candidate name. What this class owns is the LOOKUP: which candidates are
 * tried, in which order, against the program.
 *
 * ## The order is the decision
 *
 * ADR-057: inside a scope, a bare `f` means the scope's own `f` when one
 * exists, and the global `f` otherwise -- codegen emits `S__f()` for a bare
 * `f()` inside `S` whichever of the two is declared. Before this class, two
 * analyzers held that order independently and one held it backwards: the
 * ADR-070 check asked "is the GLOBAL `f` non-void?" first and fell back to the
 * scope's, so with a global `u8 f()` beside a scope's `void f()` it rejected
 * a bare `f();` that codegen lowered to the void call. `candidates` is now the
 * one place the order is written, and every lookup walks it.
 */

import IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type TExpression from "../../../types/syntax/TExpression";
import type TExpressionOf from "../../../types/syntax/TExpressionOf";
import OperandTyper from "../../../utils/OperandTyper";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import TypeText from "../../../utils/TypeText";
import CalleeNameResolver from "./CalleeNameResolver";
import ScopeCandidates from "./ScopeCandidates";
import type IAnalysisContext from "../types/IAnalysisContext";

class FunctionReference {
  /**
   * The C names a resolved spelling may denote, most specific first: the
   * enclosing scope's member (ADR-057), then the name as resolved. A
   * `global.`-qualified or already-qualified name has one candidate.
   */
  static candidates(
    resolvedName: string,
    scopePath: string,
    isGlobalCall: boolean,
  ): string[] {
    // `scopeQualifiedCandidate` already returns null for a `global.` call, so
    // the root passed here is null: the search order is what differs, and it is
    // decided in one place.
    const scoped = CalleeNameResolver.scopeQualifiedCandidate(
      resolvedName,
      scopePath,
      isGlobalCall,
    );
    return ScopeCandidates.forRoot(null, scoped, [resolvedName]);
  }

  /**
   * The candidates for a TYPE spelling as written in a declaration:
   * `onDown`, `this.handler`, `global.onDown`, `S.handler`, or the C name a
   * struct field's type is recorded under. An array spelling names its
   * element type.
   */
  static candidatesForTypeText(typeText: string, scopePath: string): string[] {
    const text = TypeText.withoutDimensions(typeText);
    if (text.startsWith("this.")) {
      return scopePath === ""
        ? []
        : [ScopeUtils.qualifyInScope(text.slice("this.".length), scopePath)];
    }
    if (text.startsWith("global.")) {
      return [text.slice("global.".length)];
    }
    if (text.includes(".")) {
      return [QualifiedCName.fromSourceName(text)];
    }
    return FunctionReference.candidates(text, scopePath, false);
  }

  /**
   * The function a call chain targets, or null: a foreign function, a call
   * through a value (`p.handler(5)`), or a name the program does not declare.
   */
  static ofCallChain(
    chain: TExpression,
    scopePath: string,
    context: IAnalysisContext,
  ): IFunctionSymbol | null {
    const resolved = CalleeNameResolver.resolveDetailed(
      chain,
      scopePath,
      (name) => context.symbols.knownScopes.has(name),
    );
    if (resolved === null) return null;
    return FunctionReference.lookup(
      FunctionReference.candidates(
        resolved.name,
        scopePath,
        resolved.isGlobalCall,
      ),
      context,
    );
  }

  /**
   * The function a call reaches: one named (`f(...)`, `S.f(...)`), or the
   * function type of the callback it calls through (`h.onPoke(...)`,
   * `cb(...)`), whose parameters ADR-029 makes those of the named function.
   */
  static ofCall(
    chain: TExpressionOf<"postfix">,
    scopePath: string,
    context: IAnalysisContext,
    callAt: number = chain.ops.findIndex((op) => op.kind === "call"),
  ): IFunctionSymbol | null {
    if (callAt < 0) return null;
    // Only the chain's first call is named; a later one calls what the chain
    // before it gives (`make().op(...)`)
    if (callAt === chain.ops.findIndex((op) => op.kind === "call")) {
      const named = FunctionReference.ofCallChain(chain, scopePath, context);
      if (named !== null) return named;
    }
    const target: TExpression =
      callAt === 0
        ? chain.primary
        : { ...chain, ops: chain.ops.slice(0, callAt) };
    const typeName = OperandTyper.typeOf(target, context)?.typeName;
    if (typeName === undefined || typeName === null) return null;
    return FunctionReference.ofTypeText(typeName, scopePath, context);
  }

  /**
   * The function an expression NAMES without calling it -- `onUp`,
   * `this.handler`, `global.onUp`, `S.handler` -- or null for anything else:
   * a variable of callback type, a call, a subscript, an expression.
   */
  static ofValue(
    expression: TExpression,
    scopePath: string,
    context: IAnalysisContext,
  ): IFunctionSymbol | null {
    const primary =
      expression.kind === "postfix" ? expression.primary : expression;
    const ops = expression.kind === "postfix" ? expression.ops : [];
    if (ops.some((op) => op.kind !== "member")) return null;
    const base = CalleeNameResolver.baseName(primary);
    if (base === null) return null;
    let name = base;
    for (const op of ops) {
      const next = CalleeNameResolver.resolveMemberAccess(
        name,
        op.kind === "member" ? op.name : "",
        scopePath,
        (name) => context.symbols.knownScopes.has(name),
      );
      if (next === null) return null;
      name = next;
    }
    if (name === "this" || name === "global") return null;
    return FunctionReference.lookup(
      FunctionReference.candidates(name, scopePath, base === "global"),
      context,
    );
  }

  /** The function a declared TYPE names, or null when the type is not one. */
  static ofTypeText(
    typeText: string,
    scopePath: string,
    context: IAnalysisContext,
  ): IFunctionSymbol | null {
    return FunctionReference.lookup(
      FunctionReference.candidatesForTypeText(typeText, scopePath),
      context,
    );
  }

  /** The symbol's C name -- the identity ADR-029's nominal rule compares. */
  static cNameOf(symbol: IFunctionSymbol): string {
    return ScopeUtils.getTranspiledCName(symbol);
  }

  private static lookup(
    candidates: readonly string[],
    context: IAnalysisContext,
  ): IFunctionSymbol | null {
    const program = context.program;
    for (const cName of candidates) {
      const symbol = program.symbolByCName(cName);
      if (symbol?.kind === "function") return symbol;
    }
    return null;
  }
}

export default FunctionReference;
