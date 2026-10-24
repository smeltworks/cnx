/**
 * ADR-017 bare enum members: E0424.
 *
 * #1322. Four throws in `output/` -- two arms in `CodeGenerator`, one in
 * `SwitchGenerator` for a case label, one in `ControlFlowGenerator` for a
 * return -- decided whether an enum member written BARE (`RED` rather than
 * `Color.RED`) stands where something names its enum. Two of them reported
 * `1:0`; the other two computed a position and spent it on the message.
 *
 * ## The rule is about POSITION, read off 2.1's one walk of positions
 *
 * Codegen carried an `expectedType` set by whichever generator was running,
 * cleared by a comparison and suppressed inside a call's arguments. That
 * position is now recorded once, by `ValuePositions` (#1991): each value's
 * innermost site and the site enclosing it. 2.2 plans the type each value is
 * written against from the same sites, and this check reads the enum from them:
 *
 *   names its enum   a variable initializer, a plain or compound assignment,
 *                    a return, a struct-initializer field (even one passed as
 *                    an argument, or declared in a `for` header)
 *   names none       a comparison operand, a subscript, a call argument, an
 *                    assignment's target, a slice or bit range written to,
 *                    and a `for` header's own declaration and assignments
 *
 * The `for` header's own value is the one row that differs from a statement
 * outside it: #1537 waits on ADR-017 saying whether it names an enum. A field
 * inside it does, as it did before #1991.
 *
 * ## One hole closed, probed
 *
 * `Color c <- YELLOW` with `YELLOW` declared only by `Status` resolved nothing
 * (the expected enum has no such member) and codegen then emitted the bare
 * name into C, exit 0. Here it is E0424 with the enums that do declare it.
 *
 * ## What "bare" means
 *
 * A name is a bare enum member only when nothing else declares it: a local,
 * parameter, const, function or register of the same spelling wins, exactly
 * as codegen resolved a declared name before ever asking the enums. That
 * predicate is E0427's, shared rather than restated.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";
import ValuePositions from "./helpers/ValuePositions";
import IBareEnumMemberError from "./types/IBareEnumMemberError";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IValuePositions from "../../types/IValuePositions";
import type TValueSite from "../../types/TValueSite";

/** The enum a position names, or null when it names none */
type TExpected = string | null;

type TIdentifier = Extract<TExpression, { kind: "identifier" }>;

/** The enum each value's site names (#1991), from 2.1's one walk of sites */
class ExpectedEnums {
  private constructor(
    private readonly context: IAnalysisContext,
    private readonly valuePositions: IValuePositions,
    private readonly forClauses: ReadonlySet<object>,
  ) {}

  static of(
    program: IProgramSyntax,
    context: IAnalysisContext,
    valuePositions: IValuePositions,
  ): ExpectedEnums {
    const forClauses = new Set<object>();
    for (const member of program.members) {
      for (const statement of StatementNodes.in(member.declaration)) {
        if (statement.kind !== "for") continue;
        if (statement.init) forClauses.add(statement.init);
        if (statement.update) forClauses.add(statement.update);
      }
    }
    return new ExpectedEnums(context, valuePositions, forClauses);
  }

  at(expr: TExpression): TExpected {
    const at = this.valuePositions.sites.get(expr);
    return at === undefined ? null : this.ofSite(at.site, expr);
  }

  private ofSite(site: TValueSite, expr: TExpression): TExpected {
    switch (site.kind) {
      case "declaration":
        return this.forClauses.has(site.declaration)
          ? null
          : this.enumOfWritten(site.declaration.type, site.declaration.span);
      case "assignment":
        return this.forClauses.has(site.assignment)
          ? null
          : this.targetEnum(site.assignment.target);
      case "return":
        return this.enumOfWritten(site.function.returnType, site.function.span);
      case "field":
        return this.fieldEnum(expr);
      default:
        return null;
    }
  }

  private fieldEnum(value: TExpression): TExpected {
    const field = ValuePositions.at(
      this.valuePositions.positions,
      value,
    ).typeText;
    return field !== null && this.context.symbols.knownEnums.has(field)
      ? field
      : null;
  }

  /** A slice or bit range writes elements or bits, and names no enum */
  private targetEnum(target: TExpression): TExpected {
    const writesRange =
      target.kind === "postfix" &&
      target.ops.some(
        (op) => op.kind === "subscript" && op.indexes.length === 2,
      );
    if (writesRange) return null;
    return (
      OperandTyper.typeOfTarget(target, this.context)?.enumTypeName ?? null
    );
  }

  private enumOfWritten(type: TTypeSyntax, at: ISourcePosition): TExpected {
    return (
      OperandTyper.typeOfWritten(type, this.context, at)?.enumTypeName ?? null
    );
  }
}

class BareEnumMemberAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(
    program: IProgramSyntax,
    valuePositions: IValuePositions,
  ): IBareEnumMemberError[] {
    const expected = ExpectedEnums.of(program, this.context, valuePositions);
    const expressions = program.members
      .flatMap((member) => DeclarationParts.of(member.declaration))
      .flatMap(ExpressionNodes.of);
    // A chain's head and an assignment's target name a value; they are not one.
    const notValues = new Set<TExpression>();
    for (const expr of expressions) {
      if (expr.kind === "postfix") notValues.add(expr.primary);
    }
    for (const member of program.members) {
      for (const site of StatementNodes.assignments(member.declaration)) {
        notValues.add(site.target);
      }
    }
    const found: IBareEnumMemberError[] = [];
    for (const expr of expressions) {
      if (expr.kind !== "identifier" || notValues.has(expr)) continue;
      const error = this.check(expr, expected.at(expr));
      if (error !== null) found.push(error);
    }
    return found.sort(
      (a, b) => a.span.line - b.span.line || a.span.column - b.span.column,
    );
  }

  private check(
    identifier: TIdentifier,
    expected: TExpected,
  ): IBareEnumMemberError | null {
    const symbols = this.context.symbols;
    const name = identifier.name;
    const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
    if (declaring.length === 0) return null;
    const scopePath = OperandTyper.scopePathAt(identifier.span, this.context);
    if (
      UndeclaredValueAnalyzer.isDeclaredValue(
        name,
        identifier.span,
        scopePath,
        this.context,
      )
    ) {
      return null;
    }
    if (expected !== null && symbols.enumMembers.get(expected)?.has(name)) {
      return null;
    }
    return {
      code: "E0424",
      span: identifier.span,
      message: EnumMemberSuggestion.message(name, declaring),
      helpText:
        "A bare enum member is accepted only where its enum is already named -- a declaration or assignment of that type, a return from a function of that type, a field of that type. Elsewhere, qualify it (ADR-017).",
    };
  }
}

export default BareEnumMemberAnalyzer;
