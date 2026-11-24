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
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import OperandTyper from "../../utils/OperandTyper";
import StructInitializerType from "./helpers/StructInitializerType";
import ValuePositions from "./helpers/ValuePositions";
import type IOperandType from "../../types/IOperandType";
import type ISourceSite from "../../types/ISourceSite";
import type ISourceSpan from "../../types/ISourceSpan";
import type IValuePosition from "../../types/IValuePosition";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IBitFieldRangeError from "./types/IBitFieldRangeError";

const SIGN_HELP =
  "A bit-field typed int, short, long, char or int32_t is signed or unsigned as the compiler and its flags choose (-funsigned-bitfields). Declare it signed int or unsigned int in its header (ADR-034).";
const WIDTH_HELP =
  "cnx judges what fits a bit-field by its width, and reads a width written as integer literals, arithmetic and bitwise operators, parentheses and macros of them. Write the width as one in its header (ADR-034).";

class BitFieldRangeAnalyzer {
  constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  /** Every chain, read or written, and every `{ field: value }` write */
  public analyze(program: IProgramSyntax): IBitFieldRangeError[] {
    return ExpressionNodes.ofProgram(program).flatMap((expr) =>
      expr.kind === "structInitializer"
        ? this.checkInitializer(expr)
        : this.check(expr),
    );
  }

  private check(chain: TExpression): IBitFieldRangeError[] {
    if (chain.kind !== "postfix") return [];
    const steps = OperandTyper.chainOf(chain, this.context).steps;
    const index = steps.findIndex((step) =>
      BitFieldRangeAnalyzer.hasNoRange(step.after),
    );
    if (index < 0) return [];
    return [
      BitFieldRangeAnalyzer.error(
        steps[index].after,
        steps[index].member,
        // A rooted chain (`global.r.pi`) has one op its steps start after
        chain.ops[chain.ops.length - steps.length + index].span,
        BindingSite.ofChain(chain, this.context),
      ),
    ];
  }

  /** A header struct's fields, written by `{ field: value }` */
  private checkInitializer(
    expr: Extract<TExpression, { kind: "structInitializer" }>,
  ): IBitFieldRangeError[] {
    const position = ValuePositions.at(this.positions, expr);
    const typeText = StructInitializerType.valueTypeAt(position);
    if (typeText === null) return [];
    const cName = this.context.program.cTypeNameAt(
      this.context.sourceFile,
      typeText,
      expr.span,
    );
    const declaredAt = StructInitializerType.declarationOf(
      position,
      expr.span,
      this.context,
    );
    return expr.fields.flatMap((field) => {
      const operand = ForeignTypeFacts.fieldOperand(
        cName,
        field.name,
        this.context.symbolTable,
        OperandTyper.target(this.context),
      );
      return BitFieldRangeAnalyzer.hasNoRange(operand)
        ? [
            BitFieldRangeAnalyzer.error(
              operand,
              field.name,
              field.span,
              declaredAt,
            ),
          ]
        : [];
    });
  }

  private static hasNoRange(operand: IOperandType | null | undefined): boolean {
    return (
      operand?.signChosenByCompiler === true || operand?.bitWidthUnread === true
    );
  }

  private static error(
    operand: IOperandType | null | undefined,
    member: string | null,
    span: ISourceSpan,
    declaredAt: ISourceSite | undefined,
  ): IBitFieldRangeError {
    const sign = operand?.signChosenByCompiler === true;
    return {
      code: sign ? "E0944" : "E0946",
      span,
      message: sign
        ? `The C compiler chooses whether bit-field '${member}' is signed`
        : `cnx cannot read the width of bit-field '${member}'`,
      helpText: sign ? SIGN_HELP : WIDTH_HELP,
      declaredAt,
    };
  }
}

export default BitFieldRangeAnalyzer;
