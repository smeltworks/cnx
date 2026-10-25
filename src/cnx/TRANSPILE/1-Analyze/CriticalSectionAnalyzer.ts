/**
 * E0853: `return` inside a `critical` block leaves interrupts disabled.
 * E0916: a `critical` block on a target where disabling interrupts does not shut out every other execution context (#1789).
 *
 * The generated C brackets the block with `__cnx_get_PRIMASK()` /
 * `__cnx_disable_irq()` on the way in and `__cnx_set_PRIMASK(__primask)` on the
 * way out. A `return` jumps past the restore, so on device the interrupts stay
 * off -- not a wrong value, a hung system.
 *
 * ## Why this moved, and what moving found
 *
 * #1322 relocates it from three throws in `TypeValidator`, which shared one
 * message and were driven by a hand-rolled recursion:
 * `_validateStatementForEarlyExit` enumerated the statement kinds it would
 * descend into -- return, if, while, for, do-while.
 *
 * It did not list `switch`. So this compiled clean:
 *
 *     critical {
 *         switch (value) {
 *             case 1 { return value; }
 *         }
 *     }
 *
 * and emitted a `return` sitting between `__cnx_disable_irq()` and
 * `__cnx_set_PRIMASK()`. That is the exact hazard the rule exists to prevent,
 * shipped past the guard that prevents it.
 *
 * This walk cannot have that hole. It descends through `StatementChildren`,
 * which names every statement kind and stops compiling when one is added, so
 * every statement that can nest in a critical block is reached. It reads 1.2's
 * syntax, not the tree (#1991).
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TStatement from "../../types/syntax/TStatement";
import type ITargetDescription from "../../types/ITargetDescription";
import StatementChildren from "../../utils/StatementChildren";
import ICriticalSectionError from "./types/ICriticalSectionError";
import ResolvedTarget from "../../utils/ResolvedTarget";

class CriticalSectionAnalyzer {
  /** E0916's help, which `docs/error-codes.md` quotes */
  static readonly NO_CRITICAL_SECTION_HELP =
    "A critical block disables interrupts (ADR-050), which shuts out every other context only on a target whose description has interrupt_mask true. An atomic variable's read-modify-write needs no critical block; otherwise name a target that can mask.";

  private readonly found: ICriticalSectionError[] = [];

  /** The run's target, or null where 1.4 rejected it and said why */
  constructor(private readonly target: ITargetDescription | null) {}

  public analyze(program: IProgramSyntax): ICriticalSectionError[] {
    for (const member of program.members) {
      this.declaration(member.declaration);
    }
    return this.found;
  }

  private declaration(declaration: TMemberDeclaration): void {
    if (declaration.kind === "function") {
      this.statements(declaration.body.statements, false);
    }
  }

  private statements(
    statements: readonly TStatement[],
    inCritical: boolean,
  ): void {
    for (const statement of statements) this.statement(statement, inCritical);
  }

  /** `inCritical`: some enclosing statement is a `critical` block */
  private statement(statement: TStatement, inCritical: boolean): void {
    if (
      statement.kind === "critical" &&
      this.target !== null &&
      !ResolvedTarget.masksInterrupts(this.target)
    ) {
      this.found.push({
        code: "E0916",
        span: statement.span,
        message: `target '${this.target.name}' has no critical section: disabling interrupts there does not shut out every other execution context`,
        helpText: CriticalSectionAnalyzer.NO_CRITICAL_SECTION_HELP,
      });
    }
    if (statement.kind === "return" && inCritical) {
      this.found.push({
        code: "E0853",
        span: statement.span,
        message:
          "Cannot use 'return' inside critical section - would leave interrupts disabled",
        helpText:
          "The interrupt state is restored after the block; a `return` jumps past that restore. Assign the value to a variable inside the block and return it after the block closes.",
      });
    }
    this.statements(
      StatementChildren.of(statement),
      inCritical || statement.kind === "critical",
    );
  }
}

export default CriticalSectionAnalyzer;
