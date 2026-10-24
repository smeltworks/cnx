/**
 * ADR-016 scope access: E0435, E0436, E0437.
 *
 * #1322. Six throws in `output/` -- two in `ScopeResolver`, three in
 * `MemberAccessValidator`, one in `CodeGenerator` -- all reaching the user as
 * `1:0`, across eleven fixtures that assert that position.
 *
 * ## A duplicate the audit's table missed
 *
 * `ScopeResolver.validateCrossScopeVisibility` and
 * `MemberAccessValidator.validateNotSelfScopeReference` both rejected a scope's
 * own member reached through the scope's name, with the same message, decided
 * separately. The audit's duplicate-message table listed groups by throw text
 * and this pair escaped it because one of the two carried an `Error:` prefix.
 * They are one decision here.
 *
 * ## Three positions, one set of rules
 *
 * `Counter.value` can stand as an expression, as the target of an assignment,
 * and as a TYPE (`Internal.Secret s;` names a scope's struct). Codegen checked
 * each position on its own path -- the type position through
 * `TypeGenerationHelper`'s injected callback -- and the three had to be kept in
 * step by hand. Here each position only NAMES its scope and member; the rules
 * are asked once, in `check`.
 *
 * ## What each rule reads
 *
 * The enclosing scope is the lexical frame's `scopePath`; since ADR-016
 * rejects nested scopes (E0430) it is a single name. Visibility, membership and
 * the known enums, registers and scopes come from the per-file symbol view,
 * which is populated before this pass runs and already spans included files --
 * a private const in an included scope is rejected across the include, and two
 * fixtures assert it. A local variable shadowing a register is asked of the
 * frames.
 */

import ScopeUtils from "../../utils/ScopeUtils";
import OperandTyper from "../../utils/OperandTyper";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import type ISourceSpan from "../../types/ISourceSpan";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import IScopeAccessError from "./types/IScopeAccessError";
import type IAnalysisContext from "./types/IAnalysisContext";

interface IAccess {
  readonly scope: string;
  readonly member: string;
  readonly viaGlobal: boolean;
  readonly at: ISourceSpan;
}

class ScopeAccessCheck {
  private readonly found: IScopeAccessError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IScopeAccessError[] {
    return this.found;
  }

  // --- The three positions. Each only names the access. -------------------

  /**
   * A struct MEMBER's type was never visibility-checked by codegen: `S.onTick
   * handler;` with a private `onTick` compiles, and #1205's fixture depends
   * on it -- its whole point is the header prototype for that private
   * callback. Reproduced rather than closed; a variable's or parameter's
   * qualified type IS checked, as it was.
   */
  public declaration(declaration: TMemberDeclaration): void {
    const types = declaration.kind !== "struct";
    for (const part of DeclarationParts.of(declaration)) {
      if (types && part.kind === "type") this.type(part.type);
      for (const expr of ExpressionNodes.of(part)) this.expression(expr, types);
    }
    if (declaration.kind === "function") this.caseLabels(declaration);
  }

  /** A `case Scope.member:` label names a scope member too */
  private caseLabels(
    func: Extract<TMemberDeclaration, { kind: "function" }>,
  ): void {
    for (const label of StatementNodes.caseLabels(func)) {
      if (label.kind === "qualified") this.qualified(label.path, label.span);
    }
  }

  /**
   * A chain -- a value or an assignment target, which 1.2 returns alike.
   * `this.` states the scope; nothing to resolve. `global.Scope.member`: the
   * scope is the first op, the member the second.
   */
  private expression(expr: TExpression, types: boolean): void {
    if (types && expr.kind === "cast") this.type(expr.type);
    if (expr.kind !== "postfix") return;
    const primary = expr.primary;
    if (primary.kind === "root") {
      if (primary.root === "this") return;
      const scope = ScopeAccessCheck.memberOf(expr.ops[0]);
      const member = ScopeAccessCheck.memberOf(expr.ops[1]);
      if (scope && member) {
        this.check({ scope, member, viaGlobal: true, at: expr.span });
      }
      return;
    }
    if (primary.kind !== "identifier") return;
    const member = ScopeAccessCheck.memberOf(expr.ops[0]);
    if (member) {
      this.check({
        scope: primary.name,
        member,
        viaGlobal: false,
        at: expr.span,
      });
    }
  }

  private type(type: TTypeSyntax): void {
    if (type.kind === "array") this.type(type.element);
    if (type.kind === "qualified") this.qualified(type.path, type.span);
  }

  /** `Scope.member`, or `Scope.member.more`; 1.2 spells `global.T` apart */
  private qualified(names: readonly string[], at: ISourceSpan): void {
    if (names.length < 2) return;
    this.check({ scope: names[0], member: names[1], viaGlobal: false, at });
  }

  /** The member a `.name` op names, or null for a subscript, a call, or no op */
  private static memberOf(op: TPostfixOpSyntax | undefined): string | null {
    return op?.kind === "member" ? op.name : null;
  }

  // --- The rules, asked once ------------------------------------------------

  private check(access: IAccess): void {
    // A register declared inside a scope is owned by the register rules, not
    // these: `Board.GPIO.DR_SET[3] <- true;` inside `Board` compiles, and so
    // does `Board.GPIO.DR[0] <- true;` from `main`, private or not. Codegen's
    // register path exempted it ("a scoped register -- allow bare access")
    // before any of the three checks here could run, so it is exempt from all
    // three. `scopedRegisters` is keyed by the transpiled C name, so the key
    // goes through the single encoder rather than being spelled by hand.
    if (this.isScopedRegister(access)) return;

    const here = OperandTyper.scopePathAt(access.at, this.context);

    if (this.reportOwnScope(access, here)) return;
    if (this.reportPrivate(access, here)) return;
    this.reportShadowedGlobal(access, here);
  }

  /** E0435: `Counter.value` inside `Counter`. `global.Counter.value` is allowed. */
  private reportOwnScope(access: IAccess, here: string): boolean {
    if (access.viaGlobal || here === "" || access.scope !== here) return false;
    this.found.push({
      code: "E0435",
      span: access.at,
      message: `Cannot reference own scope '${access.scope}' by name; use 'this.${access.member}' instead of '${access.scope}.${access.member}'`,
      helpText:
        "Inside a scope its members are reached through `this.`; the scope's name is for the outside. `global.` is allowed when the qualification is deliberate.",
    });
    return true;
  }

  /** E0436: a private member reached from another scope or from file scope. */
  private reportPrivate(access: IAccess, here: string): boolean {
    if (!this.context.symbols.knownScopes.has(access.scope)) return false;
    if (access.scope === here) return false;
    const visibility = this.context.symbols.scopeMemberVisibility
      .get(access.scope)
      ?.get(access.member);
    if (visibility !== "private") return false;
    const context =
      here === "" ? "from outside the scope" : `from scope '${here}'`;
    this.found.push({
      code: "E0436",
      span: access.at,
      message: `Cannot access private member '${access.member}' of scope '${access.scope}' ${context}`,
      helpText:
        "Only public members are accessible outside their scope. Mark it `public`, or reach it through a public member.",
    });
    return true;
  }

  /**
   * E0437: inside a scope, a global enum or register whose name a scope member
   * -- or, for a register, a local variable -- shadows must be written with
   * `global.`. Bare, the name would resolve to the shadow and generate C that
   * names the wrong thing.
   */
  private reportShadowedGlobal(access: IAccess, here: string): void {
    if (access.viaGlobal || here === "") return;
    const symbols = this.context.symbols;

    const isEnum = symbols.knownEnums.has(access.scope);
    const isRegister = symbols.knownRegisters.has(access.scope);
    if (!isEnum && !isRegister) return;

    const shadowedByMember =
      symbols.scopeMembers.get(here)?.has(access.scope) ?? false;
    const shadowedByLocal =
      isRegister &&
      this.context.program.bindValue(
        this.context.sourceFile,
        null,
        access.scope,
        access.at,
      )?.kind === "local";
    if (!shadowedByMember && !shadowedByLocal) return;

    const kind = isEnum ? "enum" : "register";
    const why = shadowedByMember
      ? `scope member '${access.scope}' shadows the global ${kind}`
      : `a local variable named '${access.scope}' shadows the global ${kind}`;
    this.found.push({
      code: "E0437",
      span: access.at,
      message: `Use 'global.${access.scope}.${access.member}' to access ${kind} '${access.scope}' from inside scope '${here}' (${why})`,
      helpText:
        "A bare name resolves to the nearest declaration, which here is the shadow. `global.` names the file-scope one unambiguously.",
    });
  }

  private isScopedRegister(access: IAccess): boolean {
    const cName = ScopeUtils.getTranspiledCName({
      scopePath: access.scope,
      name: access.member,
    });
    return this.context.symbols.scopedRegisters.has(cName);
  }
}

class ScopeAccessAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** 1.2's syntax: declarations, then each function's case labels (#1991) */
  public analyze(program: IProgramSyntax): IScopeAccessError[] {
    const check = new ScopeAccessCheck(this.context);
    for (const member of program.members) {
      check.declaration(member.declaration);
    }
    return check
      .errors()
      .sort(
        (a, b) => a.span.line - b.span.line || a.span.column - b.span.column,
      );
  }
}

export default ScopeAccessAnalyzer;
