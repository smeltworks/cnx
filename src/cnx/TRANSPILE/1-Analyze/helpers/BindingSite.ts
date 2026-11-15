/**
 * Where a binding is declared: the declaration a written binding needs `mut`
 * on (ADR-071), or the one a diagnostic is about (#1402). A local's
 * declaration is in the file being analyzed; a global or a scope member may be
 * in an included one.
 */

import type ISourceSite from "../../../types/ISourceSite";
import type TValueBinding from "../../../types/TValueBinding";
import type IAnalysisContext from "../types/IAnalysisContext";
import type TExpression from "../../../types/syntax/TExpression";
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import OperandTyper from "../../../utils/OperandTyper";

class BindingSite {
  static of(
    binding: TValueBinding | null,
    context: IAnalysisContext,
  ): ISourceSite | undefined {
    if (binding?.kind === "local") {
      const at = binding.declaration.extent;
      return {
        sourcePath: context.sourceFile,
        line: at.line,
        column: at.column,
      };
    }
    if (binding?.kind === "variable")
      return BindingSite.ofSymbol(binding.symbol);
    return undefined;
  }

  /** Where a symbol is declared, in whichever file declares it */
  static ofSymbol(
    symbol: Pick<IFunctionSymbol, "sourceFile" | "span">,
  ): ISourceSite {
    return {
      sourcePath: symbol.sourceFile,
      line: symbol.span.line,
      column: symbol.span.column,
    };
  }

  /**
   * #1402: the declaration an operand diagnostic is about -- the first name
   * its operands read that is declared in another file, else the first
   * declared in this one; undefined when they read no declared name
   */
  static ofOperands(
    operands: readonly TExpression[],
    context: IAnalysisContext,
  ): ISourceSite | undefined {
    const sites = operands
      .flatMap((operand) => OperandTyper.valueLeaves(operand, context))
      .flatMap((leaf) => BindingSite.of(leaf?.binding ?? null, context) ?? []);
    return (
      sites.find((site) => site.sourcePath !== context.sourceFile) ?? sites[0]
    );
  }
}

export default BindingSite;
