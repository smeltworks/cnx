/**
 * ADR-007 bit indexing: E0856, E0888.
 *
 * #1322. Two throws, both reported as `1:0` after building a position into
 * their own message text (`Error at line N: …`) -- a position carried as prose
 * rather than by the diagnostic.
 *
 * ## E0856: how many subscripts a base allows
 *
 * ADR-036 gives an array one subscript per dimension; ADR-007 gives a
 * bit-indexable scalar one more, for the bit. So `arr[i][b]` is the last legal
 * form for a one-dimensional array and `arr[i][b][x]` indexes a value that is
 * not an array.
 *
 * Only integer and float bases are checked, as codegen did: a string is a char
 * array with its own rules, a bitmap rejects bracket indexing under E0883, and
 * a struct is reached through member access instead.
 *
 * ## E0888: a float bit range needs somewhere to put the union
 *
 * Reading `f[start, width]` on a float is lowered to a union copy (MISRA
 * C:2012 Rule 21.15 forbids the pointer cast), and a union copy is a
 * statement. At file scope there is no statement to emit it into. This is the
 * one rule here that is about WHERE the access is written rather than what it
 * is written on.
 *
 * ## E0890: a read-modify-write evaluates its target twice
 *
 * A bit, bit-range or bitmap-field write keeps the other bits, so it reads the
 * target and stores it back: every subscript in the target, and the bit index
 * with it, is evaluated twice. A call or a volatile read there runs twice, and
 * the store can land on a different element than the read. Owner ruling
 * (#1760 review): reject it, as E0702 rejects a call in a condition. A
 * write-1 register member is composed without a read (ADR-004), so it is
 * evaluated once and is not restricted.
 */

import ExpressionShape from "../../utils/ExpressionShape";
import FloatBits from "../../utils/FloatBits";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import OperandTyper from "../../utils/OperandTyper";
import IBitAccessError from "./types/IBitAccessError";
import TChainRoot from "../../types/TChainRoot";
import RegisterAccessMode from "../../utils/RegisterAccessMode";
import BitmapFieldStep from "../../utils/BitmapFieldStep";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";
import ConstantExpression from "./helpers/ConstantExpression";

class BitAccessCheck {
  private readonly found: IBitAccessError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IBitAccessError[] {
    return this.found;
  }

  /**
   * The chain's declared name, its root, and the subscripts after that name:
   * `this.x[3]` is `x` under `this`, with `[3]` after it.
   */
  private static partsOf(expr: TExpression): {
    name: string;
    root: TChainRoot;
    subscripts: readonly TPostfixOpSyntax[];
  } | null {
    if (expr.kind !== "postfix") return null;
    const primary = expr.primary;
    if (primary.kind === "identifier") {
      return { name: primary.name, root: null, subscripts: expr.ops };
    }
    if (primary.kind !== "root") return null;
    const first = expr.ops[0];
    if (first?.kind !== "member") return null;
    return {
      name: first.name,
      root: primary.root,
      subscripts: expr.ops.slice(1),
    };
  }

  public checkExpression(expr: TExpression, inFunction: boolean): void {
    this.checkBitBounds(expr);
    const parts = BitAccessCheck.partsOf(expr);
    if (parts === null) return;
    this.checkChain(parts, expr, inFunction);
  }

  public checkSite(site: IAssignmentSyntax): void {
    this.checkBitBounds(site.target);
    const parts = BitAccessCheck.partsOf(site.target);
    if (parts === null) return;
    this.checkChain(parts, site.target, true);
    this.checkSingleEvaluation(site);
  }

  /**
   * ADR-007: a bit, bit-range or bitmap-field write reads its target and
   * stores it back, so a subscript with a side effect would run twice.
   */
  private checkSingleEvaluation(site: IAssignmentSyntax): void {
    if (site.operator !== "<-") return;
    const target = site.target;
    if (target.kind !== "postfix" || !this.isReadModifyWrite(target)) return;
    const indices = target.ops.flatMap((op) =>
      op.kind === "subscript" ? op.indexes : [],
    );
    for (const index of indices) {
      if (!OperandTyper.hasSideEffect(index, this.context)) continue;
      this.report(
        index,
        "E0890",
        `'${index.written}' would be evaluated twice: '${target.written}' is read and then written back`,
        "A bit, bit-range or bitmap-field write keeps the other bits, so it reads its target and stores it back, and every subscript in the target runs twice. Store the index in a variable first (ADR-007).",
      );
    }
  }

  /**
   * The typer's last step, read as the classifier reads it (#1749 review): a
   * bit, a bit range or a bitmap field, on anything but a
   * write-1 register member.
   */
  private isReadModifyWrite(target: TExpression): boolean {
    const last = OperandTyper.chainOf(target, this.context).steps.at(-1);
    if (last === undefined) return false;
    const symbols = this.context.symbols;
    const field = BitmapFieldStep.fieldOf(last, symbols.bitmapFields);
    if (!BitmapFieldStep.writesBits(last, field)) return false;
    const member = last.beforeRegisterMember;
    return (
      member === null ||
      !RegisterAccessMode.isWriteOne(symbols.registerMemberAccess.get(member))
    );
  }

  private checkChain(
    parts: {
      name: string;
      root: TChainRoot;
      subscripts: readonly TPostfixOpSyntax[];
    },
    at: TExpression,
    inFunction: boolean,
  ): void {
    const declared =
      OperandTyper.chainOf(at, this.context).steps[0]?.before ?? null;
    if (declared === null) return; // not a declaration this pass can measure
    const spelling =
      parts.root === null ? parts.name : `${parts.root}.${parts.name}`;
    const baseType = declared.typeName ?? "";
    if (!inFunction) this.checkFloatRangeScope(spelling, at);
    this.checkDepth(
      parts.subscripts,
      declared.dimensions.length,
      baseType,
      spelling,
      at,
    );
  }

  /**
   * E0888: a float bit RANGE read outside a function body. A single bit index
   * is not lowered through a union, so it is not restricted.
   */
  private checkFloatRangeScope(name: string, at: TExpression): void {
    const head = ExpressionShape.headOf(at);
    const steps = OperandTyper.chainOf(at, this.context).steps;
    const index = head.ops.findIndex(
      (op, i) =>
        op.kind === "subscript" &&
        FloatBits.rangeTypeOf(steps[i - head.opsConsumed]) !== null,
    );
    const range = head.ops[index];
    if (range === undefined) return;
    // The float ranged, not the chain's root (#1099): `r.field`, not `r`
    const reached = head.ops
      .slice(head.opsConsumed, index)
      .map((op) => {
        if (op.kind === "member") return `.${op.name}`;
        if (op.kind === "subscript") {
          return `[${op.indexes.map((e) => e.written).join(", ")}]`;
        }
        return "(...)";
      })
      .join("");
    const bounds =
      range.kind === "subscript" ? range.indexes.map((e) => e.written) : [];
    this.report(
      at,
      "E0888",
      `Float bit range '${name}${reached}[${bounds.join(", ")}]' cannot be read at file scope`,
      "Reading a float's bits copies it through a union (MISRA C:2012 Rule 21.15 forbids the pointer cast), and a copy is a statement -- there is none at file scope. Read it inside a function.",
    );
  }

  /**
   * E0920 (ADR-007, #1808): a constant bit index, or a constant bit range's
   * last bit, past the width the typer gives the value it indexes -- its
   * declared type's, or a bitmap field's (#2251: `p.Mode[3]` on a 3-bit field
   * would write the next field). A runtime index is not checked here.
   */
  private checkBitBounds(expr: TExpression): void {
    if (expr.kind !== "postfix") return;
    const steps = OperandTyper.chainOf(expr, this.context).steps;
    const ops = expr.ops.slice(expr.ops.length - steps.length);
    steps.forEach((step, at) => {
      const op = ops[at];
      if (op?.kind !== "subscript") return;
      if (step.subscript !== "bit_single" && step.subscript !== "bit_range") {
        return;
      }
      const width = step.before?.bitWidth ?? null;
      if (width === null) return;
      const start = ConstantExpression.valueAt(op.indexes[0], this.context);
      if (start === null) return;
      const count =
        op.indexes.length === 2
          ? ConstantExpression.valueAt(op.indexes[1], this.context)
          : 1;
      if (count === null || start + count <= width) return;
      const written = expr.written;
      const what =
        op.indexes.length === 2
          ? `bit range [${start}, ${count}] ends at bit ${start + count - 1}`
          : `bit ${start}`;
      this.report(
        expr,
        "E0920",
        `Bit index out of range in '${written}': ${what}, but the value has ${width} bits (0-${width - 1})`,
        "A bit index counts within the indexed value's own bits: its declared type's, or a bitmap field's (ADR-007, ADR-034). Index a wider value, or a bit that exists.",
      );
    });
  }

  /**
   * E0856: ADR-036 allows one subscript per array dimension and ADR-007 one
   * more for a bit index. Only a bit-indexable scalar element has that extra
   * one, which is why the base type decides.
   */
  private checkDepth(
    subscripts: readonly TPostfixOpSyntax[],
    dimensions: number,
    baseType: string,
    name: string,
    at: TExpression,
  ): void {
    if (TYPE_WIDTH[baseType] === undefined) return; // not a bit-indexable scalar
    let leading = 0;
    for (const op of subscripts) {
      if (op.kind !== "subscript") break;
      leading += 1;
    }
    const allowed = dimensions + 1;
    if (leading <= allowed) return;

    const shape =
      dimensions === 0
        ? `a scalar '${baseType}'`
        : `a ${dimensions}-dimensional '${baseType}' array`;
    this.report(
      at,
      "E0856",
      `too many subscripts on '${name}': it is ${shape}, so it allows at most ${allowed}`,
      `${dimensions} for the array ${dimensions === 1 ? "dimension" : "dimensions"} plus one optional bit index (ADR-036/ADR-007). Indexing further indexes a value that is not an array. Did you mean the bit range '${name}[start, width]'?`,
    );
  }

  private report(
    at: TExpression,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.span.line,
      column: at.span.column,
      message,
      helpText,
    });
  }
}

class BitAccessAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /**
   * #1991: reads 1.2's syntax, not the parse tree. A target is checked as a
   * site and not again as an expression, and only a function body is inside
   * a function -- a scope's members are at file scope.
   */
  public analyze(program: IProgramSyntax): IBitAccessError[] {
    const check = new BitAccessCheck(this.context);
    const visit = (declaration: TMemberDeclaration): void => {
      const inFunction = declaration.kind === "function";
      const sites = StatementNodes.assignments(declaration);
      const targets = new Set<TExpression>(sites.map((site) => site.target));
      for (const expr of DeclarationParts.of(declaration).flatMap(
        ExpressionNodes.of,
      )) {
        if (!targets.has(expr)) check.checkExpression(expr, inFunction);
      }
      for (const site of sites) check.checkSite(site);
    };
    for (const member of program.members) visit(member.declaration);
    return check.errors().sort(SourceOrder.compare);
  }
}

export default BitAccessAnalyzer;
