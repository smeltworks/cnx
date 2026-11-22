/**
 * ADR-072 ruling 20: a C header bit-field whose type says neither `signed`
 * nor `unsigned` -- `int`, `short`, `long`, `char`, `int32_t`, a typedef of
 * one -- holds what the C compiler chooses. GCC makes `int f : 3` hold -4
 * through 3, and `-funsigned-bitfields` makes it hold 0 through 7, so the
 * same bits read back -1 under one build and 7 under the other. No range
 * cnx could judge it by is right for both, so it is read and written by
 * neither. Which fields these are, the operand typer decides once
 * (`signChosenByCompiler`); this reads it off the chain.
 *
 * Error code:
 * - E0944: a read or write of such a bit-field
 */
import BindingSite from "../../utils/BindingSite";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import OperandTyper from "../../utils/OperandTyper";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IBitFieldSignError from "./types/IBitFieldSignError";

const HELP =
  "A bit-field typed int, short, long, char or int32_t is signed or unsigned as the compiler and its flags choose (-funsigned-bitfields). Declare it signed int or unsigned int in its header (ADR-034).";

class BitFieldSignAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain, read or written */
  public analyze(program: IProgramSyntax): IBitFieldSignError[] {
    return program.members.flatMap((member) =>
      DeclarationParts.of(member.declaration).flatMap((part) =>
        ExpressionNodes.of(part).flatMap((expr) => this.check(expr)),
      ),
    );
  }

  private check(chain: TExpression): IBitFieldSignError[] {
    if (chain.kind !== "postfix") return [];
    const steps = OperandTyper.chainOf(chain, this.context).steps;
    const index = steps.findIndex(
      (step) => step.after?.signChosenByCompiler === true,
    );
    if (index < 0) return [];
    return [
      {
        code: "E0944",
        span: chain.ops[index].span,
        message: `The C compiler chooses whether bit-field '${steps[index].member}' is signed`,
        helpText: HELP,
        declaredAt: BindingSite.ofChain(chain, this.context),
      },
    ];
  }
}

export default BitFieldSignAnalyzer;
