/**
 * Where a binding is declared: the declaration a written binding needs `mut`
 * on (ADR-071), or the one a diagnostic is about (#1402). A local's
 * declaration is in the file being analyzed; a global or a scope member may be
 * in an included one.
 */

import type IOperandType from "../types/IOperandType";
import type ISourceSite from "../types/ISourceSite";
import type TValueBinding from "../types/TValueBinding";
import type ITypingContext from "../types/ITypingContext";
import type TExpression from "../types/syntax/TExpression";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";
import OperandTyper from "./OperandTyper";

class BindingSite {
  static of(
    binding: TValueBinding | null,
    context: Pick<ITypingContext, "sourceFile">,
  ): ISourceSite | undefined {
    if (binding?.kind === "local") {
      const at = binding.declaration.extent;
      return {
        sourcePath: context.sourceFile,
        line: at.line,
        column: at.column,
      };
    }
    if (binding?.kind === "variable" || binding?.kind === "function") {
      return BindingSite.ofSymbol(binding.symbol);
    }
    return undefined;
  }

  /** A declaration in the file being analyzed, at its own position */
  static ofSpan(
    span: Pick<ISourceSite, "line" | "column">,
    context: Pick<ITypingContext, "sourceFile">,
  ): ISourceSite {
    return {
      sourcePath: context.sourceFile,
      line: span.line,
      column: span.column,
    };
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
   * #1402: a declaration by its C name -- this file's own first, then the
   * one an include supplies; undefined for a name nothing declares
   */
  static ofCName(
    cName: string | null,
    context: Pick<ITypingContext, "program" | "sourceFile">,
  ): ISourceSite | undefined {
    if (cName === null) return undefined;
    const found = context.program.symbolTable().getOverloadsByCName(cName);
    const symbol =
      found.find((candidate) => candidate.sourceFile === context.sourceFile) ??
      found[0];
    return symbol && BindingSite.ofSymbol(symbol);
  }

  /** #1402: where `scopePath.name` is declared, by the binder's identity */
  static ofMember(
    scopePath: string,
    name: string,
    context: Pick<ITypingContext, "program">,
  ): ISourceSite | undefined {
    const symbol = context.program.memberOf(scopePath, name);
    return symbol && BindingSite.ofSymbol(symbol);
  }

  /** #1402: the declaration a chain is rooted in, `a` of `a.b[0].c` */
  static ofChain(
    chain: TExpression,
    context: ITypingContext,
  ): ISourceSite | undefined {
    return BindingSite.of(OperandTyper.rootOfTarget(chain, context), context);
  }

  /**
   * #1402: the declaration of what a chain's last member names -- the struct
   * declaring `data` in `shared.data`, wherever that struct is declared; the
   * chain's root when it names no member
   */
  static ofSubject(
    chain: TExpression,
    context: ITypingContext,
  ): ISourceSite | undefined {
    const owner = OperandTyper.chainOf(chain, context)
      .steps.filter((step) => step.member !== null && step.property === null)
      .at(-1)?.before?.typeName;
    return owner
      ? (BindingSite.ofCName(owner, context) ??
          BindingSite.ofChain(chain, context))
      : BindingSite.ofChain(chain, context);
  }

  /**
   * #1402: the declaration an operand diagnostic is about -- the first name
   * its operands read that is declared in another file, else the first
   * declared in this one; undefined when they read no declared name
   */
  static ofOperands(
    operands: readonly TExpression[],
    context: ITypingContext,
  ): ISourceSite | undefined {
    const sites = operands
      .flatMap((operand) => OperandTyper.valueLeaves(operand, context))
      .flatMap((leaf) => BindingSite.ofLeaf(leaf, context) ?? []);
    return (
      sites.find((site) => site.sourcePath !== context.sourceFile) ?? sites[0]
    );
  }

  /** A value leaf's declaration: its binding's, or an enum member's enum's */
  private static ofLeaf(
    leaf: IOperandType | null,
    context: ITypingContext,
  ): ISourceSite | undefined {
    if (leaf === null) return undefined;
    if (leaf.binding !== null) return BindingSite.of(leaf.binding, context);
    return context.program.symbolByCName(leaf.typeName ?? "")?.kind === "enum"
      ? BindingSite.ofCName(leaf.typeName, context)
      : undefined;
  }
}

export default BindingSite;
