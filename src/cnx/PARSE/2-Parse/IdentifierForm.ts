/**
 * ADR-063 / Issue #1117: the underscore rule on declared identifiers.
 *
 * How a declared name is spelled is syntax, so 1.2 reports it with the file's
 * other parse errors (#1991), off the tree only 1.2 holds.
 *
 * A cnx identifier may not end with `_` and may not contain `__`. That reserves
 * `__` exclusively for the transpiler as the qualified-name separator, which makes
 * `Scope__member` injective: distinct declarations can no longer produce the same C
 * identifier. A leading underscore stays legal — injectivity constrains only the
 * separator's left boundary, so the `_handler` private-member idiom (ADR-029) is
 * unaffected.
 *
 * Only DECLARATION contexts are checked. References are deliberately skipped, which
 * is what lets a cnx file call an external C symbol such as `__disable_irq()`
 * without tripping the rule (ADR-010, ADR-063).
 */

import { ParseTreeWalker, TerminalNode } from "antlr4ng";
import FormError from "./FormError";
import { CnxListener } from "./grammar/CnxListener";
import * as Parser from "./grammar/CnxParser";
import type ITranspileError from "../../types/ITranspileError";
import ReservedCnxName from "../../utils/ReservedCnxName";
import TIdentifierViolation from "./types/TIdentifierViolation";

/**
 * Pure function classifying an identifier against the ADR-063 rule.
 *
 * @param identifierName - The identifier as written in the source
 * @returns The violation kind, or null when the identifier is legal
 */
function classifyIdentifier(
  identifierName: string,
): TIdentifierViolation | null {
  // Checked first because it is the more specific diagnosis: `cnx__value` breaks
  // both rules, and naming the reserved prefix tells the author more than
  // pointing at the underscores.
  if (ReservedCnxName.isReserved(identifierName)) {
    return "reserved-prefix";
  }
  if (identifierName.includes("__")) {
    return "consecutive";
  }
  if (identifierName.endsWith("_")) {
    return "trailing";
  }
  return null;
}

/**
 * The diagnostic code for each violation kind.
 *
 * Part 1 of ADR-063 is E0201; part 2 is E0202. Keeping the mapping beside the
 * classifier means a new rule cannot be added without deciding its code.
 */
const VIOLATION_CODES: Readonly<Record<TIdentifierViolation, string>> = {
  trailing: "E0201",
  consecutive: "E0201",
  "reserved-prefix": "E0202",
};

/**
 * Pure function creating the error message for a violation.
 */
function formatIdentifierSyntaxError(
  identifierName: string,
  violation: TIdentifierViolation,
): string {
  if (violation === "reserved-prefix") {
    return (
      `Identifier '${identifierName}' cannot begin with '${ReservedCnxName.PREFIX}'. ` +
      `That prefix is reserved for names the transpiler generates, compared case-insensitively.`
    );
  }
  if (violation === "consecutive") {
    return (
      `Identifier '${identifierName}' cannot contain consecutive underscores. ` +
      `'__' is reserved as the separator for scope-qualified names in generated C.`
    );
  }
  return (
    `Identifier '${identifierName}' cannot end with an underscore. ` +
    `A trailing underscore would make scope-qualified names ambiguous in generated C.`
  );
}

/**
 * Pure function producing a name that satisfies the rule.
 *
 * Applies BOTH normalizations regardless of which clause was reported, because an
 * identifier can break both at once. `classifyIdentifier` reports "consecutive"
 * first, so fixing only that would suggest `my_value_` for `my__value_` — a name
 * E0201 itself rejects.
 */
function suggestLegalIdentifier(identifierName: string): string {
  const withoutReservedPrefix = ReservedCnxName.isReserved(identifierName)
    ? identifierName.slice(ReservedCnxName.PREFIX.length)
    : identifierName;

  // The trailing match is a single `_`, not `_+`: the collapse above has already
  // reduced every run to one underscore, so at most one can remain at the end.
  // `_+$` would be equivalent but backtracks super-linearly on a long run of
  // underscores (SonarCloud S8786).
  return withoutReservedPrefix.replaceAll(/_+/g, "_").replace(/_$/, "");
}

/**
 * Pure function creating the help text for a violation.
 */
function formatIdentifierSyntaxHelp(
  identifierName: string,
  violation: TIdentifierViolation,
): string {
  const suggestion = suggestLegalIdentifier(identifierName);
  if (violation === "reserved-prefix") {
    return `Drop the reserved prefix (e.g. '${suggestion}')`;
  }
  if (violation === "consecutive") {
    return `Use a single underscore instead (e.g. '${suggestion}')`;
  }
  return `Remove the trailing underscore (e.g. '${suggestion}')`;
}

/**
 * Listener that walks every declaration context checking the declared identifier.
 *
 * Each handler delegates to the analyzer's single check() entry point rather than
 * repeating the classify/report logic, which keeps the thirteen near-identical
 * handlers from tripping duplication analysis.
 */
class IdentifierSyntaxListener extends CnxListener {
  readonly found: ITranspileError[] = [];

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterRegisterDeclaration = (
    ctx: Parser.RegisterDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterRegisterMember = (ctx: Parser.RegisterMemberContext): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterStructDeclaration = (
    ctx: Parser.StructDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterStructMember = (ctx: Parser.StructMemberContext): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterEnumDeclaration = (
    ctx: Parser.EnumDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterEnumMember = (ctx: Parser.EnumMemberContext): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterBitmapDeclaration = (
    ctx: Parser.BitmapDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterBitmapMember = (ctx: Parser.BitmapMemberContext): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.check(ctx.IDENTIFIER());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.check(ctx.IDENTIFIER());
  };

  private check(identifier: TerminalNode | null): void {
    // ANTLR types every name as optional; only a recovery tree omits one,
    // and 1.2 does not check form on those.
    if (identifier === null) {
      return;
    }
    const identifierName = identifier.getText();
    const violation = classifyIdentifier(identifierName);
    if (violation === null) {
      return;
    }
    this.found.push(
      FormError.at(
        identifier.symbol,
        VIOLATION_CODES[violation],
        formatIdentifierSyntaxError(identifierName, violation),
        formatIdentifierSyntaxHelp(identifierName, violation),
      ),
    );
  }
}

/**
 * Analyzer for identifier syntax violations (ADR-063)
 */
class IdentifierForm {
  static errorsIn(tree: Parser.ProgramContext): ITranspileError[] {
    const listener = new IdentifierSyntaxListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.found;
  }
}

export default IdentifierForm;
