/**
 * ADR-072 ruling 20: a C header bit-field whose type says neither `signed`
 * nor `unsigned` -- `int`, `short`, `long`, `char`, `int32_t`, a typedef of
 * one -- holds what the C compiler chooses. GCC makes `int f : 3` hold -4
 * through 3, and `-funsigned-bitfields` makes it hold 0 through 7, so the
 * same bits read back -1 under one build and 7 under the other. No range
 * cnx could judge it by is right for both, so it is read and written by
 * neither. Nor is a bit-field whose width cnx cannot read, `f : sizeof(int)`
 * (#2494): a value cannot be judged against bits it does not know. Which
 * fields these are, the operand typer decides once (`signChosenByCompiler`,
 * `bitWidthUnread`); this reads it off the chain.
 *
 * Error codes:
 * - E0944: a read or write of a bit-field whose sign the compiler chooses
 * - E0946: a read or write of a bit-field whose width cnx cannot read
 */
import BindingSite from "../../utils/BindingSite";
import ExpressionNodes from "../../utils/ExpressionNodes";
import OperandTyper from "../../utils/OperandTyper";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IBitFieldRangeError from "./types/IBitFieldRangeError";

const SIGN_HELP =
  "A bit-field typed int, short, long, char or int32_t is signed or unsigned as the compiler and its flags choose (-funsigned-bitfields). Declare it signed int or unsigned int in its header (ADR-034).";
const WIDTH_HELP =
  "cnx judges what fits a bit-field by its width, and reads a width written as integer literals, arithmetic and bitwise operators, parentheses and macros of them. Write the width as one in its header (ADR-034).";

class BitFieldRangeAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain, read or written */
  public analyze(program: IProgramSyntax): IBitFieldRangeError[] {
    return ExpressionNodes.ofProgram(program).flatMap((expr) =>
      this.check(expr),
    );
  }

  private check(chain: TExpression): IBitFieldRangeError[] {
    if (chain.kind !== "postfix") return [];
    const steps = OperandTyper.chainOf(chain, this.context).steps;
    const index = steps.findIndex(
      (step) =>
        step.after?.signChosenByCompiler === true ||
        step.after?.bitWidthUnread === true,
    );
    if (index < 0) return [];
    const member = steps[index].member;
    const sign = steps[index].after?.signChosenByCompiler === true;
    return [
      {
        code: sign ? "E0944" : "E0946",
        // A rooted chain (`global.r.pi`) has one op its steps start after
        span: chain.ops[chain.ops.length - steps.length + index].span,
        message: sign
          ? `The C compiler chooses whether bit-field '${member}' is signed`
          : `cnx cannot read the width of bit-field '${member}'`,
        helpText: sign ? SIGN_HELP : WIDTH_HELP,
        declaredAt: BindingSite.ofChain(chain, this.context),
      },
    ];
  }
}

export default BitFieldRangeAnalyzer;
