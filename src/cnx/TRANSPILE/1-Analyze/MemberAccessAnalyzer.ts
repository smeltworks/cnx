/**
 * #1805: a `.name` applied to a value whose type has no members.
 *
 * Only a type that declares members answers a member access: a struct, a
 * bitmap, a header struct or union. Any other value -- an integer, a float,
 * a bool, an enum value, a string, an array -- answers only the ADR-058 and
 * ADR-045 properties the typer reads on the step. A local or parameter named
 * like a scope is a local (ADR-057: local, scope, global, before a `.` as
 * everywhere), so `Motor.get()` on a `u8 Motor` is a member of a `u8`.
 * The value's type is the one the binder bound the root to, through the
 * operand typer's chain; nothing here looks a name up again.
 *
 * Not this rule's: a type named as a value (E0897), a property a type does
 * not answer (E0867), a field a struct does not declare (#2061), and a
 * prefix the typer could not settle -- a scope, a register, a header path.
 *
 * Error code:
 * - E0927: a member of a value whose type has none
 */
import BindingSite from "../../utils/BindingSite";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ExpressionShape from "../../utils/ExpressionShape";
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import OperandTyper from "../../utils/OperandTyper";
import type IChainStep from "../../types/IChainStep";
import type IOperandType from "../../types/IOperandType";
import type ISourceSite from "../../types/ISourceSite";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import RegisterInstance from "../../utils/RegisterInstance";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IMemberAccessError from "./types/IMemberAccessError";

const HELP =
  "Only a struct, a bitmap, a scope, a register or a header struct or union has members; any other value answers only its length properties (ADR-058). A local or parameter named like a scope shadows it: reach the scope with global.Scope.member (ADR-057).";

class MemberAccessAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain, read or written */
  public analyze(program: IProgramSyntax): IMemberAccessError[] {
    return ExpressionNodes.ofProgram(program).flatMap((expr) =>
      this.check(expr),
    );
  }

  private check(chain: TExpression): IMemberAccessError[] {
    if (chain.kind !== "postfix") return [];
    const steps = OperandTyper.chainOf(chain, this.context).steps;
    const index = steps.findIndex((step) => this.hasNoSuchMember(step));
    if (index < 0) return [];
    const step = steps[index];
    return [
      {
        code: "E0927",
        span: chain.ops[index].span,
        message: `'${ExpressionShape.writtenThrough(chain, index)}' is a ${this.typeOf(step)} and has no member '${step.member}'`,
        helpText: HELP,
        declaredAt: this.typeDeclaredAt(step, chain),
      },
    ];
  }

  /** #1402: the declaration E0927 is about -- the type that has no members, wherever it is declared */
  private typeDeclaredAt(
    step: IChainStep,
    chain: TExpression,
  ): ISourceSite | undefined {
    const cName = step.before?.typeName ?? step.before?.bitmapTypeName ?? null;
    return (
      BindingSite.ofCName(cName, this.context) ??
      BindingSite.ofChain(chain, this.context)
    );
  }

  /** A `.name` step on a settled value whose type declares no members */
  private hasNoSuchMember(step: IChainStep): boolean {
    const before = step.before;
    if (step.member === null || step.property !== null) return false;
    if (before === null || step.beforeNamesType) return false;
    if (before.typeName === null && before.bitmapTypeName === null) {
      return false;
    }
    return !this.hasMembers(before);
  }

  /** The allow-list: the value types that declare members */
  private hasMembers(t: IOperandType): boolean {
    if (t.dimensions.length > 0) return false;
    if (t.bitmapTypeName !== null) return true;
    if (t.typeName === null) return false;
    const symbol = this.context.program.symbolByCName(t.typeName);
    // ADR-072: a register parameter's type is a register type
    if (symbol?.kind === "struct" || RegisterInstance.isType(symbol)) {
      return true;
    }
    // A C++ class or struct has members though it declares only methods
    const cpp = this.context.symbolTable.getCppSymbol(t.typeName);
    if (cpp?.kind === "class" || cpp?.kind === "struct") return true;
    return ForeignTypeFacts.isStructType(
      t.typeName,
      this.context.symbolTable,
      OperandTyper.target(this.context),
    );
  }

  /** The type's cnx name -- `Timing.Config`, never its C name `Timing__Config` (#1287, #1292) */
  private typeOf(step: IChainStep): string {
    const before = step.before;
    if (before === null) return "value";
    const cName = before.typeName ?? before.bitmapTypeName ?? "value";
    const name =
      this.context.program.symbolByCName(cName)?.cnxScopedName ?? cName;
    return before.dimensions.length > 0
      ? `${name}${before.dimensions.map((d) => `[${d}]`).join("")}`
      : name;
  }
}

export default MemberAccessAnalyzer;
