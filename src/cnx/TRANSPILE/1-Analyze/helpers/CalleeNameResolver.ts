/**
 * Resolves the qualified name of the function a postfix expression calls.
 *
 * "What function does this call target?" is one decision, and it is asked by
 * more than one analyzer: FunctionCallAnalyzer (ADR-030 define-before-use) and
 * ReturnValueUseAnalyzer (ADR-070 / E0708). It is deliberately owned here
 * rather than implemented per-caller.
 *
 * This matters more than it looks. ADR-016 makes `this` and `global` their own
 * tokens, and each qualifier resolves differently (`this.m` -> CurrentScope__m,
 * `global.m` -> m, `Scope.m` -> Scope__m). Two implementations of that would
 * agree only for as long as nobody touched either -- and a caller that resolved
 * a name differently would silently enforce its rule on a different function
 * than the one being called.
 *
 * Callers supply their own context (enclosing scope, known scope names) rather
 * than this module reaching for global state, so the resolution is a pure
 * function of what the caller can see.
 */

import type IProgram from "../../../types/IProgram";
import type TExpression from "../../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";
import QualifiedCName from "../../../utils/QualifiedCName";
import ICalleeResolution from "../types/ICalleeResolution";

class CalleeNameResolver {
  /**
   * The base name a postfix expression starts from: an identifier, or the
   * ADR-016 qualifier keywords, which are separate tokens rather than
   * identifiers. Returns null for anything that cannot start a named call.
   */
  static baseName(primary: TExpression): string | null {
    if (primary.kind === "identifier") return primary.name;
    return primary.kind === "root" ? primary.root : null;
  }

  /**
   * Resolve one member-access step. Returns the new name, or null when the base
   * is not something a cnx call can be named against. The new name is null for
   * a scope member 3-Declare never declared, which has no C name (#2116).
   */
  static resolveMemberAccess(
    resolvedName: string,
    memberName: string,
    currentScopePath: string,
    isScope: (name: string) => boolean,
    program: Pick<IProgram, "memberOf">,
  ): { resolvedName: string | null } | null {
    // this.member -> the current scope's member (only meaningful inside a scope)
    if (resolvedName === "this") {
      return currentScopePath
        ? {
            resolvedName: CalleeNameResolver.declaredCName(
              program,
              currentScopePath,
              memberName,
            ),
          }
        : null;
    }

    // Issue #985: global.member -> member (strip the qualifier)
    if (resolvedName === "global") {
      return { resolvedName: memberName };
    }

    if (isScope(resolvedName)) {
      return {
        resolvedName: CalleeNameResolver.declaredCName(
          program,
          resolvedName,
          memberName,
        ),
      };
    }

    // Object.method or a chained access -- not a cnx function call
    return null;
  }

  /**
   * Walk a postfix expression's operations to the call, building the callee's
   * qualified name as it goes.
   */
  static resolveCallTarget(
    ops: readonly TPostfixOpSyntax[],
    baseName: string,
    currentScopePath: string,
    isScope: (name: string) => boolean,
    program: Pick<IProgram, "memberOf">,
  ): ICalleeResolution {
    let resolvedName: string | null = baseName;
    let writtenName = baseName;
    let isGlobalCall = baseName === "global";

    for (const op of ops) {
      if (op.kind === "member") {
        const resolved: { resolvedName: string | null } | null =
          resolvedName === null
            ? null
            : CalleeNameResolver.resolveMemberAccess(
                resolvedName,
                op.name,
                currentScopePath,
                isScope,
                program,
              );
        if (resolved === null) {
          return { resolvedName, writtenName, foundCall: false, isGlobalCall };
        }
        // Resolution through a known scope makes this a scope method call,
        // not a global function lookup.
        if (isGlobalCall && resolvedName !== null && isScope(resolvedName)) {
          isGlobalCall = false;
        }
        resolvedName = resolved.resolvedName;
        writtenName = `${writtenName}.${op.name}`;
        continue;
      }

      if (op.kind === "call") {
        return { resolvedName, writtenName, foundCall: true, isGlobalCall };
      }
    }

    return { resolvedName, writtenName, foundCall: false, isGlobalCall };
  }

  /**
   * Full resolution for a postfix expression, keeping `isGlobalCall`.
   *
   * Callers that look a name up need that flag: an unqualified name inside a
   * scope may mean the scope's member (ADR-057), but an explicitly
   * `global.`-qualified one never does. Dropping it would make the two
   * indistinguishable at the lookup.
   */
  static resolveDetailed(
    postfix: TExpression,
    currentScopePath: string,
    isScope: (name: string) => boolean,
    program: Pick<IProgram, "memberOf">,
  ): { name: string; isGlobalCall: boolean } | null {
    if (postfix.kind !== "postfix") return null;
    const base = CalleeNameResolver.baseName(postfix.primary);
    if (base === null) return null;

    const result = CalleeNameResolver.resolveCallTarget(
      postfix.ops,
      base,
      currentScopePath,
      isScope,
      program,
    );
    if (!result.foundCall || result.resolvedName === null) return null;
    if (result.resolvedName === "this" || result.resolvedName === "global") {
      return null;
    }
    return { name: result.resolvedName, isGlobalCall: result.isGlobalCall };
  }

  /**
   * ADR-057: inside a scope, a bare `read()` may mean `this.read()`. The name
   * a caller should retry its lookup against, or null when the fallback does
   * not apply.
   *
   * This is the *decision* -- "when does an unqualified name mean a scope
   * member" -- and it is shared deliberately. Each caller then applies it to
   * its own index (defined functions, return types), but none of them re-derives
   * when the fallback is allowed. `global.`-qualified calls are excluded because
   * `global.` explicitly means the global scope.
   */
  static scopeQualifiedCandidate(
    name: string,
    currentScopePath: string,
    isGlobalCall: boolean,
    program: Pick<IProgram, "memberOf">,
  ): string | null {
    if (!currentScopePath || isGlobalCall) return null;
    // Already qualified -- there is nothing to fall back from.
    if (QualifiedCName.isQualified(name)) return null;
    return CalleeNameResolver.declaredCName(program, currentScopePath, name);
  }

  /**
   * The C name 3-Declare gave `name` in `scopePath`, or null when it declared
   * none there: an undeclared callee has no C name (#2116).
   */
  private static declaredCName(
    program: Pick<IProgram, "memberOf">,
    scopePath: string,
    name: string,
  ): string | null {
    return program.memberOf(scopePath, name)?.fullyQualifiedCName ?? null;
  }
}

export default CalleeNameResolver;
