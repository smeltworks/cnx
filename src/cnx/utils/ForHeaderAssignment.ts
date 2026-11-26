/**
 * ADR-068 (E0715, #1647): which assignment forms a `for` header clause cannot
 * hold. A clause is one C expression, and four forms lower to more than one
 * statement: a slice (one write per element), any write to an atomic (an
 * LDREX/STREX loop or a PRIMASK section, ADR-049 Q4/Q7), a bit write on a
 * float (through a union), and a string built from its parts (ADR-045). A
 * string copied whole is one `cnx_string_copy` call (#2207), so a header
 * holds it (#2234).
 *
 * One decision, read off the operand typer: 2.1 reports it as E0715, and the
 * header renderer asserts it, so neither derives it again. Which writes are
 * atomic is `AtomicOwner`'s answer, the one 2.2 plans the write's form from:
 * a bit or bitmap-field write to an atomic is a read-modify-write too (#2200),
 * and its written type, a bit, carries no `atomic` (#2155 review).
 */

import AtomicOwner from "./AtomicOwner";
import BitmapFieldStep from "./BitmapFieldStep";
import OperandTyper from "./OperandTyper";
import StringValueForm from "./StringValueForm";
import type ITypingContext from "../types/ITypingContext";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";

class ForHeaderAssignment {
  /** The form no header holds and why, or null for an assignment a header holds */
  static rejectedForm(
    site: IAssignmentSyntax,
    ctx: ITypingContext,
  ): string | null {
    const target = site.target;
    const steps = OperandTyper.chainOf(target, ctx).steps;
    const last = steps.at(-1);
    const isBitWrite = last?.subscript === "bit_range";
    if (isBitWrite && last.before?.category === "floating") {
      return "a float bit write is more than one statement";
    }
    const field = BitmapFieldStep.fieldOf(last, ctx.symbols.bitmapFields);
    if (AtomicOwner.ofWrite(site, ctx, field) !== null) {
      return "an atomic read-modify-write is more than one statement";
    }
    const written = OperandTyper.typeOfTarget(target, ctx);
    if (site.operator !== "<-") return null;
    if (AtomicOwner.isDeclaredAtomic(written))
      return "an atomic store is more than one statement";
    if (steps.some((step) => step.subscript === "array_slice")) {
      return "a slice write is more than one statement";
    }
    if (OperandTyper.stringCopyCapacity(target, ctx) === null) return null;
    return StringValueForm.isBuilt(site.value, ctx)
      ? "a string built from its parts is more than one statement"
      : null;
  }
}

export default ForHeaderAssignment;
