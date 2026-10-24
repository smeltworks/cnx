/**
 * ADR-035: an array's list initializer has one element per slot at every
 * level (E0866), or the fill-all form `[v*]` for a level.
 *
 * #1322. Codegen counted the elements it had just generated, the outer list
 * only, so `u8[2][2] m <- [[1, 2, 3], [4, 5]]` was accepted and reached C as an
 * excess-elements initializer. One rule now, with the declared dimensions
 * read off the type and the elements counted off the list -- at EVERY level.
 *
 * A declared size is a value -- `u8[SIZE]` with a scope's own `SIZE` -- so
 * this is 2.1's. Whether the brackets, the sizes and the initializer are
 * written in an accepted form is syntax, and 1.2's `ArrayForm` reports it
 * (#1991). Both read `VariableDeclarations.ruled` (#2073), so a declaration
 * that reaches here is one 1.2 judged and accepted.
 */

import ArrayListCount from "./helpers/ArrayListCount";
import ConstantExpression from "./helpers/ConstantExpression";
import ForHeaderVariable from "../../utils/ForHeaderVariable";
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import OperandTyper from "../../utils/OperandTyper";
import VariableDeclarations from "../../utils/VariableDeclarations";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import IArrayDeclarationError from "./types/IArrayDeclarationError";
import type IAnalysisContext from "./types/IAnalysisContext";

type TDimension = number | string | null;

class ArrayDeclarationCheck {
  private readonly found: IArrayDeclarationError[] = [];

  constructor(private readonly context: IAnalysisContext) {}

  public errors(): IArrayDeclarationError[] {
    return this.found;
  }

  /**
   * #1823 (ADR-036): a `for` header declares one scalar loop variable. 1.2
   * rejects an array written there (E0917); a header typedef can name one
   * too (`typedef uint8_t Buf[4]`), which only the symbols can tell.
   */
  public forHeader(declaration: IVariableDeclarationSyntax): void {
    const type = declaration.type;
    if (type.kind !== "user") return;
    const target = OperandTyper.target(this.context);
    const lookup = this.context.symbolTable;
    if (!ForeignTypeFacts.isForeignType(type.name, lookup, target)) return;
    const typed = ForeignTypeFacts.operandType(type.name, lookup, target);
    if ((typed?.dimensions.length ?? 0) === 0) return;
    this.found.push({
      code: "E0917",
      span: declaration.span,
      message: ForHeaderVariable.message(true, declaration.name),
      helpText: ForHeaderVariable.HELP,
    });
  }

  public variable(declaration: IVariableDeclarationSyntax): void {
    const type = declaration.type;
    const initializer = declaration.initializer;
    if (type.kind !== "array" || initializer?.kind !== "arrayInitializer") {
      return;
    }
    const sizes: TDimension[] = type.dimensions.map((size) =>
      size === null
        ? null
        : (ConstantExpression.valueAt(size, this.context) ?? size.written),
    );
    this.found.push(
      ...ArrayListCount.mismatches(
        initializer,
        sizes,
        type.element.text,
        this.context,
      ),
    );
  }
}

class ArrayDeclarationAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** The declarations 1.2 judged, in source order (#1991, #2073) */
  public analyze(program: IProgramSyntax): IArrayDeclarationError[] {
    const check = new ArrayDeclarationCheck(this.context);
    for (const entry of VariableDeclarations.ruled(program)) {
      check.variable(entry.declaration);
    }
    for (const entry of VariableDeclarations.forHeaders(program)) {
      check.forHeader(entry.declaration);
    }
    return check.errors();
  }
}

export default ArrayDeclarationAnalyzer;
