/**
 * Where a binding is declared: the declaration a written binding needs `mut`
 * on (ADR-071), or the one a diagnostic is about (#1402). A local's
 * declaration is in the file being analyzed; a global or a scope member may be
 * in an included one.
 */

import type ISourceSite from "../../../types/ISourceSite";
import type TValueBinding from "../../../types/TValueBinding";
import type IAnalysisContext from "../types/IAnalysisContext";

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
    if (binding?.kind === "variable") {
      const symbol = binding.symbol;
      return {
        sourcePath: symbol.sourceFile,
        line: symbol.span.line,
        column: symbol.span.column,
      };
    }
    return undefined;
  }
}

export default BindingSite;
