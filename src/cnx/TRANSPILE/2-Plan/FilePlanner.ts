import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import SubscriptDepthValidator from "./SubscriptDepthValidator";
import UnwrittenIncludes from "./UnwrittenIncludes";
import type TTypeInfo from "../../types/TTypeInfo";
import type TCArgumentForm from "./types/TCArgumentForm";
import CArgumentAddress from "./CArgumentAddress";
import type IPlannedArgument from "./types/IPlannedArgument";
import PRIMASK_C_TYPE from "./types/PRIMASK_C_TYPE";
import FloatBits from "../../utils/FloatBits";
import type IPlannedFloatBits from "./types/IPlannedFloatBits";
import type TPlannedNarrowing from "./types/TPlannedNarrowing";
import COMPOUND_TO_BINARY from "./types/COMPOUND_TO_BINARY";
import NarrowingCastHelper from "./NarrowingCastHelper";
import TYPE_MAP from "./types/TYPE_MAP";
import CallbackParameterShape from "../../utils/CallbackParameterShape";
import type ICallbackShapeFacts from "../../utils/types/ICallbackShapeFacts";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import ResolvedTarget from "../../utils/ResolvedTarget";
import SafeDivisionTypes from "./SafeDivisionTypes";
import TParameterInfo from "../../types/TParameterInfo";
import ICodeGeneratorOptions from "../types/ICodeGeneratorOptions";
import TypeValidator from "./TypeValidator";
import EmissionPlan from "./EmissionPlan";
import DeclarationPlan from "./DeclarationPlan";
import TypeSites from "./TypeSites";
import WrittenParts from "./WrittenParts";
import type IProgram from "../../types/IProgram";
import type IUnwrittenSyntax from "./types/IUnwrittenSyntax";
import type IPlannedStaticValue from "./types/IPlannedStaticValue";
import type IStaticValue from "../1-Analyze/types/IStaticValue";
import StaticInitializers from "../1-Analyze/helpers/StaticInitializers";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import CastRequirement from "./CastRequirement";
import type TNegativeMinimum from "./types/TNegativeMinimum";
import LengthProperty from "../../utils/LengthProperty";
import type IChainStep from "../../types/IChainStep";
import type ILengthName from "../../utils/types/ILengthName";
import type TLengthRule from "../../utils/types/TLengthRule";
import LengthSubject from "../../utils/LengthSubject";
import OperandTyper from "../../utils/OperandTyper";
import StringValueForm from "../../utils/StringValueForm";
import StringUtils from "../../utils/StringUtils";
import type TStringValueForm from "../../types/TStringValueForm";
import CppNamespaceUtils from "../../utils/CppNamespaceUtils";
import headerCType from "../../utils/headerCType";
import HeaderTypeNames from "./HeaderTypeNames";
import PublicInterface from "./PublicInterface";
import PlanTyping from "./PlanTyping";
import CompositeType from "../../utils/CompositeType";
import type IOperandType from "../../types/IOperandType";
import type TValueBinding from "../../types/TValueBinding";
import type TOverflowBehavior from "../../types/TOverflowBehavior";
import type TDeclarationKind from "../../types/TDeclarationKind";
import type IEmissionFacts from "../../types/IEmissionFacts";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type ISyntaxNode from "../../types/syntax/ISyntaxNode";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TStatement from "../../types/syntax/TStatement";
import type IStructDeclarationSyntax from "../../types/syntax/IStructDeclarationSyntax";
import type IParameterSyntax from "../../types/syntax/IParameterSyntax";
import type IFunctionDeclarationSyntax from "../../types/syntax/IFunctionDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TBlockSyntax from "../../types/syntax/TBlockSyntax";
import AssignmentTarget from "../../utils/AssignmentTarget";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import TypeText from "../../utils/TypeText";
import ExpressionShape from "../../utils/ExpressionShape";
import VariableDeclarations from "../../utils/VariableDeclarations";
import MutArgument from "../1-Analyze/helpers/MutArgument";
import StringWriteSites from "../1-Analyze/helpers/StringWriteSites";
import SafeDivision from "../../utils/SafeDivision";
import StatementNodes from "../../utils/StatementNodes";
import CppModeHelper from "./CppModeHelper";
import RegisterAccessMode from "../../utils/RegisterAccessMode";
import RegisterMmio from "./RegisterMmio";
import StatementChildren from "../../utils/StatementChildren";
import ExclusiveAccess from "./ExclusiveAccess";
import type TAtomicForm from "../types/TAtomicForm";
import type IPlannedAtomic from "../types/IPlannedAtomic";
import type ITargetDescription from "../../types/ITargetDescription";
import includeGenerators from "./IncludeGenerator";
import DeclaredTypeInfo from "../../PARSE/3-Declare/DeclaredTypeInfo";
import type IChainBase from "../../types/IChainBase";
import AssignmentClassifier from "./AssignmentClassifier";
import AssignmentOperatorMapper from "./AssignmentOperatorMapper";
import type IPlannedCast from "./types/IPlannedCast";
import ConstExprLowering from "../../utils/ConstExprLowering";
import UNRESOLVED_DIMENSION from "../../types/UNRESOLVED_DIMENSION";
import dimensionEvalOptions from "./dimensionEvalOptions";
import CallArgumentPassing from "./CallArgumentPassing";
import type IArgumentPassing from "./types/IArgumentPassing";
import type TArgumentForm from "./types/TArgumentForm";
import CppMemberHelper from "./CppMemberHelper";
import IPostfixOp from "../../types/IPostfixOp";
import CppConstructorHelper from "../../utils/CppConstructorHelper";
import type ITypingContext from "../../types/ITypingContext";
import type TExpression from "../../types/syntax/TExpression";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import ExpressionChildren from "../../utils/ExpressionChildren";
import type TStructInitializerForm from "./types/TStructInitializerForm";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import TypeGenerationHelper from "./TypeGenerationHelper";
import type IPlannedType from "./types/IPlannedType";
import type IAnalyzedFile from "../../types/IAnalyzedFile";
import type IValuePositions from "../../types/IValuePositions";
import type IValuePosition from "../../types/IValuePosition";
import type IValueSite from "../../types/IValueSite";
import type TValueSite from "../../types/TValueSite";
import type IPlannedExpectedType from "./types/IPlannedExpectedType";
import type ITypeGenerationDeps from "./types/ITypeGenerationDeps";
import type IFilePlan from "./types/IFilePlan";
import type IPlannedClamp from "./types/IPlannedClamp";
import type IPlannedSliceSource from "./types/IPlannedSliceSource";
import type IPlannedWholeArrayWrite from "./types/IPlannedWholeArrayWrite";
import SliceSource from "./SliceSource";
import type IPlannedFunctionParameter from "./types/IPlannedFunctionParameter";
import invariant from "../../utils/invariant";
import CallExprUtils from "./CallExprUtils";
import FunctionCatalog from "./FunctionCatalog";
import type TPlanInputs from "../types/TPlanInputs";
import AdrProvenance from "../../instrumentation/AdrProvenance";
import BitmapFieldStep from "../../utils/BitmapFieldStep";
import type IBitmapFieldTarget from "../../types/IBitmapFieldTarget";
import AtomicOwner from "../../utils/AtomicOwner";
import AtomicOperandType from "./AtomicOperandType";
import TypeNameLadder from "../../utils/TypeNameLadder";
import SymbolTypeResolver from "../../utils/TypeResolver";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import SymbolGuards from "../../types/symbols/SymbolGuards";
import type IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import type TSymbol from "../../types/symbols/TSymbol";
import type ICallbackTypeInfo from "../../types/ICallbackTypeInfo";
import PlannedRequirements from "./PlannedRequirements";
import PrivateConstSpelling from "./PrivateConstSpelling";
import ClampTypes from "./ClampTypes";
import FloatBitType from "./FloatBitType";
import ArgumentForm from "./ArgumentForm";
import type TArgumentShape from "./types/TArgumentShape";
import PlanQueries from "./PlanQueries";
import TranspileState from "../TranspileState";
import ParameterInfoPlanner from "./ParameterInfoPlanner";

interface FunctionSignature {
  name: string;
  parameters: Array<{
    name: string;
    baseType: string; // The cnx type (e.g., 'u32', 'f32')
    isConst: boolean;
    isArray: boolean;
  }>;
}

/** ADR-044 (#1152): the `+ - *` operators that saturate through a helper */
const CLAMP_HELPER_FOR_OPERATOR: Readonly<Partial<Record<string, string>>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
};

const NO_EXPECTED_TYPE: IPlannedExpectedType = {
  type: null,
  suppressBareEnumResolution: false,
};

/**
 * #1991: 2.2 Plan -- every decision 2.3 Render reads for one file, made
 * before any of it is written. `CodeGenWalker.plan` delegates here, so the
 * plan-render-state and depcruise rules for `2-Plan/` see the planning code.
 */
class FilePlanner {
  private readonly state: TranspileState;
  private readonly queries: PlanQueries;
  private parametersOrNull: ReadonlyMap<string, TParameterInfo> | null = null;

  constructor(state: TranspileState) {
    this.state = state;
    this.queries = new PlanQueries(state);
  }

  /**
   * What 2.2 reads off the options before it plans anything, which the walker
   * installs on TranspileState for the plan and `fileSetup` hands on to 2.3.
   */
  static planInputs(options: ICodeGeneratorOptions): TPlanInputs {
    const symbols = options.symbolInfo;
    return {
      program: options.program,
      symbols,
      sourcePath: options.sourcePath,
      debugMode: options.debugMode,
      cppMode: options.program.cppMode(),
      targetDescription: options.targetDescription,
      includeRewrites: options.includeRewrites,
      includeKinds: options.includeKinds,
      scopeMembers: symbols.scopeMembers,
    };
  }

  /** 2.3 renders against the parameters 2.2 planned for the file */
  useParameters(parameters: ReadonlyMap<string, TParameterInfo>): void {
    this.parametersOrNull = parameters;
  }

  /**
   * A type context reduced to what the renderer asks of it (#1445).
   *
   * The named branches come from `TypeNameLadder` -- the one ladder --
   * rather than from a second walk here, which is what `TypeGenerationHelper`
   * used to do. `typeBindingDeps` supplies the same two predicates that helper
   * was handed: ADR-057's scope-type test, and this generator's C++-aware
   * `Scope.Type` resolver.
   *
   * An array's alternatives describe its ELEMENT, so the classification is
   * taken from `arrayType()` when there is one. `primitiveName` and `isString`
   * follow the same accessors, and `isArray` is carried because
   * `getRequiredInclude` asks a narrower question than `generate` does -- see
   * its comment.
   */
  cTypeOf(plan: IPlannedType): string {
    return TypeGenerationHelper.generate(plan, this.typeGenerationDeps());
  }

  private typeGenerationDeps(): ITypeGenerationDeps {
    return {
      checkNeedsStructKeyword: (name) =>
        this.state.symbolTable.checkNeedsStructKeyword(name),
      isCrossFileDeclaration: (name) => this.state.isCrossFileDeclaration(name),
    };
  }

  private planType(type: TTypeSyntax, scopePath: string): IPlannedType {
    const element = type.kind === "array" ? type.element : type;
    const deps = this.state.typeBindingDeps((identifiers) =>
      this.resolveQualifiedType(identifiers),
    );

    return {
      named: TypeNameLadder.classifyNamed(element, scopePath, deps),
      isString: element.kind === "string",
      stringTypeText: element.kind === "string" ? element.text : undefined,
      primitiveName: element.kind === "primitive" ? element.text : null,
      isArray: type.kind === "array",
      userTypeLine: element.kind === "user" ? element.span.line : undefined,
      text: type.text,
      writtenName: this.typeNameIn(type, scopePath),
    };
  }

  /**
   * #1668 (C6b): a composite's integer type, as the typer settled it -- the
   * answer 2.1's E0869 reads too -- so the clamp helper's width and the
   * conversion check cannot count a different set of operands
   */
  private compositeClampType(expr: TExpression): string | null {
    const t = OperandTyper.typeOf(expr, this.state.typingContext());
    return t?.bitWidth === null ? null : (t?.typeName ?? null);
  }

  /** #1668 (C6b): ADR-044's behavior for a composite, PlanTyping's row */
  private compositeClampBehavior(expr: TExpression): TOverflowBehavior | null {
    return PlanTyping.overflowOf(
      OperandTyper.valueLeaves(expr, this.state.typingContext()),
    );
  }

  /**
   * Check if an expression is a string type.
   * ADR-045: Used to detect string comparisons and generate strcmp().
   * Issue #137: Extended to handle array element access (e.g., names[0])
   * Issue #1030: Extended to handle struct member access (e.g., person.name)
   */
  private isStringExpression(expr: TExpression): boolean {
    if (ExpressionShape.isStringLiteral(expr)) {
      return true;
    }

    return OperandTyper.isString(
      OperandTyper.typeOf(expr, this.state.typingContext()),
    );
  }

  static positionOf(expr: TExpression): ISourcePosition {
    return { line: expr.span.line, column: expr.span.column };
  }

  /** What decides an argument's form (#1991), as 2.2 plans it */
  private argumentShape(
    expr: TExpression,
    structInitializers: ReadonlyMap<
      TExpressionOf<"structInitializer">,
      TStructInitializerForm
    >,
  ): TArgumentShape {
    return {
      getLvalueType: () => this.getLvalueType(expr),
      getMemberAccessArrayStatus: () => this.getMemberAccessArrayStatus(expr),
      isCppMemberConversionRequired: (t) =>
        this.isCppMemberConversionRequired(expr, t),
      isStringSubscriptAccess: () => this.isStringSubscriptAccess(expr),
      isCompoundLiteral: () => {
        const inner = ExpressionShape.unparenthesized(expr);
        return (
          inner.kind === "structInitializer" &&
          structInitializers.get(inner) === "compound"
        );
      },
    };
  }

  /**
   * A bare-name argument as written, and the C name the one binder gives it
   * (#1760 review): the same answer a read and an assignment target take,
   * through `TypeValidator.resolveBareIdentifier`.
   */
  boundArgumentName(expr: TExpression): {
    readonly emitted: string;
    readonly parameter: TParameterInfo | undefined;
  } | null {
    const id = ExpressionShape.simpleIdentifier(expr);
    if (id === null) return null;
    return {
      emitted: this.boundName(id, FilePlanner.positionOf(expr)),
      parameter: this.parameterAt(id, FilePlanner.positionOf(expr)),
    };
  }

  /** The C name a bare identifier at `at` is emitted under (ADR-057) */
  boundName(id: string, at: ISourcePosition): string {
    return (
      TypeValidator.resolveBareIdentifier(
        id,
        at,
        (name: string) => this.queries.isKnownStruct(name),
        this.state,
      ) ?? id
    );
  }

  /** #1668 (C6c): an expression's one type for 2.2, PlanTyping's row */
  directTypeOf(expr: TExpression): string | null {
    return OperandTyper.directTypeName(
      OperandTyper.typeOf(expr, this.state.typingContext()),
    );
  }

  /**
   * The integer type an expression converts from: its one type, or a
   * composite's integer type -- the answer 2.1's E0869 reads
   */
  integerTypeOf(expr: TExpression): string | null {
    return this.directTypeOf(expr) ?? this.compositeClampType(expr);
  }

  /** Whether any value leaf is floating, or indeterminate (CompositeType) */
  hasFloatingLeaf(expr: TExpression): boolean {
    const typing = this.state.typingContext();
    return CompositeType.anyFloating(OperandTyper.valueLeaves(expr, typing));
  }

  typeNameIn(type: TTypeSyntax, scopePath: string): string {
    // #1285: one ladder. This was the largest of seven copies, and the only one
    // that handled `arrayType` by peeking at two of its six element
    // alternatives -- TypeNameLadder recurses into all of them.
    const resolved = TypeNameLadder.resolveWrittenName(
      type,
      scopePath,
      this.state.typeBindingDeps((identifiers) =>
        this.resolveQualifiedType(identifiers),
      ),
    );
    // #1508: the other half of ADR-010's promise. A cross-file declaration is
    // reached two ways -- it is CALLED, which the postfix generator records, or
    // its TYPE is named, which is this. A global variable cannot call anything
    // at file scope, so without this site the `global variable` contexts would
    // be permanently unoccupiable and would have had to be declared `off` --
    // recording a claim that an included type cannot be used for a global,
    // which is false.
    //
    // Both sites are one mechanism (provenance at the point of resolution), not
    // the two the matrix guidance warns against mixing: neither depends on a
    // diagnostic, and a fixture is credited once per position either way.
    if (resolved !== null && this.state.isCrossFileDeclaration(resolved)) {
      AdrProvenance.record("010", type.span.line);
    }
    return resolved ?? type.text;
  }

  /**
   * A written value's compile-time value, which a bit write folds into its
   * mask (`BitUtils.boolToInt`). None when it reads a local: the fold would
   * leave the local's declaration with no reader, which `-Wunused-variable`
   * rejects (#1791, #2155 review 8). A `volatile` has none either way.
   */
  foldWrittenValue(expr: TExpression): number | undefined {
    const typing = this.state.typingContext();
    const readsLocal = ExpressionNodes.direct(expr).some(
      (node) =>
        (node.kind === "identifier" || node.kind === "postfix") &&
        OperandTyper.typeOf(node, typing)?.binding?.kind === "local",
    );
    return readsLocal ? undefined : this.constantOf(expr);
  }

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(expr: TExpression): number | undefined {
    // Issue #1127: the shared builder, not a fourth inline copy of the same
    // three lookups. This is the orchestrator entry point that
    // ArrayDimensionUtils uses to emit declaration dimensions, so it is on the
    // hot path for exactly the divergences this work closes.
    return this.constantOf(expr);
  }

  /**
   * Issue #517: Check if a type is a C++ class with a user-defined constructor.
   * C++ classes with user-defined constructors are NOT aggregate types,
   * so designated initializers { .field = value } don't work with them.
   * We check for the existence of a constructor symbol (TypeName::ClassName).
   */
  private _isCppClassWithConstructor(typeName: string): boolean {
    return CppConstructorHelper.hasConstructor(
      typeName,
      this.state.symbolTable,
    );
  }

  /**
   * Issue #388: Resolve a qualified type from dot notation to the correct output format.
   * For C++ namespace types (like MockLib.Parse.ParseResult), uses :: separator.
   * For cnx scope types (like Motor.State), uses _ separator.
   *
   * @param identifiers Array of identifier names forming the qualified type
   * @returns The resolved type name with appropriate separator
   */
  resolveQualifiedType(identifiers: string[]): string {
    if (identifiers.length === 0) {
      return "";
    }
    // #2116: 1.3 spelled every written `Scope.T` / `Ns.T` once -- `Ns::T` for
    // a C++ head, else the C name -- so this reads it and never re-derives it
    const written = identifiers.join(".");
    const stored = this.state.program?.qualifiedTypeName(written);
    invariant(
      stored !== undefined,
      `1.3 spells every qualified type a file writes ('${written}')`,
    );
    return stored;
  }

  /**
   * 2.2 Plan: every decision 2.3 Render reads for this file, made before any
   * of it is written. `render` takes what this returns (#1991).
   */
  plan(file: IAnalyzedFile, options: ICodeGeneratorOptions): IFilePlan {
    const program = file.program;
    // ADR-049: 1.4 settled the target; 2.2 reads it off the program

    const parameters = this.planParameterInfos(program);
    this.parametersOrNull = parameters.infos;

    return this.planFile(
      program,
      options,
      file.valuePositions,
      parameters.planned,
    );
  }

  /**
   * #1991: 2.2 decides every written type's plan before 2.3 renders any of
   * the file, so `renderType` reads a decision rather than making one.
   */
  private planTypeSites(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): ReadonlyMap<TTypeSyntax, IPlannedType> {
    const unwrittenTypes = this.unwrittenTypes(program);
    const planned = new Map<TTypeSyntax, IPlannedType>();
    for (const { type, scope } of TypeSites.of(program, unwritten)) {
      if (unwrittenTypes.has(type)) continue;
      planned.set(type, this.planType(type, this.state.scopePathOf(scope)));
    }
    return planned;
  }

  /**
   * ADR-045: 2.2 decides, for every `=`/`!=` comparison 2.3 writes, whether it
   * compares strings, so 2.3 writes strcmp from that decision
   */
  private planComparisons(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): ReadonlyMap<TExpression, boolean> {
    const planned = new Map<TExpression, boolean>();
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (expression.kind === "binary" && expression.level === "equality") {
        planned.set(
          expression,
          this.isStringExpression(expression.operands[0]) ||
            this.isStringExpression(expression.operands[1]),
        );
      }
    }
    return planned;
  }

  /**
   * ADR-024: 2.2 decides, for every cast 2.3 writes, the type it converts
   * from and whether it saturates, before 2.3 renders any of them
   */
  private planCasts(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): ReadonlyMap<
    TExpressionOf<"cast">,
    Pick<IPlannedCast, "operandType" | "clampForm">
  > {
    const typing = this.state.typingContext();
    const planned = new Map<
      TExpressionOf<"cast">,
      Pick<IPlannedCast, "operandType" | "clampForm">
    >();
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (expression.kind !== "cast") continue;
      const operand = OperandTyper.typeOf(expression.operand, typing);
      const operandType = PlanTyping.castSourceType(operand);
      planned.set(expression, {
        operandType,
        clampForm: FilePlanner.clampFormOf(
          operand,
          operandType,
          expression.type.text,
        ),
      });
    }
    return planned;
  }

  /**
   * MISRA 10.3: each written `-` literal that is its type's minimum, which 2.3
   * spells as the `<limits.h>` macro. The literal's suffix is the one 2.3
   * drops (8/16/32 bits) or spells `LL` (i64).
   */
  /**
   * ADR-007: a float's bits are read and written through a union, which the
   * float static assert sizes (MISRA 21.15): a range read off a named float,
   * and any bit write to a float
   */
  private planFloatBits(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    cTypes: Set<string>,
  ): {
    readonly reads: ReadonlyMap<TPostfixOpSyntax, IPlannedFloatBits>;
    readonly writes: ReadonlyMap<TExpression, IPlannedFloatBits | null>;
  } {
    const typing = this.state.typingContext();
    const targets = new Set<TExpression>(
      FilePlanner.assignmentSites(program).map((write) => write.target),
    );
    const writes = new Map<TExpression, IPlannedFloatBits | null>();
    for (const target of targets) {
      const last = OperandTyper.chainOf(target, typing).steps.at(-1);
      const floatType = FloatBits.typeOf(last);
      writes.set(target, null);
      if (floatType === null) continue;
      const head = ExpressionShape.headOf(target);
      const shared = FloatBits.sharesShadow(head, head.ops.length - 1);
      writes.set(target, { floatType, shared });
      // The union's integer member (#1927)
      cTypes.add(FloatBitType.of(floatType));
    }
    const reads = new Map<TPostfixOpSyntax, IPlannedFloatBits>();
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (expression.kind !== "postfix" || targets.has(expression)) continue;
      const head = ExpressionShape.headOf(expression);
      const steps = OperandTyper.chainOf(expression, typing).steps;
      head.ops.forEach((op, i) => {
        const floatType = FloatBits.rangeTypeOf(steps[i - head.opsConsumed]);
        if (op.kind !== "subscript" || floatType === null) return;
        // #2057, #1099: the ranged value's type, not the root's, which sent a
        // member's, a field's or an element's bits down the integer path
        reads.set(op, { floatType, shared: FloatBits.sharesShadow(head, i) });
        cTypes.add(FloatBitType.of(floatType));
      });
    }
    return { reads, writes };
  }

  private static planNegativeMinimums(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): ReadonlyMap<TExpressionOf<"unary">, TNegativeMinimum> {
    const planned = new Map<TExpressionOf<"unary">, TNegativeMinimum>();
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (expression.kind !== "unary" || expression.operator !== "-") continue;
      if (expression.operand.kind !== "literal") continue;
      const text = expression.operand.text;
      if (/^2147483648(?:[uUiI](?:8|16|32))?$/.test(text)) {
        planned.set(expression, "int32_t");
      } else if (/^9223372036854775808(?:[iI]64)?$/.test(text)) {
        planned.set(expression, "int64_t");
      }
    }
    return planned;
  }

  /**
   * ADR-051: the helper each written `safe_div`/`safe_mod` call is written as,
   * keyed by the output variable's type, and the C types it is written with:
   * its integer type and the `bool` error flag it returns (#1108, #1927)
   */
  private planSafeDivisions(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    cTypes: Set<string>,
    requirements: PlannedRequirements,
  ): ReadonlyMap<TExpression, string> {
    const state = this.state;
    const typing = state.typingContext();
    const planned = new Map<TExpression, string>();
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      const call = SafeDivision.callOf(expression);
      if (call === null) continue;
      const output = call.args[0];
      // E0884 and E0885 stop a call without a typed output before 2.2 runs
      invariant(output !== undefined, `${call.name} has an output argument`);
      const cnxType = OperandTyper.typeOf(output, typing)?.typeName;
      invariant(cnxType != null, `${call.name}'s output argument is typed`);
      planned.set(
        expression,
        CallExprUtils.generateSafeDivModHelperName(call.name, cnxType),
      );
      requirements.safeDivision(SafeDivision.operationOf(call.name), cnxType);
      SafeDivisionTypes.cTypesOf(cnxType).forEach((t) => cTypes.add(t));
    }
    return planned;
  }

  /**
   * ADR-014: how each written struct initializer is written. A C++ class with
   * a constructor takes `{}` and its fields after (#517). A declaration's
   * initializer, outside a ternary arm or a call argument, is a plain
   * designated initializer (#992): a compound literal is not a C99 constant
   * expression and fails at file scope on GCC < 13. So is one outside any
   * function, and in C++ one of an anonymous struct or union, since each
   * `struct { ... }` is its own type there (#882). Any other is a compound
   * literal. A whole array's list is its temporary's declaration initializer
   * (#1782), so its elements are plain too.
   */
  /**
   * #2332: a struct initializer built before its statement -- a C++ class
   * with a constructor, or one with a `string<N>` field copied in -- is built
   * only when the `&&`/`||` operand or `?:` arm holding it runs. Each such
   * operand and ternary is lowered to an `if`: a `bool` holds the chain's
   * value so far, and a ternary's value is a variable of its own type. A
   * `for` update is run again with nothing written before it, so it keeps
   * the hoist it had (#2343); a loop condition cannot hold one, since E0702
   * admits no call there.
   */
  private planLazyOperands(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    structInitializers: ReadonlyMap<
      TExpressionOf<"structInitializer">,
      TStructInitializerForm
    >,
    stringFields: ReadonlyMap<TExpression, number>,
    expectedTypes: ReadonlyMap<TExpression, IPlannedExpectedType>,
    cTypes: Set<string>,
  ): {
    readonly operands: ReadonlySet<TExpression>;
    readonly ternaries: ReadonlyMap<TExpressionOf<"ternary">, string>;
  } {
    const buildsApart = (expr: TExpression): boolean =>
      ExpressionNodes.direct(expr).some(
        (node) =>
          node.kind === "structInitializer" &&
          (structInitializers.get(node) === "cppClass" ||
            node.fields.some((field) => stringFields.has(field.value))),
      );
    const retested = new Set(
      FilePlanner.forUpdates(program).flatMap((head) =>
        ExpressionNodes.direct(head),
      ),
    );
    const operands = new Set<TExpression>();
    const ternaries = new Map<TExpressionOf<"ternary">, string>();
    for (const expr of FilePlanner.writtenExpressions(program, unwritten)) {
      if (retested.has(expr)) continue;
      if (
        expr.kind === "binary" &&
        (expr.level === "and" || expr.level === "or")
      ) {
        for (const operand of expr.operands.slice(1)) {
          if (buildsApart(operand)) operands.add(operand);
        }
      }
      if (
        expr.kind === "ternary" &&
        (buildsApart(expr.whenTrue) || buildsApart(expr.whenFalse))
      ) {
        const cType = TypeGenerationHelper.generateByName(
          this.lazyTernaryType(expr, expectedTypes),
          this.typeGenerationDeps(),
        );
        cTypes.add(cType);
        ternaries.set(expr, cType);
      }
    }
    if (operands.size > 0) cTypes.add("bool");
    return { operands, ternaries };
  }

  /**
   * #2332: the type a lowered ternary's variable holds -- its position's, and
   * where none gives one (a comparison's operand) its typed arm's, which an
   * unsuffixed literal arm (the typer's `int`) takes on as C's conversion would
   */
  private lazyTernaryType(
    expr: TExpressionOf<"ternary">,
    expectedTypes: ReadonlyMap<TExpression, IPlannedExpectedType>,
  ): string {
    const typing = this.state.typingContext();
    const typeName =
      expectedTypes.get(expr)?.type ??
      [expr.whenTrue, expr.whenFalse]
        .map((arm) => OperandTyper.typeOf(arm, typing)?.typeName ?? null)
        .find((name) => name !== null && name !== "int") ??
      null;
    invariant(
      typeName !== null,
      `the ternary on line ${expr.span.line} has a typed arm: one holds a call or a struct initializer, which E0357 types from its position`,
    );
    return typeName;
  }

  /** Every `for` update's expressions: run again each pass, after nothing written before them */
  private static forUpdates(program: IProgramSyntax): TExpression[] {
    return program.members.flatMap(({ declaration }) =>
      StatementNodes.in(declaration).flatMap((statement) =>
        statement.kind === "for" && statement.update !== null
          ? [statement.update.target, statement.update.value]
          : [],
      ),
    );
  }

  private planStructInitializers(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    expectedTypes: ReadonlyMap<TExpression, IPlannedExpectedType>,
    wholeArrayValues: ReadonlySet<TExpression>,
  ): ReadonlyMap<TExpressionOf<"structInitializer">, TStructInitializerForm> {
    const { declarationInits, inFunctions } =
      FilePlanner.initializerPositions(program);
    const planned = new Map<
      TExpressionOf<"structInitializer">,
      TStructInitializerForm
    >();
    const visit = (
      expr: TExpression,
      plain: boolean,
      inFunction: boolean,
    ): void => {
      if (expr.kind === "structInitializer") {
        const typeName = expectedTypes.get(expr)?.type ?? null;
        invariant(
          typeName !== null,
          "a struct initializer takes its type from its position -- E0357 " +
            "rejects this in pass 2.1, before this runs",
        );
        planned.set(
          expr,
          this.structInitializerForm(typeName, plain, inFunction),
        );
      }
      for (const [child, childPlain] of FilePlanner.initializerChildren(
        expr,
        plain,
      )) {
        visit(child, childPlain || wholeArrayValues.has(child), inFunction);
      }
    };
    for (const { part } of WrittenParts.of(program, unwritten)) {
      if (part.kind !== "expression" || part.constant) continue;
      visit(
        part.expression,
        declarationInits.has(part.expression) ||
          wholeArrayValues.has(part.expression),
        inFunctions.has(part.expression),
      );
    }
    return planned;
  }

  /**
   * The initializers of declarations, and the expressions written inside a
   * function. A `for` header's declaration is neither plain nor a statement's.
   */
  private static initializerPositions(program: IProgramSyntax): {
    readonly declarationInits: ReadonlySet<TExpression>;
    readonly inFunctions: ReadonlySet<TExpression>;
  } {
    const declarationInits = new Set<TExpression>();
    const inFunctions = new Set<TExpression>();
    for (const { declaration } of program.members) {
      FilePlanner.memberInitializers(declaration).forEach((init) =>
        declarationInits.add(init),
      );
      FilePlanner.functionExpressions(declaration).forEach((expr) =>
        inFunctions.add(expr),
      );
    }
    return { declarationInits, inFunctions };
  }

  /** A declaration's initializer, or its body's declarations' */
  private static memberInitializers(member: TDeclarationSyntax): TExpression[] {
    if (member.kind === "function") {
      return FilePlanner.statementInitializers(member);
    }
    return member.kind === "variableDeclaration" && member.initializer
      ? [member.initializer]
      : [];
  }

  /** Every expression written in a function, or none for anything else */
  private static functionExpressions(
    member: TDeclarationSyntax,
  ): TExpression[] {
    if (member.kind !== "function") return [];
    return DeclarationParts.of(member).flatMap((part) =>
      part.kind === "expression" ? [part.expression] : [],
    );
  }

  /** A function's declaration statements' initializers, outside `for` headers */
  private static statementInitializers(
    func: Extract<TDeclarationSyntax, { kind: "function" }>,
  ): TExpression[] {
    const statements = StatementNodes.in(func);
    const forInits = new Set<unknown>(
      statements.flatMap((statement) =>
        statement.kind === "for" && statement.init ? [statement.init] : [],
      ),
    );
    return statements.flatMap((statement) =>
      statement.kind === "variableDeclaration" &&
      statement.initializer &&
      !forInits.has(statement)
        ? [statement.initializer]
        : [],
    );
  }

  /**
   * How a struct initializer of `typeName` is written: through a C++ class's
   * constructor, designated, or as a compound literal
   */
  private structInitializerForm(
    typeName: string,
    plain: boolean,
    inFunction: boolean,
  ): TStructInitializerForm {
    const cppMode = this.state.cppMode;
    if (cppMode && this._isCppClassWithConstructor(typeName)) return "cppClass";
    const anonymous =
      typeName.startsWith("struct {") || typeName.startsWith("union {");
    return plain || !inFunction || (cppMode && anonymous)
      ? "designated"
      : "compound";
  }

  /**
   * Each child of `expr`, and whether a struct initializer there is still the
   * plain value of a declaration: not in a ternary branch or a call argument
   */
  private static initializerChildren(
    expr: TExpression,
    plain: boolean,
  ): Array<[TExpression, boolean]> {
    if (expr.kind === "ternary") {
      return [
        [expr.condition, plain],
        [expr.whenTrue, false],
        [expr.whenFalse, false],
      ];
    }
    if (expr.kind !== "postfix") {
      return ExpressionChildren.of(expr).map((child) => [child, plain]);
    }
    const children: Array<[TExpression, boolean]> = [[expr.primary, plain]];
    for (const op of expr.ops) {
      if (op.kind === "subscript") {
        op.indexes.forEach((index) => children.push([index, plain]));
      } else if (op.kind === "call") {
        op.arguments.forEach((argument) => children.push([argument, false]));
      }
    }
    return children;
  }

  /**
   * ADR-058: what 2.3's length reads need, by `LengthProperty.rule` -- a
   * string's chars now are strlen, from <string.h>, and a runtime integer
   * length is a helper.
   */
  private planLengths(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    requirements: PlannedRequirements,
  ): void {
    for (const { rule } of this.lengthReads(program, unwritten)) {
      if (rule.kind === "string") requirements.require("string");
      const helper = LengthProperty.helperOf(rule);
      if (helper !== null) requirements.lengthHelper(helper);
    }
  }

  /** Every length 2.3 writes, with the rule it is written by: the typer's step names the property */
  private *lengthReads(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): Generator<{ step: IChainStep; name: ILengthName; rule: TLengthRule }> {
    const typing = this.state.typingContext();
    const isStruct = LengthSubject.structTest(
      (cName) => typing.program.symbolByCName(cName),
      typing.symbolTable,
    );
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (expression.kind !== "postfix") continue;
      for (const step of OperandTyper.chainOf(expression, typing).steps) {
        const name = LengthProperty.parse(step.property ?? "");
        const subject = name && LengthSubject.of(step, isStruct);
        if (name === null || !subject) continue;
        yield { step, name, rule: LengthProperty.rule(name, subject) };
      }
    }
  }

  /** Every expression 2.3 writes, except inside a dimension or enum value, which 1.4 spells */
  private static writtenExpressions(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): TExpression[] {
    return WrittenParts.of(program, unwritten).flatMap(({ part }) =>
      part.kind === "expression" && !part.constant
        ? WrittenParts.nodes(part.expression, unwritten)
        : [],
    );
  }

  /**
   * Types in a written declaration that 2.3 spells some other way: a callback
   * field by its typedef (ADR-029).
   */
  private unwrittenTypes(program: IProgramSyntax): ReadonlySet<TTypeSyntax> {
    const unwritten = new Set<TTypeSyntax>();
    for (const { declaration } of program.declarations) {
      if (declaration.kind !== "struct") continue;
      for (const field of declaration.fields) {
        if (
          this.state.callbackFieldTypes.has(`${declaration.name}.${field.name}`)
        ) {
          unwritten.add(field.type);
        }
      }
    }
    return unwritten;
  }

  /**
   * Issue #282: a private const scalar is inlined at its uses, not declared at
   * file scope. Issue #500 exempts arrays, which cannot be inlined, and #1739
   * one with no value to inline, and a constructor's argument, which C++
   * passes by name (`Counter Lights__counter(Lights__start);`). 2.2 decides
   * it once, before 2.3 renders the scope.
   */
  private planInlinedConsts(
    program: IProgramSyntax,
    cTypes: Set<string>,
  ): ReadonlySet<TDeclarationSyntax> {
    const inlined = new Set<TDeclarationSyntax>();
    for (const { declaration: scope } of program.declarations) {
      if (scope.kind !== "scope") continue;
      this.planInlinedScopeConsts(scope, cTypes, inlined);
    }
    return inlined;
  }

  /**
   * #1735: each value in a static-storage initializer that 2.3 writes as its
   * folded value, and the declarations a name was folded in, which carry the
   * annotation that says why
   */
  private planStaticValues(
    program: IProgramSyntax,
    valuePositions: IValuePositions | null,
  ): {
    readonly values: ReadonlyMap<TExpression, IPlannedStaticValue>;
    readonly notes: ReadonlySet<TDeclarationSyntax>;
  } {
    const values = new Map<TExpression, IPlannedStaticValue>();
    const notes = new Set<TDeclarationSyntax>();
    invariant(valuePositions !== null, "2.1 hands 2.2 where each value stands");
    const typing = this.state.typingContext();
    for (const value of StaticInitializers.values(
      program,
      valuePositions.positions,
    )) {
      const planned = FilePlanner.staticValueOf(
        value,
        typing.program,
        typing.sourceFile,
      );
      if (planned === null) continue;
      values.set(value.value, {
        ...planned,
        clampLines: ExpressionNodes.direct(value.value).flatMap((node) =>
          node.kind === "binary" &&
          (node.level === "additive" || node.level === "multiplicative") &&
          this.clampChain(node) !== null
            ? [node.span.line]
            : [],
        ),
      });
      if (
        StaticInitializers.readsVariable(
          value.value,
          typing.program,
          typing.sourceFile,
        )
      ) {
        notes.add(value.declaration);
      }
    }
    return { values, notes };
  }

  /**
   * The value's folded spelling. A const cnx has no value for and C does
   * -- a char literal, a header macro -- named alone is spelled as that
   * const is where it is used, so C is given the literal or the macro (#1739)
   */
  private static staticValueOf(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): Omit<IPlannedStaticValue, "clampLines"> | null {
    const settled = StaticInitializers.settle(value, program, sourceFile);
    // A value of no number or bool type folds only as the const it names (an
    // enum const, as its member)
    const named =
      value.typeName === null ||
      (settled !== null && StaticInitializers.cHasValue(settled))
        ? StaticInitializers.namedConst(value.value, program, sourceFile)
        : null;
    if (named === null && value.typeName === null) return null;
    if (
      named === null &&
      settled?.kind === "foreign" &&
      StaticInitializers.readsVariable(value.value, program, sourceFile)
    ) {
      return {
        spelling: {
          text: StaticInitializers.cText(value, program, sourceFile),
          typeName: value.typeName,
          verbatim: true,
        },
        narrowing: null,
      };
    }
    if (named === null) {
      const spelling = PrivateConstSpelling.ofValue(
        program,
        settled,
        value.typeName!,
      );
      // 2.1 stopped every value cnx settled to nothing C can be given
      // (E0909, E0910); what is left is C's to evaluate as written
      invariant(
        spelling !== null ||
          settled === null ||
          StaticInitializers.cHasValue(settled),
        "2.1 rejects a static value with no spelling C takes",
      );
      return spelling === null ? null : { spelling, narrowing: null };
    }
    const cName = named.fullyQualifiedCName;
    const spelling = PrivateConstSpelling.spelling(program, cName);
    return spelling === null
      ? null
      : {
          spelling,
          narrowing: PrivateConstSpelling.narrowingOf(program, cName),
        };
  }

  private planInlinedScopeConsts(
    scope: Extract<TDeclarationSyntax, { kind: "scope" }>,
    cTypes: Set<string>,
    inlined: Set<TDeclarationSyntax>,
  ): void {
    const constants = this.transpileState.typingContext().program;
    const declaringScopePath =
      this.state.program?.scopePathOf(scope.name) ?? scope.name;
    const constructorArguments = new Set(
      scope.members.flatMap(({ declaration }) =>
        declaration.kind === "constructorDeclaration"
          ? declaration.arguments.map((argument) => argument.name)
          : [],
      ),
    );
    for (const { declaration } of scope.members) {
      if (declaration.kind !== "variableDeclaration") continue;
      if (constructorArguments.has(declaration.name)) continue;
      const symbol = this.state.program?.memberOf(
        declaringScopePath,
        declaration.name,
      );
      invariant(
        symbol !== undefined,
        "3-Declare declares every scope variable",
      );
      const cName = symbol.fullyQualifiedCName;
      if (!PrivateConstSpelling.inlines(constants, cName)) continue;
      inlined.add(declaration);
      const narrowing = PrivateConstSpelling.narrowingOf(constants, cName);
      if (narrowing?.kind === "cast") cTypes.add(narrowing.cType);
    }
  }

  private planFile(
    program: IProgramSyntax,
    options: ICodeGeneratorOptions,
    valuePositions: IValuePositions | null,
    functionParameters: IFilePlan["functionParameters"],
  ): IFilePlan {
    const selfInclude = this.planSelfInclude(options);
    const selfIncludeAdded = selfInclude !== null;
    const requirements = new PlannedRequirements(options.sourcePath);

    // Neither answer depends on what rendering turns out to produce, so
    // Render reads them rather than interpreting the state they came from.
    const declarationPlan = DeclarationPlan.build(
      program.declarations.map((entry) =>
        FilePlanner.declarationKindOf(entry.declaration),
      ),
      selfIncludeAdded,
    );
    const decidedCTypes = new Set<string>();
    const stringCopies = this.planStringCopies(
      program,
      valuePositions,
      decidedCTypes,
    );
    const inlinedConsts = this.planInlinedConsts(program, decidedCTypes);
    const statics = this.planStaticValues(program, valuePositions);
    const unwritten: IUnwrittenSyntax = {
      declarations: inlinedConsts,
      values: new Set(
        [...statics.values.keys()].flatMap((value) =>
          ExpressionNodes.direct(value),
        ),
      ),
    };
    const types = this.planTypeSites(program, unwritten);
    const nullInitialized = this.planNullInitialized(program, unwritten);
    // #1610: the NULL a C file writes is declared by <stddef.h>
    if (this.writesNull(program, unwritten, nullInitialized)) {
      requirements.require("stddef");
    }
    // Each planned type is written once 2.3 is done, so its include is decided here
    for (const plan of types.values()) {
      const requiredInclude = TypeGenerationHelper.getRequiredInclude(plan);
      if (requiredInclude) {
        requirements.require(requiredInclude);
      }
    }
    const comparisons = this.planComparisons(program, unwritten);
    // ADR-045: a string comparison is written as strcmp, from <string.h>
    if ([...comparisons.values()].includes(true)) {
      requirements.require("string");
    }
    this.planLengths(program, unwritten, requirements);
    const safeDivisions = this.planSafeDivisions(
      program,
      unwritten,
      decidedCTypes,
      requirements,
    );
    const casts = this.planCasts(program, unwritten);
    for (const [expression, cast] of casts) {
      // ADR-024: a saturating cast compares against <limits.h>'s macros
      if (cast.clampForm !== null) {
        requirements.require("limits");
      }
      if (cast.clampForm === "helper") {
        requirements.castHelper(cast.operandType!, expression.type.text);
      }
    }
    const negativeMinimums = FilePlanner.planNegativeMinimums(
      program,
      unwritten,
    );
    // MISRA 10.3: a minimum is written as its <limits.h> macro
    if (negativeMinimums.size > 0) {
      requirements.require("limits");
    }
    const complementCasts = this.planComplementCasts(program, unwritten);
    const floatBits = this.planFloatBits(program, unwritten, decidedCTypes);
    const bitmapFieldWrites = this.planBitmapFieldWrites(program);
    // ADR-007: each union copy is checked by the float static assert
    const floatBitWrites = [...floatBits.writes.values()].filter(
      (write) => write !== null,
    ).length;
    for (let i = 0; i < floatBits.reads.size + floatBitWrites; i++) {
      requirements.require("float_static_assert");
    }
    const registerAccesses = new Map<IAssignmentSyntax, string>();
    const foreignRegisterValues = this.planRegisterAccesses(
      program,
      valuePositions,
      registerAccesses,
      decidedCTypes,
    );
    const expectedTypes = this.planExpectedTypes(
      program,
      unwritten,
      valuePositions,
      types,
      foreignRegisterValues,
    );
    const narrowings = this.planNarrowings(expectedTypes, decidedCTypes, [
      ...FilePlanner.writtenExpressions(program, unwritten),
      ...foreignRegisterValues.flatMap((value) =>
        ExpressionNodes.direct(value),
      ),
    ]);
    invariant(valuePositions !== null, "2.1 hands 2.2 where each value stands");
    const wholeArrayWrites = this.planWholeArrayWrites(
      valuePositions,
      decidedCTypes,
    );
    const wholeArrayArguments = FilePlanner.planWholeArrayArguments(
      valuePositions,
      decidedCTypes,
    );
    const fillSizes = this.planFillSizes(valuePositions);
    const structInitializers = this.planStructInitializers(
      program,
      unwritten,
      expectedTypes,
      new Set([
        ...[...wholeArrayWrites.keys()].map((site) => site.value),
        ...wholeArrayArguments.keys(),
      ]),
    );
    const lazy = this.planLazyOperands(
      program,
      unwritten,
      structInitializers,
      stringCopies.fields,
      expectedTypes,
      decidedCTypes,
    );
    const argumentPlans = this.planArguments(
      valuePositions,
      stringCopies.arguments,
      structInitializers,
      wholeArrayArguments,
      decidedCTypes,
    );
    const clamps = this.planClamps(
      program,
      unwritten,
      foreignRegisterValues,
      decidedCTypes,
    );
    const atomicForms = this.planInterruptSafety(
      program,
      bitmapFieldWrites,
      floatBits.writes,
      clamps.compound,
      decidedCTypes,
      requirements,
    );
    const sliceSources = new Map<IAssignmentSyntax, IPlannedSliceSource>();
    const compoundCasts = new Map<IAssignmentSyntax, string>();
    this.planAssignmentCTypes(
      program,
      atomicForms,
      clamps.compound,
      sliceSources,
      compoundCasts,
      decidedCTypes,
    );
    this.planLengthCTypes(program, unwritten, decidedCTypes);
    const includeDirectives = program.includes.map((include) =>
      this.transformIncludeDirective(include.written),
    );
    const decided: Omit<IFilePlan, "emission" | "setup" | "header"> = {
      program,
      functionParameters,
      arguments: argumentPlans,
      selfInclude,
      includeDirectives,
      inlinedConsts,
      nullInitialized,
      staticValues: statics.values,
      staticValueNotes: statics.notes,
      types,
      comparisons,
      casts,
      negativeMinimums,
      complementCasts,
      floatBitReads: floatBits.reads,
      floatBitWrites: floatBits.writes,
      bitmapFieldWrites,
      atomicForms,
      cTypes: this.planCTypes(program, unwritten, types, bitmapFieldWrites, [
        ...decidedCTypes,
        ...negativeMinimums.values(),
        ...complementCasts.values(),
      ]),
      safeDivisions,
      clampChains: clamps.chains,
      compoundClamps: clamps.compound,
      compoundCasts,
      registerAccesses,
      clampOps: clamps.ops,
      sliceSources,
      stringCopies: stringCopies.copies,
      stringValueForms: stringCopies.forms,
      substringCounts: this.planSubstringCounts(stringCopies.forms),
      stringFields: stringCopies.fields,
      stringCopyHelper: stringCopies.helper,
      wholeArrayWrites,
      fillSizes,
      expectedTypes,
      narrowings,
      structInitializers,
      lazyOperands: lazy.operands,
      lazyTernaries: lazy.ternaries,
    };
    return {
      ...decided,
      emission: EmissionPlan.build(
        this.planEmissionFacts(decided, requirements, selfIncludeAdded),
      ),
      setup: this.state.fileSetup({
        parameters: this.parameters(),
        selfIncludeAdded,
        needsISR: requirements.requires("isr"),
        declarationPlan,
      }),
      header: options.header,
    };
  }

  /**
   * MISRA 7.2, ADR-014, #477: the type each value is rendered against, read
   * off 2.1's walk of where it stands. The innermost site that names a type
   * sets it; a comparison operand has none (#1032), and a function
   * argument's bare enum member stays unresolved.
   */
  /**
   * The type 2.3 writes a call's argument against: its parameter's, unless it
   * goes by reference as an lvalue, which is written as itself.
   */
  private argumentExpectedType(
    site: Extract<TValueSite, { kind: "argument" }>,
  ): string | null {
    const passing = this.argumentPassing(site);
    const base = passing.param?.baseType;
    if (!base) return null;
    const call = site.call.ops[site.op];
    invariant(call?.kind === "call", "an argument site names a call");
    return passing.mode === "reference" &&
      this.getLvalueType(
        ExpressionShape.unparenthesized(call.arguments[site.argument]),
      ) !== null
      ? null
      : base;
  }

  /** How the call at `site` passes its argument (#1991) */
  private argumentPassing(
    site: Extract<TValueSite, { kind: "argument" }>,
  ): IArgumentPassing {
    const head = ExpressionShape.headOf(site.call);
    const step =
      OperandTyper.chainOf(site.call, this.state.typingContext()).steps[
        site.op - head.opsConsumed
      ] ?? null;
    const input = this.state;
    const callbackTypeFunction = CallArgumentPassing.callbackFunction(
      step?.before?.typeName ?? null,
      input,
    );
    return CallArgumentPassing.of(
      callbackTypeFunction ?? step?.callee ?? null,
      site.argument,
      input,
      this.queries,
      callbackTypeFunction === undefined,
    );
  }

  /**
   * How an argument to a C or C++ function is written: as is, by its address
   * for a pointer parameter, or as the pointer a callback-promoted parameter
   * already holds (#1991)
   */
  private cArgumentForm(
    expression: TExpression,
    param: IArgumentPassing["param"],
  ): TCArgumentForm {
    const object = ExpressionShape.unparenthesized(expression);
    const id = ExpressionShape.simpleIdentifier(object);
    const declared = this.nameTypeOf(object);
    const parameter =
      id === null
        ? undefined
        : this.parameterAt(id, FilePlanner.positionOf(object));
    return CArgumentAddress.formOf(
      {
        param,
        addressWritten: object.kind === "unary" && object.operator === "&",
        promotedHandle: parameter?.forcePointerSemantics ?? false,
        argType:
          this.directTypeOf(object) ??
          declared?.baseType ??
          this.foreignVariableType(id),
        declared,
        isArray: OperandTyper.decaysToPointer(
          OperandTyper.typeOf(object, this.state.typingContext()),
        ),
        isHandleArrayElement: this.isHandleArrayElement(object),
      },
      this.queries,
    );
  }

  /**
   * The type of an extern C or C++ global a bare name refers to, which only
   * header symbol collection knows (e.g. an lvgl font `lv_font_montserrat_32`
   * of type `lv_font_t`, Issue #985; #2058 for C++)
   */
  private foreignVariableType(id: string | null): string | null {
    const symbolTable = this.state.symbolTable;
    if (id === null || symbolTable === null) return null;
    const symbol = ForeignTypeFacts.foreignSymbol(symbolTable, id);
    return symbol?.kind === "variable" && !symbol.isArray ? symbol.type : null;
  }

  /**
   * #1668 (C7): the declared type of what an expression NAMES -- a variable
   * spelled bare, `this.x`, `global.x` or `Scope.x`, with nothing applied to
   * it -- and undefined for anything else.
   */
  nameTypeOf(expr: TExpression): TTypeInfo | undefined {
    const typing = this.state.typingContext();
    if (ExpressionShape.postfixView(expr) === null) return undefined;
    const chain = OperandTyper.chainOf(expr, typing);
    if (chain.steps.length !== DeclaredTypeInfo.nameSteps(chain)) {
      return undefined;
    }
    return DeclaredTypeInfo.ofChain(
      chain,
      typing.symbols,
      this.state.symbolTable,
      this.state.targetDescription,
    ).typeInfo;
  }

  /**
   * ADR-030 / #996: whether an argument is one element of an array held
   * through pointers -- `handles[i]` of a `Dev[4] handles`, however the array
   * is named: bare, `this.`, `global.`, or `Scope.` from outside the scope.
   * The array's own declaration says so (`isPointer` on an array of handles,
   * from `DeclaredPointer`), for a parameter, a file-scope, local or scope
   * variable, and one declared in an included file alike.
   */
  private isHandleArrayElement(expr: TExpression): boolean {
    const typing = this.state.typingContext();
    if (ExpressionShape.postfixView(expr) === null) return false;
    const chain = OperandTyper.chainOf(expr, typing);
    const subscript = chain.steps[DeclaredTypeInfo.nameSteps(chain)];
    if (subscript?.subscript !== "array_element") return false;
    const array = DeclaredTypeInfo.ofChain(
      chain,
      typing.symbols,
      this.state.symbolTable,
      this.state.targetDescription,
    ).typeInfo;
    return (array?.isArray ?? false) && (array?.isPointer ?? false);
  }

  /**
   * How each call argument is passed and written (#1991), and the C type its
   * form writes: a by-reference argument's temporary, cast or compound
   * literal, or a C++ enum class value's cast to its integer parameter (#304)
   */
  private planArguments(
    valuePositions: IValuePositions,
    stringArguments: ReadonlyMap<TExpression, number>,
    structInitializers: ReadonlyMap<
      TExpressionOf<"structInitializer">,
      TStructInitializerForm
    >,
    wholeArrayArguments: ReadonlyMap<TExpression, IPlannedWholeArrayWrite>,
    cTypes: Set<string>,
  ): ReadonlyMap<TExpression, IPlannedArgument> {
    const planned = new Map<TExpression, IPlannedArgument>();
    for (const [expression, site] of FilePlanner.argumentSites(
      valuePositions,
    )) {
      const passing = this.argumentPassing(site);
      const base = passing.param?.baseType;
      const built = stringArguments.get(expression);
      const form: TArgumentForm | null =
        built === undefined
          ? this.argumentForm(
              expression,
              passing,
              wholeArrayArguments.get(expression),
              structInitializers,
            )
          : { kind: "string-built", capacity: built };
      const enumCast =
        passing.mode === "reference"
          ? null
          : CallArgumentPassing.cppEnumCast(
              this.directTypeOf(expression),
              base,
              this.queries,
            );
      const cForm =
        passing.mode === "c"
          ? this.cArgumentForm(expression, passing.param)
          : null;
      planned.set(expression, { passing, form, cForm, enumCast });
      const cType = form === null ? enumCast : ArgumentForm.cTypeOf(form);
      if (cType !== null) cTypes.add(cType);
    }
    return planned;
  }
  /** Each argument where it is written, with the call site it binds at */
  private static *argumentSites(
    valuePositions: IValuePositions,
  ): Generator<[TExpression, Extract<TValueSite, { kind: "argument" }>]> {
    for (const [expression, at] of valuePositions.sites) {
      const site = at.site;
      if (site.kind !== "argument") continue;
      const call = site.call.ops[site.op];
      invariant(call?.kind === "call", "an argument site names a call");
      if (call.arguments[site.argument] === expression) {
        yield [expression, site];
      }
    }
  }

  /** A by-reference argument's form; a list for an array parameter is its temporary */
  private argumentForm(
    expression: TExpression,
    passing: ReturnType<FilePlanner["argumentPassing"]>,
    array: IPlannedWholeArrayWrite | undefined,
    structInitializers: ReadonlyMap<
      TExpressionOf<"structInitializer">,
      TStructInitializerForm
    >,
  ): TArgumentForm | null {
    if (passing.mode !== "reference") return null;
    if (array !== undefined) return { kind: "array-temp", array };
    if (this.isArrayTernary(expression, passing)) {
      return { kind: "array" };
    }
    return this.referenceForm(expression, passing, structInitializers);
  }

  /**
   * ADR-014: a ternary of arrays for an array parameter is passed as it
   * stands, the way each of its arms would be; the arms are 2.1's to check
   */
  private isArrayTernary(
    expression: TExpression,
    passing: IArgumentPassing,
  ): boolean {
    return (
      passing.param?.isArray === true &&
      ExpressionShape.unparenthesized(expression).kind === "ternary" &&
      OperandTyper.arrayArms(expression, this.state.typingContext()) !== null
    );
  }

  /**
   * A by-reference argument's form. A `mut` parameter's argument is an object
   * 2.1 accepted (E0915), so it is never passed as a temporary.
   */
  private referenceForm(
    expression: TExpression,
    passing: IArgumentPassing,
    structInitializers: ReadonlyMap<
      TExpressionOf<"structInitializer">,
      TStructInitializerForm
    >,
  ): TArgumentForm {
    const object = ExpressionShape.unparenthesized(expression);
    const form = ArgumentForm.of(
      this.boundArgumentName(object) !== null,
      passing.param?.baseType,
      this.argumentShape(object, structInitializers),
      this.state.cppMode,
      passing.param?.isConst ?? false,
    );
    invariant(
      passing.param?.isConst !== false ||
        (MutArgument.isWritable(expression, this.state.typingContext()) &&
          form.kind !== "rvalue"),
      "2.1 rejected every `mut` argument that is not an object (ADR-006, E0915)",
    );
    return form;
  }

  private planExpectedTypes(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    valuePositions: IValuePositions | null,
    types: ReadonlyMap<TTypeSyntax, IPlannedType>,
    foreignRegisterValues: readonly TExpression[],
  ): ReadonlyMap<TExpression, IPlannedExpectedType> {
    invariant(valuePositions !== null, "2.1 hands 2.2 where each value stands");
    const typeScopes = new Map(
      TypeSites.of(program, unwritten).map((site) => [site.type, site.scope]),
    );
    const scopeMembers = new Set<IVariableDeclarationSyntax>(
      program.members.flatMap(({ declaration, scope }) =>
        scope !== null && declaration.kind === "variableDeclaration"
          ? [declaration]
          : [],
      ),
    );
    const forInits = new Set<IVariableDeclarationSyntax>(
      program.members.flatMap((entry) =>
        StatementNodes.in(entry.declaration).flatMap((statement) =>
          statement.kind === "for" &&
          statement.init?.kind === "variableDeclaration"
            ? [statement.init]
            : [],
        ),
      ),
    );
    // A string outside a scope is copied in by the string helpers, so neither
    // it nor its indexes are written against a type
    const copiesString = (declaration: IVariableDeclarationSyntax): boolean => {
      const type = declaration.type;
      const element = type.kind === "array" ? type.element : type;
      return element.kind === "string" && !scopeMembers.has(declaration);
    };
    const inlined = new Set<IVariableDeclarationSyntax>(
      [...unwritten.declarations].flatMap((declaration) =>
        declaration.kind === "variableDeclaration" ? [declaration] : [],
      ),
    );
    const spellDeclared = (
      declaration: IVariableDeclarationSyntax,
    ): string | null => {
      // An inlined const's initializer is never written, so nothing in it is
      // written against its type
      if (inlined.has(declaration)) return null;
      const type = declaration.type;
      if (copiesString(declaration)) return null;
      const planned = types.get(type);
      // A scope's string is the char array it is declared as, not copied in
      // by the string helpers, so it is written against its C type
      const element = type.kind === "array" ? type.element : type;
      if (scopeMembers.has(declaration) && element.kind === "string") {
        return planned === undefined ? null : this.cTypeOf(planned);
      }
      if (forInits.has(declaration)) {
        if (planned === undefined) return null;
        const declared = this.cTypeOf(planned);
        return this.queries.getCallbackTypedefName(declared) ?? declared;
      }
      return (
        TypeNameLadder.resolveWrittenName(
          type,
          this.state.scopePathOf(typeScopes.get(type) ?? null),
          this.state.typeBindingDeps((identifiers) =>
            this.resolveQualifiedType(identifiers),
          ),
        ) ?? type.text
      );
    };
    const spellSite = (
      site: TValueSite,
      outer: string | null,
    ): string | null => {
      switch (site.kind) {
        case "declaration":
          return spellDeclared(site.declaration);
        case "assignment":
          return this.assignedValueType(
            site.assignment.target,
            this.targetDeclaration(site.assignment.target),
          );
        case "return":
          return site.function.returnType.text;
        case "field":
          return outer === null
            ? null
            : (this._resolveFieldType(
                site.field,
                this.state.symbolTable?.getStructFieldTypes(outer),
              ) ?? null);
        case "index":
          return "size_t";
        default:
          return null;
      }
    };
    const resolved = new Map<IValueSite, IPlannedExpectedType | null>();
    const within = (
      type: string | null,
      outer: IPlannedExpectedType | null,
      suppressBareEnumResolution: boolean,
    ): IPlannedExpectedType | null =>
      type === null ? outer : { type, suppressBareEnumResolution };
    const resolve = (at: IValueSite | null): IPlannedExpectedType | null => {
      if (at === null) return NO_EXPECTED_TYPE;
      if (at.site.kind === "comparison") return NO_EXPECTED_TYPE;
      // A target's index, or a copied string's, is written against no type
      const outerSite = at.outer?.site;
      if (
        at.site.kind === "index" &&
        (outerSite?.kind === "target" ||
          (outerSite?.kind === "declaration" &&
            copiesString(outerSite.declaration)))
      ) {
        return NO_EXPECTED_TYPE;
      }
      const known = resolved.get(at);
      if (known !== undefined) return known;
      const outer = resolve(at.outer);
      // A site with a type sets it, and one without leaves the outer one's.
      // A function argument's suppresses its bare enum member (#872), and a
      // struct field's names its own, even in an argument (ADR-017)
      let planned: ReturnType<typeof within>;
      if (at.site.kind === "argument") {
        planned = within(this.argumentExpectedType(at.site), outer, true);
      } else {
        const spelled = outer === null ? null : spellSite(at.site, outer.type);
        planned = within(
          spelled,
          outer,
          at.site.kind !== "field" &&
            (outer?.suppressBareEnumResolution ?? false),
        );
      }
      resolved.set(at, planned);
      return planned;
    };
    const planned = new Map<TExpression, IPlannedExpectedType>();
    for (const expression of valuePositions.positions.keys()) {
      const expected = resolve(valuePositions.sites.get(expression) ?? null);
      if (expected !== null) planned.set(expression, expected);
    }
    // Like the file's own register's: written against no type
    for (const value of foreignRegisterValues) {
      for (const node of ExpressionNodes.direct(value)) {
        planned.set(node, NO_EXPECTED_TYPE);
      }
    }
    return planned;
  }

  /**
   * ADR-004: the `uintN_t` each byte-aligned write to a write-only register
   * member is written through, and the base address and offset expressions
   * of the registers another file declares that those writes spell. The
   * file's own registers' are already among 2.1's value positions.
   */
  private planRegisterAccesses(
    program: IProgramSyntax,
    valuePositions: IValuePositions | null,
    accesses: Map<IAssignmentSyntax, string>,
    cTypes: Set<string>,
  ): TExpression[] {
    invariant(valuePositions !== null, "2.1 hands 2.2 where each value stands");
    const symbols = this.state.symbols!;
    const foreign: TExpression[] = [];
    const sites = FilePlanner.assignmentSites(program);
    for (const site of sites) {
      const range = AssignmentTarget.parts(site.target).ops.at(-1);
      // The register member the typer names, however it is spelled (#2185)
      const step = this.targetDeclaration(site.target).last;
      const member =
        step?.subscript === "bit_range" ? step.beforeRegisterMember : null;
      const register = step?.beforeRegister ?? null;
      if (
        !member ||
        !register ||
        range?.kind !== "subscript" ||
        range.indexes.length !== 2
      ) {
        continue;
      }
      const base = symbols.registerBaseAddresses.get(register);
      const offset = symbols.registerMemberOffsets.get(member);
      if (
        base === undefined ||
        offset === undefined ||
        !RegisterAccessMode.isWriteOne(symbols.registerMemberAccess.get(member))
      ) {
        continue;
      }
      const accessType = RegisterMmio.accessType(
        this.tryEvaluateConstant(range.indexes[0]),
        this.tryEvaluateConstant(range.indexes[1]),
      );
      if (accessType === null) continue;
      accesses.set(site, accessType);
      cTypes.add(accessType);
      for (const value of [base, offset]) {
        if (!valuePositions.positions.has(value) && !foreign.includes(value)) {
          foreign.push(value);
        }
      }
    }
    return foreign;
  }

  /**
   * ADR-015 / #1610: each declaration whose zero is the null pointer -- a
   * scalar with no initializer whose C value is a pointer, at file scope, in
   * a scope or in a body. That is the declaration's own `DeclaredPointer`
   * answer, the one its `*` is written from, or a pointer typedef (#957),
   * which needs no `*`. An array of handles keeps ADR-015's brace zero (#996).
   */
  private planNullInitialized(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): ReadonlySet<IVariableDeclarationSyntax> {
    // A scope member or local is typed without its `kind`, so it is looked up by node
    const unwrittenNodes: ReadonlySet<ISyntaxNode> = unwritten.declarations;
    return new Set(
      FilePlanner.variableDeclarations(program).filter(
        (decl) =>
          !decl.initializer &&
          !unwrittenNodes.has(decl) &&
          !FilePlanner.isArrayDeclaration(decl) &&
          this.state.holdsPointer(decl),
      ),
    );
  }

  /**
   * Every variable the file declares with ADR-015's zero: at file scope, in a
   * scope, in a body. A `for` header's declaration is not one: the header is
   * written without ADR-015's zero today (#2334 decides whether it gets one),
   * so planning it a null would raise `<stddef.h>` for a `NULL` nothing writes.
   */
  private static variableDeclarations(
    program: IProgramSyntax,
  ): IVariableDeclarationSyntax[] {
    return program.members.flatMap((entry) => {
      const statements = StatementNodes.in(entry.declaration);
      const forHeaders = new Set<TStatement>(
        statements.flatMap((statement) =>
          statement.kind === "for" && statement.init !== null
            ? [statement.init]
            : [],
        ),
      );
      return [
        ...(entry.declaration.kind === "variableDeclaration"
          ? [entry.declaration]
          : []),
        ...statements.flatMap((statement) =>
          statement.kind === "variableDeclaration" && !forHeaders.has(statement)
            ? [statement]
            : [],
        ),
      ];
    });
  }

  /**
   * #1610: whether the file writes `NULL` -- a written `NULL` literal, or a
   * null-initialized declaration -- which `<stddef.h>` declares. The answer
   * follows the spelling `CppModeHelper.nullLiteral` writes, so C++'s
   * `nullptr` needs no header.
   */
  private writesNull(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    nullInitialized: ReadonlySet<IVariableDeclarationSyntax>,
  ): boolean {
    if (CppModeHelper.nullLiteral(this.state) !== "NULL") return false;
    if (nullInitialized.size > 0) return true;
    return FilePlanner.writtenExpressions(program, unwritten).some(
      (expression) =>
        expression.kind === "literal" && expression.literalKind === "null",
    );
  }

  /**
   * Issue #500: both spellings make an array -- C-style trailing dimensions
   * and the cnx array type. The one predicate for a local, a scope member
   * and a file-scope variable.
   */
  static isArrayDeclaration(decl: IVariableDeclarationSyntax): boolean {
    return decl.dimensions.length > 0 || decl.type.kind === "array";
  }

  /**
   * The `uint32_t` 2.3 writes a length in (#1760): a logical bit or byte
   * length of an array with a dimension that does not fold (a C macro) is a
   * product, a memory length a cast `sizeof`, a runtime one a helper's, and
   * strlen's only when it is widened for its bits.
   */
  private planLengthCTypes(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    cTypes: Set<string>,
  ): void {
    for (const { step, name, rule } of this.lengthReads(program, unwritten)) {
      const unfolded =
        rule.kind === "logical" &&
        name.unit !== "element_count" &&
        step.before?.dimensions.some((dim) => typeof dim !== "number");
      const helper = LengthProperty.helperOf(rule) !== null;
      if (
        unfolded ||
        rule.kind === "memory" ||
        (rule.kind === "string" && name.unit === "bit_length") ||
        helper
      ) {
        cTypes.add(LengthProperty.PRODUCT_C_TYPE);
      }
      // `sizeof(bool)`: the C type a memory length measures (2.3's memoryCType)
      const primitive = TYPE_MAP[step.before?.typeName ?? ""];
      if (rule.kind === "memory" && primitive !== undefined) {
        cTypes.add(primitive);
      }
      // a runtime integer length's helper takes the value widened to 64 bits
      if (helper) cTypes.add("uint64_t");
      if (rule.kind === "decimal" && rule.signed) cTypes.add("int64_t");
    }
  }

  /**
   * The C types 2.3 writes for an assignment's own form: a slice write's
   * element type (#1081), and MISRA 10.3's cast back to a narrow variable
   * that a compound write promotes to `int` (#845). A field or an element is
   * written `op=`, with no cast.
   */
  private planAssignmentCTypes(
    program: IProgramSyntax,
    atomicForms: ReadonlyMap<IAssignmentSyntax, IPlannedAtomic | null>,
    compoundClamps: ReadonlyMap<IAssignmentSyntax, unknown>,
    sliceSources: Map<IAssignmentSyntax, IPlannedSliceSource>,
    compoundCasts: Map<IAssignmentSyntax, string>,
    cTypes: Set<string>,
  ): void {
    const typing = this.state.typingContext();
    const sites = FilePlanner.assignmentSites(program);
    for (const site of sites) {
      const last = OperandTyper.chainOf(site.target, typing).steps.at(-1);
      if (last?.subscript === "array_slice") {
        const element = last.before?.typeName ?? null;
        invariant(element !== null, "a sliced buffer names its element type");
        // A string's bytes are cast through uint8_t (MISRA 10.8)
        cTypes.add(TYPE_MAP[element] ?? "uint8_t");
        this.planSliceSource(site, sliceSources, cTypes);
        continue;
      }
      if (site.operator === "<-" || (atomicForms.get(site) ?? null) !== null) {
        continue;
      }
      if (AssignmentTarget.parts(site.target).ops.length > 0) continue;
      const written = OperandTyper.typeOfTarget(site.target, typing);
      const baseType = written?.typeName ?? null;
      if (
        written === null ||
        baseType === null ||
        baseType === "int" ||
        NarrowingCastHelper.getPromotedType(baseType) !== "int"
      ) {
        continue;
      }
      const cOp = AssignmentOperatorMapper.toCOperator(
        site.operator,
        site.operatorSpan.line,
      );
      if (
        COMPOUND_TO_BINARY[cOp] !== undefined &&
        (compoundClamps.get(site) ?? null) === null
      ) {
        const cType = TYPE_MAP[baseType] ?? baseType;
        compoundCasts.set(site, cType);
        cTypes.add(cType);
      }
    }
  }

  /** ADR-044: the helpers a `+ - *` chain saturates through, or null for plain C */
  private clampChain(expr: TExpressionOf<"binary">): IPlannedClamp | null {
    const cnxType = this.compositeClampType(expr);
    if (cnxType === null || TypeCheckUtils.usesNativeArithmetic(cnxType)) {
      return null;
    }
    if (this.compositeClampBehavior(expr) !== "clamp") return null;
    const defaultOperator = expr.level === "additive" ? "+" : "*";
    const helpers = expr.operands
      .slice(1)
      .map(
        (_, i) =>
          CLAMP_HELPER_FOR_OPERATOR[expr.operators[i] ?? defaultOperator],
      );
    if (!helpers.every((op): op is string => op !== undefined)) return null;
    return { cnxType, operations: helpers };
  }

  /**
   * ADR-044: which written `+ - *` chains and compound writes of a `clamp`
   * integer saturate, and through which helpers. A chain qualifies only when
   * every operator has a helper; a mixed chain like `a * b / c` stays plain C.
   */
  private planClamps(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    foreignRegisterValues: readonly TExpression[],
    cTypes: Set<string>,
  ): {
    readonly chains: ReadonlyMap<TExpression, IPlannedClamp | null>;
    readonly compound: ReadonlyMap<
      IAssignmentSyntax,
      { operation: string; cnxType: string } | null
    >;
    readonly ops: ReadonlySet<string>;
  } {
    const ops = new Set<string>();
    const use = (operation: string, cnxType: string): void => {
      ops.add(`${operation}_${cnxType}`);
      ClampTypes.cTypesOf(cnxType).forEach((t) => cTypes.add(t));
    };

    const chains = new Map<TExpression, IPlannedClamp | null>();
    for (const expr of [
      ...FilePlanner.writtenExpressions(program, unwritten),
      ...foreignRegisterValues.flatMap((value) =>
        ExpressionNodes.direct(value),
      ),
    ]) {
      if (expr.kind !== "binary") continue;
      if (expr.level !== "additive" && expr.level !== "multiplicative") {
        continue;
      }
      const chain = this.clampChain(expr);
      chains.set(expr, chain);
      chain?.operations.forEach((operation) => use(operation, chain.cnxType));
    }

    const compound = new Map<
      IAssignmentSyntax,
      { operation: string; cnxType: string } | null
    >();
    const typing = this.state.typingContext();
    for (const site of FilePlanner.assignmentSites(program)) {
      compound.set(site, null);
      if (site.operator === "<-") continue;
      const clamp = AssignmentClassifier.clampOfWrite(
        OperandTyper.writtenType(site.target, typing),
        site.operator,
        () => site.value.kind !== "missing" && this.hasFloatingLeaf(site.value),
      );
      if (clamp === null) continue;
      use(clamp.operation, clamp.cnxType);
      compound.set(site, clamp);
    }
    return { chains, compound, ops };
  }

  /** Every assignment in the file, in source order */
  private static assignmentSites(program: IProgramSyntax): IAssignmentSyntax[] {
    return program.members.flatMap((entry) =>
      StatementNodes.assignments(entry.declaration),
    );
  }

  /**
   * #1731: the capacity of each write of one whole `string<N>`, which is one
   * `cnx_string_copy` (#2207) whatever spells its target. ADR-045's copy,
   * recorded where it is decided. The typer's answer, asked as 2.1's E0715
   * asks it, so a `for` header cannot be handed a copy 2.1 did not see (#1731
   * review). The form of each value it copies in is decided here with it,
   * by `StringValueForm`, as 2.1's E0864 reads it (#1257). Whether the file
   * defines the helper, and the `uint32_t` it counts in, are decided here
   * too, as `planClamps` decides its helpers and their types.
   */
  private planStringCopies(
    program: IProgramSyntax,
    valuePositions: IValuePositions | null,
    cTypes: Set<string>,
  ): {
    readonly copies: ReadonlyMap<IAssignmentSyntax, number>;
    readonly forms: ReadonlyMap<TExpression, TStringValueForm>;
    readonly arguments: ReadonlyMap<TExpression, number>;
    readonly fields: ReadonlyMap<TExpression, number>;
    readonly helper: boolean;
  } {
    const copies = new Map<IAssignmentSyntax, number>();
    const forms = new Map<TExpression, TStringValueForm>();
    const typing = this.state.typingContext();
    for (const site of FilePlanner.assignmentSites(program)) {
      const capacity = OperandTyper.stringCopyCapacity(site.target, typing);
      if (capacity === null) continue;
      AdrProvenance.record("045", site.operatorSpan.line, "string-copy");
      copies.set(site, capacity);
      forms.set(site.value, StringValueForm.of(site.value, typing));
    }
    FilePlanner.planStringInits(program, typing, forms);
    const builtArguments = FilePlanner.planStringArguments(
      valuePositions,
      typing,
      forms,
    );
    const fields = FilePlanner.planStringFields(
      program,
      valuePositions,
      typing,
      forms,
    );
    // #2207: every assignment ends in `cnx_string_copy`, a concatenation's
    // and a substring's after they are built apart (#1257), and so does a
    // declaration's copy; the helper counts in `uint32_t`
    const helper =
      copies.size > 0 ||
      fields.size > 0 ||
      [...forms.values()].some((f) => StringUtils.usesCopyHelper(f));
    if (helper) cTypes.add("uint32_t");
    return { copies, forms, arguments: builtArguments, fields, helper };
  }

  /**
   * #2236: each struct initializer field in a function that writes a
   * `string<N>`, by the field's capacity. C has no initializer for a `char[]`
   * from a string, and C++ before C++20's GCC 11 takes no designated string
   * literal for one, so every one is copied in like any string. At file scope
   * only a literal reaches one (E0863), and it stays in the initializer.
   */
  /** #2240: each substring part's length, which E0922 has made constant */
  private planSubstringCounts(
    forms: ReadonlyMap<TExpression, TStringValueForm>,
  ): ReadonlyMap<TExpression, number> {
    const counts = new Map<TExpression, number>();
    for (const form of forms.values()) {
      const parts =
        form.kind === "concat"
          ? form.parts
          : form.kind === "substring"
            ? [form.part]
            : [];
      for (const part of parts) {
        if (part.kind !== "substring") continue;
        const count = part.length === null ? 1 : this.constantOf(part.length);
        invariant(
          count !== undefined,
          "2.1's E0922 rejects a substring length that is not a constant",
        );
        counts.set(part.chain, count);
      }
    }
    return counts;
  }

  private static planStringFields(
    program: IProgramSyntax,
    valuePositions: IValuePositions | null,
    typing: ITypingContext,
    forms: Map<TExpression, TStringValueForm>,
  ): ReadonlyMap<TExpression, number> {
    const fields = new Map<TExpression, number>();
    if (valuePositions === null) return fields;
    const fileScope = VariableDeclarations.fileScopeValues(program);
    for (const { value, write, capacity } of StringWriteSites.of(
      valuePositions,
    )) {
      if (write !== "field" || fileScope.has(value)) continue;
      forms.set(value, StringValueForm.of(value, typing));
      fields.set(value, capacity);
    }
    return fields;
  }

  /**
   * #2239: a concatenation or a substring passed to a `string<N>` parameter,
   * by the parameter's capacity -- built apart like an assignment's, by the
   * same value form. Any other argument is passed as it is written.
   */
  private static planStringArguments(
    valuePositions: IValuePositions | null,
    typing: ITypingContext,
    forms: Map<TExpression, TStringValueForm>,
  ): ReadonlyMap<TExpression, number> {
    const built = new Map<TExpression, number>();
    if (valuePositions === null) return built;
    for (const { value, write, capacity } of StringWriteSites.of(
      valuePositions,
    )) {
      if (write !== "argument") continue;
      const form = StringValueForm.of(value, typing);
      if (form.kind !== "concat" && form.kind !== "substring") continue;
      forms.set(value, form);
      built.set(value, capacity);
    }
    return built;
  }

  /**
   * #1731 sweep: a function's `string<N> t <- v` takes the form of `v` by the
   * rule an assignment's value does (#1257): a literal initializes the array,
   * and a copy, a concatenation and a substring are written into it. 2.1 has
   * rejected a value that is no string (E0923), so a copy's is a string: a
   * cnx one, or a C `char*` or `char[]`.
   */
  private static planStringInits(
    program: IProgramSyntax,
    typing: ITypingContext,
    forms: Map<TExpression, TStringValueForm>,
  ): void {
    for (const { declaration, site } of VariableDeclarations.ruled(program)) {
      const initializer = declaration.initializer;
      if (site !== "statement" || initializer === null) continue;
      if (declaration.type.kind !== "string") continue;
      if (declaration.type.capacity === null) continue;
      forms.set(initializer, StringValueForm.of(initializer, typing));
    }
  }

  /**
   * #1782: each `<-` that writes a whole array -- 2.1's position for its
   * value says so, and 2.1 has checked that it is given what ADR-035 gives
   * one (E0866) with `<-` alone (E0857) -- and the element type and
   * dimensions its copy walks.
   */
  private planWholeArrayWrites(
    valuePositions: IValuePositions,
    cTypes: Set<string>,
  ): ReadonlyMap<IAssignmentSyntax, IPlannedWholeArrayWrite> {
    const typing = this.state.typingContext();
    const planned = new Map<IAssignmentSyntax, IPlannedWholeArrayWrite>();
    for (const [value, at] of valuePositions.sites) {
      if (at.site.kind !== "assignment") continue;
      const site = at.site.assignment;
      const position = valuePositions.positions.get(value);
      const dimensions = position?.dimensions ?? [];
      if (site.value !== value || dimensions.length === 0) continue;
      const written = OperandTyper.typeOfTarget(site.target, typing);
      const typeName = written?.typeName ?? null;
      invariant(
        written !== null && typeName !== null,
        "a whole array's element type is named",
      );
      invariant(
        ExpressionShape.givesWholeArray(value, typeName),
        "2.1 gave a whole array its list (E0866)",
      );
      planned.set(
        site,
        FilePlanner.wholeArrayShape(
          position?.typeText ?? typeName,
          written.cType,
          dimensions,
          value,
          FilePlanner.isVolatileTarget(
            OperandTyper.rootOfTarget(site.target, typing),
          ),
        ),
      );
      cTypes.add("uint32_t");
    }
    return planned;
  }

  /**
   * #2157: each list (or a `u8` array's string) given for an array
   * parameter, and the temporary of the parameter's shape it is passed as.
   * 2.1's E0866 has counted it against the parameter.
   */
  private static planWholeArrayArguments(
    valuePositions: IValuePositions,
    cTypes: Set<string>,
  ): ReadonlyMap<TExpression, IPlannedWholeArrayWrite> {
    const planned = new Map<TExpression, IPlannedWholeArrayWrite>();
    for (const [expression, at] of valuePositions.sites) {
      if (at.site.kind !== "argument") continue;
      const position = valuePositions.positions.get(expression);
      if (
        !position?.isArray ||
        position.dimensions.length === 0 ||
        position.typeText === null
      ) {
        continue;
      }
      const element = TypeText.withoutDimensions(position.typeText);
      if (!ExpressionShape.givesWholeArray(expression, element)) continue;
      const shape = FilePlanner.wholeArrayShape(
        position.typeText,
        null,
        position.dimensions,
        expression,
        false,
      );
      planned.set(expression, shape);
      cTypes.add(shape.elementCType);
    }
    return planned;
  }

  /**
   * #2110 (ADR-035): how many slots each fill-all fills, at every level of a
   * whole array's list -- a declaration's, an assignment target's, a field's
   * or a parameter's. A size that does not fold is absent: 2.1 rejects any
   * fill there but zero (#2196), which C's `{v}` already gives every slot.
   */
  private planFillSizes(
    valuePositions: IValuePositions,
  ): ReadonlyMap<TExpressionOf<"arrayInitializer">, number> {
    const found = new Map<TExpressionOf<"arrayInitializer">, number>();
    for (const [value, at] of valuePositions.positions) {
      if (value.kind !== "arrayInitializer" || at.inList) continue;
      FilePlanner.fillSizesOf(
        value,
        this.listSizes(value, at, valuePositions),
        0,
        found,
      );
    }
    return found;
  }

  /** The sizes a whole array's list fills, leading first; null: not folded */
  private listSizes(
    value: TExpression,
    at: IValuePosition,
    valuePositions: IValuePositions,
  ): ReadonlyArray<number | null> {
    if (!at.isDeclaration) {
      return at.dimensions.map((size) =>
        typeof size === "number" ? size : null,
      );
    }
    const site = valuePositions.sites.get(value)?.site;
    if (site?.kind !== "declaration") return [];
    const { type, dimensions } = site.declaration;
    return [
      ...(type.kind === "array" ? type.dimensions : []),
      ...dimensions,
    ].map((size) => (size === null ? null : (this.constantOf(size) ?? null)));
  }

  private static fillSizesOf(
    list: TExpressionOf<"arrayInitializer">,
    sizes: ReadonlyArray<number | null>,
    level: number,
    found: Map<TExpressionOf<"arrayInitializer">, number>,
  ): void {
    const size = sizes[level];
    if (list.fill !== null && typeof size === "number") found.set(list, size);
    for (const element of list.fill === null ? list.elements : [list.fill]) {
      if (element.kind === "arrayInitializer") {
        FilePlanner.fillSizesOf(element, sizes, level + 1, found);
      }
    }
  }

  /**
   * A target declared `volatile` or `atomic` (which C writes `volatile`); a
   * call in its subscript is a side effect, not a qualifier
   */
  private static isVolatileTarget(binding: TValueBinding | null): boolean {
    if (binding?.kind === "local") {
      return binding.declaration.isVolatile || binding.declaration.isAtomic;
    }
    if (binding?.kind === "variable") {
      return binding.symbol.isVolatile || binding.symbol.isAtomic;
    }
    return false;
  }

  /**
   * A whole array's shape from its position's type spelling, the one source
   * an assignment target and a parameter share; `cType` is a header's own
   * spelling of an unfixed-width element
   */
  private static wholeArrayShape(
    typeText: string,
    cType: string | null,
    dimensions: ReadonlyArray<number | string>,
    value: TExpression,
    volatileTarget: boolean,
  ): IPlannedWholeArrayWrite {
    const element = TypeText.withoutDimensions(typeText);
    if (TypeCheckUtils.isSizedStringName(element)) {
      const capacity = Number(element.slice("string<".length, -1));
      return {
        elementCType: "char",
        dimensions: [...dimensions, capacity + 1],
        fromList: value.kind === "arrayInitializer",
        volatileTarget,
      };
    }
    return {
      elementCType: cType ?? TYPE_MAP[element] ?? element,
      dimensions,
      fromList: value.kind === "arrayInitializer",
      volatileTarget,
    };
  }

  /**
   * #1081: how a slice write reads its source, and the C types its source
   * temps write. 2.1 has checked the geometry, so offset and length fold.
   */
  private planSliceSource(
    site: IAssignmentSyntax,
    sliceSources: Map<IAssignmentSyntax, IPlannedSliceSource>,
    cTypes: Set<string>,
  ): void {
    const parts = AssignmentTarget.parts(site.target);
    const slice = parts.ops.at(-1);
    invariant(
      slice?.kind === "subscript" && slice.indexes.length === 2,
      "a slice write ends in a two-index subscript",
    );
    const lengthValue = this.tryEvaluateConstant(slice.indexes[1]);
    invariant(lengthValue !== undefined, "2.1 folded the slice length (E0859)");
    const value = site.value;
    const hasValue = value.kind !== "missing";
    const source = SliceSource.of(
      {
        hasValue,
        valueExpressionType: () => this.directTypeOf(value),
        valueIntegerType: () => this.integerTypeOf(value),
        foldValue: () => this.tryEvaluateConstant(value),
      },
      parts.identifier ?? "",
      lengthValue,
    );
    sliceSources.set(site, source);
    for (const cType of [source.cType, source.unsignedCType]) {
      if (cType !== null) cTypes.add(cType);
    }
    const elementBytes = SliceSource.elementBytes(
      this.targetDeclaration(site.target).typeInfo,
    );
    const elementCount = lengthValue / elementBytes;
    if (
      SliceSource.materializes(source, elementCount) &&
      !SliceSource.splits(source)
    ) {
      cTypes.add(SliceSource.tempTypeOf(source, lengthValue));
    }
  }

  /**
   * MISRA 10.3: how 2.3 writes each value C promotes to `int` -- a bit read, a
   * bitmap field read or a character literal -- against the type 2.2 planned
   * for the value it sits in, keyed by its typer step; and the C types of the
   * casts
   */
  private planNarrowings(
    expectedTypes: ReadonlyMap<TExpression, IPlannedExpectedType>,
    cTypes: Set<string>,
    written: Iterable<TExpression>,
  ): ReadonlyMap<TExpression, ReadonlyMap<number, TPlannedNarrowing>> {
    const typing = this.state.typingContext();
    const bitmapFields = this.state.symbols?.bitmapFields;
    const promotedSources = (node: TExpression): Array<[number, string]> => {
      if (node.kind === "literal")
        return node.text.startsWith("'") ? [[0, "int"]] : [];
      if (node.kind !== "postfix") return [];
      const steps = OperandTyper.chainOf(node, typing).steps;
      return steps.flatMap((step, index): Array<[number, string]> => {
        const from = step.before?.typeName ?? null;
        if (step.subscript === "bit_single") return [[index, "int"]];
        if (step.subscript === "bit_range") {
          // A float's bits are read through a union's integer member, which
          // is not promoted (ADR-007)
          return from === null || FloatBits.rangeTypeOf(step) !== null
            ? []
            : [[index, NarrowingCastHelper.getPromotedType(from)]];
        }
        // A field's bits (#2251) are read off the field, which is promoted
        // only where it is the value
        return step.subscript === null &&
          step.property === null &&
          index === steps.length - 1 &&
          from !== null &&
          bitmapFields?.has(from)
          ? [[index, "int"]]
          : [];
      });
    };
    const narrowings = new Map<TExpression, Map<number, TPlannedNarrowing>>();
    for (const [value, planned] of expectedTypes) {
      const target = planned.type;
      if (target === null) continue;
      const visit = (node: TExpression): void => {
        if (node !== value && expectedTypes.has(node)) return;
        for (const [index, source] of promotedSources(node)) {
          const narrowing = NarrowingCastHelper.narrowingOf(source, target);
          if (narrowing === null) continue;
          const steps = narrowings.get(node) ?? new Map();
          steps.set(index, narrowing);
          narrowings.set(node, steps);
          if (narrowing.kind === "cast") cTypes.add(narrowing.cType);
        }
        ExpressionChildren.of(node).forEach(visit);
      };
      visit(value);
    }
    for (const expression of written) {
      const read =
        expression.kind === "postfix" || expression.kind === "literal";
      if (read && !narrowings.has(expression)) {
        narrowings.set(expression, new Map());
      }
    }
    return narrowings;
  }

  /**
   * MISRA 10.1: each written `~` of an unsigned operand, and the C type 2.3
   * casts it back to (`~` promotes a narrow operand to `int`)
   */
  private planComplementCasts(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
  ): ReadonlyMap<TExpressionOf<"unary">, string> {
    const casts = new Map<TExpressionOf<"unary">, string>();
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (expression.kind !== "unary" || expression.operator !== "~") continue;
      const operandType = this.directTypeOf(expression.operand);
      if (operandType !== null && TypeCheckUtils.isUnsigned(operandType)) {
        casts.set(expression, TYPE_MAP[operandType] ?? operandType);
      }
    }
    return casts;
  }

  /**
   * #1927: every C type the file's text uses, from which 2.2 decides
   * `<stdint.h>` and `<stdbool.h>` (`CTypeIncludes`): each written type, each
   * `true`/`false`, each bitmap's backing type (and that of each bitmap whose
   * field the file writes), and the C types of the forms
   * 2.2 already chose (`decided`).
   */
  private planCTypes(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax,
    types: ReadonlyMap<TTypeSyntax, IPlannedType>,
    bitmapFieldWrites: ReadonlyMap<
      IAssignmentSyntax,
      IBitmapFieldTarget | null
    >,
    decided: Iterable<string>,
  ): ReadonlySet<string> {
    const cTypes = new Set<string>(decided);
    for (const plan of types.values()) cTypes.add(this.cTypeOf(plan));
    for (const expression of FilePlanner.writtenExpressions(
      program,
      unwritten,
    )) {
      if (
        expression.kind === "literal" &&
        (expression.text === "true" || expression.text === "false")
      ) {
        cTypes.add("bool");
      }
    }
    // The typedef is generated even where the header owns it (#369/#1164)
    for (const entry of program.declarations) {
      if (entry.declaration.kind !== "bitmap") continue;
      const backing = this.state.symbols?.bitmapBackingType.get(
        entry.declaration.name,
      );
      if (backing !== undefined) cTypes.add(backing);
    }
    this.planBitmapWriteCTypes(bitmapFieldWrites, cTypes);
    this.planHeaderTextCTypes(cTypes);
    return cTypes;
  }

  /**
   * #1300: a type the header does not define is written into the `.c` as the
   * header's text (a scope's private struct, enum or bitmap), so the `.c`
   * spells every type that text names
   */
  private planHeaderTextCTypes(cTypes: Set<string>): void {
    const { symbolTable, sourcePath } = this.state;
    if (sourcePath === null) return;
    const inHeader = new Set(
      PublicInterface.forFile(symbolTable, sourcePath).map(
        (symbol) => symbol.fullyQualifiedCName,
      ),
    );
    const inSource = symbolTable
      .getTSymbolsByFile(sourcePath)
      .filter((symbol) => !inHeader.has(symbol.fullyQualifiedCName));
    for (const named of HeaderTypeNames.collect(
      inSource.filter(
        (symbol) => symbol.kind === "struct" || symbol.kind === "bitmap",
      ),
    )) {
      cTypes.add(headerCType(named, symbolTable));
    }
  }

  /**
   * The backing type of each bitmap whose field the file writes: 2.3 casts
   * the write to it, and the bitmap may be another file's (a register
   * member's type included)
   */
  private planBitmapWriteCTypes(
    bitmapFieldWrites: ReadonlyMap<
      IAssignmentSyntax,
      IBitmapFieldTarget | null
    >,
    cTypes: Set<string>,
  ): void {
    const symbols = this.state.symbols!;
    for (const field of bitmapFieldWrites.values()) {
      const backing = field
        ? symbols.bitmapBackingType.get(field.bitmapType)
        : undefined;
      if (backing !== undefined) cTypes.add(backing);
    }
  }

  /**
   * ADR-034: the bitmap field each assignment writes -- its target's final
   * step, as the typer typed the chain, whatever spells its prefix (#1749).
   * The one decision the classifier routes on, the handler writes, the
   * backing type is planned from and an atomic owner is found by.
   */
  private planBitmapFieldWrites(
    program: IProgramSyntax,
  ): ReadonlyMap<IAssignmentSyntax, IBitmapFieldTarget | null> {
    const bitmapFields = this.state.symbols!.bitmapFields;
    const writes = new Map<IAssignmentSyntax, IBitmapFieldTarget | null>();
    for (const entry of program.members) {
      for (const site of StatementNodes.assignments(entry.declaration)) {
        writes.set(
          site,
          BitmapFieldStep.fieldOf(
            this.targetDeclaration(site.target).last,
            bitmapFields,
          ),
        );
      }
    }
    return writes;
  }

  /**
   * ADR-049/050: the form of each atomic read-modify-write, and what the
   * file's masked regions and LDREX/STREX loops need. Required in the order
   * 2.3 writes them, a `critical` block after the statements inside it, so
   * the #1143 report lists their sites as before (#1991).
   */
  private planInterruptSafety(
    program: IProgramSyntax,
    bitmapFieldWrites: ReadonlyMap<
      IAssignmentSyntax,
      IBitmapFieldTarget | null
    >,
    floatBitWrites: ReadonlyMap<TExpression, IPlannedFloatBits | null>,
    compoundClamps: ReadonlyMap<
      IAssignmentSyntax,
      { operation: string; cnxType: string } | null
    >,
    cTypes: Set<string>,
    requirements: PlannedRequirements,
  ): ReadonlyMap<IAssignmentSyntax, IPlannedAtomic | null> {
    const forms = new Map<IAssignmentSyntax, IPlannedAtomic | null>();
    const visit = (statements: readonly TStatement[]): void => {
      for (const statement of statements) {
        visit(StatementChildren.of(statement));
        if (statement.kind === "critical") {
          requirements.require("irq_wrappers", statement.span.line);
          // The saved mask's type (#1927)
          cTypes.add(PRIMASK_C_TYPE);
        }
      }
    };
    for (const entry of program.members) {
      visit(StatementNodes.roots(entry.declaration));
      for (const site of StatementNodes.assignments(entry.declaration)) {
        const atomic = this.atomicFormOf(
          site,
          bitmapFieldWrites.get(site) ?? null,
          (floatBitWrites.get(site.target) ?? null) !== null,
          compoundClamps.get(site)?.cnxType ?? null,
        );
        forms.set(site, atomic);
        if (atomic === null) continue;
        if (atomic.form !== "interrupt-mask") {
          // A retry loop holds the written value in `__operand` (#1807)
          cTypes.add(atomic.operandCType);
          cTypes.add(atomic.cType);
        }
        if (atomic.form === "ldrex-strex") {
          requirements.require("cmsis");
          requirements.noteLdrexStrexLoop();
        } else if (
          atomic.form === "compare-exchange" ||
          atomic.form === "compare-exchange-libatomic"
        ) {
          requirements.noteCompareExchangeLoop(
            atomic.form === "compare-exchange-libatomic",
          );
        } else {
          requirements.require("irq_wrappers");
          cTypes.add(PRIMASK_C_TYPE);
        }
      }
    }
    return forms;
  }

  /**
   * ADR-049: a read-modify-write of a value declared `atomic` -- a compound
   * write to it, or a bit, a bit range or a bitmap field of it written with
   * `<-` (#2200) -- is an LDREX/STREX loop where the target and the type
   * allow one, otherwise the masked region, or a compare-exchange loop on a
   * target that cannot mask interrupts (#1789). `AtomicOwner` decides which
   * value is modified, from the typer, whatever spells it (#1179). Null when
   * the write is not atomic.
   */
  private atomicFormOf(
    site: IAssignmentSyntax,
    bitmapField: IBitmapFieldTarget | null,
    writesFloatBits: boolean,
    clampType: string | null,
  ): IPlannedAtomic | null {
    const typing = this.state.typingContext();
    const access = AtomicOwner.ofWrite(site, typing, bitmapField);
    if (access === null) return null;
    AdrProvenance.record("049", site.target.span.line);
    const target = this.state.targetDescription;
    const exclusive =
      target?.ldrex_strex === true ? ExclusiveAccess.of(access) : null;
    const form = FilePlanner.atomicFormFor(
      target,
      exclusive !== null,
      access.bits,
    );
    const planned = {
      ...access,
      form,
      exclusive: form === "ldrex-strex" ? exclusive : null,
    };
    const valueCType = AtomicOperandType.valueCTypeOf(
      OperandTyper.typeOf(site.value, typing),
      this.tryEvaluateConstant(site.value),
      access,
    );
    if (site.operator !== "<-") {
      return {
        ...planned,
        operandCType: AtomicOperandType.ofCompound(
          access,
          clampType,
          valueCType,
        ),
      };
    }
    const step = this.targetDeclaration(site.target).last;
    return {
      ...planned,
      operandCType: AtomicOperandType.ofBits(
        access,
        BitmapFieldStep.writesOneBit(step, bitmapField),
        writesFloatBits,
        valueCType,
      ),
    };
  }

  /**
   * #1789 review: a type wider than the target's `word_size` (ADR-049: the
   * widest naturally atomic access) has no native compare-exchange, so GCC
   * calls libatomic's `__atomic_*_N` for it (u64 on esp32).
   */
  private static widerThanWord(
    target: ITargetDescription | null,
    bits: number | null,
  ): boolean {
    return target !== null && bits !== null && bits > target.word_size;
  }

  /** The target's one answer to "how is a read-modify-write made atomic" */
  private static atomicFormFor(
    target: ITargetDescription | null,
    exclusive: boolean,
    bits: number | null,
  ): TAtomicForm {
    if (target?.ldrex_strex === true && exclusive) return "ldrex-strex";
    if (!ResolvedTarget.masksInterrupts(target)) {
      return FilePlanner.widerThanWord(target, bits)
        ? "compare-exchange-libatomic"
        : "compare-exchange";
    }
    return "interrupt-mask";
  }

  /**
   * The file's own header, which the `.c` includes first for extern "C"
   * linkage, or null when the file has no public interface.
   *
   * Issue #1164: this used to ask a second predicate that saw only scope
   * members, so a file exporting types, consts or top-level functions got a
   * header nothing included. Same question, same answer source as the header
   * itself. #1515: `PlanOptions.of` asked `PublicInterface`.
   */
  private planSelfInclude(options: ICodeGeneratorOptions): string | null {
    if (!options.hasPublicInterface) {
      return null;
    }
    return options.selfInclude;
  }

  /**
   * Generate all declarations from the tree.
   */
  /**
   * What a declaration is, in the terms 2.2 Plan's ordering asks about.
   *
   * The parse tree stops here: `DeclarationPlan` takes kinds, not contexts,
   * so a pass outside the parse layer does not grow a dependency on ANTLR to
   * answer a question about order (#1317).
   */
  private static declarationKindOf(
    declaration: TDeclarationSyntax,
  ): TDeclarationKind {
    if (declaration.kind === "function") return "function";
    if (declaration.kind === "scope") return "scope";
    return "other";
  }

  /**
   * The file's emission questions, from 2.2's decisions above and the
   * requirements they raised, so the emission plan is built before 2.3
   * writes any of the file (#1991)
   */
  private planEmissionFacts(
    plan: Omit<IFilePlan, "emission" | "setup" | "header">,
    requirements: PlannedRequirements,
    selfIncludeAdded: boolean,
  ): IEmissionFacts {
    const existingIncludeTargets: string[] = [];
    if (plan.selfInclude !== null) {
      existingIncludeTargets.push(`"${plan.selfInclude}"`);
    }
    for (const line of plan.includeDirectives) {
      const target = UnwrittenIncludes.targetOf(line);
      if (target !== null) existingIncludeTargets.push(target);
    }
    return {
      cppMode: this.queries.isCppMode(),
      cTypes: plan.cTypes,
      needsString: requirements.requires("string"),
      needsCMSIS: requirements.requires("cmsis"),
      needsLimits: requirements.requires("limits"),
      needsStddef: requirements.requires("stddef"),
      needsFloatStaticAssert: requirements.requires("float_static_assert"),
      needsIrqWrappers: requirements.requires("irq_wrappers"),
      needsISR: requirements.requires("isr"),
      selfIncludeAdded,
      existingIncludeTargets,
      clampOps: plan.clampOps,
      stringCopyHelper: plan.stringCopyHelper,
      castHelpers: requirements.castHelpers,
      lengthHelpers: requirements.lengthHelpers,
      safeDivOps: requirements.safeDivisions,
      floatAssertSites: requirements.sitesOf("float_static_assert"),
      irqWrapperSites: requirements.sitesOf("irq_wrappers"),
      debugMode: this.state.debugMode,
      emittedDesignatedInitializer: [...plan.structInitializers.values()].some(
        (form) => form !== "cppClass",
      ),
      emittedCompoundLiteral: [...plan.structInitializers.values()].includes(
        "compound",
      ),
      emittedLdrexStrexLoop: requirements.emitsLdrexStrexLoop,
      ldrexStrexSites: requirements.sitesOf("ldrex_strex_loop"),
      emittedCompareExchangeLoop: requirements.emitsCompareExchangeLoop,
      compareExchangeSites: requirements.sitesOf("compare_exchange_loop"),
      emittedWideCompareExchangeLoop: requirements.emitsWideCompareExchangeLoop,
      wideCompareExchangeSites: requirements.sitesOf(
        "wide_compare_exchange_loop",
      ),
    };
  }

  /**
   * Extract the include target (`<header.h>` or `"header.h"`) from a line,
   * or null if the line is not a plain `#include` directive.
   */
  /**
   * ADR-010: Transform #include directives, converting .cnx to .h or .hpp
   * Delegates to IncludeGenerator
   * Issue #941: Now passes cppMode for .hpp extension in C++ mode
   * Issue #1467: passes the resolved include paths. Codegen does not decide
   * which header an include names -- PathResolver did, during discovery.
   */
  private transformIncludeDirective(includeText: string): string {
    return includeGenerators.transformIncludeDirective(includeText, {
      sourcePath: this.state.sourcePath,
      rewrites: this.state.includeRewrites,
      kinds: this.state.includeKinds,
      headerExtension: this.state.outputExtensions.header,
    });
  }

  /**
   * Collect function and callback information.
   * Issue #60: Symbol collection extracted to SymbolCollector.
   * This method handles function signatures and callback types (not yet extracted).
   */
  functionCatalog(
    program: IProgramSyntax,
    callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>,
  ): FunctionCatalog {
    const catalog = new FunctionCatalog(callbackTypes);
    for (const { declaration } of program.declarations) {
      if (declaration.kind === "scope") {
        this._collectScopeFunctions(catalog, declaration);
      } else if (declaration.kind === "struct") {
        this._collectStructCallbackFields(catalog, declaration, "");
      } else if (declaration.kind === "function") {
        this._collectTopLevelFunction(catalog, declaration);
      } else if (
        declaration.kind === "variableDeclaration" ||
        declaration.kind === "constructorDeclaration"
      ) {
        // #1562: a file-scope variable is declared `extern` in the header,
        // so the header owns the typedef its type names
        catalog.notePublicReference(this.typeNameIn(declaration.type, ""));
      }
    }
    return catalog;
  }

  /**
   * Collect scoped functions and their callback types
   */
  private _collectScopeFunctions(
    catalog: FunctionCatalog,
    scopeDecl: Extract<TDeclarationSyntax, { kind: "scope" }>,
  ): void {
    const scopeName = scopeDecl.name;
    const typeScopePath = this.state.scopePathOf(scopeName);
    for (const { declaration } of scopeDecl.members) {
      if (declaration.kind === "function") {
        this._registerScopeFunction(
          catalog,
          this.state.program?.scopePathOf(scopeName) ?? scopeName,
          declaration,
          typeScopePath,
        );
      }
    }
    for (const { declaration } of scopeDecl.members) {
      if (declaration.kind === "struct") {
        this._collectStructCallbackFields(catalog, declaration, typeScopePath);
      } else if (
        declaration.kind === "variableDeclaration" ||
        declaration.kind === "constructorDeclaration"
      ) {
        catalog.notePublicReference(
          this.typeNameIn(declaration.type, typeScopePath),
        );
      }
    }
  }

  /**
   * Register one scope function: its qualified name, signature, and ADR-029
   * callback type. Extracted so the pre-pass above and nothing else owns the
   * registration -- it must complete for every function in the scope before any
   * reference to one is resolved.
   */
  private _registerScopeFunction(
    catalog: FunctionCatalog,
    declaringScopePath: string,
    funcDecl: IFunctionDeclarationSyntax,
    typeScopePath: string,
  ): void {
    const fullName = this.state.declaredCName(
      declaringScopePath,
      funcDecl.name,
    );
    catalog.addFunction(
      fullName,
      this.extractFunctionSignature(
        catalog,
        fullName,
        funcDecl.parameters,
        typeScopePath,
      ),
    );
    // #1484: locals in the body name callback types too.
    this._collectLocalCallbackTypeReferences(
      catalog,
      funcDecl.body,
      typeScopePath,
    );
  }

  /**
   * Collect callback field types from struct declaration
   */
  private _collectStructCallbackFields(
    catalog: FunctionCatalog,
    structDecl: IStructDeclarationSyntax,
    scopePath: string,
  ): void {
    for (const field of structDecl.fields) {
      const fieldType = this.typeNameIn(field.type, scopePath);
      catalog.noteStructField(`${structDecl.name}.${field.name}`, fieldType);
      catalog.notePublicReference(fieldType);
    }
  }

  /**
   * Collect top-level function and register as callback type
   */
  private _collectTopLevelFunction(
    catalog: FunctionCatalog,
    funcDecl: IFunctionDeclarationSyntax,
  ): void {
    catalog.addFunction(
      funcDecl.name,
      this.extractFunctionSignature(
        catalog,
        funcDecl.name,
        funcDecl.parameters,
        "",
      ),
    );
    // #1484: locals in the body name callback types too.
    this._collectLocalCallbackTypeReferences(catalog, funcDecl.body, "");
  }

  /**
   * A parameter as the function CONTEXT needs it (#1445).
   *
   * Distinct from `planParameter`, which serves the signature adapter, and the
   * two disagree on purpose -- see `IPlannedFunctionParameter` for the two
   * places and why. This one's `isArray` admits either spelling, and its
   * dimensions are folded to VALUES for ADR-036 bounds checking rather than
   * rendered as C text.
   */
  planFunctionParameter(
    param: IParameterSyntax,
    scopePath: string,
  ): IPlannedFunctionParameter {
    const arrayType = param.type.kind === "array" ? param.type : null;
    const isArray = param.dimensions.length > 0 || arrayType !== null;
    return {
      name: param.name,
      nameSpan: param.nameSpan,
      isConst: !param.mut,
      isArray,
      arrayDimensions: this.foldParameterDimensions(
        param.dimensions,
        arrayType?.dimensions ?? null,
        isArray,
      ),
      stringCapacity: FilePlanner.stringCapacityOf(param.type) ?? undefined,
      type: this.planType(param.type, scopePath),
      typeName: this.typeNameIn(param.type, scopePath),
    };
  }

  /**
   * #1991: 2.2's answer for every parameter of the file, decided before 2.3
   * enters any function, so the argument 2.2 plans and the body 2.3 renders
   * read one answer
   */
  private planParameterInfos(program: IProgramSyntax): {
    readonly infos: ReadonlyMap<string, TParameterInfo>;
    readonly planned: ReadonlyMap<IParameterSyntax, IPlannedFunctionParameter>;
  } {
    const infos = new Map<string, TParameterInfo>();
    const planned = new Map<IParameterSyntax, IPlannedFunctionParameter>();
    const callbacks = {
      isKnownStruct: (typeName: string) => this.queries.isKnownStruct(typeName),
    };
    const planParameters = (
      cName: string,
      fn: IFunctionDeclarationSyntax,
      typeScopePath: string,
    ): void => {
      (fn.parameters ?? []).forEach((param, index) => {
        const parameter = this.planFunctionParameter(param, typeScopePath);
        planned.set(param, parameter);
        infos.set(
          TranspileState.parameterKey(param.nameSpan),
          ParameterInfoPlanner.infoOf(
            parameter,
            index,
            cName,
            callbacks,
            this.state,
          ),
        );
      });
    };
    for (const { declaration, scope } of program.members) {
      if (declaration.kind !== "function") continue;
      if (scope === null) {
        planParameters(declaration.name, declaration, "");
        continue;
      }
      planParameters(
        this.state.declaredCName(
          this.state.program?.scopePathOf(scope) ?? scope,
          declaration.name,
        ),
        declaration,
        this.state.scopePathOf(scope),
      );
    }
    return { infos, planned };
  }

  private parameters(): ReadonlyMap<string, TParameterInfo> {
    invariant(
      this.parametersOrNull !== null,
      "2.2 plans the file's parameters before one is read",
    );
    return this.parametersOrNull;
  }

  /** The parameter `name` binds to at `at`, as 2.2 planned it */
  parameterAt(name: string, at: ISourcePosition): TParameterInfo | undefined {
    return this.state.parameterIn(this.parameters(), name, at);
  }

  /**
   * A parameter's dimensions as VALUES, for ADR-036 bounds checking.
   *
   * Issue #1159: fold through the shared evaluator, and keep the slot when the
   * size does not fold so dimension i still matches subscript i.
   * `parseIntegerLiteral` alone folds literals only, so a const-sized
   * parameter recorded `UNRESOLVED_DIMENSION` and lost ADR-036 bounds checking
   * while the signature folded the same const -- `void fill(u8[SIZE] buf)`
   * emitted `uint8_t buf[6]` and still accepted `buf[9]`.
   */
  private foldParameterDimensions(
    cStyleDimensions: ReadonlyArray<TExpression | null>,
    typeDimensions: ReadonlyArray<TExpression | null> | null,
    isArray: boolean,
  ): readonly number[] {
    if (!isArray) return [];
    if (cStyleDimensions.length > 0) {
      return cStyleDimensions.map(
        (dimension) =>
          (dimension && this.constantOf(dimension)) ?? UNRESOLVED_DIMENSION,
      );
    }
    if (!typeDimensions) return [];
    return typeDimensions.flatMap((dimension) =>
      dimension ? [this.constantOf(dimension) ?? UNRESOLVED_DIMENSION] : [],
    );
  }

  /**
   * ADR-013: Extract function signature from parameter list
   */
  private extractFunctionSignature(
    catalog: FunctionCatalog,
    name: string,
    params: readonly IParameterSyntax[] | null,
    scopePath: string,
  ): FunctionSignature {
    const parameters: Array<{
      name: string;
      baseType: string;
      isConst: boolean;
      isArray: boolean;
    }> = [];

    if (params) {
      for (const param of params) {
        const paramName = param.name;
        const isConst = !param.mut;
        const isArray =
          param.dimensions.length > 0 || param.type.kind === "array";
        const baseType = this.typeNameIn(param.type, scopePath);
        // Issue #1201: a parameter naming a callback type needs that type's
        // typedef emitted, exactly as a struct field does.
        catalog.notePublicReference(baseType);
        parameters.push({ name: paramName, baseType, isConst, isArray });
      }
    }

    return { name, parameters };
  }

  /**
   * ADR-029 / #1484: record the callback types named by LOCAL variable
   * declarations in a function body.
   *
   * The three sites that already record a reference -- struct fields, scope
   * member variables, and parameters via `extractFunctionSignature` -- all walk
   * DECLARATIONS. A local variable lives inside a statement, so none of them
   * reach it, and a callback type named only by a local had its `_fp` typedef
   * omitted from the very output that used it: correct type name, no typedef,
   * `unknown type name 'onTick_fp'`.
   *
   * Runs in the pre-pass rather than during generation because
   * `recordCallbackTypedef` consumes this set as each function is emitted; a
   * reference discovered while generating a later body would arrive after the
   * decision it exists to inform.
   */
  private _collectLocalCallbackTypeReferences(
    catalog: FunctionCatalog,
    body: TBlockSyntax,
    scopePath: string,
  ): void {
    for (const statement of body.statements) {
      this.collectCallbackTypeReferencesIn(catalog, statement, scopePath);
    }
  }

  private collectCallbackTypeReferencesIn(
    catalog: FunctionCatalog,
    statement: TStatement,
    scopePath: string,
  ): void {
    const visit = (child: TStatement): void =>
      this.collectCallbackTypeReferencesIn(catalog, child, scopePath);
    switch (statement.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        catalog.noteReference(this.typeNameIn(statement.type, scopePath));
        return;
      case "for":
        if (statement.init?.kind === "variableDeclaration")
          visit(statement.init);
        StatementChildren.of(statement).forEach(visit);
        return;
      case "if":
      case "while":
      case "doWhile":
      case "forever":
      case "critical":
      case "switch":
      case "block":
        StatementChildren.of(statement).forEach(visit);
        return;
      case "assignment":
      case "expression":
      case "return":
      case "missing":
        return;
      default:
        statement satisfies never;
    }
  }

  /**
   * ADR-029: every function this file can see is a type here too, whether it
   * is declared in this file or reached through an include (#1491).
   *
   * One builder for both (#1929). The signature is READ FROM THE SYMBOL, not
   * re-derived from a parse tree -- "after 1.3, nothing may compute a symbol's
   * name." A symbol's `arrayDimensions` are already const-folded, which is the
   * property MISRA Rule 18.8 needs (#1127). A second, parse-tree builder for
   * local functions used to run afterwards and overwrite this one's result;
   * the two had to share `callbackParamShape` and `typedefParamIsConst`
   * because they disagreed twice (#1529, #1552).
   *
   * Registration is unconditional; EMISSION stays gated by
   * `headerOwnsCallbackTypedef`, which intersects with `callbackTypeReferences`.
   * So a visible function nobody uses as a type still yields no typedef and
   * cannot trip MISRA Rule 2.3 (unused type declarations).
   */
  planCallbackTypes(): ReadonlyMap<string, ICallbackTypeInfo> {
    const callbackTypes = new Map<string, ICallbackTypeInfo>();
    const symbols = this.state.symbols;
    if (!symbols) {
      return callbackTypes;
    }

    // The per-file VISIBLE set: what this file declares, plus what its includes
    // contribute via mergeExternalSymbols. Keyed by transpiled C name.
    // Every function-as-type is found BEFORE any is built: a parameter may name
    // one declared later, and building in one pass made `callIt_fp`'s
    // parameter `tickSource` rather than `tickSource_fp` when `callIt` came
    // first (#1929).
    const functions = new Map<string, IFunctionSymbol>();
    for (const cName of symbols.functionReturnTypes.keys()) {
      // Run-wide identity lookup -- the exact-name index, never the bare-name
      // one, which returns empty for every scoped symbol (#1139).
      const symbol = this.state.symbolTable
        .getOverloadsByCName(cName)
        .find(
          (candidate) =>
            candidate.sourceLanguage === ESourceLanguage.Cnx &&
            SymbolGuards.isFunction(candidate as TSymbol),
        ) as IFunctionSymbol | undefined;

      // #1283 review: StructDefault reads `functionReturnTypes` as the set of
      // function-as-types; it must be exactly the set registered here, or a
      // field's C shape and its default disagree (#1984 types them properly)
      invariant(
        symbol !== undefined,
        `functionReturnTypes holds cnx functions only, but '${cName}' is not one`,
      );
      functions.set(cName, symbol);
    }

    // Registered dependencies-first: every reader that walks `callbackTypes`
    // emits in its order, and C needs `tickSource_fp` declared before a
    // typedef whose parameter names it. A cycle cannot be written in C at
    // all; `seen` also stops the walk from looping on one.
    const seen = new Set<string>();
    const register = (cName: string): void => {
      const symbol = functions.get(cName);
      if (!symbol || seen.has(cName)) {
        return;
      }
      seen.add(cName);
      for (const param of symbol.parameters) {
        register(SymbolTypeResolver.getTypeName(param.type));
      }
      callbackTypes.set(
        cName,
        this.callbackInfoFromSymbol(cName, symbol, symbols),
      );
    };
    for (const cName of functions.keys()) {
      register(cName);
    }
    return callbackTypes;
  }

  /**
   * Build an `ICallbackTypeInfo` from a resolved function symbol.
   *
   * The symbol carries the resolved return type and parameters, so nothing here
   * re-resolves a name. What it means is `CallbackParameterShape`'s, which 2.1's
   * C-header check reads too (#1619).
   */
  private callbackInfoFromSymbol(
    cName: string,
    symbol: IFunctionSymbol,
    symbols: ICodeGenSymbols,
  ): ICallbackTypeInfo {
    const facts: ICallbackShapeFacts = {
      program: this.state.program,
      symbols,
      symbolTable: this.state.symbolTable,
    };
    return {
      functionName: cName,
      returnType: CallbackParameterShape.returnType(symbol, facts),
      parameters: CallbackParameterShape.parameters(cName, symbol, facts),
      typedefName: CallbackParameterShape.typedefName(cName),
    };
  }

  /**
   * Check if an expression is an lvalue that needs & when passed to functions.
   * This includes member access (cursor.x) and array access (arr[i]).
   * Returns the type of lvalue or null if not an lvalue.
   */
  private getLvalueType(expr: TExpression): "member" | "array" | null {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return null;

    const result = CppMemberHelper.getLastPostfixOpType(
      FilePlanner.toPostfixOps(view.ops),
    );

    if (result === "function") return null;
    return result;
  }

  /**
   * Does this member access need a temp variable in C++ mode?
   *
   * Issue #251/#252/#256. True when passing a struct member to a function would
   * fail C++ compilation:
   * 1. Const struct parameter member -> non-const parameter (const T* -> T* invalid)
   * 2. External C struct members of bool/enum type -> u8 parameter (type mismatch)
   * 3. Array element member access (arr[i].member) with external struct elements
   *
   * #1450: this REPORTS `CppMemberHelper`'s answer, which is 2.2 Plan's. All
   * that happens here is parse-tree navigation -- unwrap the postfix, find the
   * base identifier, and pick WHICH of the two Plan questions applies. Named
   * `isCppMemberConversionRequired` until the #1589 review, which is the spelling
   * that says this module decides it.
   */
  private isCppMemberConversionRequired(
    expr: TExpression,
    targetParamBaseType?: string,
  ): boolean {
    if (!this.state.cppMode) return false;
    if (!targetParamBaseType) return false;

    const view = ExpressionShape.postfixView(expr);
    const baseId = ExpressionShape.rootName(expr);
    if (!view || !baseId) return false;

    const ops = view.ops;

    // Case 1: Direct parameter member access (cfg.value)
    const paramInfo = this.parameterAt(baseId, FilePlanner.positionOf(expr));
    if (paramInfo) {
      return CppMemberHelper.needsParamMemberConversion(
        paramInfo,
        targetParamBaseType,
      );
    }

    // Case 2: Array element or function return member access
    return this.isComplexMemberConversionRequired(
      ops,
      baseId,
      targetParamBaseType,
      FilePlanner.positionOf(expr),
    );
  }

  /**
   * Convert parser PostfixOpContext to IPostfixOp interface for CppMemberHelper.
   */
  private static toPostfixOps(ops: readonly TPostfixOpSyntax[]): IPostfixOp[] {
    return ops.map((op) => ({
      hasExpression: op.kind === "subscript",
      hasIdentifier: op.kind === "member",
      hasArgumentList: op.kind === "call" && op.arguments.length > 0,
      textEndsWithParen: op.kind === "call",
    }));
  }

  /**
   * Case 2: array element or function return member access -- arr[i].member,
   * getConfig().member (issue #256).
   *
   * Gathers the inputs `CppMemberHelper` needs (the variable's type info, the
   * postfix ops adapted to `IPostfixOp`) and reports its answer.
   */
  private isComplexMemberConversionRequired(
    ops: readonly TPostfixOpSyntax[],
    baseId: string,
    targetParamBaseType: string,
    at: ISourcePosition,
  ): boolean {
    const typeInfo = this.state.declarationTypeInfo(null, baseId, at);
    return CppMemberHelper.needsComplexMemberConversion(
      FilePlanner.toPostfixOps(ops),
      typeInfo,
      targetParamBaseType,
    );
  }

  /**
   * Issue #246: Check if an expression is a subscript access on a string variable.
   * For example, buf[0] where buf is a string<N>.
   * Used to determine when to cast char* to uint8_t* etc.
   */
  private isStringSubscriptAccess(expr: TExpression): boolean {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return false;

    const ops = view.ops;
    const hasPostfixOps = ops.length > 0;
    const lastOpHasExpression =
      hasPostfixOps && ops.at(-1)!.kind === "subscript";

    const baseId = ExpressionShape.rootName(expr);
    if (!baseId) return false;

    const typeInfo = this.state.declarationTypeInfo(
      null,
      baseId,
      FilePlanner.positionOf(expr),
    );
    const paramInfo = this.parameterAt(baseId, FilePlanner.positionOf(expr));

    return CppMemberHelper.isStringSubscriptPattern(
      hasPostfixOps,
      lastOpHasExpression,
      typeInfo,
      paramInfo?.isString ?? false,
    );
  }

  /**
   * Issue #308: whether a member access argument (`result.data`, at any
   * depth) is stored as a C array, which decays to a pointer when passed, so
   * it takes no `&`. The member's type is the one operand typer's (#1737).
   *
   * Issue #355: "unknown" when there is no struct field info for the member,
   * for defensive code generation that skips potentially dangerous conversions.
   *
   * @returns "array" if definitely an array, "not-array" if definitely not,
   *          "unknown" if struct field info is not available
   */
  private getMemberAccessArrayStatus(
    expr: TExpression,
  ): "array" | "not-array" | "unknown" {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return "not-array";

    if (view.ops.at(-1)?.kind !== "member") return "not-array";

    const baseId = ExpressionShape.rootName(expr);
    if (!baseId || !this.rootBindsToVariable(baseId, expr)) {
      return "not-array";
    }

    const member = OperandTyper.typeOf(expr, this.state.typingContext());
    if (member === null) {
      return "unknown";
    }

    return OperandTyper.decaysToPointer(member) ? "array" : "not-array";
  }

  /** Whether a chain's root names a declaration (#1668) or a parameter */
  private rootBindsToVariable(baseId: string, at: TExpression): boolean {
    return (
      this.state.declarationTypeInfo(
        null,
        baseId,
        FilePlanner.positionOf(at),
      ) !== undefined ||
      this.parameterAt(baseId, FilePlanner.positionOf(at)) !== undefined
    );
  }

  /**
   * A bounded string type's declared capacity, or null (#1445) -- of the
   * element for an array of them, `string<N>[M]` (#1569).
   */
  static stringCapacityOf(type: TTypeSyntax): number | null {
    const element = type.kind === "array" ? type.element : type;
    return element.kind === "string" && element.capacity !== null
      ? Number.parseInt(element.capacity, 10)
      : null;
  }

  /**
   * The C type string of a named struct field, or undefined if the field is not
   * in the type map. #2116: 1.3 stored a C++ `Ns.T` field type as `Ns::T`
   * already (#502), so it is read, not re-spelled.
   */
  private _resolveFieldType(
    fieldName: string,
    structFieldTypes: Map<string, string> | undefined,
  ): string | undefined {
    if (!structFieldTypes?.has(fieldName)) return undefined;
    return structFieldTypes.get(fieldName)!;
  }

  constantOf(expr: TExpression): number | undefined {
    return ConstExprLowering.valueOf(
      expr,
      dimensionEvalOptions(this.transpileState),
    );
  }

  /** #1668 (C7): what an assignment target writes, by the one binder */
  targetDeclaration(target: TExpression): IChainBase {
    const typing = this.state.typingContext();
    const chain = OperandTyper.chainOf(target, typing);
    // Issue #1106/#1114: every run of subscripts within its value's limit
    SubscriptDepthValidator.validate(target, chain.steps);
    return DeclaredTypeInfo.ofChain(
      chain,
      typing.symbols,
      this.state.symbolTable,
      this.state.targetDescription,
    );
  }

  /**
   * The type an assignment's value is rendered against: what the target
   * holds, as the typer types it -- its cnx name, or, where cnx does
   * not fix the width (a header `size_t`), the header's spelling, so the
   * output is the same on every target -- with `::` for a C++ namespace's
   * type. #1760 review: three walkers derived it from the target's shape,
   * and a header `uint8_t` field came back as that spelling, which the
   * MISRA C:2012 Rule 10.3 cast does not read, while a scalar's bit range
   * and a bitmap field had none at all. A slice's value is serialized at
   * its own width, so it has none (#1085).
   */
  private assignedValueType(
    targetExpr: TExpression,
    target: IChainBase,
  ): string | null {
    if (target.last?.subscript === "array_slice") return null;
    const written = OperandTyper.typeOfTarget(
      targetExpr,
      this.state.typingContext(),
    );
    const name = written?.cType ?? written?.typeName ?? null;
    return name === null
      ? null
      : CppNamespaceUtils.convertToCppNamespace(name, this.state.symbolTable);
  }

  /**
   * ADR-024's saturation, and #1668's single-evaluation form of it: a cast
   * whose operand has a side effect -- a call, or a volatile or atomic read,
   * as the one operand typer reports -- calls a helper, so the operand is
   * evaluated once. A pure operand keeps the bounded ternary.
   */
  private static clampFormOf(
    operand: IOperandType | null,
    operandType: string | null,
    targetTypeName: string,
  ): IPlannedCast["clampForm"] {
    if (!CastRequirement.requiresClamping(operandType, targetTypeName)) {
      return null;
    }
    return operand?.hasSideEffect ? "helper" : "inline";
  }

  /**
   * 2.3 Render's per-file state, for callers that hold the WALKER (#1452 box 4).
   *
   * An accessor rather than widening `host`, so `Transpiler` reaches the state
   * without reaching `CodeGenerator`. It was described as narrow on the grounds
   * that `Transpiler` needed one flag off it (ADR-040's ISR typedef); it names
   * `transpileState` 45 times, so what it is narrow about is the OBJECT
   * exposed, not the number of reads.
   *
   * The walk itself does not go through here -- it holds the state directly as
   * `this.state`.
   */
  get transpileState(): TranspileState {
    return this.state;
  }
}

export default FilePlanner;
