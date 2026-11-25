import CppModeHelper from "../../2-Plan/CppModeHelper";
import PrivateConstSpelling from "../../2-Plan/PrivateConstSpelling";
import type TranspileState from "../../TranspileState";
import type IConstSpelling from "../../2-Plan/types/IConstSpelling";
import type TPlannedNarrowing from "../../2-Plan/types/TPlannedNarrowing";
import type IGeneratorOutput from "./generators/IGeneratorOutput";
import type IGeneratorState from "./generators/IGeneratorState";
import generateLiteral from "./generators/expressions/LiteralGenerator";

/**
 * #1739: a private scope const written where it is used, spelled as 2.2's
 * `PrivateConstSpelling` decided, through `generateLiteral`.
 */
class PrivateConstValue {
  static inlined(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const symbol = transpileState.typingContext().program.symbolByCName(cName);
    if (
      symbol?.kind !== "variable" ||
      !PrivateConstSpelling.canInline(symbol)
    ) {
      return null;
    }
    return PrivateConstValue.constant(generatorState, transpileState, cName);
  }

  /**
   * Any const's value as a C constant expression, or null -- what a `case`
   * label needs of a public or file-scope const too, which is emitted as an
   * object C cannot switch on (C99 6.8.4.2p3)
   */
  static constant(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const program = transpileState.typingContext().program;
    const spelling = PrivateConstSpelling.spelling(program, cName);
    if (spelling === null) return null;
    return PrivateConstValue.written(
      generatorState,
      transpileState,
      spelling,
      PrivateConstSpelling.narrowingOf(program, cName),
    );
  }

  /** A spelled value written through `generateLiteral`, as a literal of its type */
  static written(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    spelling: IConstSpelling,
    narrowing: TPlannedNarrowing | null,
  ): IGeneratorOutput {
    if (spelling.verbatim) return { code: spelling.text, effects: [] };
    // A literal has no sign: a negative value is the negated literal, in
    // parentheses so `-X` does not read as a decrement
    const negative = spelling.text.startsWith("-");
    const output = generateLiteral(
      negative ? spelling.text.slice(1) : spelling.text,
      { ...generatorState, expectedType: spelling.typeName },
      transpileState,
      narrowing,
    );
    if (negative) return { ...output, code: `(-${output.code})` };
    return {
      ...output,
      code: spelling.casts.reduceRight(
        (code, cType) => CppModeHelper.cast(cType, code, transpileState),
        output.code,
      ),
    };
  }
}

export default PrivateConstValue;
