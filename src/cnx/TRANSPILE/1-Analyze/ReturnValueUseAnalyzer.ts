/**
 * Return-Value Use Analyzer (ADR-070, E0708)
 *
 * Rejects a non-void function call used as a bare expression statement, unless
 * the author explicitly discarded it with a cast to void:
 *
 *   next();            // E0708 -- return value discarded
 *   (void) next();     // OK    -- explicitly discarded
 *   u32 v <- next();   // OK    -- used
 *
 * ADR-070 splits discarded returns into two cases. This analyzer owns **Case 2**
 * (the author wrote the call). Case 1 -- calls the transpiler itself emits while
 * lowering string operations -- is codegen, and is cast to void at the single
 * emit site in StringUtils. The two never disagree because neither re-derives
 * the other's decision: an author-written call reaches this analyzer, a
 * transpiler-emitted one never exists at the cnx source level at all.
 *
 * Domain boundary: a callee whose return type cnx cannot resolve is outside
 * the rule, not an exception to it -- you cannot check a return type you cannot
 * see. This is ADR-070's "enforce where resolvable" boundary.
 *
 * `safe_div`/`safe_mod` (ADR-051) are deliberately NOT exempt. An earlier draft
 * of ADR-070 carved them out on the premise that they have "no bound return" at
 * the cnx level; authors bind it constantly (`err <- safe_div(...)`), and the
 * same ADR names "a discarded `safe_div` outcome" as a motivating example of the
 * bug this rule prevents. They are ordinary non-void functions here.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import StatementNodes from "../../utils/StatementNodes";
import StdlibFunctions from "./StdlibFunctions";
import CalleeNameResolver from "./helpers/CalleeNameResolver";
import IReturnValueUseError from "./types/IReturnValueUseError";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import DeclaredTypeFacts from "../../utils/DeclaredTypeFacts";
import type IAnalysisContext from "./types/IAnalysisContext";

class ReturnValueUseAnalyzer {
  /**
   * True when the statement's expression is a cast to void wrapping anything.
   * Uses the existing ADR-017 cast expression -- no new syntax (ADR-070).
   */
  static isVoidCast(expr: TExpression): boolean {
    return expr.kind === "cast" && expr.type.kind === "void";
  }

  /**
   * The call an expression statement is, looking through a non-void cast:
   * `(u8)f();` still discards. A parenthesized call or an operator is not one.
   */
  static asBareCall(expr: TExpression): TExpression | null {
    if (expr.kind === "cast") {
      return ReturnValueUseAnalyzer.asBareCall(expr.operand);
    }
    if (expr.kind !== "postfix") return null;
    return expr.ops.at(-1)?.kind === "call" ? expr : null;
  }

  /**
   * The name to report, or null when this call has no value to discard.
   *
   * ADR-057: a bare `read()` inside a scope means `this.read()`, but return
   * types are keyed by transpiled C name -- so the bare spelling misses the
   * lookup the qualified one hits, and the discard would be accepted on the
   * form CLAUDE.md makes house style. Retry against the scope-qualified
   * candidate before concluding there is nothing to check.
   */
  static nonVoidCallee(
    resolved: { name: string; isGlobalCall: boolean },
    currentScopePath: string,
    context: IAnalysisContext,
  ): string | null {
    if (ReturnValueUseAnalyzer.returnsAValue(resolved.name, context)) {
      return resolved.name;
    }

    const fallback = CalleeNameResolver.scopeQualifiedCandidate(
      resolved.name,
      currentScopePath,
      resolved.isGlobalCall,
    );
    if (fallback && ReturnValueUseAnalyzer.returnsAValue(fallback, context)) {
      return fallback;
    }

    return null;
  }

  /**
   * True only when cnx can see a non-void return type for `name`.
   * Unresolvable names answer false: outside the rule's domain, not exempt.
   */
  static returnsAValue(name: string, context: IAnalysisContext): boolean {
    const builtin = StdlibFunctions.builtinReturnType(name);
    if (builtin !== null) {
      return builtin !== "void";
    }

    const declared = context.symbols.functionReturnTypes.get(name);
    if (declared !== undefined) {
      return declared !== "void";
    }

    // Functions declared in included C/C++ headers reach the analyzer through
    // the symbol table rather than through CodeGenState.symbols, which only
    // merges .cnx includes. ADR-070 rejects blanket-exempting external C
    // precisely because these returns ARE visible -- just by a different route.
    const external = ReturnValueUseAnalyzer.externalReturnType(
      name,
      context.symbolTable,
    );
    if (external !== null) {
      return external !== "void";
    }

    if (StdlibFunctions.isKnown(name)) {
      return !StdlibFunctions.returnsVoid(name);
    }

    return false;
  }

  /**
   * Return type of a function declared in an included C/C++ header.
   *
   * C symbols carry their types as plain strings and live in a different part
   * of the symbol table from cnx symbols (`getCSymbol`, not the TSymbol
   * index), so they need their own lookup. ADR-070 rejects blanket-exempting
   * external C precisely because these returns are visible -- they just arrive
   * by a different route than CodeGenState.symbols, which merges only .cnx
   * includes.
   */
  static externalReturnType(
    name: string,
    symbolTable: IResolvedSymbols,
  ): string | null {
    // .hpp symbols land in a separate index from .h ones; ICppFunctionSymbol
    // is structurally identical, so one lookup covers both.
    //
    // #1456: the `?.` on the table AND on both methods is gone. Neither can be
    // absent -- `IResolvedSymbols` declares both -- so the optional call was a guard
    // that could not fire, and it would have turned a genuinely missing method
    // into `null`, which reads here as "this function returns nothing" rather
    // than as an error.
    const sym = symbolTable.getCSymbol(name) ?? symbolTable.getCppSymbol(name);
    if (sym?.kind !== "function") return null;
    return sym.type ?? null;
  }

  /** The non-void function an expression statement discards, if any */
  private static discardedCallee(
    expr: TExpression,
    scopePath: string,
    context: IAnalysisContext,
  ): string | null {
    if (ReturnValueUseAnalyzer.isVoidCast(expr)) return null;
    const call = ReturnValueUseAnalyzer.asBareCall(expr);
    if (call === null) return null;
    const resolved = CalleeNameResolver.resolveDetailed(
      call,
      scopePath,
      (name) => DeclaredTypeFacts.isScope(context.symbols, name),
    );
    if (!resolved) return null;
    return ReturnValueUseAnalyzer.nonVoidCallee(resolved, scopePath, context);
  }

  /** #1991: reads 1.2's syntax, not the parse tree */
  static analyze(
    program: IProgramSyntax,
    context: IAnalysisContext,
  ): IReturnValueUseError[] {
    const errors: IReturnValueUseError[] = [];
    for (const { declaration, scope } of program.members) {
      for (const statement of StatementNodes.in(declaration)) {
        if (statement.kind !== "expression") continue;
        const funcName = ReturnValueUseAnalyzer.discardedCallee(
          statement.expression,
          scope ?? "",
          context,
        );
        if (funcName === null) continue;
        errors.push({
          line: statement.span.line,
          column: statement.span.column,
          code: "E0708",
          message: `Return value of non-void function '${funcName}' is discarded`,
          helpText: `Use the value, or discard it explicitly: (void) ${funcName}(...);`,
        });
      }
    }
    return errors;
  }
}

export default ReturnValueUseAnalyzer;
