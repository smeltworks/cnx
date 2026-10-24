/**
 * ADR-035 array initializers and ADR-036 declaration shape, as written:
 * E0866 (an initializer that is not a list), E0874, E0875, E0876, E0892,
 * and E0917 (an array or a string declared in a `for` header, #1823).
 *
 * Where the brackets are, whether a dimension has an expression, and whether
 * an initializer is a list are syntax, so 1.2 reports them with the file's
 * other parse errors (#1991). Counting a list against its declared size needs
 * the size's value, which is 2.1's `ArrayDeclarationAnalyzer`. A variable
 * declaration is judged off the lowered program, through the same
 * `VariableDeclarations.ruled` walk 2.1 uses, so both passes judge the same
 * declarations (#2073). A struct member and a parameter are not variable
 * declarations, and are judged off the tree.
 *
 * ## Reproduced, not closed, stated
 *
 * Codegen rejected the C-style form (`u8 arr[4]`) for a variable declaration
 * and a parameter, and accepted it for a scope member and a struct member --
 * thirty-one fixtures use it in a scope or a struct, and a unit test pins the
 * scope case as intended. A `for` header declares a scalar loop variable, so
 * an array there is E0917 in either spelling, and so is a string (#1823). ADR-036 names the
 * prefix form as the only one; this rejects exactly where codegen did and
 * records the rest for the ADR's owner, since closing it is a language change
 * on code the corpus treats as valid.
 */
import { ParseTreeWalker } from "antlr4ng";
import FormError from "./FormError";
import { CnxListener } from "./grammar/CnxListener";
import * as Parser from "./grammar/CnxParser";
import SyntaxLowering from "./SyntaxLowering";
import ProgramLowering from "./ProgramLowering";
import MainSignature from "../../utils/MainSignature";
import ExpressionShape from "../../utils/ExpressionShape";
import ParserUtils from "../../utils/ParserUtils";
import CodedErrorText from "../../utils/CodedErrorText";
import ForHeaderVariable from "../../utils/ForHeaderVariable";
import VariableDeclarations from "../../utils/VariableDeclarations";
import type ISourceSpan from "../../types/ISourceSpan";
import type ITranspileError from "../../types/ITranspileError";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSite from "../../types/syntax/IVariableDeclarationSite";
import type TExpression from "../../types/syntax/TExpression";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";

type TArrayTypeSyntax = Extract<TTypeSyntax, { kind: "array" }>;

class ArrayFormListener extends CnxListener {
  private readonly found: ITranspileError[] = [];

  public errors(): ITranspileError[] {
    return this.found;
  }

  override enterStructMember = (ctx: Parser.StructMemberContext): void => {
    const dimensions = [
      ...(ctx.type().arrayType()?.arrayTypeDimension() ?? []),
      ...ctx.arrayDimension(),
    ];
    this.checkEmptyDimensions(dimensions, ctx.IDENTIFIER().getText());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    // `main(string args[])` is the language's own form for the command-line
    // args (ADR-030), lowered to `argv` -- the one trailing `[]` that is not
    // C-style. The same criterion codegen lowers it with, asked once.
    const fn = ctx.parent?.parent;
    if (
      fn instanceof Parser.FunctionDeclarationContext &&
      MainSignature.takesArgs(
        fn.IDENTIFIER().getText(),
        ProgramLowering.parameters(fn.parameterList()),
      )
    ) {
      return;
    }
    const trailing = ctx.arrayDimension();
    const name = ctx.IDENTIFIER().getText();
    const typeText = ctx.type().getText();
    if (trailing.length > 0) {
      const after = ArrayFormListener.dimensionText(trailing);
      this.found.push(
        FormError.at(
          ParserUtils.getPosition(ctx),
          "E0874",
          `C-style array parameter is not allowed. Use '${typeText}${after} ${name}' instead of '${typeText} ${name}${after}'`,
          "cnx puts every array dimension in the type, before the name (ADR-036).",
        ),
      );
      return;
    }
    const dimensions = ctx.type().arrayType()?.arrayTypeDimension() ?? [];
    if (dimensions.some((dimension) => dimension.expression() === null)) {
      this.found.push(
        FormError.at(
          ParserUtils.getPosition(ctx),
          "E0875",
          "Unbounded array parameters are not allowed. All dimensions must have explicit sizes for memory safety.",
          "A parameter's dimensions are what the callee can trust; write the size, e.g. `u8[8] data` (ADR-036).",
        ),
      );
    }
  };

  /** #1822 (ADR-035): a struct member states every dimension's size */
  private checkEmptyDimensions(
    dimensions: readonly (
      | Parser.ArrayDimensionContext
      | Parser.ArrayTypeDimensionContext
    )[],
    name: string,
  ): void {
    dimensions.forEach((dim, index) => {
      if (dim.expression() !== null) return;
      const position = ParserUtils.getPosition(dim);
      this.found.push(
        ArrayForm.emptyDimension(position.line, position.column, name, index),
      );
    });
  }

  private static dimensionText(
    dimensions: readonly (
      | Parser.ArrayDimensionContext
      | Parser.ArrayTypeDimensionContext
    )[],
  ): string {
    return dimensions
      .map((d) => {
        const size = d.expression();
        return `[${size === null ? "" : SyntaxLowering.node(size).written}]`;
      })
      .join("");
  }
}

/** ADR-035/036 on the variable declarations `VariableDeclarations` walks (#2073) */
class ArrayVariableForm {
  private readonly found: ITranspileError[] = [];

  public errors(): ITranspileError[] {
    return this.found;
  }

  /**
   * #1823 (ADR-036): a `for` header declares one scalar loop variable, so an
   * array or a string there is E0917, in either array spelling.
   */
  public forHeader(entry: IVariableDeclarationSite): void {
    const declaration = entry.declaration;
    const type = declaration.type;
    const isArray = type.kind === "array" || declaration.dimensions.length > 0;
    if (!isArray && type.kind !== "string") return;
    this.found.push(
      FormError.at(
        declaration.span,
        "E0917",
        ForHeaderVariable.message(isArray, declaration.name),
        ForHeaderVariable.HELP,
      ),
    );
  }

  public variable(entry: IVariableDeclarationSite): void {
    const declaration = entry.declaration;
    const type = declaration.type;
    const trailing = declaration.dimensions;
    // A scope member reaches its own generator, which never rejected the
    // C-style form -- reproduced, see the file comment.
    if (trailing.length > 0 && entry.site !== "scopeMember") {
      const base = type.kind === "array" ? type.element.text : type.text;
      const existing = ArrayVariableForm.dimensionText(
        type.kind === "array" ? type.dimensions : [],
      );
      const after = ArrayVariableForm.dimensionText(trailing);
      this.found.push(
        FormError.at(
          declaration.span,
          "E0874",
          `C-style array declaration is not allowed. Use '${base}${existing}${after} ${declaration.name}' instead of '${base}${existing} ${declaration.name}${after}'`,
          "cnx puts every array dimension in the type, before the name (ADR-036).",
        ),
      );
      return;
    }
    const initializer = declaration.initializer;
    const sizes = [
      ...(type.kind === "array" ? type.dimensions : []),
      ...trailing,
    ];
    const spans = [
      ...(type.kind === "array" ? type.dimensionSpans : []),
      ...declaration.dimensionSpans,
    ];
    if (
      this.checkEmptyDimensions(
        sizes,
        spans,
        declaration.name,
        initializer !== null,
      )
    ) {
      return;
    }
    if (type.kind !== "array" || initializer === null) return;
    this.checkInitializer(type, initializer);
  }

  /**
   * #1822 (ADR-035): every dimension states its size, except the single
   * dimension of a one-dimensional variable initialized by a list -- or, for
   * `u8`, a string literal -- whose size is the number of elements. Which
   * initializer is accepted is E0866's; this asks only whether there is one
   * to count. Returns whether anything was reported.
   */
  private checkEmptyDimensions(
    sizes: readonly (TExpression | null)[],
    spans: readonly ISourceSpan[],
    name: string,
    hasInitializer: boolean,
  ): boolean {
    if (sizes.length === 1 && hasInitializer) return false;
    let reported = false;
    sizes.forEach((size, index) => {
      if (size !== null) return;
      this.found.push(
        ArrayForm.emptyDimension(
          spans[index].line,
          spans[index].column,
          name,
          index,
        ),
      );
      reported = true;
    });
    return reported;
  }

  /**
   * ADR-035: an array's initializer is a list, or -- for a `u8` array -- a
   * string literal. An inferred size (`u8[]`) is fixed by counting the list,
   * so the fill-all form `[v*]`, which has nothing to count, cannot fix one.
   */
  private checkInitializer(
    type: TArrayTypeSyntax,
    initializer: TExpression,
  ): void {
    if (initializer.kind !== "arrayInitializer") {
      if (ExpressionShape.givesWholeArray(initializer, type.element.text)) {
        return; // `u8[] s <- "Hello"` (ADR-035)
      }
      this.found.push(
        FormError.at(
          initializer.span,
          "E0866",
          `An array must be initialized by a list, not '${initializer.written}'`,
          "Write the elements out in brackets, or declare it empty and assign the elements afterwards (ADR-035).",
        ),
      );
      return;
    }
    const inferred = type.dimensions.some((size) => size === null);
    if (inferred && initializer.fill !== null) {
      this.found.push(
        FormError.at(
          initializer.span,
          "E0876",
          `Fill-all syntax ${initializer.written} requires explicit array size`,
          "An inferred size comes from counting the elements, and the fill-all form has none to count; write the dimension (ADR-035).",
        ),
      );
    }
  }

  private static dimensionText(sizes: readonly (TExpression | null)[]): string {
    return sizes
      .map((size) => `[${size === null ? "" : size.written}]`)
      .join("");
  }
}

class ArrayForm {
  /** Every array-shape error in a file that parsed: its tree, and that tree lowered */
  static errorsIn(
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
  ): ITranspileError[] {
    const listener = new ArrayFormListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    const variables = new ArrayVariableForm();
    for (const entry of VariableDeclarations.ruled(program)) {
      variables.variable(entry);
    }
    for (const entry of VariableDeclarations.forHeaders(program)) {
      variables.forHeader(entry);
    }
    return [...listener.errors(), ...variables.errors()];
  }

  /** E0892, for a declaration on the tree or lowered alike */
  static emptyDimension(
    line: number,
    column: number,
    name: string,
    index: number,
  ): ITranspileError {
    return {
      line,
      column,
      message: CodedErrorText.of(
        "E0892",
        `Array '${name}' leaves dimension ${index + 1} without a size`,
      ),
      helpText:
        "Write the size. Only a one-dimensional array initialized by a list (or, for u8, a string literal) may leave it out, and its size is the number of elements (ADR-035).",
      severity: "error",
    };
  }
}

export default ArrayForm;
