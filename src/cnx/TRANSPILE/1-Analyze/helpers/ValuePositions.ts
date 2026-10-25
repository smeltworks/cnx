import type IAssignmentSyntax from "../../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../../types/syntax/IVariableDeclarationSyntax";
import type TMemberDeclaration from "../../../types/syntax/TMemberDeclaration";
import type TExpression from "../../../types/syntax/TExpression";
import type TStatement from "../../../types/syntax/TStatement";
import OperandTyper from "../../../utils/OperandTyper";
import StatementNodes from "../../../utils/StatementNodes";
import TypeResolver from "../../../utils/TypeResolver";
import FunctionReference from "./FunctionReference";
import StructInitializerType from "./StructInitializerType";
import TypeText from "../../../utils/TypeText";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import type IAnalysisContext from "../types/IAnalysisContext";
import type IValuePosition from "../../../types/IValuePosition";
import type IValuePositions from "../../../types/IValuePositions";
import type IValueSite from "../../../types/IValueSite";
import type IFunctionDeclarationSyntax from "../../../types/syntax/IFunctionDeclarationSyntax";

const NOWHERE: IValuePosition = {
  typeText: null,
  isArray: false,
  dimensions: [],
  isDeclaration: false,
  inList: false,
  supplied: false,
};

const NO_TYPE: IValuePosition = { ...NOWHERE, supplied: true };

type TPostfix = Extract<TExpression, { kind: "postfix" }>;
type TStructInitializer = Extract<TExpression, { kind: "structInitializer" }>;

/**
 * Carries each position's type down 1.2's syntax to the values under it
 * (#1991), where the parse-tree reading walked up from each value to the first
 * establishing parent. A `for`'s init and update assignments establish
 * nothing, as their parse-tree rules were not assignment statements.
 */
const TARGET: IValueSite = { site: { kind: "target" }, outer: null };

class ValuePositionWalk {
  private readonly forClauses = new Set<IAssignmentSyntax>();

  public constructor(
    private readonly positions: Map<TExpression, IValuePosition>,
    private readonly sites: Map<TExpression, IValueSite>,
    private readonly context: IAnalysisContext,
  ) {}

  public declaration(declaration: TMemberDeclaration): void {
    if (declaration.kind === "variableDeclaration") {
      this.variable(declaration);
      return;
    }
    if (declaration.kind === "register") {
      this.place(declaration.address, NOWHERE, null);
      for (const member of declaration.members) {
        this.place(member.offset, NOWHERE, null);
      }
      return;
    }
    if (declaration.kind !== "function") return;
    const statements = StatementNodes.in(declaration);
    for (const statement of statements) {
      if (statement.kind !== "for") continue;
      if (statement.init?.kind === "assignment") {
        this.forClauses.add(statement.init);
      }
    }
    for (const statement of statements) this.statement(statement, declaration);
  }

  private statement(
    statement: TStatement,
    fn: IFunctionDeclarationSyntax,
  ): void {
    switch (statement.kind) {
      case "variableDeclaration":
        this.variable(statement);
        return;
      case "assignment":
        this.assignment(statement);
        return;
      case "expression":
        this.place(statement.expression, NOWHERE, null);
        return;
      case "if":
      case "while":
      case "doWhile":
        this.place(statement.condition, NOWHERE, null);
        return;
      case "for":
        if (statement.condition) this.place(statement.condition, NOWHERE, null);
        if (statement.update) this.unplacedAssignment(statement.update);
        return;
      case "switch":
        this.place(statement.subject, NOWHERE, null);
        return;
      case "return":
        if (statement.value) {
          this.place(
            statement.value,
            { ...NO_TYPE, typeText: fn.returnType.text },
            { site: { kind: "return", function: fn }, outer: null },
          );
        }
        return;
      default:
        return;
    }
  }

  private variable(declaration: IVariableDeclarationSyntax): void {
    for (const dimension of declaration.dimensions) {
      if (dimension) this.place(dimension, NOWHERE, null);
    }
    if (!declaration.initializer) return;
    const typeText = declaration.type.text;
    this.place(
      declaration.initializer,
      {
        ...NO_TYPE,
        typeText,
        isArray:
          declaration.dimensions.length > 0 ||
          TypeText.withoutDimensions(typeText) !== typeText,
        isDeclaration: true,
      },
      { site: { kind: "declaration", declaration }, outer: null },
    );
  }

  private assignment(site: IAssignmentSyntax): void {
    if (this.forClauses.has(site)) {
      this.unplacedAssignment(site);
      return;
    }
    const target = OperandTyper.typeOfTarget(site.target, this.context);
    // A compound operator takes no whole array; E0857 rejects it there
    const dimensions =
      site.operator === "<-"
        ? OperandTyper.wholeArrayDimensions(site.target, this.context)
        : [];
    this.place(site.target, NOWHERE, TARGET);
    this.place(
      site.value,
      {
        ...NO_TYPE,
        typeText: target?.typeName ?? null,
        isArray: dimensions.length > 0,
        dimensions,
      },
      ValuePositionWalk.assigned(site),
    );
  }

  /** A `for` clause's: no position for 2.1, the target's type for 2.2 */
  private unplacedAssignment(site: IAssignmentSyntax): void {
    this.place(site.target, NOWHERE, TARGET);
    this.place(site.value, NOWHERE, ValuePositionWalk.assigned(site));
  }

  private static assigned(assignment: IAssignmentSyntax): IValueSite {
    return { site: { kind: "assignment", assignment }, outer: null };
  }

  private place(
    expr: TExpression,
    at: IValuePosition,
    site: IValueSite | null,
  ): void {
    this.positions.set(expr, at);
    if (site) this.sites.set(expr, site);
    switch (expr.kind) {
      case "ternary":
        this.place(expr.condition, at, site);
        this.place(expr.whenTrue, at, site);
        this.place(expr.whenFalse, at, site);
        return;
      case "binary": {
        const operandSite: IValueSite | null =
          expr.level === "equality" || expr.level === "relational"
            ? { site: { kind: "comparison" }, outer: site }
            : site;
        for (const operand of expr.operands) {
          this.place(operand, at, operandSite);
        }
        return;
      }
      case "unary":
      case "cast":
        this.place(expr.operand, at, site);
        return;
      case "parenthesized":
        this.place(expr.expression, at, site);
        return;
      case "postfix":
        this.postfix(expr, at, site);
        return;
      case "structInitializer":
        this.fields(expr, at, site);
        return;
      case "arrayInitializer": {
        const listed = { ...at, inList: true };
        for (const element of expr.elements) {
          this.place(element, listed, site);
        }
        if (expr.fill) this.place(expr.fill, listed, site);
        return;
      }
      default:
        return;
    }
  }

  private postfix(
    chain: TPostfix,
    at: IValuePosition,
    site: IValueSite | null,
  ): void {
    this.place(chain.primary, at, site);
    const indexed: IValueSite = { site: { kind: "index" }, outer: site };
    chain.ops.forEach((op, opIndex) => {
      if (op.kind === "subscript") {
        for (const index of op.indexes) this.place(index, NOWHERE, indexed);
      } else if (op.kind === "call") {
        op.arguments.forEach((argument, index) =>
          this.place(argument, this.parameter(chain, opIndex, index), {
            site: {
              kind: "argument",
              call: chain,
              op: opIndex,
              argument: index,
            },
            outer: site,
          }),
        );
      }
    });
  }

  private parameter(
    chain: TPostfix,
    callAt: number,
    index: number,
  ): IValuePosition {
    const callee = FunctionReference.ofCall(
      chain,
      OperandTyper.scopePathAt(chain.span, this.context),
      this.context,
      callAt,
    );
    const param = callee?.parameters[index];
    return param === undefined
      ? NO_TYPE
      : {
          ...NO_TYPE,
          typeText: TypeResolver.getTypeName(param.type),
          isArray: param.isArray,
          dimensions: param.arrayDimensions ?? [],
        };
  }

  private fields(
    init: TStructInitializer,
    at: IValuePosition,
    site: IValueSite | null,
  ): void {
    const structName =
      at.typeText === null
        ? null
        : StructInitializerType.structNamed(
            at.typeText,
            OperandTyper.scopePathAt(init.span, this.context),
            this.context,
          );
    const symbols = this.context.symbols;
    for (const field of init.fields) {
      this.place(
        field.value,
        structName === null
          ? NO_TYPE
          : fieldPosition(symbols, structName, field.name),
        {
          site: { kind: "field", initializer: init, field: field.name },
          outer: site,
        },
      );
    }
  }
}

/**
 * A struct field's position. A `string<N>` field is stored as `char[N+1]`,
 * but its value is one string, not an array (#2236): its last dimension is
 * its characters' (#1782), so it is an array only with dimensions of its own.
 */
function fieldPosition(
  symbols: IAnalysisContext["symbols"],
  structName: string,
  fieldName: string,
): IValuePosition {
  const typeText = symbols.structFields.get(structName)?.get(fieldName) ?? null;
  const stored =
    symbols.structFieldDimensions.get(structName)?.get(fieldName) ?? [];
  const dimensions = stringlessDimensions(typeText, stored);
  const element =
    typeText === null ? null : TypeText.withoutDimensions(typeText);
  const isArray =
    element !== null && TypeCheckUtils.isSizedStringName(element)
      ? element !== typeText
      : (symbols.structFieldArrays.get(structName)?.has(fieldName) ?? false);
  return { ...NO_TYPE, typeText, isArray, dimensions };
}

/** A string field's last dimension is its characters', not an array's (#1782) */
function stringlessDimensions(
  typeText: string | null,
  dimensions: ReadonlyArray<number | string>,
): ReadonlyArray<number | string> {
  const element =
    typeText === null ? null : TypeText.withoutDimensions(typeText);
  return element !== null && TypeCheckUtils.isSizedStringName(element)
    ? dimensions.slice(0, -1)
    : dimensions;
}

/** Where every value in a file stands (#1991) */
class ValuePositions {
  static of(
    program: IProgramSyntax,
    context: IAnalysisContext,
  ): IValuePositions {
    const positions = new Map<TExpression, IValuePosition>();
    const sites = new Map<TExpression, IValueSite>();
    const walk = new ValuePositionWalk(positions, sites, context);
    for (const member of program.members) {
      walk.declaration(member.declaration);
    }
    return { positions, sites };
  }

  /** `expr`'s position; one the walk never placed stands nowhere */
  static at(
    positions: ReadonlyMap<TExpression, IValuePosition>,
    expr: TExpression,
  ): IValuePosition {
    return positions.get(expr) ?? NOWHERE;
  }
}

export default ValuePositions;
