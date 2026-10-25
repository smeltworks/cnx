/**
 * ADR-029's per-file half: where one file names what may be a function, in a
 * position a C callback could be expected (#1825).
 *
 * Two shapes, both from #895: a variable declared with an initializer
 * (`PointCallback cb <- my_handler;`) and a call argument
 * (`global.widget_set_flush_cb(w, my_flush);`). Neither is a callback yet --
 * that needs the C header's typedef, and whether the name is a function at all
 * needs every file's declarations (#1544) -- so 1.4 decides
 * (`CallbackCompatibility`), and this records only what the file spells.
 *
 * ADR-071 adds two more, which only say a function is used as a callback at
 * all: an assignment whose value names one, and a declared type that names
 * one (ADR-029's function-as-type). A callback's `mut` parameters are part of
 * the type its implementations match, so E0899 does not ask them to be written.
 *
 * This walk sat in 2.1 Analyze inside `FunctionCallAnalyzer`, and the
 * orchestrator ran the whole analyzer over every tree, diagnostics discarded,
 * for the map it filled as a side effect.
 */

import type TCallbackUse from "../../../../types/TCallbackUse";
import type TMemberDeclaration from "../../../../types/syntax/TMemberDeclaration";
import type IFunctionDeclarationSyntax from "../../../../types/syntax/IFunctionDeclarationSyntax";
import type IProgramSyntax from "../../../../types/syntax/IProgramSyntax";
import type TExpression from "../../../../types/syntax/TExpression";
import type TStatement from "../../../../types/syntax/TStatement";
import ExpressionShape from "../../../../utils/ExpressionShape";
import ScopeUtils from "../../../../utils/ScopeUtils";
import StatementChildren from "../../../../utils/StatementChildren";
import DeclarationParts from "../../../../utils/DeclarationParts";
import ExpressionNodes from "../../../../utils/ExpressionNodes";
import TypeText from "../../../../utils/TypeText";

class CallbackUseCollector {
  /**
   * @param scopePathOf the path of a scope this file declares, by name
   * @returns every candidate use, in source order
   */
  static collect(
    program: IProgramSyntax,
    scopePathOf: (scopeName: string) => string,
  ): TCallbackUse[] {
    const uses: TCallbackUse[] = [];
    // Issue #895: every member function of a scope, which may name its
    // siblings as `this.member`.
    for (const { declaration, scope } of program.members) {
      CallbackUseCollector.scanDeclaration(
        uses,
        declaration,
        scope === null ? "" : scopePathOf(scope),
      );
    }
    return uses;
  }

  private static scanDeclaration(
    uses: TCallbackUse[],
    declaration: TMemberDeclaration,
    scopePath: string,
  ): void {
    if (declaration.kind === "function") {
      for (const parameter of declaration.parameters ?? []) {
        CallbackUseCollector.recordType(uses, parameter.type.text, scopePath);
      }
      CallbackUseCollector.scanFunction(uses, declaration, scopePath);
    } else if (declaration.kind === "struct") {
      for (const field of declaration.fields) {
        CallbackUseCollector.recordType(uses, field.type.text, scopePath);
      }
    } else if (declaration.kind === "variableDeclaration") {
      CallbackUseCollector.recordInitializer(uses, declaration, scopePath);
      CallbackUseCollector.recordType(uses, declaration.type.text, scopePath);
    }
    CallbackUseCollector.scanExpressions(uses, declaration, scopePath);
  }

  /**
   * Every expression the declaration holds, nested ones included: a call's
   * arguments (`reg(myTick)`, `f(g(myTick))`) and a struct literal's field
   * values (`{tick: myTick}`) may name what fills a callback slot (#2103
   * review), wherever they are written.
   */
  private static scanExpressions(
    uses: TCallbackUse[],
    declaration: TMemberDeclaration,
    scopePath: string,
  ): void {
    for (const part of DeclarationParts.of(declaration)) {
      for (const expr of ExpressionNodes.of(part)) {
        if (expr.kind !== "structInitializer") {
          CallbackUseCollector.recordArguments(uses, expr, scopePath);
          continue;
        }
        for (const field of expr.fields) {
          const functionName = CallbackUseCollector.functionReference(
            field.value,
            scopePath,
          );
          if (functionName) uses.push({ kind: "assignment", functionName });
        }
      }
    }
  }

  /**
   * ADR-029: a declared type that may name a function. A bare name inside a
   * scope may be the scope's own function or a global one (ADR-057), so both
   * are recorded; 1.4 keeps only names a function has.
   */
  private static recordType(
    uses: TCallbackUse[],
    typeText: string,
    scopePath: string,
  ): void {
    // `onTick[2] handlers` names `onTick` (#2103 review)
    const named = TypeText.withoutDimensions(typeText);
    const path = named.split(".");
    if (path.some((part) => !/^[A-Za-z_]\w*$/.test(part))) return;
    if (path.length > 1) {
      uses.push({
        kind: "type",
        functionName: ScopeUtils.qualifyPathInScope(path, ""),
      });
      return;
    }
    uses.push({ kind: "type", functionName: named });
    if (scopePath) {
      uses.push({
        kind: "type",
        functionName: ScopeUtils.qualifyInScope(named, scopePath),
      });
    }
  }

  /**
   * @param scopePath the scope the function is a member of, which `this.`
   *        names; `""` for a standalone function
   */
  private static scanFunction(
    uses: TCallbackUse[],
    funcDecl: IFunctionDeclarationSyntax,
    scopePath: string,
  ): void {
    CallbackUseCollector.scanStatements(
      uses,
      funcDecl.body.statements,
      scopePath,
    );
  }

  /**
   * Scan statements, recursing into every statement they hold (#2003).
   */
  private static scanStatements(
    uses: TCallbackUse[],
    statements: readonly TStatement[],
    scopePath: string,
  ): void {
    for (const statement of statements) {
      if (statement.kind === "variableDeclaration") {
        // Check variable declarations for callback assignments
        CallbackUseCollector.recordInitializer(uses, statement, scopePath);
        CallbackUseCollector.recordType(uses, statement.type.text, scopePath);
      } else if (statement.kind === "assignment") {
        const functionName = CallbackUseCollector.functionReference(
          statement.value,
          scopePath,
        );
        if (functionName) uses.push({ kind: "assignment", functionName });
      } else {
        CallbackUseCollector.scanStatements(
          uses,
          StatementChildren.of(statement),
          scopePath,
        );
      }
    }
  }

  /**
   * `PointCallback cb <- my_handler;` -- a declaration whose initializer names
   * what may be a function.
   */
  private static recordInitializer(
    uses: TCallbackUse[],
    varDecl: {
      readonly initializer: TExpression | null;
      readonly type: { readonly text: string };
    },
    scopePath: string,
  ): void {
    if (!varDecl.initializer) return;
    const functionName = CallbackUseCollector.functionReference(
      varDecl.initializer,
      scopePath,
    );
    if (!functionName) return;
    uses.push({
      kind: "initializer",
      functionName,
      typeName: varDecl.type.text,
    });
  }

  /**
   * Issue #895: `global.widget_set_flush_cb(w, my_flush)` -- a call whose
   * arguments name what may be functions. Whether the callee is a C function
   * and the parameter a function pointer typedef is 1.4's question.
   */
  private static recordArguments(
    uses: TCallbackUse[],
    expr: TExpression,
    scopePath: string,
  ): void {
    const callInfo = CallbackUseCollector.extractCallInfo(expr);
    if (!callInfo) return;
    for (const [argIndex, arg] of callInfo.args.entries()) {
      const functionName = CallbackUseCollector.functionReference(
        arg,
        scopePath,
      );
      if (!functionName) continue;
      uses.push({
        kind: "argument",
        functionName,
        callee: callInfo.funcName,
        argIndex,
      });
    }
  }

  /**
   * The lookup key of a function reference -- the transpiled C name it spells
   * -- or null if the expression is not one. Matches:
   *   - Bare identifiers: "my_handler"
   *   - Qualified scope names: "MyScope.handler"
   *   - Self-scope reference: "this.handler", in the enclosing scope
   *   - Global scope reference: "global.ScopeName.handler"
   */
  private static functionReference(
    expr: TExpression,
    scopePath: string,
  ): string | null {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return null;
    const members: string[] = [];
    for (const op of view.ops) {
      if (op.kind !== "member") return null;
      members.push(op.name);
    }
    const { primary } = view;
    if (primary.kind === "identifier") {
      if (members.length > 1) return null;
      return members.length === 0
        ? primary.name
        : ScopeUtils.qualifyPathInScope([primary.name, ...members], "");
    }
    if (primary.kind !== "root") return null;
    // this.member -> CurrentScope.member (Issue #895), outside a scope nothing
    if (primary.root === "this") {
      return members.length === 1 && scopePath
        ? ScopeUtils.qualifyInScope(members[0], scopePath)
        : null;
    }
    // global.Scope.member -> Scope.member (Issue #895)
    return members.length === 2
      ? ScopeUtils.qualifyPathInScope(members, "")
      : null;
  }

  /**
   * The function name and arguments of a call statement's expression, or
   * null if it is not a call on a name or a `global.` path.
   */
  private static extractCallInfo(
    expr: TExpression,
  ): { funcName: string; args: readonly TExpression[] } | null {
    if (expr.kind !== "postfix") return null;
    const { primary } = expr;
    // For 'global', the path starts empty and gets built from member access
    let path: string[];
    if (primary.kind === "identifier") {
      path = [primary.name];
    } else if (primary.kind === "root" && primary.root === "global") {
      path = [];
    } else {
      return null;
    }
    for (const op of expr.ops) {
      if (op.kind === "member") {
        // Member access: one more component of the qualified name
        path.push(op.name);
      } else if (op.kind === "call") {
        if (path.length === 0) return null;
        return {
          funcName: ScopeUtils.qualifyPathInScope(path, ""),
          args: op.arguments,
        };
      }
    }
    return null;
  }
}

export default CallbackUseCollector;
