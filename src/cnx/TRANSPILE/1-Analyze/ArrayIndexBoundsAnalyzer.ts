/**
 * ADR-036 constant index bounds: E0854.
 *
 * #1322. Two throws in `TypeValidator.checkArrayBounds`, reached from three
 * codegen paths -- an assignment target, a multi-dimensional target, and (since
 * #1360) a subscript in value position -- all reporting `1:0` with the line
 * smuggled into the message text.
 *
 * ## What is subscripted, at each subscript
 *
 * `grid[i][9]` is bounded by the shape of `grid[i]`, not of `grid`, so the
 * question at every subscript is "what is the type of the chain before it".
 * That is the one operand typer's chain walk (#1668), the same for an
 * expression and an assignment target, where codegen once resolved the
 * array's name three different ways (bare, scope-resolved, and "root or
 * resolved identifier"). Its dimensions are 1.4's, folded where the array is
 * declared, so a local `const N <- 2` sizes `u8[N] buf` at 2 (#1664 box 7).
 *
 * ## One hole closed, probed
 *
 * `s.data[9]` with `u8[4] data` a struct field was never checked, read or
 * written: codegen bounded the ROOT variable's dimensions and `s` has none.
 * The prefix walk carries a field's dimensions, so a field is bounded like a
 * variable.
 *
 * ## What stays silent
 *
 * A runtime index; a dimension this pass cannot size (a C macro); a subscript
 * with no dimension left, which is a bit index and another rule's; and a
 * two-expression subscript, which is a slice or a bit range (ADR-007).
 */

import OperandTyper from "../../utils/OperandTyper";
import ExpressionShape from "../../utils/ExpressionShape";
import ElementCount from "../../utils/ElementCount";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import UNRESOLVED_DIMENSION from "../../types/UNRESOLVED_DIMENSION";
import type IChainTyping from "../../types/IChainTyping";
import type ISourceSpan from "../../types/ISourceSpan";
import type TConstExpr from "../../types/TConstExpr";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import IArrayIndexBoundsError from "./types/IArrayIndexBoundsError";
import ConstantExpression from "./helpers/ConstantExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../types/IOperandType";

type TChain = Extract<TExpression, { kind: "postfix" }>;

/** One subscript in a chain: its expressions, and how many ops follow it. */
interface ISubscript {
  readonly expressions: readonly TExpression[];
  readonly opsAfter: number;
  readonly dimension: number;
  readonly at: ISourceSpan;
}

class ArrayIndexBoundsCheck {
  private readonly found: IArrayIndexBoundsError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IArrayIndexBoundsError[] {
    return this.found;
  }

  /**
   * Each subscript against the value it indexes, as the one operand typer
   * typed the chain -- a value or an assignment target, which 1.2 returns as
   * the same chain. A `this.`/`global.` root consumes its first `.name`, so
   * the typer's steps are the chain's LAST ops, in order.
   */
  public checkChain(chain: TExpression): void {
    if (chain.kind !== "postfix") return;
    const subscripts = ArrayIndexBoundsCheck.subscriptsOf(chain.ops);
    if (subscripts.length === 0) return;
    const typing = OperandTyper.chainOf(chain, this.context);
    for (const subscript of subscripts) {
      const step = typing.steps.at(-1 - subscript.opsAfter);
      const indexed = step?.before ?? null;
      this.check(
        subscript,
        indexed === null
          ? null
          : this.boundOf(indexed, subscript, typing, chain),
        ExpressionShape.writtenThrough(
          chain,
          chain.ops.length - subscript.opsAfter - 1,
        ),
      );
    }
  }

  /**
   * The leading dimension of what the subscript indexes: the number 1.4
   * settled, else -- a header macro 1.4 leaves unresolved -- the count
   * ElementCount reads from the dimension as declared, the one count render
   * spells defaults by (#1283 review). Null when there is none to check.
   */
  private boundOf(
    indexed: IOperandType,
    subscript: ISubscript,
    typing: IChainTyping,
    chain: TChain,
  ): number | null {
    const settled = indexed.dimensions[0];
    if (typeof settled === "number" && settled !== UNRESOLVED_DIMENSION) {
      return settled;
    }
    if (settled === "") return null; // an unsized `[]`
    const declared = this.declaredDimensions(subscript, typing, chain);
    const expr = declared?.[subscript.dimension - 1] ?? null;
    return expr === null
      ? null
      : ElementCount.of(expr, this.context.program, this.context.sourceFile);
  }

  /** The dimensions, as declared, of the array the subscript's run indexes */
  private declaredDimensions(
    subscript: ISubscript,
    typing: IChainTyping,
    chain: TChain,
  ): ReadonlyArray<TConstExpr | null> | undefined {
    const ops = chain.ops;
    const at = ops.length - 1 - subscript.opsAfter;
    // A `this.`/`global.` root's first `.name` is the root itself
    const first = chain.primary.kind === "root" ? 1 : 0;
    let member = -1;
    for (let i = at - 1; i >= first; i -= 1) {
      if (ops[i].kind !== "subscript") {
        member = i;
        break;
      }
    }
    if (member === -1) {
      const root = typing.root;
      if (root?.kind === "local") return root.declaration.arrayDimensionExprs;
      if (root?.kind === "variable") return root.symbol.arrayDimensionExprs;
      return undefined;
    }
    const owner = typing.steps.at(-1 - (ops.length - 1 - member))?.before;
    const struct = owner?.typeName
      ? this.context.program.symbolByCName(owner.typeName)
      : undefined;
    if (struct?.kind !== "struct") return undefined;
    const op = ops[member];
    return struct.fields.get(op.kind === "member" ? op.name : "")
      ?.dimensionExprs;
  }

  /** E0854 against the leading dimension of what the subscript indexes. */
  private check(
    subscript: ISubscript,
    bound: number | null,
    name: string,
  ): void {
    if (bound === null || subscript.expressions.length !== 1) return;
    const index = ConstantExpression.valueAt(
      subscript.expressions[0],
      this.context,
    );
    if (index === null) return;
    if (index < 0) {
      this.found.push({
        code: "E0854",
        span: subscript.at,
        message: `Array index out of bounds: ${index} is negative for '${name}' dimension ${subscript.dimension}`,
        helpText: "An index counts from zero (ADR-036).",
      });
      return;
    }
    if (bound > 0 && index >= bound) {
      this.found.push({
        code: "E0854",
        span: subscript.at,
        message: `Array index out of bounds: ${index} >= ${bound} for '${name}' dimension ${subscript.dimension}`,
        helpText: `The last valid index is ${bound - 1} (ADR-036).`,
      });
    }
  }

  /**
   * Every one-or-two-expression subscript op in a chain, with the number of
   * ops after it (so the prefix walk can stop before it) and which dimension
   * of the current base it indexes (subscripts since the last member step).
   */
  private static subscriptsOf(ops: readonly TPostfixOpSyntax[]): ISubscript[] {
    const found: ISubscript[] = [];
    let depth = 0;
    ops.forEach((op, index) => {
      if (op.kind !== "subscript") {
        depth = 0;
        return;
      }
      depth += 1;
      found.push({
        expressions: op.indexes,
        opsAfter: ops.length - index - 1,
        dimension: depth,
        at: op.span,
      });
    });
    return found;
  }
}

class ArrayIndexBoundsAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain 1.2 returned, values and assignment targets alike (#1991) */
  public analyze(program: IProgramSyntax): IArrayIndexBoundsError[] {
    const check = new ArrayIndexBoundsCheck(this.context);
    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part)) check.checkChain(expr);
      }
    }
    // 1.2's parts and their expressions are in source order
    return check.errors();
  }
}

export default ArrayIndexBoundsAnalyzer;
