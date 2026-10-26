import InterruptMask from "./3-Render/codegen/helpers/InterruptMask";
import type IPlannedArgument from "./2-Plan/types/IPlannedArgument";
import type IPlannedStaticValue from "./2-Plan/types/IPlannedStaticValue";
import LengthProperty from "../utils/LengthProperty";
import GeneratedBanner from "../utils/GeneratedBanner";
import type TPlannedNarrowing from "./2-Plan/types/TPlannedNarrowing";
import type TStructInitializerForm from "./2-Plan/types/TStructInitializerForm";
import HeaderEmissionCapture from "./3-Render/headers/HeaderEmissionCapture";
import type IHeaderEmissionFacts from "./3-Render/headers/types/IHeaderEmissionFacts";
import type IRenderedSource from "./3-Render/codegen/types/IRenderedSource";
import userCType from "../utils/userCType";
/**
 * CodeGenWalker -- the walk over one file's plain-data `IProgramSyntax`
 * that drives code generation.
 *
 * #1445 box 3: the render pass must not hold parse nodes. This class is the
 * half of the former `CodeGenerator` that did, extracted whole: every member
 * whose text names a `Parser.*Context`, `ParserRuleContext` or
 * `CommonTokenStream`, plus the parse-free members that only those call.
 *
 * #1932 then took the walk itself off the tree: 1.2's `ProgramLowering`
 * produces `IParsedFile.program`, the walker generates from it, and it names
 * no parse type -- `parse-tree-confined-to-parser` is `error` here.
 *
 * It lives at `src/cnx/TRANSPILE/` rather than in a pass because it is not one.
 * It walks the file and drives 2.2 and 2.3 for a single file -- the same role
 * `Transpiler` plays for a run, and README §1's tree draws it there. It cannot
 * live in `2-Plan/`: `2-2-plan-reads-no-later-pass` is `error` with
 * `reachable: true`, and the walk
 * imports sixteen generator functions and twenty-eight helpers from
 * `3-Render/`.
 *
 * What stayed behind in `CodeGenerator` is the render-side service surface --
 * `IOrchestrator`'s methods, the emission-fact captures and output assembly.
 * The split is ACYCLIC and that was measured, not assumed: the staying half
 * makes zero calls back into the walk, so this class depends on
 * `CodeGenerator` and never the reverse. Fourteen of its methods are reached
 * through `this.host`, all of them already public.
 */
import type IChainStep from "../types/IChainStep";
import type TRenderedStringPart from "../types/TRenderedStringPart";
import type TStringValueForm from "../types/TStringValueForm";
import { basename } from "node:path";
import CommentFormatter from "./3-Render/codegen/CommentFormatter";
import PrivateConstValue from "./3-Render/codegen/PrivateConstValue";
import StaticInitializers from "./1-Analyze/helpers/StaticInitializers";
import type TChainRoot from "../types/TChainRoot";
import type TValueBinding from "../types/TValueBinding";
import IComment from "../types/IComment";
import TParameterInfo from "../types/TParameterInfo";
import type IBoundParameter from "./types/IBoundParameter";
import TypeValidator from "./2-Plan/TypeValidator";
import IGeneratorOutput from "./3-Render/codegen/generators/IGeneratorOutput";
import ComplianceAnnotations from "./2-Plan/ComplianceAnnotations";
import emittedLocalName from "../utils/emittedLocalName";
import OperandTyper from "../utils/OperandTyper";
import type IEmissionPlan from "../types/IEmissionPlan";
import TGeneratorFn from "./3-Render/codegen/generators/TGeneratorFn";
import generateLiteral from "./3-Render/codegen/generators/expressions/LiteralGenerator";
import generateBinaryExpr from "./3-Render/codegen/generators/expressions/BinaryExprGenerator";
import TPlannedBinaryExpr from "./3-Render/codegen/types/TPlannedBinaryExpr";
import BinaryExprUtils from "./3-Render/codegen/generators/expressions/BinaryExprUtils";
import generateUnaryExpr from "./3-Render/codegen/generators/expressions/UnaryExprGenerator";
import generateTernaryExpr from "./3-Render/codegen/generators/expressions/ExpressionGenerator";
import type TPlannedTernary from "./3-Render/codegen/types/TPlannedTernary";
import generatePostfixExpression from "./3-Render/codegen/generators/expressions/PostfixExpressionGenerator";
import controlFlowGenerators from "./3-Render/codegen/generators/statements/ControlFlowGenerator";
import IPlannedFor from "./3-Render/codegen/types/IPlannedFor";
import IPlannedForAssignment from "./3-Render/codegen/types/IPlannedForAssignment";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type IVariableDeclarationSyntax from "../types/syntax/IVariableDeclarationSyntax";
import type TStatement from "../types/syntax/TStatement";
import type TSwitchStatement from "../types/syntax/TSwitchStatement";
import type IStructDeclarationSyntax from "../types/syntax/IStructDeclarationSyntax";
import type IRegisterDeclarationSyntax from "../types/syntax/IRegisterDeclarationSyntax";
import type IParameterSyntax from "../types/syntax/IParameterSyntax";
import type IFunctionDeclarationSyntax from "../types/syntax/IFunctionDeclarationSyntax";
import type TDeclarationSyntax from "../types/syntax/TDeclarationSyntax";
import type ISyntaxNode from "../types/syntax/ISyntaxNode";
import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type TCaseLabelSyntax from "../types/syntax/TCaseLabelSyntax";
import type TBlockSyntax from "../types/syntax/TBlockSyntax";
import AssignmentTarget from "../utils/AssignmentTarget";
import IPlannedForVarDecl from "./3-Render/codegen/types/IPlannedForVarDecl";
import IPlannedForever from "./3-Render/codegen/types/IPlannedForever";
import IPlannedIf from "./3-Render/codegen/types/IPlannedIf";
import IPlannedLoop from "./3-Render/codegen/types/IPlannedLoop";
import TPlannedReturn from "./3-Render/codegen/types/TPlannedReturn";
import VariableModifierBuilder from "./3-Render/codegen/helpers/VariableModifierBuilder";
import ArrayInitHelper from "./3-Render/codegen/helpers/ArrayInitHelper";
import generateCriticalStatement from "./3-Render/codegen/generators/statements/CriticalGenerator";
import generateSwitchStatement from "./3-Render/codegen/generators/statements/SwitchGenerator";
import type IPlannedSwitch from "./3-Render/codegen/types/IPlannedSwitch";
import type TPlannedCaseLabel from "./3-Render/codegen/types/TPlannedCaseLabel";
import enumGenerator from "./3-Render/codegen/generators/declarationGenerators/EnumGenerator";
import bitmapGenerator from "./3-Render/codegen/generators/declarationGenerators/BitmapGenerator";
import registerGeneratorFor from "./3-Render/codegen/generators/declarationGenerators/RegisterGenerator";
import type IPlannedRegister from "./3-Render/codegen/types/IPlannedRegister";
import type IPlannedFunction from "./3-Render/codegen/types/IPlannedFunction";
import type IPlannedStruct from "./3-Render/codegen/types/IPlannedStruct";
import type IPlannedDimension from "./3-Render/codegen/types/IPlannedDimension";
import type IPlannedCallArgument from "./3-Render/codegen/types/IPlannedCallArgument";
import structGenerator from "./3-Render/codegen/generators/declarationGenerators/StructGenerator";
import ArrayDimensionUtils from "./3-Render/codegen/generators/declarationGenerators/ArrayDimensionUtils";
import IPlannedArrayDeclaration from "./3-Render/codegen/types/IPlannedArrayDeclaration";
import IPlannedPostfix from "./3-Render/codegen/types/IPlannedPostfix";
import SubscriptDepthValidator from "./2-Plan/SubscriptDepthValidator";
import TPlannedPostfixOp from "./3-Render/codegen/types/TPlannedPostfixOp";
import TPlannedStringDecl from "./3-Render/codegen/types/TPlannedStringDecl";
import IPlannedStringInit from "./3-Render/codegen/types/IPlannedStringInit";
import TPlannedVariableDecl from "./3-Render/codegen/types/TPlannedVariableDecl";
import TPlannedVariableInitializer from "./3-Render/codegen/types/TPlannedVariableInitializer";
import IPlannedScope from "./3-Render/codegen/types/IPlannedScope";
import TPlannedScopeMember from "./3-Render/codegen/types/TPlannedScopeMember";
import TPlannedScopeVariable from "./3-Render/codegen/types/TPlannedScopeVariable";
import PublicInterface from "./2-Plan/PublicInterface";
import functionGenerator from "./3-Render/codegen/generators/declarationGenerators/FunctionGenerator";
import scopeGenerator from "./3-Render/codegen/generators/declarationGenerators/ScopeGenerator";
import FormatUtils from "../utils/FormatUtils";
import ExpressionShape from "../utils/ExpressionShape";
import SafeDivision from "../utils/SafeDivision";
import helperGenerators from "./3-Render/codegen/generators/support/HelperGenerator";
import includeGenerators from "./2-Plan/IncludeGenerator";
import DeclaredTypeInfo from "../PARSE/3-Declare/DeclaredTypeInfo";
import DeclaredPointer from "../utils/DeclaredPointer";
import type TTypeInfo from "../types/TTypeInfo";
import memberAccessChain from "./3-Render/codegen/memberAccessChain";
import type IRootHolding from "./3-Render/codegen/types/IRootHolding";
import AssignmentHandlerRegistry from "./3-Render/codegen/assignment/index";
import AssignmentClassifier from "./2-Plan/AssignmentClassifier";
import ForHeaderAssignment from "../utils/ForHeaderAssignment";
import AssignmentOperatorMapper from "./2-Plan/AssignmentOperatorMapper";
import buildAssignmentContext from "./2-Plan/AssignmentContextBuilder";
import StringLengthCounter from "./2-Plan/StringLengthCounter";
import CppModeHelper from "./2-Plan/CppModeHelper";
import generateCast from "./3-Render/codegen/generators/expressions/CastExprGenerator";
import type IPlannedCast from "./2-Plan/types/IPlannedCast";
import ConstExprLowering from "../utils/ConstExprLowering";
import ElementCount from "../utils/ElementCount";
import ConstantEvaluator from "../utils/ConstantEvaluator";
import ConstantFold from "../utils/ConstantFold";
import dimensionEvalOptions from "./2-Plan/dimensionEvalOptions";
import MemberChainAnalyzer from "./3-Render/codegen/analysis/MemberChainAnalyzer";
import type IBitAccessAnalysis from "../types/IBitAccessAnalysis";
import type TPlannedTargetOp from "../types/TPlannedTargetOp";
import ArgumentGenerator from "./3-Render/codegen/helpers/ArgumentGenerator";
import VariableDeclHelper from "./3-Render/codegen/helpers/VariableDeclHelper";
import MemberSeparatorResolver from "./3-Render/codegen/helpers/MemberSeparatorResolver";
import ParameterDereferenceResolver from "./3-Render/codegen/helpers/ParameterDereferenceResolver";
import PostfixChainBuilder from "./3-Render/codegen/helpers/PostfixChainBuilder";
import SimpleIdentifierResolver from "./3-Render/codegen/helpers/SimpleIdentifierResolver";
import BaseIdentifierBuilder from "./3-Render/codegen/helpers/BaseIdentifierBuilder";
import ISimpleIdentifierDeps from "./3-Render/codegen/types/ISimpleIdentifierDeps";
import IPostfixChainDeps from "./3-Render/codegen/types/IPostfixChainDeps";
import IPostfixOperation from "./3-Render/codegen/types/IPostfixOperation";
import type TExpression from "../types/syntax/TExpression";
import type TExpressionOf from "../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import type ISourcePosition from "../utils/types/ISourcePosition";
import IMemberSeparatorDeps from "./3-Render/codegen/types/IMemberSeparatorDeps";
import IParameterDereferenceDeps from "./3-Render/codegen/types/IParameterDereferenceDeps";
import ISeparatorContext from "./3-Render/codegen/types/ISeparatorContext";
import type IAnalysis from "./1-Analyze/types/IAnalysis";
import AnalyzedFiles from "./1-Analyze/AnalyzedFiles";
import PlanOptions from "./2-Plan/PlanOptions";
import type IFilePlan from "./2-Plan/types/IFilePlan";
import type IRenderLedger from "./3-Render/types/IRenderLedger";
import type IPlannedParameter from "./3-Render/codegen/types/IPlannedParameter";
import type IPlannedFunctionParameter from "./2-Plan/types/IPlannedFunctionParameter";
import FunctionContextManager from "./3-Render/codegen/helpers/FunctionContextManager";
import BitRangeHelper from "./3-Render/codegen/helpers/BitRangeHelper";
import type IPlannedType from "./2-Plan/types/IPlannedType";
import CTypeIncludes from "./2-Plan/CTypeIncludes";
import WrittenCTypes from "./3-Render/codegen/helpers/WrittenCTypes";
import invariant from "../utils/invariant";
import StringUtils from "../utils/StringUtils";
import AdrProvenance from "../instrumentation/AdrProvenance";
import ExpressionNodes from "../utils/ExpressionNodes";
import ParameterInputAdapter from "./3-Render/codegen/helpers/ParameterInputAdapter";
import ParameterSignatureBuilder from "./3-Render/codegen/helpers/ParameterSignatureBuilder";
import QualifiedNameGenerator from "../utils/QualifiedNameGenerator";
import MisraSuppressionUtils from "./3-Render/MisraSuppressionUtils";
import EnumZeroValue from "../utils/EnumZeroValue";
import QualifiedCName from "../utils/QualifiedCName";
import ToolchainRequirementUtils from "../utils/ToolchainRequirementUtils";
import MainSignature from "../utils/MainSignature";
import ScopeUtils from "../utils/ScopeUtils";
const {
  generateOverflowHelpers: helperGenerateOverflowHelpers,
  generateSafeDivHelpers: helperGenerateSafeDivHelpers,
} = helperGenerators;

const { processPreprocessorDirective: includeProcessPreprocessorDirective } =
  includeGenerators;
import CodeGenerator from "./3-Render/codegen/CodeGenerator";
import FilePlanner from "./2-Plan/FilePlanner";
import ParameterPassing from "./2-Plan/ParameterPassing";
/** What render folds a constant chain at: wide enough to hold any i64 */
const WIDEST_SIGNED = "i64";

/** A syntax node a render-time check can name the line of */
type TSpanned = { readonly span: { readonly line: number } };

class CodeGenWalker {
  /**
   * The render-side services. Generators receive THIS object as their
   * orchestrator, not the walker: `IOrchestrator` is implemented over there.
   *
   * Injected with a default rather than constructed in the body, so a test can
   * hold the same instance the walk drives and assert on the state it
   * accumulates. Production never passes one.
   */
  private readonly host: CodeGenerator;

  /** The render in progress, set only while `render` runs */
  private renderingOrNull: IRenderLedger | null = null;

  /** The plan 2.3 renders from; asking outside `render` is a bug */
  private get filePlan(): IFilePlan {
    return this.rendering.plan;
  }

  /** What 2.3 has rendered of the plan so far; asking outside `render` is a bug */
  private get rendering(): IRenderLedger {
    invariant(
      this.renderingOrNull,
      "2.3 reads 2.2's plan only while rendering the file it was made for",
    );
    return this.renderingOrNull;
  }

  private readonly planner: FilePlanner;

  constructor(host: CodeGenerator = new CodeGenerator()) {
    this.host = host;
    this.planner = new FilePlanner(host.state);
  }

  /**
   * 2.2 Plan: every decision 2.3 Render reads for this file, made before any
   * of it is written, from 2.1's artifact and the file's key in it. `render`
   * takes what this returns (#1991).
   */
  plan(sourcePath: string, analysis: IAnalysis): IFilePlan {
    const file = AnalyzedFiles.fileOf(analysis, sourcePath);
    const options = PlanOptions.of(sourcePath, analysis);
    const state = this.host.state;
    const inputs = FilePlanner.planInputs(options);
    state.beginPlan(inputs, this.host);
    AdrProvenance.beginFile(inputs.sourcePath);
    // ADR-029: every function-as-type this file can see, before anything can
    // reference one
    const callbackTypes = this.planner.planCallbackTypes();
    state.useCallbackTypes(callbackTypes);
    state.useFunctionCatalog(
      this.planner.functionCatalog(file.program, callbackTypes),
    );
    return this.planner.plan(file, options);
  }

  private typeNameOf(type: TTypeSyntax): string {
    return this.plannedType(type).writtenName;
  }

  /**
   * Lookup map for primitive type zero initializers. `false` needs no record
   * of its own (#1927): it initializes a `bool` declaration, whose type
   * `generateType` records.
   */
  private static readonly PRIMITIVE_ZERO_VALUES: ReadonlyMap<string, string> =
    new Map([
      ["bool", "false"],
      ["f32", "0.0f"],
      ["f64", "0.0"],
    ]);

  private readonly commentFormatter: CommentFormatter = new CommentFormatter();

  /** Issue #644: String declaration helper for bounded/array/concat strings */
  /** Issue #644: Array initialization helper for size inference and fill-all */
  /**
   * Run a generator and apply its effects.
   *
   * #1445: takes the generator itself, not a name to look up. `GeneratorRegistry`
   * held three string-keyed maps whose values were stored as
   * `TGeneratorFn<ParserRuleContext>` -- an erasure written with three `as`
   * casts -- so nothing checked that the context handed to a dispatch matched
   * the kind named, and every call site needed an `invariant` to recover the
   * fact that a string lookup can miss. Passing the function infers `T` from
   * the generator and checks the context against it, and the invariants go
   * with the lookup that could fail.
   *
   * Eleven of its fourteen expression registrations were already dead, four of
   * its members had only test callers, and #1285 records the one incident it
   * caused: a second, unreachable implementation kept alive behind
   * `if (generator)` because registration is unconditional, so the guard could
   * never fail and the twin still had to be maintained by hand.
   *
   * **The inference checks the context, not the MEANING of a context-free one.**
   * `T` is inferred, so handing `generateWhile` an `IfStatementContext` is a
   * compile error -- but `generateEnum` and `generateBitmap` are both
   * `TGeneratorFn<string>`, so those two are mutually substitutable and any
   * string satisfies either. For that pair the registry's erasure did not go
   * away, it moved from `ParserRuleContext` into `string`; what catches a
   * swap there is each generator's `invariant` on an unknown key, at run
   * time. Stated because the slice's own commit subject says "a mis-wire is
   * now a type error", which was true of the seven context-typed generators
   * of the day and not of the two that slice converted.
   *
   * There are now ZERO context-typed generators -- the slices after it took
   * the render layer to none, which is this PR's headline result. So the
   * caveat is no longer a minority case: `generateEnum`/`generateBitmap` are
   * the ONLY unguarded substitution left in the family, and the run-time
   * `invariant` is the only thing standing behind it.
   */
  private invokeGenerator<T>(generate: TGeneratorFn<T>, ctx: T): string {
    const result = generate(
      ctx,
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
    this.host.applyEffects(result.effects);
    return result.code;
  }

  /**
   * Run a declaration generator whose definition an included header may own
   * (ADR-029), suppressing only the emitted text.
   *
   * Only the type-forming kinds route here. `struct` deliberately does NOT:
   * its generator suppresses only the typedef and still emits ADR-029's init
   * function, which has external linkage and no other home -- suppressing the
   * whole generator dropped that function once already (#1164). Scope,
   * register, struct and function therefore call `invokeGenerator` directly
   * rather than passing a `false` that made this the same function twice.
   */
  private invokeSuppressibleDeclaration<T>(
    generate: TGeneratorFn<T>,
    ctx: T,
  ): string {
    // The generator still runs when the header owns the definition, so its
    // effects are registered -- returning early would silently drop them,
    // which is how the ADR-029 struct init function was lost (#369/#1164).
    const code = this.invokeGenerator(generate, ctx);
    return this.host.state.declarationPlan().headerOwnsTypeDefinitions
      ? ""
      : code;
  }

  private renderExpression(expr: TExpression): string {
    const folded = this.filePlan.staticValues.get(expr);
    if (folded !== undefined) {
      const written = PrivateConstValue.written(
        this.host.getState(),
        this.planner.transpileState,
        folded.spelling,
        folded.narrowing,
      );
      this.host.applyEffects(written.effects);
      this.recordFoldedRules(expr, folded);
      return written.code;
    }
    return this.invokeGenerator(generateTernaryExpr, this.planTernary(expr));
  }

  /**
   * #1735: the rules a folded value applied, recorded where they fired, by
   * the decisions writing it would have asked: ADR-044's clamp, where 2.2
   * planned a helper for the chain; ADR-001's `=` as equality; and
   * ADR-057's resolution of each bare name
   */
  private recordFoldedRules(
    expr: TExpression,
    folded: IPlannedStaticValue,
  ): void {
    for (const line of folded.clampLines) AdrProvenance.record("044", line);
    for (const node of ExpressionNodes.direct(expr)) {
      if (node.kind !== "binary") continue;
      const equality =
        node.level === "equality"
          ? BinaryExprUtils.equalityAdrLine(node.operators, node.span.line)
          : undefined;
      if (equality !== undefined) AdrProvenance.record("001", equality);
    }
    for (const name of StaticInitializers.bareNames(expr)) {
      TypeValidator.resolveBareIdentifier(
        name.path[0],
        name.at,
        (typeName: string) => this.host.isKnownStruct(typeName),
        this.host.state,
      );
    }
  }

  /**
   * #1735: why a static-storage initializer that read a name is written as
   * its value. C's rule alone: C++ initializes such a variable dynamically,
   * so there the naive form broke no rule to cite
   */
  private staticValueNote(declaration: TDeclarationSyntax): string {
    return this.filePlan.staticValueNotes.has(declaration) &&
      !this.host.state.cppMode
      ? ComplianceAnnotations.render(ComplianceAnnotations.STATIC_VALUE) + "\n"
      : "";
  }

  /**
   * #1610: why a pointer declared without a value starts as `NULL`. Asked of
   * the spelling `zeroOf` writes, so the note follows it: `nullptr` is not an
   * integer constant, and the rule has nothing to say about it
   */
  private nullPointerNote(declaration: ISyntaxNode): string {
    const nullInitialized: ReadonlySet<ISyntaxNode> =
      this.filePlan.nullInitialized;
    return nullInitialized.has(declaration) &&
      CppModeHelper.nullLiteral(this.host.state) === "NULL"
      ? ComplianceAnnotations.render(ComplianceAnnotations.NULL_POINTER) + "\n"
      : "";
  }

  /**
   * A ternary reduced to its operands (#1445).
   *
   * An expression that is not a ternary is a plain value. The arms go over as thunks
   * because Issue #992's rule is the generator's: see `TPlannedTernary`.
   */
  private planTernary(expr: TExpression): TPlannedTernary {
    if (expr.kind !== "ternary") {
      return { kind: "value", code: this.renderBinary(expr) };
    }
    const cType = this.filePlan.lazyTernaries.get(expr);
    if (cType === undefined) {
      return {
        kind: "ternary",
        renderCondition: () => this.renderBinary(expr.condition),
        renderTrue: () => this.renderBinary(expr.whenTrue),
        renderFalse: () => this.renderBinary(expr.whenFalse),
      };
    }
    this.rendering.lazyTernaries.add(expr);
    const condition = this.renderBinary(expr.condition);
    const whenTrue = this.renderQueuing(() => this.renderBinary(expr.whenTrue));
    const whenFalse = this.renderQueuing(() =>
      this.renderBinary(expr.whenFalse),
    );
    invariant(
      whenTrue.queued.length + whenFalse.queued.length > 0,
      `2.2's lazy ternary on line ${expr.span.line} builds a temporary in an arm`,
    );
    const temp = this.host.state.getNextTempVarName();
    const indent = FormatUtils.indent(1);
    const arm = (rendered: { code: string; queued: string[] }): string[] => [
      ...rendered.queued.map((line) => indent + line),
      `${indent}${temp} = ${rendered.code};`,
    ];
    this.host.state.pendingTempDeclarations.push(
      ComplianceAnnotations.render(ComplianceAnnotations.TERNARY_ARM),
      `${cType} ${temp};`,
      `if (${condition}) {`,
      ...arm(whenTrue),
      "} else {",
      ...arm(whenFalse),
      "}",
    );
    return { kind: "value", code: temp };
  }

  /**
   * #2332: render an operand that runs only sometimes, and hand back the
   * statements it queued to run before its statement instead of queuing them.
   */
  private renderQueuing(render: () => string): {
    code: string;
    queued: string[];
  } {
    const outer = this.host.state.pendingTempDeclarations;
    this.host.state.pendingTempDeclarations = [];
    const code = render();
    const queued = this.host.state.pendingTempDeclarations;
    this.host.state.pendingTempDeclarations = outer;
    return { code, queued };
  }

  /**
   * #2332: `&&` and `||`. An operand after the first runs only when the ones
   * before it leave the value undecided, so a temporary 2.2 found it builds
   * is built under that same test rather than before the statement.
   */
  private renderShortCircuit(
    operands: readonly TExpression[],
    separator: " && " | " || ",
  ): string {
    const renderOperand = (operand: TExpression): string => {
      const result = this.renderBinaryLevel(this.planBinaryExpr(operand));
      this.host.applyEffects(result.effects);
      return result.code;
    };
    const first = operands[0];
    invariant(first !== undefined, "a logical chain has operands");
    let value = renderOperand(first);
    for (const operand of operands.slice(1)) {
      if (!this.filePlan.lazyOperands.has(operand)) {
        value = `${value}${separator}${renderOperand(operand)}`;
        continue;
      }
      this.rendering.lazyOperands.add(operand);
      const built = this.renderQueuing(() => renderOperand(operand));
      invariant(
        built.queued.length > 0,
        `2.2's lazy operand on line ${operand.span.line} builds a temporary`,
      );
      const temp = this.host.state.getNextTempVarName();
      const indent = FormatUtils.indent(1);
      this.host.state.pendingTempDeclarations.push(
        ComplianceAnnotations.render(
          separator === " && "
            ? ComplianceAnnotations.AND_OPERAND
            : ComplianceAnnotations.OR_OPERAND,
        ),
        `bool ${temp} = ${value};`,
        `if (${separator === " && " ? temp : `!${temp}`}) {`,
        ...built.queued.map((line) => indent + line),
        `${indent}${temp} = ${built.code};`,
        "}",
      );
      value = temp;
    }
    return value;
  }

  private plannedType(type: TTypeSyntax): IPlannedType {
    const plan = this.filePlan.types.get(type);
    invariant(
      plan !== undefined,
      `2.2 planned every type 2.3 renders (got "${type.text}" at line ${type.span.line})`,
    );
    return plan;
  }

  private renderType(type: TTypeSyntax): string {
    const cType = this.planner.cTypeOf(this.plannedType(type));
    this.rendering.types.add(type);
    return cType;
  }

  /**
   * Generate a unary expression.
   */
  private renderUnary(expr: TExpression): string {
    // #1445: the generator takes the operator and the operand's generated
    // code. The recursion stays here, where the expression is.
    if (expr.kind !== "unary") {
      return this.invokeGenerator(generateUnaryExpr, {
        operator: null,
        operandCode: this.renderPostfix(expr),
        minimum: null,
        complementCast: null,
      });
    }

    const operand = expr.operand;
    const minimum = this.filePlan.negativeMinimums.get(expr) ?? null;
    if (minimum !== null) this.rendering.minimums.add(expr);
    const complementCast = this.filePlan.complementCasts.get(expr) ?? null;
    if (complementCast !== null) this.rendering.complementCasts.add(expr);
    return this.invokeGenerator(generateUnaryExpr, {
      operator: expr.operator,
      operandCode: this.renderUnary(operand),
      minimum,
      complementCast,
    });
  }

  /**
   * A postfix expression: its primary, and the operations applied to it.
   *
   * What the generator read off the tree was the op KINDS -- an IDENTIFIER is
   * a member access, one or two bracketed expressions are a subscript, neither
   * is a call -- and two facts about the leading subscript run. Both are
   * decided here; the renders they reach are thunks, because generating an
   * index draws a temp name and queues its declaration, so rendering one for
   * an operation the generator has not reached yet would take the name a
   * nearer expression holds today.
   */
  private planPostfixExpression(expr: TExpression): IPlannedPostfix {
    const head = ExpressionShape.headOf(expr);
    const primary = head.primary;
    const ops = head.ops;
    const rootIdentifier =
      head.root === null ? (head.identifier?.name ?? undefined) : undefined;

    // #1445 review: planned FIRST, then counted off the planned ops.
    //
    // This counted off the raw nodes while the write path counted off planned
    // ones, so `SubscriptDepthValidator` -- whose whole purpose is that the two
    // paths "cannot diverge on what counts as a subscript" -- answered that
    // question from two representations behind a `"kind" in op` probe. Planning
    // is pure (it builds thunks and renders nothing), so doing it first costs
    // nothing and leaves the validator one branch and one shape.
    //
    // #1668 (S25): each subscript's kind is the one operand typer's, step by
    // step. A `this.`/`global.` chain consumes its first `.name`, so the
    // typer's steps are the op list's tail.
    const typing = this.host.state.typingContext();
    const chain = OperandTyper.chainOf(expr, typing);
    const steps = chain.steps;
    // Issue #1106/#1114: every run of subscripts within its value's limit
    SubscriptDepthValidator.validate(expr, steps);
    const offset = head.opsConsumed;
    const plannedOps = ops.map((op, i) =>
      this.planPostfixOp(
        op,
        steps[i - offset] ?? null,
        head.rootOp,
        this.plannedNarrowings(expr).get(i - offset) ?? null,
        this.filePlan.safeDivisions.get(expr) ?? null,
      ),
    );

    return {
      rootIdentifier,
      rootParameter:
        rootIdentifier && head.identifier
          ? this.planner.parameterAt(rootIdentifier, {
              line: head.identifier.span.line,
              column: head.identifier.span.column,
            })
          : undefined,
      renderPrimary: () => this.renderPrimary(primary),
      ops: plannedOps,
      // #1668 (C7): the chain's bound base, from the same typed chain
      base: DeclaredTypeInfo.ofChain(
        chain,
        typing.symbols,
        this.host.state.symbolTable,
        this.host.state.targetDescription,
      ),
    };
  }

  /**
   * Which of `postfixOp`'s three shapes this one is. `step` is the one operand
   * typer's step for it (#1668): a subscript's kind, and for a call the value
   * it calls -- everything before it (#1561, #1696).
   */
  private planPostfixOp(
    op: TPostfixOpSyntax,
    step: IChainStep | null,
    rootOp: TPostfixOpSyntax | null,
    narrowing: TPlannedNarrowing | null,
    safeDivisionHelper: string | null,
  ): TPlannedPostfixOp {
    const typedAs = step?.subscript ?? null;
    switch (op.kind) {
      case "member":
        return {
          kind: "member",
          name: op.name,
          appliesToRoot: op === rootOp,
          step,
          narrowing,
        };
      case "subscript": {
        const indexes = op.indexes;
        // Issue #1094: the final index is the WIDTH on the two-index arm, and
        // folding it is what gets a const or macro width a precomputed mask
        // rather than a runtime one.
        const widthExpr = indexes.at(-1);
        // The typer types every subscript it walks, an untyped value's
        // included (the classifier's default for an unknown type)
        invariant(typedAs !== null, "the typer typed this subscript");
        return {
          kind: "subscript",
          indexCount: indexes.length,
          renderIndexes: () =>
            indexes.map((index) => this.renderExpression(index)),
          foldWidth: () =>
            widthExpr === undefined
              ? undefined
              : this.planner.constantOf(widthExpr),
          typedAs,
          step,
          floatBits: this.filePlan.floatBitReads.get(op) ?? null,
          narrowing,
        };
      }
      case "call": {
        const args = op.arguments;
        return {
          kind: "call",
          // #1508: ADR-010 is recorded at the CALL rather than at the directive --
          // an `#include` sits in no scope, function or variable, so the matrix's
          // context axis has nothing to ask it.
          line: op.span.line,
          // ADR-029: a callback-typed value names the function that is its type,
          // by C name -- the key `callbackTypes` holds. A function's own name is
          // not a typed value, so the typer's step has no `before`: null.
          calleeType: () => step?.before?.typeName ?? null,
          planArguments: () =>
            this.planCallArguments(args.length === 0 ? null : args),
          safeDivisionHelper,
        };
      }
      case "missing":
        invariant(
          false,
          "a missing postfix operation is a parse error, which stops the pipeline before render",
        );
    }
  }

  private renderPostfix(expr: TExpression): string {
    return this.againstPlannedType(expr, () => this.writePostfix(expr));
  }

  private writePostfix(expr: TExpression): string {
    invariant(
      SafeDivision.callOf(expr) === null ||
        this.filePlan.safeDivisions.has(expr),
      "2.2 planned every safe-division helper 2.3 calls (ADR-051)",
    );
    const result = generatePostfixExpression(
      this.planPostfixExpression(expr),
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
    this.host.applyEffects(result.effects);
    return result.code;
  }

  /**
   * The binary precedence ladder, collapsed.
   *
   * 1.2 lowers the grammar's ten levels to one `binary` node per real
   * operator run (#1932), so a plan is only as deep as the expression's
   * operator nesting, and a non-binary operand is a leaf.
   *
   * Every operand is a thunk that re-enters the planner one level down, so
   * each renders when the renderer writes it, against the type 2.2 planned
   * for it -- none, under a comparison (#1032, #1991).
   */
  private planBinaryExpr(expr: TExpression): TPlannedBinaryExpr {
    if (expr.kind !== "binary") {
      return { kind: "leaf", render: () => this.renderUnary(expr) };
    }
    const operands = expr.operands;
    const operators = [...expr.operators];
    const renderOperands = operands.map(
      (operand) => () => this.renderBinaryLevel(this.planBinaryExpr(operand)),
    );
    switch (expr.level) {
      case "or":
        return {
          kind: "leaf",
          render: () => this.renderShortCircuit(operands, " || "),
        };
      case "and":
        return {
          kind: "leaf",
          render: () => this.renderShortCircuit(operands, " && "),
        };
      case "bitwiseOr":
        return { kind: "join", separator: " | ", renderOperands };
      case "bitwiseXor":
        return { kind: "join", separator: " ^ ", renderOperands };
      case "bitwiseAnd":
        return { kind: "join", separator: " & ", renderOperands };
      case "equality": {
        const isStrcmp = this.filePlan.comparisons.get(expr);
        invariant(
          isStrcmp !== undefined,
          `2.2 planned every comparison 2.3 renders (got line ${expr.span.line})`,
        );
        this.rendering.comparisons.add(expr);
        return {
          kind: "comparison",
          defaultOperator: "=",
          operators,
          mapOperator: BinaryExprUtils.mapEqualityOperator,
          adrLine: BinaryExprUtils.equalityAdrLine(operators, expr.span.line),
          strcmp: isStrcmp ? { isNotEqual: operators[0] === "!=" } : null,
          renderOperands,
        };
      }
      case "relational":
        return {
          kind: "comparison",
          defaultOperator: "<",
          operators,
          mapOperator: null,
          adrLine: undefined,
          strcmp: null,
          renderOperands,
        };
      case "shift":
        return { kind: "shift", operators, renderOperands };
      case "additive":
      case "multiplicative":
        return {
          kind: "arithmetic",
          constantValue: this.constantValue(expr),
          defaultOperator: expr.level === "additive" ? "+" : "*",
          operators,
          clamp: CodeGenWalker.plannedAt(
            this.filePlan.clampChains,
            expr,
            this.rendering.clampChains,
            "`+ - *` chain",
          ),
          adrLine: expr.span.line,
          renderOperands,
        };
    }
  }

  /**
   * Render a NESTED level, returning its effects to the parent rather than
   * applying them.
   *
   * The top of the ladder goes through `invokeGenerator`, which applies the
   * accumulated effects once. An inner level must not, or an operand's
   * include would be applied while its parent is still deciding whether to
   * emit it.
   */
  private renderBinaryLevel(plan: TPlannedBinaryExpr): IGeneratorOutput {
    return generateBinaryExpr(
      plan,
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
  }

  /**
   * #1175: an arithmetic chain's value when it is a constant expression, by
   * the one evaluator, where the tree is in hand. Render used to fold the
   * generated C operand text with `parseInt`.
   *
   * Whether the chain overflows is 2.1's decision, at its destination's type
   * (E0910, ADR-044): one that reaches here fits it. So the value is computed
   * at the widest signed type, which then holds it exactly, and render needs
   * no destination of its own -- `i64 big <- 2147483647 + 1` is 2147483648,
   * which no i32 step could give (#1863 review).
   */
  private constantValue(expr: TExpression): string | null {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(expr),
      dimensionEvalOptions(this.planner.transpileState),
      WIDEST_SIGNED,
    );
    const value =
      result.kind === "value"
        ? ConstantEvaluator.toNumber(result.value)
        : undefined;
    return value === undefined ? null : String(value);
  }

  private renderBinary(expr: TExpression): string {
    return this.invokeGenerator(generateBinaryExpr, this.planBinaryExpr(expr));
  }

  private enumTypeOf(expr: TExpression): string | null {
    const t = OperandTyper.typeOf(expr, this.host.state.typingContext());
    return t?.category === "enum" ? t.enumTypeName : null;
  }

  /**
   * Generate function argument with pass-by-reference handling.
   * Part of IOrchestrator interface - delegates to ArgumentGenerator.
   */
  private generateFunctionArg(
    expr: TExpression,
    planned: IPlannedArgument,
  ): string {
    invariant(
      planned.form !== null,
      "2.2 planned the form of every argument 2.3 passes by reference",
    );
    const object = ExpressionShape.unparenthesized(expr);
    const simpleId = this.planner.boundArgumentName(object);
    const declared = this.planner.nameTypeOf(object);
    // #1445: thunks closing over `ctx`. `ArgumentGenerator` never read a
    // member off the node -- it threaded it through five callbacks and four
    // private helpers only to hand it back -- so the node stays here, where
    // the tree already is.
    return ArgumentGenerator.generateArg(
      simpleId,
      declared,
      planned.form,
      {
        generateExpression: () => this.renderExpression(expr),
        renderStringParts: () => this.renderArgumentParts(expr),
      },
      this.host.state,
    );
  }

  /** #2239: the parts of a string argument 2.2 planned built apart */
  private renderArgumentParts(
    expr: TExpression,
  ): readonly TRenderedStringPart[] {
    const form = this.filePlan.stringValueForms.get(expr);
    invariant(
      form !== undefined,
      "2.2 planned the value form of every string argument it builds apart",
    );
    return this.renderStringParts(form);
  }

  /** #1969: the parameter a bare-name expression binds to, where it is */
  private parameterNamed(expr: TExpression): TParameterInfo | undefined {
    const id = ExpressionShape.simpleIdentifier(expr);
    return id === null
      ? undefined
      : this.planner.parameterAt(id, FilePlanner.positionOf(expr));
  }

  private renderBlock(block: Pick<TBlockSyntax, "statements">): string {
    const lines: string[] = ["{"];
    const innerIndent = FormatUtils.indent(1); // One level of relative indentation
    for (const stmt of block.statements) {
      this.host.state.indentLevel++;
      const stmtCode = this.renderStatement(stmt);
      this.host.state.indentLevel--;
      if (stmtCode) {
        const indentedLines = stmtCode
          .split("\n")
          .map((line) => innerIndent + line);
        lines.push(indentedLines.join("\n"));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private renderStatement(statement: TStatement): string {
    const result = this.renderStatementCode(statement);
    // Issue #250: Prepend any pending temp declarations (C++ mode)
    const tempDecls = this.host.flushPendingTempDeclarations();
    return tempDecls === "" ? result : tempDecls + "\n" + result;
  }

  /**
   * #1643 review: the comment lines that cite why a declaration is emitted
   * under a moved name -- empty when it keeps its own
   */
  private nameMoveComments(
    decl: Pick<IVariableDeclarationSyntax, "name" | "nameSpan">,
  ): string {
    const local = this.host.state.ownLocalDeclaration(decl);
    return local
      ? ComplianceAnnotations.renderMoves(
          local.nameMoves,
          local.name,
          emittedLocalName(local),
        )
      : "";
  }

  private renderStatementCode(statement: TStatement): string {
    switch (statement.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        return (
          this.nameMoveComments(statement) +
          this.nullPointerNote(statement) +
          VariableDeclHelper.renderVariableDecl(
            this.planVariableDecl(statement),
            this.host.state,
          )
        );
      case "assignment":
        return this.generateAssignment(statement);
      case "expression":
        return this.renderExpression(statement.expression) + ";";
      case "if":
        return this.invokeGenerator(
          controlFlowGenerators.generateIf,
          this.planIf(statement),
        );
      case "while":
        return this.invokeGenerator(
          controlFlowGenerators.generateWhile,
          this.planWhile(statement),
        );
      case "doWhile":
        return this.invokeGenerator(
          controlFlowGenerators.generateDoWhile,
          this.planDoWhile(statement),
        );
      case "for":
        return this.invokeGenerator(
          controlFlowGenerators.generateFor,
          this.planFor(statement),
        );
      case "forever":
        return this.invokeGenerator(
          controlFlowGenerators.generateForever,
          this.planForever(statement),
        );
      case "switch":
        return this.invokeGenerator(
          generateSwitchStatement,
          this.planSwitch(statement),
        );
      case "return":
        return this.invokeGenerator(
          controlFlowGenerators.generateReturn,
          this.planReturn(statement),
        );
      case "critical":
        // ADR-050: a critical statement for atomic multi-variable operations.
        // #1445: the block is rendered here and the generator wraps it, so the
        // block still renders before the wrapper's irq_wrappers effect is
        // applied, and effect order is unchanged.
        return this.invokeGenerator(generateCriticalStatement, {
          blockCode: this.renderBlock(statement.body),
        });
      case "block":
        return this.renderBlock(statement);
      case "missing":
        invariant(
          false,
          "a statement the parser repaired never reaches render -- the run stops at the parse error",
        );
    }
  }

  /**
   * Generate an assignment target.
   * Part of IOrchestrator interface.
   * Issue #387: Unified postfix chain - all patterns now use IDENTIFIER postfixTargetOp*
   *
   * @param opCount how many of the target's postfix operations to render;
   *        all of them unless given. A bit write renders its target without
   *        the final subscript through this same renderer (#1668 review), so
   *        a renamed local, a scope member or a struct parameter is spelled
   *        once, here.
   */
  generateAssignmentTarget(ctx: TExpression, opCount?: number): string {
    const parts = AssignmentTarget.parts(ctx);
    const hasGlobal = parts.root === "global";
    const hasThis = parts.root === "this";
    const identifier = parts.identifier ?? undefined;
    const postfixOps = parts.ops.slice(0, opCount);

    // SonarCloud S3776: Use SimpleIdentifierResolver for simple identifier case
    if (!hasGlobal && !hasThis && postfixOps.length === 0 && identifier) {
      return SimpleIdentifierResolver.resolve(
        identifier,
        this._buildSimpleIdentifierDeps(),
        parts.position,
      );
    }

    // Issue #779: Resolve bare scope member identifiers before postfix chain processing
    // This ensures scope members get their prefix even with array/member access.
    // Also skip known registers - they should be handled by the postfix chain builder
    // to enable proper register validation (requiring global. when shadowed).
    let resolvedIdentifier = identifier ?? "";
    // The parameter a bare root binds to; a `global.`/`this.` root binds
    // past it (ADR-057)
    const parameter =
      !hasGlobal && !hasThis && identifier
        ? this.host.state.parameterBindingAt(identifier, parts.position)
        : undefined;
    if (!hasGlobal && !hasThis && identifier) {
      // A local named like a global register is the local, as its reads are:
      // ADR-057 resolves a bare name local-first, writes included (#2199)
      const isKnownRegister =
        this.host.state.symbols?.knownRegisters.has(identifier) &&
        this.host.state.bindingAt(null, identifier, parts.position)?.kind !==
          "local";
      // Issue #1100: Parameters with postfix ops (array/bit subscript, member
      // access) must resolve through the same dereference logic as a bare
      // parameter reference (ParameterDereferenceResolver), not skip it.
      // For array/struct/string/etc. parameters this is a no-op (they're
      // already pointer-like, matching the prior behavior verbatim — e.g.
      // `buf[idx]` stays `buf[idx]`). For a scalar parameter that became a
      // pointer because it's modified elsewhere in the function, a bit
      // access (`v[4] <- true`) now correctly dereferences to `(*v)[4]`
      // (which AssignmentContextBuilder reduces to base identifier `(*v)`)
      // instead of assigning through the raw pointer.
      if (parameter) {
        resolvedIdentifier = ParameterDereferenceResolver.resolve(
          parameter,
          this._buildParameterDereferenceDeps(),
        );
      } else if (!isKnownRegister) {
        // ADR-057: pass the REAL locality. Hardcoding `false` and skipping
        // locals entirely made this the write-side twin of
        // TypeValidator.resolveBareIdentifier rather than a caller of it, so a
        // shadowing local kept its bare name here while every read was
        // renamed -- `data[1] <- 5` wrote the global and `return data[1]` read
        // the local, in the same function, compiling clean.
        const resolved = TypeValidator.resolveBareIdentifier(
          identifier,
          parts.position,
          (name: string) => this.host.isKnownStruct(name),
          this.host.state,
        );
        if (resolved !== null) {
          resolvedIdentifier = resolved;
        }
      }
    }

    // SonarCloud S3776: Use BaseIdentifierBuilder for base identifier
    const safeIdentifier = identifier ?? "";
    const { result: baseResult, firstId } = BaseIdentifierBuilder.build(
      hasGlobal || hasThis ? safeIdentifier : resolvedIdentifier,
      hasGlobal,
      hasThis,
      this.host.state.currentScopePath,
    );

    // No postfix operations - return base
    if (postfixOps.length === 0) {
      return baseResult;
    }

    // SonarCloud S3776: Use PostfixChainBuilder for postfix operations
    const operations = this._extractPostfixOperations(postfixOps, parts.rootOp);
    const postfixDeps = this._buildPostfixChainDeps(
      firstId,
      parameter?.info,
      hasGlobal,
      hasThis,
      this.planner.targetDeclaration(ctx).rootTypeInfo,
    );

    return PostfixChainBuilder.build(
      baseResult,
      firstId,
      operations,
      postfixDeps,
    );
  }

  /** Generate parameter list for function signature */
  generateParameterList(params: readonly IParameterSyntax[]): string {
    return params
      .map((param, index) => this.generateParameter(param, index))
      .join(", ");
  }

  /**
   * #1283: the ADR-029 default of a declaration of a struct (or an array of
   * one), or null when that struct's default is all zero. The dimensions are
   * the declarator's -- the type's first, then any written after the name --
   * because every element of an array must hold the default too.
   */
  private structDefaultOf(
    type: TTypeSyntax,
    nameDimensions: ReadonlyArray<TExpression | null>,
  ): string | null {
    const resolved = this.namedTypeOf(type, true);
    if (!resolved) {
      return null;
    }
    const written = [
      ...(type.kind === "array" ? type.dimensions : []),
      ...nameDimensions,
    ];
    const typing = this.planner.transpileState.typingContext();
    return this.host.renderStructDefault(
      resolved.name,
      written.map((size) =>
        size
          ? (this.planner.constantOf(size) ??
            ElementCount.of(
              ConstExprLowering.lower(size),
              typing.program,
              typing.sourceFile,
            ))
          : null,
      ),
    );
  }

  /**
   * ADR-015: the zero initializer for a type.
   * ADR-017: an enum initializes to its first member.
   */
  private zeroInitializerOf(
    type: TTypeSyntax,
    isArray: boolean,
    nameDimensions: ReadonlyArray<TExpression | null> = [],
  ): string {
    // #1283: ADR-029 "Never Null" -- a struct whose callbacks have defaults
    // (directly, in a nested struct, or in a callback array) is not zero.
    const structDefault = this.structDefaultOf(type, nameDimensions);
    if (structDefault !== null) {
      return structDefault;
    }

    // Issue #379 / #1004: arrays zero-init with the aggregate brace ({} in
    // C++, {0} in C) regardless of element type.
    if (isArray) {
      return this.host.getAggregateZeroInitBrace();
    }

    // Handle named types (scoped, global, qualified, user)
    const resolved = this.namedTypeOf(type);
    if (resolved) {
      // Check if enum
      if (this.host.state.symbols!.knownEnums.has(resolved.name)) {
        return this._getEnumZeroValue(resolved.name, resolved.separator);
      }
      // Issue #1004: struct/class zero-init. C++ value-initialization ({})
      // works for every aggregate (including ones whose first field is an
      // enum, where {0} is an invalid int->enum narrowing); C uses {0}.
      return this.host.getAggregateZeroInitBrace();
    }

    // Issue #295: C++ template types use value initialization {}
    if (type.kind === "template") {
      return "{}";
    }

    // Issue #1019: string<N> types use empty string initializer
    if (type.kind === "string") {
      return '""';
    }

    // Primitive types use lookup map
    if (type.kind === "primitive") {
      const primType = type.name;
      return CodeGenWalker.PRIMITIVE_ZERO_VALUES.get(primType) ?? "0";
    }

    // Default fallback
    return "0";
  }

  /**
   * The parameters a function's context registers, decided (#1445).
   *
   * Part of IOrchestrator: `ScopeGenerator` enters a context for a scoped
   * function, so planning at both call sites would be two derivations of one
   * parameter list.
   */
  planFunctionParameters(
    params: readonly IParameterSyntax[] | null,
  ): readonly IPlannedFunctionParameter[] | null {
    return params?.map((param) => this.plannedParameter(param)) ?? null;
  }

  /** 2.2's plan for a parameter (#1991 review: never re-planned at render) */
  private plannedParameter(param: IParameterSyntax): IPlannedFunctionParameter {
    const planned = this.filePlan.functionParameters.get(param);
    invariant(
      planned !== undefined,
      `2.2 planned every parameter 2.3 renders ('${param.name}' at line ${param.nameSpan.line})`,
    );
    return planned;
  }

  /**
   * ADR-029: the C type that a DECLARATION of this type emits.
   *
   * A function-as-type is declared by its `_fp` typedef; everything else is
   * itself. This is the single owner of that consequence, because #1484 showed
   * what happens when each declaration site decides it independently: a
   * parameter and a scope member mapped, a local variable did not, and a `for`
   * init declaration -- a separate grammar rule, `forVarDecl`, that
   * `VariableDeclarationContext` never matches -- did not either. Fixing one
   * site made it disagree with the declaration beside it in the same source.
   *
   * A fifth declaration site should call this rather than repeat the pairing.
   */

  private renderDeclaredType(type: TTypeSyntax): string {
    const declared = this.renderType(type);
    return this.host.getCallbackTypedefName(declared) ?? declared;
  }

  /**
   * Issues #1200, #1201: does this callback type need its `_fp` typedef emitted?
   *
   * True when the type is referenced by any field or parameter, not only by a
   * field of a top-level struct. Reading callbackFieldTypes alone missed
   * scope-nested struct fields, scope members and parameters, each of which
   * produced C that referenced a typedef nothing had emitted.
   *
   * This is an EMISSION question -- "must a typedef be written?" -- and it is
   * the only one left here. Its twin, ADR-029's nominal-typing question ("is
   * this function used as a field TYPE?"), was next to it until #1322 moved
   * that rule to pass 2.1 as E0880. The two were deliberately separate then
   * and are separate now for the same reason: merging them once widened the
   * nominal rule as a side effect and rejected a callback assignment that
   * transpiles on main.
   */
  /**
   * ADR-029 + #1491: emit typedefs for callback types this file NAMES but does
   * not DECLARE.
   *
   * `recordCallbackTypedef` fires when a function is emitted, so it covers
   * every type this file declares and none it reaches through an include. A
   * variable typed by an included function-as-type therefore referenced a
   * typedef nothing had emitted.
   *
   * It goes in the `.c`, not the header, unless this file's own public
   * interface names the type -- which `generateCallbackTypedef` already decides
   * via `headerOwnsCallbackTypedef`. That is the rule C libraries follow: a
   * header typedefs the callback types its API uses, and a type needed only
   * inside one translation unit stays there. It is also what stops two files
   * that both name the same included function-as-type from each exporting the
   * typedef and colliding in anything that includes both.
   */
  private emitTypedefsForUndeclaredCallbackTypes(): void {
    for (const funcName of this.host.state.callbackTypeReferences) {
      if (
        !this.host.state.callbackTypes.has(funcName) ||
        this.host.state.emittedCallbackTypedefs.has(funcName)
      ) {
        continue;
      }
      const typedef = this.host.generateCallbackTypedef(funcName);
      if (typedef) {
        this.host.state.pendingCallbackTypedefs.push(typedef);
        this.host.state.emittedCallbackTypedefs.add(funcName);
      }
    }
  }

  isMainFunctionWithArgs(
    name: string,
    params: readonly IParameterSyntax[] | null,
  ): boolean {
    return MainSignature.takesArgs(name, params);
  }

  /**
   * Generate a primary expression.
   * Part of IOrchestrator interface for PostfixExpressionGenerator.
   */

  /** 2.3 writes each value against the type 2.2 planned for it (#1991) */
  private againstPlannedType<T>(expr: TExpression, write: () => T): T {
    const planned = this.filePlan.expectedTypes.get(expr);
    invariant(
      planned !== undefined,
      `2.2 planned the type of the value on line ${expr.span.line} that 2.3 writes`,
    );
    return this.host.state.withPlannedExpectedType(
      planned.type,
      planned.suppressBareEnumResolution,
      write,
    );
  }

  private renderPrimary(expr: TExpression): string {
    return this.againstPlannedType(expr, () => this.writePrimary(expr));
  }

  private writePrimary(expr: TExpression): string {
    invariant(
      expr.kind !== "sizeof",
      "E0603 rejects sizeof in pass 2.1; a size is ADR-058's .type_byte_length",
    );
    switch (expr.kind) {
      case "cast":
        return generateCast(this.planCast(expr), this.host.state);
      case "structInitializer":
        return this.generateStructInitializer(expr);
      case "arrayInitializer":
        return this.generateArrayInitializer(expr);
      case "root":
        return expr.root === "this"
          ? this._resolveThisKeyword()
          : "__GLOBAL_PREFIX__";
      case "identifier":
        return this._resolveIdentifierExpression(
          expr.name,
          FilePlanner.positionOf(expr),
        );
      case "literal":
        return this._generateLiteralExpression(
          expr.text,
          this.plannedNarrowings(expr).get(0) ?? null,
        );
      case "parenthesized":
        return `(${this.renderExpression(expr.expression)})`;
      default:
        return "";
    }
  }

  /**
   * PR #681: Build dependencies for parameter dereference resolution.
   * Used by ParameterDereferenceResolver to determine if parameters need dereferencing.
   */
  private _buildParameterDereferenceDeps(): IParameterDereferenceDeps {
    return {
      maybeDereference: (id: string) =>
        CppModeHelper.maybeDereference(id, this.host.state),
    };
  }

  /**
   * PR #681: Build dependencies for member separator resolution.
   * Used by MemberSeparatorResolver to determine appropriate separators.
   */
  private _buildMemberSeparatorDeps(): IMemberSeparatorDeps {
    return {
      isKnownScope: (name: string) => this.host.isKnownScope(name),
      isKnownRegister: (name: string) =>
        this.host.state.symbols!.knownRegisters.has(name),
      rootMemberSeparator: (holding: IRootHolding) =>
        memberAccessChain.rootMemberSeparator(holding, this.host.state.cppMode),
    };
  }

  /** 2.3 Render: the file's C, written from 2.2's plan (#1991) */
  render(plan: IFilePlan): IRenderedSource {
    this.renderingOrNull = {
      plan,
      types: new Set(),
      comparisons: new Set(),
      casts: new Set(),
      minimums: new Set(),
      complementCasts: new Set(),
      structInitializers: new Set(),
      lazyOperands: new Set(),
      lazyTernaries: new Set(),
      narrowings: new Set(),
      clampChains: new Set(),
      floatBitWrites: new Set(),
      compoundClamps: new Set(),
      bitmapFieldWrites: new Set(),
      atomicForms: new Set(),
    };
    this.planner.useParameters(plan.setup.parameters);
    // #1928: the banner and the file result read the planned blocks'
    // requirements off the plan itself, so nothing copies them anywhere. Held
    // from here, so anything 2.3 asks to require is a decision 2.2 missed.
    this.host.state.beginRender(plan.setup, plan.emission);
    this.host.state.generator = this.host;
    try {
      const code = this.assembleGeneratedOutput(plan);
      CodeGenWalker.assertHeadersPlanned(code, plan.cTypes);
      return {
        code,
        headerFacts: this.captureHeader(plan),
        requirements: this.host.getToolchainRequirements(),
      };
    } finally {
      this.renderingOrNull = null;
    }
  }

  /**
   * Every `<stdint.h>`/`<stdbool.h>` type the file's C spells needs only the
   * headers 2.2 planned from its C types (#1991)
   */
  private static assertHeadersPlanned(
    code: string,
    planned: ReadonlySet<string>,
  ): void {
    const plannedHeaders = new Set(CTypeIncludes.decide(planned));
    const missing = CTypeIncludes.decide(WrittenCTypes.of(code)).filter(
      (header) => !plannedHeaders.has(header),
    );
    invariant(
      missing.length === 0,
      `2.2 planned the headers of every C type 2.3 writes (missing ${missing.join(", ")})`,
    );
  }

  /**
   * 2.2's decision at a site 2.3 renders, null where it decided there is
   * nothing to write: a site 2.2's walk never reached fails here instead of
   * losing its cast or clamp
   */
  private static plannedAt<K extends TSpanned, V>(
    planned: ReadonlyMap<K, V | null>,
    site: K,
    rendered: Set<K>,
    what: string,
  ): V | null {
    const decision = planned.get(site);
    invariant(
      decision !== undefined,
      `2.2 considered every ${what} 2.3 renders (got line ${site.span.line})`,
    );
    rendered.add(site);
    return decision;
  }

  /** MISRA 10.3: the promoted reads 2.2 planned in a value 2.3 renders */
  private plannedNarrowings(
    expr: TExpression,
  ): ReadonlyMap<number, TPlannedNarrowing> {
    const steps = CodeGenWalker.plannedAt(
      this.filePlan.narrowings,
      expr,
      this.rendering.narrowings,
      "postfix or literal value",
    );
    invariant(steps !== null, "2.2 plans a value's reads, empty for none");
    return steps;
  }

  /** The sites where 2.2 decided something to write */
  private static decidedSites<K, V>(
    planned: ReadonlyMap<K, V | null>,
    writes: (decision: V) => boolean = () => true,
  ): K[] {
    return [...planned]
      .filter(([, decision]) => decision !== null && writes(decision))
      .map(([site]) => site);
  }

  /** The reverse of each render-time "2.2 planned this" check: 2.2 planned nothing 2.3 skipped */
  private static assertAllRendered<K extends TSpanned>(
    planned: Iterable<K>,
    rendered: ReadonlySet<K>,
    what: string,
  ): void {
    const missed = [...planned].find((expression) => !rendered.has(expression));
    invariant(
      missed === undefined,
      `2.3 rendered every ${what} 2.2 planned (missed line ${missed?.span.line})`,
    );
  }

  /** #1323: the header's input, captured while this file's render state is warm */
  private captureHeader(plan: IFilePlan): IHeaderEmissionFacts | null {
    return HeaderEmissionCapture.capture({
      ...plan.header,
      sourcePath: plan.setup.sourcePath,
      program: plan.setup.program,
      typeInput: plan.setup.symbols,
      state: this.host.state,
    });
  }

  private assembleGeneratedOutput(plan: IFilePlan): string {
    const { program } = plan;
    const output: string[] = [];

    if (plan.selfInclude !== null) {
      output.push(`#include "${plan.selfInclude}"`, "");
    }

    this.processIncludeDirectives(plan, output);

    // Process preprocessor directives
    this.processPreprocessorDirectives(program, output);

    // Generate declarations
    const declarations = this.generateAllDeclarations(program);
    const unrendered = [...this.filePlan.types.keys()].find(
      (type) => !this.rendering.types.has(type),
    );
    invariant(
      unrendered === undefined,
      `2.3 rendered every type 2.2 planned (missed "${unrendered?.text}" at line ${unrendered?.span.line})`,
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.comparisons.keys(),
      this.rendering.comparisons,
      "comparison",
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.casts.keys(),
      this.rendering.casts,
      "cast",
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.negativeMinimums.keys(),
      this.rendering.minimums,
      "negative minimum",
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.complementCasts.keys(),
      this.rendering.complementCasts,
      "complement cast",
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.structInitializers.keys(),
      this.rendering.structInitializers,
      "struct initializer",
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.lazyOperands,
      this.rendering.lazyOperands,
      "lazy operand",
    );
    CodeGenWalker.assertAllRendered(
      this.filePlan.lazyTernaries.keys(),
      this.rendering.lazyTernaries,
      "lazy ternary",
    );
    CodeGenWalker.assertAllRendered(
      CodeGenWalker.decidedSites(
        this.filePlan.narrowings,
        (steps) => steps.size > 0,
      ),
      this.rendering.narrowings,
      "promoted read",
    );
    CodeGenWalker.assertAllRendered(
      CodeGenWalker.decidedSites(this.filePlan.clampChains),
      this.rendering.clampChains,
      "clamp chain",
    );
    CodeGenWalker.assertAllRendered(
      CodeGenWalker.decidedSites(this.filePlan.floatBitWrites),
      this.rendering.floatBitWrites,
      "float bit write",
    );
    CodeGenWalker.assertAllRendered(
      CodeGenWalker.decidedSites(this.filePlan.compoundClamps),
      this.rendering.compoundClamps,
      "compound clamp",
    );
    CodeGenWalker.assertAllRendered(
      CodeGenWalker.decidedSites(this.filePlan.bitmapFieldWrites),
      this.rendering.bitmapFieldWrites,
      "bitmap field write",
    );
    CodeGenWalker.assertAllRendered(
      CodeGenWalker.decidedSites(this.filePlan.atomicForms),
      this.rendering.atomicForms,
      "atomic write",
    );

    const emissionPlan = plan.emission;

    // 2.3 Render: format the plan. These two decide nothing.
    this.addAutoIncludes(output, emissionPlan);
    this.addGeneratedHelpers(output, emissionPlan);

    // Add the declarations
    output.push(...declarations);

    // Issue #1143: the banner is built last and prepended, because none of the
    // requirement state exists until generateAllDeclarations() above has run.
    // Computing it at the top -- where the banner used to be pushed -- could
    // only ever describe an empty requirement set.
    return [...this.buildBanner(), ...output].join("\n");
  }

  /**
   * The file's own header comment, including what its output costs.
   *
   * Only requirements above the mode's baseline are listed, so an ordinary C99
   * file is unchanged. The point is that the requirement travels with the
   * artifact: someone handed a generated .c can see what it needs without
   * having the .cnx, the transpiler, or this repository.
   *
   * Emitted on the .c/.cpp only. The companion header does not contain the
   * constructs -- the IRQ wrappers, the static asserts and the helpers are all
   * emitted into the implementation file -- so repeating the line there would
   * claim a cost the header does not carry.
   */
  private buildBanner(): readonly string[] {
    const sourcePath = this.host.state.sourcePath;
    const generatedLine = GeneratedBanner.line(
      sourcePath ? basename(sourcePath) : undefined,
    );

    const lines = ["/**", generatedLine, " * A safer C for embedded systems"];

    const requires = ToolchainRequirementUtils.describeForBanner(
      this.host.getToolchainRequirements(),
      this.host.state.cppMode ? "cpp" : "c",
    );
    for (const line of requires) {
      lines.push(` * ${line}`);
    }

    lines.push(" */", "");
    return lines;
  }

  /**
   * Process all include directives and add to output.
   */
  private processIncludeDirectives(plan: IFilePlan, output: string[]): void {
    const { program } = plan;
    for (const [index, include] of program.includes.entries()) {
      output.push(...this.formatLeadingComments(include.leadingComments));
      const includeText = include.written;
      // Issue #850: a MISRA suppression for banned headers
      const suppression =
        MisraSuppressionUtils.getMisraSuppressionComment(includeText);
      if (suppression) {
        output.push(suppression);
      }
      output.push(plan.includeDirectives[index]);
    }
    if (program.includes.length > 0) {
      output.push("");
    }
  }

  /**
   * Process all preprocessor directives and add to output.
   */
  private processPreprocessorDirectives(
    program: IProgramSyntax,
    output: string[],
  ): void {
    for (const directive of program.directives) {
      output.push(...this.formatLeadingComments(directive.leadingComments));
      const result = includeProcessPreprocessorDirective({
        kind: directive.kind,
        text: directive.text,
      });
      if (result) {
        output.push(result);
      }
    }
    if (program.directives.length > 0) {
      output.push("");
    }
  }

  private generateAllDeclarations(program: IProgramSyntax): string[] {
    const sourceOrder = program.declarations;

    // Issue #1212, #1449, #1450: WHICH declaration the callback typedef block
    // precedes is decided by 2.2 Plan and read off the plan here. WHERE that
    // lands in the emitted array is arithmetic, and stays here -- the index
    // depends on how many leading-comment lines were pushed, which is a fact
    // about text rather than a decision about what C should exist.
    const precedes = this.host.state.declarationPlan().callbackTypedefsPrecede;

    const declarations: string[] = [];
    let firstFunctionIndex: number | null = null;

    for (const [index, entry] of sourceOrder.entries()) {
      declarations.push(...this.formatLeadingComments(entry.leadingComments));

      if (index === precedes) {
        firstFunctionIndex = declarations.length;
      }

      const code = this.generateDeclaration(entry.declaration);
      if (code) {
        declarations.push(code);
      }
    }

    this.emitTypedefsForUndeclaredCallbackTypes();

    const typedefs = this.host.state.pendingCallbackTypedefs;
    if (typedefs.length > 0) {
      // One blank line either side of the block, and none between the typedefs
      // themselves -- they are one group of related declarations, and the
      // generated C is read by people auditing it.
      declarations.splice(
        firstFunctionIndex ?? declarations.length,
        0,
        "",
        ...typedefs,
        "",
      );
      this.host.state.pendingCallbackTypedefs = [];
    }

    return declarations;
  }

  /**
   * Add auto-generated includes based on usage.
   */
  /**
   * Print the system includes the plan decided on.
   *
   * Deliberately holds no condition. It used to hold five `if (needs*)` tests
   * plus a dedup that re-parsed `#include` lines already in `output` -- so the
   * emitted text was an input to the decision, and the answer depended on how
   * much of the file had been rendered. Both moved into `EmissionPlan`.
   */
  private addAutoIncludes(output: string[], plan: IEmissionPlan): void {
    if (plan.systemIncludes.length === 0) return;
    output.push(
      ...plan.systemIncludes.map((target) => `#include ${target}`),
      "",
    );
  }

  /**
   * Print the deferred blocks and helpers the plan decided on.
   *
   * Every `if` below tests a decision the plan already made, never a question.
   * The float assert's keyword arrives WITH the requirement key it costs, so
   * the two cannot disagree -- #1143 kept them in step by computing both from
   * one ternary at this site; the plan keeps them in step by making them two
   * fields of one record, and the ternary is gone from here.
   */
  private addGeneratedHelpers(output: string[], plan: IEmissionPlan): void {
    const floatAssert = plan.floatStaticAssert;
    if (floatAssert !== null) {
      output.push(
        `${floatAssert.keyword}(sizeof(float) == 4, "Float bit indexing requires 32-bit float");`,
        `${floatAssert.keyword}(sizeof(double) == 8, "Float bit indexing requires 64-bit double");`,
        "",
      );
    }

    const irq = plan.irqWrappers;
    if (irq !== null) {
      output.push(...InterruptMask.wrappers());
    }

    if (plan.isrTypedef) {
      output.push(
        "/* ADR-040: ISR function pointer type */",
        "typedef void (*ISR)(void);",
        "",
      );
    }

    const helpers = this.generateOverflowHelpers(plan);
    if (helpers.length > 0) {
      output.push(...helpers);
    }

    output.push(
      ...helperGenerators.generateStringCopyHelper(plan.stringCopyHelper),
    );

    const safeDivHelpers = this.generateSafeDivHelpers(plan.safeDivOps);
    if (safeDivHelpers.length > 0) {
      output.push(...safeDivHelpers);
    }

    output.push(...helperGenerators.generateLengthHelpers(plan.lengthHelpers));

    output.push(
      ...helperGenerators.generateCastHelpers(
        plan.castHelpers,
        this.host.isCppMode(),
      ),
    );
  }

  /**
   * ADR-029: Check if a function is used as a callback type (field type in a struct)
   */
  private generateDeclaration(declaration: TDeclarationSyntax): string {
    switch (declaration.kind) {
      case "scope":
        return this.invokeGenerator(
          scopeGenerator,
          this.planScope(declaration),
        );
      case "register":
        return this.generateRegister(declaration);
      // Issue #369 / #1164: the struct generator decides for itself what a
      // self-include suppresses. Returning early here also skipped its
      // callback-field effects and dropped the ADR-029 init function, which
      // the header never carries.
      case "struct":
        return this.invokeGenerator(
          structGenerator,
          this.planStruct(declaration),
        );
      case "enum":
        return this.invokeSuppressibleDeclaration(
          enumGenerator,
          declaration.name,
        );
      case "bitmap":
        return this.invokeSuppressibleDeclaration(
          bitmapGenerator,
          declaration.name,
        );
      case "function":
        return this.generateFunction(declaration);
      case "variableDeclaration":
      case "constructorDeclaration":
        return (
          this.staticValueNote(declaration) +
          this.nullPointerNote(declaration) +
          VariableDeclHelper.renderVariableDecl(
            this.planVariableDecl(declaration),
            this.host.state,
          ) +
          "\n"
        );
      case "missing":
        return "";
    }
  }

  /**
   * The kinds a generated header can DEFINE, in the order it emits their
   * sections (#1300). Iterating kind-outer is what gives the `.c` the header's
   * ordering: a struct naming an enum declared below it must still come second,
   * and the two files disagreeing on that was an exit-0 miscompile.
   */
  private static readonly SCOPE_TYPE_KINDS: ReadonlyArray<
    IPlannedScope["typeDefinitions"][number]["kind"]
  > = ["enum", "bitmap", "struct"];

  /**
   * An ADR-016 scope: its members, and the types it contributes to the `.c`.
   *
   * Everything a member RENDERS is left unevaluated. `generateScope` calls
   * `setCurrentScope` before it renders anything, and every type name resolves
   * against the path that sets -- a bare `Flags` inside `scope Chip` is
   * `Chip__Flags`. Resolving one here would resolve it against the OUTER path
   * and emit the wrong name with nothing failing.
   *
   * What IS decided here is the structure: which members exist, which kind each
   * is, which types the header already defines, and whether Issue #282 skips a
   * private const scalar. Those are pure reads of the declaration.
   */
  private planScope(
    scope: Extract<TDeclarationSyntax, { kind: "scope" }>,
  ): IPlannedScope {
    const name = scope.name;
    const declaringScopePath =
      this.host.state.program?.scopePathOf(name) ?? name;
    return {
      name,
      declaringScopePath,
      typeDefinitions: this.planScopeTypeDefinitions(
        scope.members,
        declaringScopePath,
      ),
      members: scope.members.map((member) =>
        this.planScopeMember(member, declaringScopePath),
      ),
    };
  }

  /**
   * #1300: the types this scope defines in the `.c` -- the complement of what
   * the header defines, asked per symbol rather than re-derived from
   * visibility. Those two answers agree only until a public signature drags a
   * private type into the header, and then the type is defined twice and the C
   * compiler rejects it.
   */
  private planScopeTypeDefinitions(
    members: Extract<TDeclarationSyntax, { kind: "scope" }>["members"],
    declaringScopePath: string,
  ): IPlannedScope["typeDefinitions"] {
    return CodeGenWalker.SCOPE_TYPE_KINDS.flatMap((kind) =>
      members.flatMap(({ declaration }) => {
        if (declaration.kind !== kind || !("name" in declaration)) return [];
        const cName = this.scopeTypeCNameIfAbsentFromHeader(
          declaration.name,
          declaringScopePath,
        );
        return cName === null ? [] : [{ kind, cName }];
      }),
    );
  }

  /** This type's transpiled C name, or null when the header already defines it. */
  private scopeTypeCNameIfAbsentFromHeader(
    name: string,
    declaringScopePath: string,
  ): string | null {
    const fullName = QualifiedNameGenerator.forMember(declaringScopePath, name);
    const definedInHeader =
      this.host.state.sourcePath !== null &&
      PublicInterface.definesTypeInHeader(
        this.host.state.symbolTable,
        this.host.state.sourcePath,
        fullName,
      );
    return definedInHeader ? null : fullName;
  }

  /** Which of the four kinds this member is, and what rendering it needs. */
  private planScopeMember(
    member: Extract<TDeclarationSyntax, { kind: "scope" }>["members"][number],
    declaringScopePath: string,
  ): TPlannedScopeMember {
    const adrLine = member.span.line;
    const declaration = member.declaration;
    // ADR-016, via the one helper the symbols layer also asks (#1300). Codegen
    // used to recompute this, so the header and the body decided visibility
    // independently.
    const visibility = ScopeUtils.memberVisibility(
      member.visibility,
      declaration.kind === "function",
    );
    const isPrivate = visibility === "private";
    switch (declaration.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        return {
          kind: "variable",
          adrLine,
          variable: this.planScopeVariable(
            declaration,
            declaringScopePath,
            isPrivate,
          ),
        };
      case "function": {
        const params = declaration.parameters;
        return {
          kind: "function",
          adrLine,
          isPrivate,
          fullName: QualifiedNameGenerator.forFunctionInScope(
            declaringScopePath,
            declaration.name,
            this.host.state.program,
          ),
          renderReturnType: () => this.renderType(declaration.returnType),
          planParameters: () => this.planFunctionParameters(params),
          renderBody: () => this.renderBlock(declaration.body),
          renderParameterList: () =>
            params ? this.generateParameterList(params) : "void",
        };
      }
      case "register":
        return {
          kind: "register",
          adrLine,
          planRegister: () => this.planRegister(declaration),
        };
      default:
        return { kind: "other", adrLine };
    }
  }

  /** Which of the three shapes a scope variable is emitted in. */
  private planScopeVariable(
    decl: Extract<
      TDeclarationSyntax,
      { kind: "variableDeclaration" | "constructorDeclaration" }
    >,
    declaringScopePath: string,
    isPrivate: boolean,
  ): TPlannedScopeVariable {
    const fullName = QualifiedNameGenerator.forMember(
      declaringScopePath,
      decl.name,
    );
    // Issue #375: constructor syntax.
    //
    // #1322: the arguments are no longer VALIDATED here -- the const check that
    // stood beside this resolution is E0432 in pass 2.1, and it was the second
    // of two implementations of one decision.
    if (decl.kind === "constructorDeclaration") {
      return {
        kind: "constructor",
        fullName,
        isPrivate,
        args: decl.arguments.map((arg) =>
          QualifiedNameGenerator.forMember(declaringScopePath, arg.name),
        ),
        renderType: () => this.renderType(decl.type),
      };
    }

    // Issue #500: check for an array BEFORE skipping -- arrays must be emitted.
    // Both spellings count: C-style trailing dimensions and the cnx arrayType.
    // ADR-071: read-only unless declared `mut`
    const isConst = !decl.modifiers.mut;
    const arrayDims = decl.dimensions;
    const arrayType = decl.type.kind === "array" ? decl.type : null;
    const isArray = FilePlanner.isArrayDeclaration(decl);

    // Issue #282: 2.2 decided which private consts are inlined at their uses
    if (this.filePlan.inlinedConsts.has(decl)) {
      return { kind: "skipped" };
    }
    // Issue #998: the one modifier builder, which validates the atomic/volatile
    // mutual exclusion. Scope variables are file scope, and the initializer does
    // not affect volatile/atomic handling.
    const modifiers = VariableModifierBuilder.build(
      decl.modifiers,
      false,
      this.host.state,
    );
    return {
      kind: "regular",
      fullName,
      isPrivate,
      isConst,
      isArray,
      isPointer: this.host.state.isDeclaredPointer(decl),
      declarationLine: decl.span.line,
      atomic: modifiers.atomic,
      volatile: modifiers.volatile,
      renderType: () => this.renderType(decl.type),
      renderArrayTypeDimensions: () =>
        ArrayDimensionUtils.renderArrayTypeDimensions(
          arrayType
            ? this.planLoweredArrayTypeDimensions(arrayType.dimensions, decl)
            : null,
        ),
      renderCStyleDimensions:
        arrayDims.length > 0
          ? () => this.renderLoweredDimensions(arrayDims)
          : null,
      renderStringCapacityDimension: () =>
        ArrayDimensionUtils.renderStringCapacityDimension(
          FilePlanner.stringCapacityOf(decl.type),
        ),
      renderInitializer: () => this.renderScopeInitializer(decl, isArray),
      note: this.staticValueNote(decl) + this.nullPointerNote(decl),
    };
  }

  /**
   * A scope variable's initializer.
   *
   * Issue #872: `expectedType` is what puts the MISRA C:2012 Rule 7.2 `U`
   * suffix on an unsigned literal. Issue #992: 2.2 plans its struct initializers
   * plain, for GCC 9-12 compatibility (#1991).
   *
   * The type is rendered again here rather than reused from the declaration:
   * the caller's copy may have become a callback typedef or gained a `*`, and
   * the expected type of the INITIALIZER is the declared type, not the emitted
   * one. Two questions, two answers.
   */
  private renderScopeInitializer(
    decl: IVariableDeclarationSyntax,
    isArray: boolean,
  ): string {
    const initializer = decl.initializer;
    if (initializer) {
      const state = this.host.state;
      state.resetArrayInitTracking();
      const rendered = ` = ${this.renderExpression(initializer)}`;
      // #1824 review: an omitted size is emitted from 1.3's count (the
      // planner), so the list rendered here must have exactly that many
      // elements -- the same check the statement renderer makes.
      const omitsSize =
        decl.type.kind === "array" && decl.type.dimensions.includes(null);
      if (omitsSize && state.wasArrayInit()) {
        ArrayInitHelper.assertInferredSize(
          decl.name,
          this.countedSize(decl),
          state,
        );
      }
      return rendered;
    }
    // ADR-015: Zero initialization for uninitialized scope variables
    return ` = ${this.zeroOf(decl, isArray)}`;
  }

  /**
   * ADR-015's zero for a declaration written without an initializer, at every
   * declaration site. #1610: a scalar whose C type is a pointer is the null
   * pointer, spelled by mode -- MISRA C:2012 Rule 11.9 makes `NULL`, not the
   * integer `0` in `{0}`, a C pointer's null constant. 2.2 decided which
   * declarations those are (`nullInitialized`).
   */
  private zeroOf(decl: IVariableDeclarationSyntax, isArray: boolean): string {
    if (this.filePlan.nullInitialized.has(decl)) {
      return CppModeHelper.nullLiteral(this.host.state);
    }
    return this.zeroInitializerOf(decl.type, isArray, decl.dimensions);
  }

  private generateRegister(register: IRegisterDeclarationSyntax): string {
    return this.invokeGenerator(
      registerGeneratorFor(this.host.getState().currentScopePath),
      this.planRegister(register),
    );
  }

  /**
   * An ADR-004 register binding, decided (#1445).
   *
   * Part of IOrchestrator: `ScopeGenerator` dispatches the same generator for
   * a register inside a scope, and planning at both sites would be two
   * derivations of one register.
   *
   * The ORDER matters and is the node-walking order: the base address is
   * generated before the members, because each generation registers effects
   * on `CodeGenState`.
   *
   * `cType` comes from `generateType`, the single ADR-057 resolution point --
   * a bare `Flags` inside `scope Chip` arrives as `Chip__Flags` and an
   * explicit `global.Flags` arrives as `Flags`. Nothing downstream may
   * re-qualify it.
   */
  planRegister(register: IRegisterDeclarationSyntax): IPlannedRegister {
    const baseAddress = this.renderExpression(register.address);
    return {
      name: register.name,
      baseAddress,
      members: register.members.map((member) => ({
        name: member.name,
        cType: this.renderType(member.type),
        access: member.access,
        offset: this.renderExpression(member.offset),
      })),
    };
  }

  /**
   * A struct declaration, decided (#1445).
   *
   * `getTypeName` is the one eager read, because every field needs it -- it is
   * the key `callbackTypes` and `knownEnums` are looked up by. The four
   * renders stay thunks: each runs on only some branches, and each can
   * register effects, so rendering them all would emit effects for fields that
   * do not use them. See `IPlannedStructField`.
   */
  private planStruct(struct: IStructDeclarationSyntax): IPlannedStruct {
    return {
      name: struct.name,
      fields: struct.fields.map((field) => {
        const arrayType = field.type.kind === "array" ? field.type : null;
        // a callback field is written through its typedef, so 2.2 names it
        // in its callback field types rather than in the written types
        const callbackType = this.host.state.callbackFieldTypes.get(
          `${struct.name}.${field.name}`,
        );
        return {
          name: field.name,
          typeName: callbackType ?? this.typeNameOf(field.type),
          isCallback: callbackType !== undefined,
          hasNameDimensions: field.dimensions.length > 0,
          hasTypeDimensions: arrayType !== null,
          renderCType: () => this.renderType(field.type),
          renderTypeDimensions: () =>
            ArrayDimensionUtils.renderArrayTypeDimensions(
              arrayType
                ? this.planLoweredArrayTypeDimensions(
                    arrayType.dimensions,
                    null,
                  )
                : null,
            ),
          renderNameDimensions: () =>
            this.renderLoweredDimensions(field.dimensions),
        };
      }),
    };
  }

  private planLoweredArrayTypeDimensions(
    dims: ReadonlyArray<TExpression | null>,
    declaration: IVariableDeclarationSyntax | null,
  ): readonly IPlannedDimension[] {
    // #1664 box 3: an omitted size is the declaration's count, the number
    // the `.h` states, for every declaration renderer that asks here.
    return dims.map((size) =>
      size
        ? { renderSize: () => this.renderLoweredDimension(size) }
        : { renderSize: () => String(this.omittedSizeOf(declaration)) },
    );
  }

  /**
   * A call's arguments, decided (#1445).
   *
   * Four of the five fields are thunks because exactly ONE render happens
   * per argument and the generator decides which -- see
   * `IPlannedCallArgument`. `simpleIdentifier` is eager: it is a pure tree
   * walk, and Issue #268's pass-through tracking reads it for every argument
   * before any of them renders.
   */
  private planCallArguments(
    args: readonly TExpression[] | null,
  ): readonly IPlannedCallArgument[] | null {
    if (args === null) return null;

    return args.map((expression) => this.planCallArgument(expression));
  }

  private planCallArgument(expression: TExpression): IPlannedCallArgument {
    const planned = this.filePlan.arguments.get(expression);
    invariant(
      planned !== undefined,
      `2.2 planned every argument 2.3 writes (line ${expression.span.line})`,
    );
    return {
      planned,
      simpleIdentifier: ExpressionShape.simpleIdentifier(expression),
      parameter: this.parameterNamed(expression),
      render: () => this.renderExpression(expression),
      renderByReference: () => this.generateFunctionArg(expression, planned),
    };
  }

  /**
   * The struct type for an initializer: explicit if written, else inferred
   * from the expected type at this position.
   *
   * #1322: an assertion now. ADR-014's rejection -- a literal no position can
   * type -- is E0357 in pass 2.1, which halts before this runs. Its sibling
   * E0356 (a redundant WRITTEN type) is gone with the grammar alternative it
   * rejected, so this takes no node: there is one source for the type.
   */
  private _resolveStructInitializerTypeName(): string {
    invariant(
      this.host.state.expectedType,
      "a struct initializer takes its type from its position -- E0357 " +
        "rejects this in pass 2.1, before this runs",
    );
    return this.host.state.expectedType;
  }

  /**
   * ADR-014: Generate struct initializer
   * { x: 10, y: 20 } -> (Point){ .x = 10, .y = 20 } (type inferred from context)
   *
   * #1322: there is no explicit-type syntax. `Point { x: 10 }` was a grammar
   * alternative that no position accepted, and it is removed.
   */
  private generateStructInitializer(
    expr: TExpressionOf<"structInitializer">,
  ): string {
    const typeName = this._resolveStructInitializerTypeName();
    const form = this.plannedStructInitializerForm(expr);

    // Issue #834: For named struct tags (no typedef), we need 'struct' prefix in C mode
    const needsStructKeyword =
      !this.host.state.cppMode &&
      this.host.state.symbolTable.checkNeedsStructKeyword(typeName);
    const castType = userCType(typeName, needsStructKeyword);
    if (form === "cppClass") {
      return this.builtCppClassObject(expr, castType);
    }

    // #1322: an empty-initializer branch stood here, reachable only through the
    // written form `Point {}` -- the inferred alternative has always required a
    // field list. That alternative is removed, so `fieldInitializerList()` is
    // non-nullable in the generated parser and `{}` is a parse error. The
    // branch went with it rather than being left as a shape nothing can build.

    const copied = expr.fields.filter((field) =>
      this.filePlan.stringFields.has(field.value),
    );
    // #2236: a string field copied in starts zeroed, where it is written, so
    // the list stays whole and in order for C++'s designated initializers
    const fields = expr.fields.map((field) => {
      const fieldName = field.name;
      const value = copied.includes(field)
        ? "{ 0 }"
        : this.renderExpression(field.value);
      return { fieldName, value };
    });
    if (copied.length > 0) {
      return this.builtStructInitializer(castType, fields, copied);
    }

    // For cnx/C structs, generate designated initializer.
    // #1997: reported as the form emitted, in both modes. What it costs (C99 in
    // C, C++20 in C++) is 2.2's decision, made from this fact and the mode.
    // The text is identical in both modes, so no probe over the output could
    // recover it; the fact has to come from here.
    const fieldInits = fields.map((f) => `.${f.fieldName} = ${f.value}`);

    const initializer = `{ ${fieldInits.join(", ")} }`;
    return form === "compound" ? `(${castType})${initializer}` : initializer;
  }

  /** 2.2's form for a struct initializer, recorded as written */
  private plannedStructInitializerForm(
    expr: TExpressionOf<"structInitializer">,
  ): TStructInitializerForm {
    const form = this.filePlan.structInitializers.get(expr);
    invariant(
      form !== undefined,
      `2.2 planned the struct initializer on line ${expr.span.line} that 2.3 writes`,
    );
    this.rendering.structInitializers.add(expr);
    return form;
  }

  /**
   * Issue #517 / ADR-014: the statements that fill a C++ class object from its
   * initializer. A class with a user-defined constructor is not an aggregate,
   * so `{ .value = 9 }` cannot initialize it: the object is constructed, then
   * each field is assigned.
   *
   * #1534: the one place that writes them, against the object they fill. They
   * were queued and drained at whatever declaration came next, so
   * `obj <- { value: 9 }` emitted `obj = {};` and then `later.value = 9;`.
   */
  private cppClassFill(
    expr: TExpressionOf<"structInitializer">,
    target: string,
  ): string[] {
    invariant(
      this.plannedStructInitializerForm(expr) === "cppClass",
      "only a C++ class with a constructor is filled after it is constructed",
    );
    invariant(
      this.host.state.inFunctionBody,
      "E0508 rejects a C++ class initializer outside a function body in pass 2.1",
    );
    invariant(
      !expr.fields.some((field) => this.filePlan.stringFields.has(field.value)),
      "a C++ class with a constructor has no string<N> field",
    );
    return [
      "/* ADR-014 / Issue #517, C++20 §9.4.2 (aggregates): a class with a user-declared constructor is not an aggregate, so no designated initializer can build it; it is constructed, then each field is assigned. */",
      ...expr.fields.map(
        (field) =>
          `${target}.${field.name} = ${this.renderExpression(field.value)};`,
      ),
    ];
  }

  /**
   * #1534: a C++ class initializer anywhere but as a declaration's whole
   * initializer -- an assignment, an argument, a return, an element, a field
   * -- is built before the statement, as #2236 builds a string field, and the
   * value is the object built.
   */
  private builtCppClassObject(
    expr: TExpressionOf<"structInitializer">,
    castType: string,
  ): string {
    const temp = this.host.state.getNextTempVarName();
    const fill = this.cppClassFill(expr, temp);
    this.host.state.pendingTempDeclarations.push(
      `${castType} ${temp} = {};`,
      ...fill,
    );
    return temp;
  }

  /**
   * #2236: a struct initializer with a `string<N>` field written from a
   * string, built before the statement: C initializes a `char[]` only from a
   * literal (and GCC 10's C++ not even from one), so the fields initialize a
   * temporary, each such string field zeroed, and each string is then copied
   * into its field, as any string is.
   * The value is the temporary.
   */
  private builtStructInitializer(
    castType: string,
    fields: readonly { readonly fieldName: string; readonly value: string }[],
    copied: readonly { readonly name: string; readonly value: TExpression }[],
  ): string {
    const temp = this.host.state.getNextTempVarName();
    const lines = copied.flatMap((field) => {
      const capacity = this.filePlan.stringFields.get(field.value);
      const form = this.filePlan.stringValueForms.get(field.value);
      invariant(
        capacity !== undefined && form !== undefined,
        "2.2 planned each string field it copies",
      );
      const target = `${temp}.${field.name}`;
      if (form.kind === "copy" || form.kind === "literal") {
        const whole = form.kind === "copy" ? form.value : form.literal;
        return [
          StringUtils.copy(target, this.renderExpression(whole), capacity),
        ];
      }
      return StringUtils.build(target, capacity, this.renderStringParts(form));
    });
    const inits = fields.map((f) => `.${f.fieldName} = ${f.value}`);
    this.host.state.pendingTempDeclarations.push(
      "/* ADR-045 / Issue #2236: a string<N> field is copied in like any string; C initializes a char[] only from a literal. */",
      `${castType} ${temp} = { ${inits.join(", ")} };`,
      ...lines,
    );
    return temp;
  }

  /**
   * ADR-035: Generate array initializer
   * [1, 2, 3] -> {1, 2, 3}
   * [0*] -> {0} (fill-all syntax)
   * Returns: { elements: string, count: number } for size inference
   */
  private generateArrayInitializer(
    expr: TExpressionOf<"arrayInitializer">,
  ): string {
    if (expr.fill !== null) {
      const fillValue = this.renderExpression(expr.fill);
      this.host.state.lastArrayInitCount = 0;
      this.host.state.lastArrayFillValue = fillValue;
      return ArrayInitHelper.fillAll(
        fillValue,
        this.filePlan.fillSizes.get(expr) ?? null,
      );
    }

    const generatedElements = expr.elements.map((element) => {
      switch (element.kind) {
        case "structInitializer":
          return this.generateStructInitializer(element);
        case "arrayInitializer":
          return this.generateArrayInitializer(element);
        default:
          return this.renderExpression(element);
      }
    });

    this.host.state.lastArrayInitCount = generatedElements.length;
    this.host.state.lastArrayFillValue = undefined;

    return `{${generatedElements.join(", ")}}`;
  }

  /**
   * A function declaration, decided (#1445).
   *
   * The return type is rendered HERE, before the context is entered, because
   * that is where the node-walking version rendered it.
   * `isMainFunctionWithArgs` and the first parameter's name are pure reads of
   * the tree, so moving them ahead of the context changes nothing they can
   * observe.
   *
   * The body and the parameter list stay unrendered: Issue #268 makes their
   * ORDER the generator's decision, and it cannot own that if it is handed
   * two strings.
   */
  private planFunction(fn: IFunctionDeclarationSyntax): IPlannedFunction {
    const params = fn.parameters;
    return {
      name: fn.name,
      returnType: this.renderType(fn.returnType),
      isMainWithArgs: this.isMainFunctionWithArgs(fn.name, params),
      firstParameterName: params?.[0]?.name,
      parameters: this.planFunctionParameters(params),
      renderBody: () => this.renderBlock(fn.body),
      renderParameterList: params
        ? () => this.generateParameterList(params)
        : null,
    };
  }

  private generateFunction(fn: IFunctionDeclarationSyntax): string {
    return this.invokeGenerator(functionGenerator, this.planFunction(fn));
  }

  private generateParameter(
    param: IParameterSyntax,
    paramIndex: number,
  ): string {
    const name = param.name;

    // #1322: a C-style or unbounded array parameter is E0874/E0875 in pass
    // 2.1 (ADR-036).

    // #1639: decided once in 2.2, and the `.h` prototype, the body and every
    // call read the same answer
    const functionName = this.host.state.currentFunctionName;
    invariant(functionName, "a parameter renders inside its function");
    const passing = ParameterPassing.of(
      functionName,
      paramIndex,
      this.host.state,
    );

    // ADR-030 / #1722: the parameter was registered when this function's
    // context was entered -- FunctionGenerator and ScopeGenerator both render
    // the list before exiting it -- and the registry holds the one
    // opaque-handle decision. Reading it here makes the `T*` this signature
    // spells and the bare `p` a whole-value use renders one answer, rather
    // than two answers that happen to agree.
    const registered = this.host.state.currentParameters.get(name);
    invariant(
      registered,
      `a parameter is registered in its function's context before the signature renders ('${name}')`,
    );

    // #1290: the C name 1.4 settled on the parameter, which the `.h`
    // prototype and every use in the body read too (ADR-057)
    const emittedName = FunctionContextManager.parameterEmittedName(
      paramIndex,
      this.host.state,
    );
    const input = ParameterInputAdapter.fromAST(
      this.planParameter(param, emittedName),
      {
        callbackTypes: this.host.state.callbackTypes,
        passing,
        isOpaqueHandle: registered.isOpaqueHandle ?? false,
      },
    );

    // Use shared builder with C/C++ mode
    return ParameterSignatureBuilder.build(
      input,
      CppModeHelper.refOrPtr(this.host.state),
    );
  }

  /**
   * A parameter reduced to what ADR-006's signature adapter asks of it (#1445).
   *
   * Three provenance positions are carried, not one: ADR-013 is recorded
   * against the parameter, the string type or the array type depending on
   * which branch of the adapter fires, and #1241 derives matrix occupancy from
   * those positions.
   *
   * The dimensions go over as a thunk. A parameter whose type IS a callback
   * returns from the adapter before any dimension is needed, and a dimension
   * that is not a compile-time constant goes through expression generation,
   * which can queue a pending temp declaration -- so rendering one that is
   * then discarded leaks it.
   */
  private planParameter(
    param: IParameterSyntax,
    emittedName: string,
  ): IPlannedParameter {
    const arrayType = param.type.kind === "array" ? param.type : null;
    const element = arrayType ? arrayType.element : param.type;
    const stringType = element.kind === "string" ? element : null;
    return {
      name: emittedName,
      isConst: !param.mut,
      typeName: this.plannedParameter(param).typeName,
      mappedType: this.renderType(param.type),
      renderDimensions: arrayType
        ? () =>
            arrayType.dimensions.map((dimension) =>
              dimension ? this.renderLoweredDimension(dimension) : "",
            )
        : null,
      isString: stringType !== null,
      stringCapacity: FilePlanner.stringCapacityOf(param.type) ?? undefined,
      line: param.span.line,
      stringTypeLine: stringType?.span.line,
      arrayTypeLine: arrayType?.span.line,
    };
  }

  /**
   * One array dimension, as C should say it.
   *
   * Issue #1159: fold a compile-time constant to its value first. Emitting the
   * identifier makes `u8[SIZE] buf` a VLA parameter (`uint8_t buf[SIZE]`)
   * while the matching local declaration folds to `uint8_t b[6]` -- the same
   * const rendered two ways in one .c, and a construct CLAUDE.md rules out.
   * #1175: a dimension is a constant wherever it is written (ADR-023: no
   * VLAs), so it folds everywhere, by the one rule.
   */
  private renderLoweredDimension(expression: TExpression): string {
    // ADR-036: a dimension is a constant expression in every context, so a
    // fixture occupies the matrix cell it is written in
    AdrProvenance.record("036", expression.span.line);
    const dimension = ConstantFold.settled(
      ConstExprLowering.lower(expression),
      dimensionEvalOptions(this.planner.transpileState),
    );
    invariant(
      dimension !== null,
      `2.1 rejects a dimension with no value (E0909, E0910) before render: '${expression.written}'`,
    );
    return String(dimension);
  }

  /**
   * `[N][M]`, or `[]` for an omitted size. Bug #8 folded only at file scope;
   * #1175: a dimension is a constant wherever it is written (ADR-023: no
   * VLAs), so it folds everywhere, by the one rule.
   */
  private renderLoweredDimensions(
    dimensions: ReadonlyArray<TExpression | null>,
  ): string {
    return dimensions
      .map((dimension) =>
        dimension ? `[${this.renderLoweredDimension(dimension)}]` : "[]",
      )
      .join("");
  }

  /**
   * One variable declaration, in whichever of three forms it takes.
   *
   * ## This planner WRITES, and the order is the contract
   *
   * `inferVariableType` renders; `trackLocalVariable` records the local's
   * name for the walk. What a name is typed as is not written here: it binds
   * through 1.4's lexical frames (#1668, C8), which is why
   * `string<32> s <- s + "x"` is detected as a concatenation and rejected
   * E0864 for "capacity 33", the 32 read off `s`'s own declaration (#1643
   * tracks that the name binds in its own initializer at all). The steps are
   * still the sequence the renderer used to perform,
   * with the rendering lifted out of it.
   */
  private planVariableDecl(
    decl: Extract<
      TStatement,
      { kind: "variableDeclaration" | "constructorDeclaration" }
    >,
  ): TPlannedVariableDecl {
    if (decl.kind === "constructorDeclaration") {
      return this.planConstructorDecl(decl);
    }
    // Issue #696: Use shared modifier builder. #517's C++ class initializer
    // assigns the fields after the declaration, so its object is never C `const`.
    const fillsAfterDeclaring = this.cppClassInitializerOf(decl) !== null;
    const modifiers = VariableModifierBuilder.build(
      fillsAfterDeclaring ? { ...decl.modifiers, mut: true } : decl.modifiers,
      this.host.state.inFunctionBody,
      this.host.state,
      this.host.state.isDeclaredPointer(decl),
    );
    const name = decl.name;
    const type = this._inferVariableType(decl);
    // ADR-057: the identifier this declaration is EMITTED under. Computed once,
    // here, because the string and array forms below return before the plain
    // declaration is assembled -- a second call would be a second place
    // deciding the same thing. Registries keep the source name; only the
    // generated text moves.
    const emittedName = this.host.state.ownEmittedName(decl);
    const stringPlan = this.planStringDecl(decl);
    if (stringPlan) {
      return {
        kind: "string",
        string: stringPlan,
        emittedName,
        modifiers,
        isConst: !decl.modifiers.mut,
      };
    }
    // Statements rather than an object literal, because the ORDER matters and
    // an object literal's property order is not something a reader checks:
    // the array half renders its type dimensions eagerly, and it must do so
    // before anything the initializer renders.
    const array = this.planArrayDeclaration(decl);
    const initializer = this.planVariableInitializer(decl);
    return {
      kind: "plain",
      sourceName: name,
      emittedName,
      modifierPrefix: VariableModifierBuilder.toPrefix(modifiers),
      type,
      array,
      initializer,
    };
  }

  /**
   * Issue #375: `Type name(arg, arg);` -- C++ constructor syntax.
   *
   * #1322: the "is not declared" (E0433) and "must be read-only" (E0432)
   * rejections that stood here are authored in pass 2.1, which halts before
   * codegen -- so an argument reaching this line is declared and const. The two
   * copies of that rule also decided const-ness two different ways;
   * `IDeclaredVar.isConst` is now the single answer.
   *
   * What survives is NAME resolution, which is codegen's own question: a scope
   * member is emitted by its qualified C name.
   */
  private planConstructorDecl(
    decl: Extract<TStatement, { kind: "constructorDeclaration" }>,
  ): TPlannedVariableDecl {
    const type = this.renderType(decl.type);
    const args = decl.arguments.map((argument) =>
      this.planner.boundName(argument.name, {
        line: argument.span.line,
        column: argument.span.column,
      }),
    );
    return {
      kind: "constructor",
      type,
      emittedName: this.host.state.ownEmittedName(decl),
      args,
    };
  }

  /**
   * The two spellings of "this declaration is an array", read once.
   *
   * cnx admits trailing C-style dimensions (`u32 a[4]`) and the arrayType
   * prefix (`u32[4] a`), so "is this an array" is their disjunction --
   * `IPlannedArrayDeclaration` says it is decided once, and it was being
   * re-derived at a second site from the same node.
   *
   * The scope-side copy gates a BEHAVIORAL arm, which is why this is not
   * cosmetic: Issue #282 inlines a private const scalar at its uses and Issue
   * #500 exempts arrays. Two spellings of this disjunction disagreeing emits an
   * array that should have been inlined, or inlines one that had to be emitted.
   *
   * `arrayType?.()` keeps the scope path's defensive call -- `TypeContext`
   * always carries the rule, but a hand-built context in a unit test need not.
   */

  /**
   * The array half of a declaration (ADR-035/ADR-036).
   *
   * `arrayTypeDimensions` is rendered HERE rather than handed over as a thunk,
   * and that is the one placement worth checking. It renders unconditionally
   * once the declaration is an array, before the initializer branch chooses
   * whether to use it, and one sub-branch discards it. A thunk would skip the
   * render on exactly that sub-branch and drop whatever effects the dimension
   * expressions raised.
   */
  private planArrayDeclaration(
    decl: IVariableDeclarationSyntax,
  ): IPlannedArrayDeclaration {
    const arrayDims = decl.dimensions;
    const typeDims = decl.type.kind === "array" ? decl.type.dimensions : null;
    if (!FilePlanner.isArrayDeclaration(decl)) {
      return {
        isArray: false,
        hasEmptyDimension: false,
        hasEmptyArrayTypeDimension: false,
        declaredSize: null,
        arrayTypeDimensions: "",
        renderCStyleDimensions: () => "",
        init: null,
      };
    }
    const hasEmptyArrayTypeDimension = (typeDims ?? []).includes(null);
    const hasEmptyDimension =
      arrayDims.includes(null) || hasEmptyArrayTypeDimension;
    const initializer = decl.initializer;
    // #1822: the inferred path emits its one counted size as the whole suffix,
    // which is right only for a one-dimensional array. E0892 rejects every
    // other empty dimension in pass 1.2.
    invariant(
      !hasEmptyDimension || CodeGenWalker.arrayRank(decl) === 1,
      `an array that omits a size is one-dimensional -- E0892 rejects '${decl.name}' in pass 1.2, before this runs`,
    );
    return {
      isArray: true,
      hasEmptyDimension,
      hasEmptyArrayTypeDimension,
      declaredSize: hasEmptyDimension
        ? this.countedSize(decl)
        : (this.foldFirstDimension(typeDims ?? []) ??
          this.foldFirstDimension(arrayDims)),
      arrayTypeDimensions: ArrayDimensionUtils.renderArrayTypeDimensions(
        typeDims === null
          ? null
          : this.planLoweredArrayTypeDimensions(typeDims, decl),
      ),
      renderCStyleDimensions: () => this.renderLoweredDimensions(arrayDims),
      init: initializer
        ? {
            renderExpression: () => this.renderExpression(initializer),
            renderDimensions: () => this.renderLoweredDimensions(arrayDims),
          }
        : null,
    };
  }

  /** How many dimensions a declaration states, in both spellings together */
  private static arrayRank(decl: IVariableDeclarationSyntax): number {
    return (
      (decl.type.kind === "array" ? decl.type.dimensions.length : 0) +
      decl.dimensions.length
    );
  }

  /**
   * #1664 box 3: what this declaration says, as 1.3 recorded it and 1.4
   * settled it -- the facts the `.h` is written from. Found by identity, so
   * it reads this declaration, never one it shadows.
   */
  private declaredHere(
    decl: IVariableDeclarationSyntax,
  ): TTypeInfo | undefined {
    return this.host.state.ownTypeInfo(decl);
  }

  /**
   * The size 1.3 counted for this declaration's one omitted dimension, or
   * null when there is none to read: only a one-dimensional declaration is
   * counted (E0892), and an uncounted size is `UNRESOLVED_DIMENSION`, 0.
   */
  private countedSize(decl: IVariableDeclarationSyntax): number | null {
    const rank = CodeGenWalker.arrayRank(decl);
    const size = this.declaredHere(decl)?.arrayDimensions?.[0];
    return rank === 1 && size !== undefined && size > 0 ? size : null;
  }

  /** An omitted size as rendered: the declaration's count, asserted. */
  private omittedSizeOf(
    declaration: IVariableDeclarationSyntax | null,
  ): number {
    const size = declaration === null ? null : this.countedSize(declaration);
    invariant(
      size !== null,
      `an omitted array size is counted from a one-dimensional declaration's list or string literal -- E0892 rejects '${declaration?.name ?? "a struct field"}' in pass 1.2, before this runs`,
    );
    return size;
  }

  /**
   * The folded value of the first dimension in a list, or null.
   *
   * Through the one evaluator (`dimensionValue`): the size
   * used to expand a fill-all must equal the size emitted in the declarator, or
   * the array is the declared length with the wrong contents (#1644).
   */
  private foldFirstDimension(
    dims: ReadonlyArray<TExpression | null>,
  ): number | null {
    const size = dims[0];
    return size ? (this.planner.constantOf(size) ?? null) : null;
  }

  /**
   * How a variable's initializer is rendered (ADR-015 when there is none).
   */
  private planVariableInitializer(
    decl: IVariableDeclarationSyntax,
  ): TPlannedVariableInitializer {
    const initializer = decl.initializer;
    if (!initializer) {
      return {
        kind: "zero",
        render: (isArray) => this.zeroOf(decl, isArray),
      };
    }
    const cppClass = this.cppClassInitializerOf(decl);
    if (cppClass) {
      return {
        kind: "cppClass",
        renderFill: (target) =>
          this.againstPlannedType(cppClass, () =>
            this.cppClassFill(cppClass, target),
          ),
      };
    }
    return {
      kind: "expression",
      renderTypeName: () => this.typeNameOf(decl.type),
      renderExpression: () => this.renderExpression(initializer),
      resolveExpressionType: () => this.planner.directTypeOf(initializer),
    };
  }

  /**
   * Issue #517: a declaration whose whole initializer builds a C++ class with
   * a constructor, which the declaration then fills after declaring (#1534)
   */
  private cppClassInitializerOf(
    decl: IVariableDeclarationSyntax,
  ): TExpressionOf<"structInitializer"> | null {
    const initializer = decl.initializer;
    return initializer?.kind === "structInitializer" &&
      this.filePlan.structInitializers.get(initializer) === "cppClass"
      ? initializer
      : null;
  }

  /**
   * Which of ADR-045's three string forms this declaration takes, or null when
   * it is not a string at all.
   *
   * #1445 box 3: `StringDeclHelper` used to be handed the `TypeContext` and do
   * this navigation itself.
   *
   * WHERE it is called from was load-bearing while a per-file registry was
   * filled as the walk went; #1668 (C8) deleted it. The variable's own name
   * binds through 1.4's lexical frames wherever this is called, so
   * `string<32> s <- s + "x"` is detected as a concatenation and rejected
   * E0864 for "capacity 33", the 32 read off `s`'s own declaration. (That the name resolves at all is a separate defect,
   * #1643.)
   */
  private planStringDecl(
    decl: IVariableDeclarationSyntax,
  ): TPlannedStringDecl | null {
    const type = decl.type;
    if (type.kind === "array" && type.element.kind === "string") {
      return this.planStringArray(decl, type.dimensions, type.element.capacity);
    }
    if (type.kind !== "string") {
      return null;
    }
    const initializer = decl.initializer;
    if (type.capacity === null) {
      return {
        kind: "unsized",
        initText: initializer ? CodeGenWalker.stringTextOf(initializer) : null,
        declaredCapacity: this.declaredHere(decl)?.stringCapacity ?? null,
      };
    }
    return {
      kind: "bounded",
      capacity: Number.parseInt(type.capacity, 10),
      init: initializer ? this.planStringInit(initializer) : null,
    };
  }

  /** What the string helpers test: a literal's token, a name, else as written */
  private static stringTextOf(expression: TExpression): string {
    if (expression.kind === "literal") {
      return expression.text;
    }
    return expression.kind === "identifier"
      ? expression.name
      : expression.written;
  }

  /**
   * A bounded string's initializer in the form 2.2 planned (#1257). A file
   * or scope string, which 2.2 does not plan, is a literal (E0863). Both
   * renders are unevaluated: either can request an include or queue a C++
   * temp, so raising those effects for an arm that is not taken would change
   * the emitted C.
   */
  private planStringInit(expression: TExpression): IPlannedStringInit {
    const form = this.filePlan.stringValueForms.get(expression) ?? {
      kind: "literal",
      literal: expression,
    };
    const whole =
      form.kind === "literal"
        ? form.literal
        : form.kind === "copy"
          ? form.value
          : expression;
    return {
      form: form.kind,
      text: CodeGenWalker.stringTextOf(whole),
      render: () => this.renderExpression(whole),
      renderParts: () => this.renderStringParts(form),
    };
  }

  /** #2240: the substring's length 2.2 folded */
  private substringCount(chain: TExpression): number {
    const count = this.filePlan.substringCounts.get(chain);
    invariant(count !== undefined, "2.2 folds every substring's length");
    return count;
  }

  /** A concatenation's or a substring's parts as generated C (ADR-045) */
  private renderStringParts(
    form: TStringValueForm,
  ): readonly TRenderedStringPart[] {
    const parts =
      form.kind === "concat"
        ? form.parts
        : form.kind === "substring"
          ? [form.part]
          : [];
    return parts.map((part): TRenderedStringPart => {
      if (part.kind === "whole") {
        return { kind: "whole", code: this.renderExpression(part.value) };
      }
      return {
        kind: "substring",
        // The chain read up to the string it subscripts, as a target is
        source: this.generateAssignmentTarget(
          part.chain,
          AssignmentTarget.parts(part.chain).ops.length - 1,
        ),
        start: this.renderExpression(part.start),
        length: this.substringCount(part.chain),
      };
    });
  }

  /**
   * Issue #1029: `string<32>[4] items`.
   */
  private planStringArray(
    decl: IVariableDeclarationSyntax,
    typeDims: ReadonlyArray<TExpression | null>,
    elementCapacity: string | null,
  ): TPlannedStringDecl {
    if (elementCapacity === null) {
      invariant(
        false,
        "a string array states its element capacity -- E0862 rejects an unsized one in pass 1.2",
      );
    }
    let dimensions = ArrayDimensionUtils.renderArrayTypeDimensions(
      this.planLoweredArrayTypeDimensions(typeDims, decl),
    );
    dimensions += this.renderLoweredDimensions(decl.dimensions);
    const initializer = decl.initializer;
    return {
      kind: "array",
      elementCapacity: Number.parseInt(elementCapacity, 10),
      dimensions,
      // #1644: the SAME call the loop above renders the declarator with. The
      // size used to expand a fill-all must equal the size emitted in `[...]`,
      // or the array is the declared length with the wrong contents.
      // An omitted size is the declaration's count; a written one folds.
      declaredSize: typeDims[0]
        ? this.foldFirstDimension(typeDims)
        : this.countedSize(decl),
      renderInit: initializer ? () => this.renderExpression(initializer) : null,
    };
  }

  /**
   * Issue #696: Infer variable type, handling nullable C pointer types.
   * Issue #895 Bug B: Infer pointer type from C function return type.
   */
  private _inferVariableType(decl: IVariableDeclarationSyntax): string {
    const type = this.renderDeclaredType(decl.type);
    return DeclaredPointer.spell(type, this.host.state.isDeclaredPointer(decl));
  }

  /**
   * Get zero initializer for an enum type.
   * Returns member with value 0, or first member, or casted 0.
   * ADR-017: Enums initialize to first member
   */
  private _getEnumZeroValue(
    enumName: string,
    separator: string = QualifiedCName.SEPARATOR,
  ): string {
    return EnumZeroValue.of(
      this.host.state.symbols!.enumMembers,
      enumName,
      separator,
    );
  }

  /**
   * Resolve full type name from any TypeContext variant.
   * Returns { name, separator } or null if not a named type.
   * ADR-016: Handles scoped, global, qualified, and user types
   */
  private namedTypeOf(
    type: TTypeSyntax,
    ofElement = false,
  ): { name: string; separator: string } | null {
    // #1285: ask for named types by name. Everything else -- string, array,
    // template, primitive, `void` -- returns null and is handled by the
    // caller's own chain, which is where it was always handled. An enumerated
    // list of alternatives to SKIP would have to be kept in step with the
    // grammar from ~3000 lines away, and getting it wrong fails open.
    // #1991: 2.2 classified it in the scope that writes it; for an array the
    // plan describes the element, which only an element's caller asks about
    const name =
      type.kind === "array" && !ofElement
        ? undefined
        : this.plannedType(type).named?.name;
    if (name === undefined) {
      return null;
    }

    // Issue #388: a C++ namespace type comes back `::`-joined.
    const separator = name.includes("::") ? "::" : QualifiedCName.SEPARATOR;
    return { name, separator };
  }

  /**
   * Generate a safe bit mask expression.
   * Avoids undefined behavior when width >= 32 for 32-bit integers.
   * @param width The width expression (may be a literal or expression)
   * @param isF64 If true, generate 64-bit masks with ULL suffix (for f64 bit indexing)
   */
  /**
   * Analyze a member chain target to detect bit access at the end.
   * Issue #644: Delegates to MemberChainAnalyzer.
   */
  /** Public for handler access via this.host.state.generator */
  /**
   * Dispatched through `ICodeGenApi` via `this.host.state.requireGenerator()`, so
   * no call site ever names this class. knip cannot follow that indirection.
   *
   * @public
   */
  analyzeMemberChainForBitAccess(
    targetExpr: TExpression,
    lastStep: IChainStep | undefined,
  ): IBitAccessAnalysis {
    // #1668 (C12): what the last subscript indexes is the typer's answer,
    // typed once with the target (`IChainBase.last`)
    return MemberChainAnalyzer.analyze(
      lastStep,
      AssignmentTarget.parts(targetExpr).ops.map((op) => this.planTargetOp(op)),
    );
  }

  /**
   * One postfix step of an assignment target, as the chain walk needs it.
   *
   * #1445: `postfixTargetOp` is `.IDENTIFIER`, `[e]` or `[e, e]`, so the only
   * thing the walk read off a node was which of those it is. The indexes stay
   * unrendered behind a thunk -- most chains are not bit accesses, and
   * rendering an index queues a pending temp declaration in some shapes. See
   * `TPlannedTargetOp`.
   */
  private planTargetOp(op: TPostfixOpSyntax): TPlannedTargetOp {
    if (op.kind === "member") {
      return { kind: "member", name: op.name };
    }

    const indexes = op.kind === "subscript" ? op.indexes : [];
    return {
      kind: "subscript",
      indexCount: indexes.length,
      renderIndexes: () => indexes.map((index) => this.renderExpression(index)),
      foldWidth: () =>
        indexes.length === 2 ? this.planner.constantOf(indexes[1]) : undefined,
    };
  }

  private generateAssignment(site: IAssignmentSyntax): string {
    const targetExpr = site.target;

    // #1668 (C7): what the target writes, bound once -- the expected type
    // below and every classifier rule and handler read this
    const target = this.planner.targetDeclaration(targetExpr);
    // #1257: a concatenation or a substring is built from its parts, so the
    // value as one C expression is never rendered
    const stringForm = this.filePlan.stringValueForms.get(site.value);
    const builtApart =
      stringForm !== undefined &&
      (stringForm.kind === "concat" || stringForm.kind === "substring");
    const value = builtApart ? "" : this.renderExpression(site.value);

    // #1322: the operator was mapped to its C form here and used for nothing
    // but the `isCompound` flag that `AssignmentValidator` took. ADR-065's
    // handlers do their own mapping from `ctx`, so both are gone with it.

    // #1322: `AssignmentValidator.validate` was called here, and by the end of
    // the relocation it validated nothing -- ADR-071's read-only rule is E0900,
    // ADR-017's enum rule E0428, ADR-024's conversions E0868/E0869, ADR-036's
    // bounds E0854, ADR-004's `ro` write E0871 and ADR-029's callback typing
    // E0879/E0880, every one of them authored in pass 2.1 at the target's own
    // position. What was left was this single line of emission bookkeeping
    // wrapped in a class named for the job it no longer did, so the class is
    // deleted rather than left as a misleading name over a side effect.
    //
    // Writing to a float invalidates its bit-shadow: the union copy is stale
    // until the next read refreshes it. Only a whole-variable assignment does
    // this -- writing THROUGH a member or an element does not rebind the float.
    const parts = AssignmentTarget.parts(targetExpr);
    if (parts.ops.length === 0) {
      const assignedName = parts.identifier;
      if (assignedName !== null) {
        this.host.state.floatShadowCurrent.delete(
          BitRangeHelper.getShadowVarName(assignedName),
        );
      }
    }

    // ADR-065: Dispatch to assignment handlers
    // Build context, classify, and dispatch - all patterns handled by handlers
    const assignCtx = buildAssignmentContext(site, {
      target,
      floatBits: CodeGenWalker.plannedAt(
        this.filePlan.floatBitWrites,
        targetExpr,
        this.rendering.floatBitWrites,
        "assignment target",
      ),
      bitmapField: CodeGenWalker.plannedAt(
        this.filePlan.bitmapFieldWrites,
        site,
        this.rendering.bitmapFieldWrites,
        "assignment",
      ),
      atomic: CodeGenWalker.plannedAt(
        this.filePlan.atomicForms,
        site,
        this.rendering.atomicForms,
        "assignment",
      ),
      plannedClamp: CodeGenWalker.plannedAt(
        this.filePlan.compoundClamps,
        site,
        this.rendering.compoundClamps,
        "assignment",
      ),
      plannedSliceSource: this.filePlan.sliceSources.get(site) ?? null,
      plannedStringCapacity: this.filePlan.stringCopies.get(site) ?? null,
      plannedStringParts:
        builtApart && stringForm !== undefined
          ? () => this.renderStringParts(stringForm)
          : null,
      plannedWholeArray: this.filePlan.wholeArrayWrites.get(site) ?? null,
      plannedCompoundCast: this.filePlan.compoundCasts.get(site) ?? null,
      plannedRegisterAccess: this.filePlan.registerAccesses.get(site) ?? null,
      state: this.host.state,
      // Already rendered once, above -- never again.
      generatedValue: () => value,
      generateAssignmentTarget: (target, opCount) =>
        this.generateAssignmentTarget(target, opCount),
      analyzeMemberChainForBitAccess: (target, lastStep) =>
        this.analyzeMemberChainForBitAccess(target, lastStep),
      generateExpression: (expr) => this.renderExpression(expr),
      tryEvaluateConstant: (expr) => this.planner.tryEvaluateConstant(expr),
      foldWrittenValue: (expr) => this.planner.foldWrittenValue(expr),
      expressionType: (expr) => this.planner.directTypeOf(expr),
      integerExpressionType: (expr) => this.planner.integerTypeOf(expr),
      hasFloatingOperand: (expr) => this.planner.hasFloatingLeaf(expr),
      toCOperator: (cnxOp, line) =>
        AssignmentOperatorMapper.toCOperator(cnxOp, line),
    });
    // ADR-065: the classifier and handlers reach 2.3's state through the context
    const assignmentKind = AssignmentClassifier.classify(assignCtx);
    const handler = AssignmentHandlerRegistry.getHandler(assignmentKind);
    return handler(assignCtx);
  }

  /**
   * Build dependencies for SimpleIdentifierResolver
   */
  private _buildSimpleIdentifierDeps(): ISimpleIdentifierDeps {
    return {
      getParameter: (name: string, at: ISourcePosition) =>
        this.host.state.parameterBindingAt(name, at),
      // A target with no postfix op is the parameter's whole value, written
      // as the read side reads it (#1760 second review: `p = (*q);`)
      resolveParameter: (parameter: IBoundParameter) =>
        memberAccessChain.wholeParamValue(
          ParameterDereferenceResolver.resolve(
            parameter,
            this._buildParameterDereferenceDeps(),
          ),
          parameter.info,
          this.host.state.cppMode,
        ),
      resolveBareIdentifier: (name: string, at: ISourcePosition) =>
        TypeValidator.resolveBareIdentifier(
          name,
          at,
          (n: string) => this.host.isKnownStruct(n),
          this.host.state,
        ),
    };
  }

  /**
   * Extract postfix operations from parser contexts
   */
  private _extractPostfixOperations(
    postfixOps: readonly TPostfixOpSyntax[],
    rootOp: TPostfixOpSyntax | null,
  ): IPostfixOperation[] {
    return postfixOps.map((op) => {
      const expressions = op.kind === "subscript" ? op.indexes : [];
      return {
        memberName: op.kind === "member" ? op.name : null,
        appliesToRoot: op === rootOp,
        indexCount: expressions.length,
        // #1652: the nodes stay closed over HERE, in the walk. What crosses
        // into the render layer is a count and a function returning strings.
        renderIndexes: () =>
          expressions.map((expr) => this.renderExpression(expr)),
      };
    });
  }

  /**
   * Build dependencies for PostfixChainBuilder
   */
  private _buildPostfixChainDeps(
    firstId: string,
    rootParameter: TParameterInfo | undefined,
    hasGlobal: boolean,
    hasThis: boolean,
    rootTypeInfo: TTypeInfo | undefined,
  ): IPostfixChainDeps {
    // How the root is held: the one answer the read path reads too (#1760
    // review: a local #895 made a pointer took `.`)
    // #1290 review: the root's parameter is the caller's, bound by the name
    // as written -- `firstId` is the C name, which ADR-057 may have moved
    const holding = memberAccessChain.rootHolding(
      rootParameter,
      rootTypeInfo,
      this.host,
    );
    const isCppAccess = hasGlobal && this.host.isCppScopeSymbol(firstId);
    const separatorDeps = this._buildMemberSeparatorDeps();

    const separatorCtx: ISeparatorContext =
      MemberSeparatorResolver.buildContext(
        {
          firstId,
          hasGlobal,
          hasThis,
          currentScopePath: this.host.state.currentScopePath,
          holding,
          isCppAccess,
        },
        separatorDeps,
      );

    return {
      getSeparator: (isFirstOp: boolean, identifierChain: string[]) =>
        MemberSeparatorResolver.getSeparator(
          isFirstOp,
          identifierChain,
          separatorCtx,
          separatorDeps,
        ),
    };
  }

  /**
   * What a `return` carries. `node.expression()` was asked twice here -- once
   * as a predicate and once with `!` -- which is what a union states once.
   */
  private planReturn(
    statement: Extract<TStatement, { kind: "return" }>,
  ): TPlannedReturn {
    const value = statement.value;
    if (!value) {
      return { kind: "void" };
    }
    return {
      kind: "value",
      render: () => this.renderExpression(value),
    };
  }

  /**
   * An `if`, with the strlen-cache counts it needs before anything renders.
   *
   * The counts are eager because counting walks the tree and emits nothing.
   * The three branches are thunks because `generateIf` has to flush the
   * condition's pending temps before either branch renders (Issue #250).
   *
   * The counts cover the condition and the THEN block only, never the else.
   * That asymmetry is preserved rather than tidied: the cache declaration is
   * emitted in front of the whole statement, but widening the counts would
   * cache a length read only on a path the declaration's own value may not
   * describe.
   */
  private planIf(statement: Extract<TStatement, { kind: "if" }>): IPlannedIf {
    const { condition, whenTrue, whenFalse } = statement;
    const lengthCounts = StringLengthCounter.countExpression(
      condition,
      this.host.state,
    );
    if (whenTrue.kind === "block") {
      StringLengthCounter.countBlockInto(
        whenTrue,
        lengthCounts,
        this.host.state,
      );
    }
    const at = { line: statement.span.line, column: statement.span.column };
    return {
      lengthCounts,
      renderLengthOperand: (name) =>
        this._resolveIdentifierExpression(name, at),
      renderCondition: () => this.renderExpression(condition),
      renderThen: () => this.renderStatement(whenTrue),
      renderElse: whenFalse ? () => this.renderStatement(whenFalse) : null,
    };
  }

  /** A `while`: condition then body. */
  private planWhile(
    statement: Extract<TStatement, { kind: "while" }>,
  ): IPlannedLoop {
    return {
      renderCondition: () => this.renderExpression(statement.condition),
      renderBody: () => this.renderStatement(statement.body),
    };
  }

  /**
   * A `do ... while` (ADR-027): the same two parts as `while`, and the
   * generator calls them in the other order. Note the body is a BLOCK here and
   * a statement there -- which is exactly the difference a thunk hides.
   */
  private planDoWhile(
    statement: Extract<TStatement, { kind: "doWhile" }>,
  ): IPlannedLoop {
    return {
      renderCondition: () => this.renderExpression(statement.condition),
      renderBody: () => this.renderBlock(statement.body),
    };
  }

  /** An ADR-068 `forever`: a body and nothing else. */
  private planForever(
    statement: Extract<TStatement, { kind: "forever" }>,
  ): IPlannedForever {
    return { renderBody: () => this.renderBlock(statement.body) };
  }

  /**
   * A variable declared in a `for` header.
   *
   * `typeName` is eager; the initializer is a thunk, so it renders where the
   * generator writes it, after the type. It is never an array or a string:
   * 1.2 rejects both here (E0917, #1823). The emitted name is 1.4's (#1934, ADR-057),
   * bound at the declaration itself.
   */
  private planForVarDecl(decl: IVariableDeclarationSyntax): IPlannedForVarDecl {
    invariant(
      decl.dimensions.length === 0 &&
        decl.type.kind !== "array" &&
        decl.type.kind !== "string",
      "1.2 rejects an array or a string declared in a for header (E0917)",
    );
    // Issue #696: Use shared modifier builder
    const modifiers = VariableModifierBuilder.buildSimple(decl.modifiers);
    // #1484: a `for` init declares a variable like any other, including one
    // typed by an ADR-029 function-as-type.
    const typeName = this.renderDeclaredType(decl.type);
    const initializer = decl.initializer;
    return {
      const: modifiers.const,
      atomic: modifiers.atomic,
      volatile: modifiers.volatile,
      typeName,
      emittedName: this.host.state.ownEmittedName(decl),
      nameMoveComments: this.nameMoveComments(decl),
      renderInitializer: initializer
        ? () => this.renderExpression(initializer)
        : null,
    };
  }

  /**
   * An assignment in a `for` header -- the init form and the update form
   * alike.
   *
   * #1647: rendered by `generateAssignment`, the statement path itself, so
   * the header is classified and handled exactly as a statement is: ADR-044's
   * clamp and MISRA C:2012 Rule 7.2's suffix included. Only the terminator
   * differs, since a header clause is an expression, not a statement.
   */
  private planForAssignment(site: IAssignmentSyntax): IPlannedForAssignment {
    return {
      render: () => {
        const form = ForHeaderAssignment.rejectedForm(
          site,
          this.host.state.typingContext(),
        );
        invariant(form === null, `E0715 rejects this in a for header: ${form}`);
        const code = this.generateAssignment(site);
        invariant(
          code.endsWith(";"),
          `a for-header assignment renders as one statement, not '${code}'`,
        );
        return code.slice(0, -1);
      },
    };
  }

  /** A `for` header and its body. */
  private planFor(
    statement: Extract<TStatement, { kind: "for" }>,
  ): IPlannedFor {
    const { condition, update } = statement;
    return {
      init: this.planForInit(statement.init),
      renderCondition: () => {
        invariant(
          condition !== null,
          "a for header states its condition -- E0707 rejects an empty one in pass 2.1, before this runs",
        );
        return this.renderExpression(condition);
      },
      update: update ? this.planForAssignment(update) : null,
      renderBody: () => this.renderStatement(statement.body),
    };
  }

  /** Which of the two `for` init forms this header uses, if either. */
  private planForInit(
    init: Extract<TStatement, { kind: "for" }>["init"],
  ): IPlannedFor["init"] {
    if (init?.kind === "variableDeclaration") {
      return { kind: "varDecl", plan: this.planForVarDecl(init) };
    }
    if (init?.kind === "assignment") {
      return { kind: "assignment", plan: this.planForAssignment(init) };
    }
    return null;
  }

  /**
   * An ADR-025 switch statement, decided (#1445).
   *
   * The subject is rendered here, and its enum type asked for, in that order
   * -- which is the node-walking order, and both can register effects.
   *
   * A case label's SIX alternatives are asked in the grammar's order, first
   * match wins, exactly as the generator asked them. Each body stays a thunk:
   * rendering a statement registers effects, and the generator decides how
   * deep each line indents.
   */
  private planSwitch(statement: TSwitchStatement): IPlannedSwitch {
    const subject = this.renderExpression(statement.subject);
    const subjectEnumType = this.enumTypeOf(statement.subject) ?? undefined;
    const defaultCase = statement.defaultCase;
    return {
      subject,
      subjectEnumType,
      cases: statement.cases.map((switchCase) => ({
        labels: switchCase.labels.map((label) => this.planCaseLabel(label)),
        renderBody: () => this.renderStatements(switchCase.body),
      })),
      renderDefaultBody: defaultCase
        ? () => this.renderStatements(defaultCase.body)
        : null,
    };
  }

  /**
   * Which of `caseLabel`'s six alternatives matched, and what it carries.
   *
   * The order is the grammar's and the generator's: qualified type,
   * identifier, integer, hex, binary, char. A char literal is its own arm
   * because it is the one that ignores a leading minus.
   */
  private planCaseLabel(label: TCaseLabelSyntax): TPlannedCaseLabel {
    switch (label.kind) {
      case "qualified": {
        const typing = this.host.state.typingContext();
        const length = LengthProperty.labelName(label);
        if (length !== null) {
          const folded = typing.program.constantValueOf(
            typing.sourceFile,
            length,
          );
          // E0717 (2.1) rejected a length label that does not fold
          invariant(
            folded.kind === "value",
            `case label '${label.path.join(".")}' reached codegen unfolded`,
          );
          return {
            kind: "numeric",
            text: folded.value.toString(),
            negative: false,
          };
        }
        const head = ScopeUtils.typeHeadCName(
          label.root,
          label.path[0],
          this.host.state.currentScopePath,
          (name) =>
            typing.program.isScopeTypeVisibleFrom(typing.sourceFile, name),
        );
        return { kind: "qualified", parts: [head, ...label.path.slice(1)] };
      }
      case "identifier": {
        const resolved = this.resolveCaseConst(
          label.root,
          label.name,
          label.span,
        );
        if (label.root === null) {
          return { kind: "identifier", name: label.name, resolved };
        }
        // E0427, E0431 and E0717 (2.1) rejected a rooted label that binds no
        // constant
        invariant(
          resolved !== null,
          `case label '${label.root}.${label.name}' reached codegen unbound`,
        );
        return { kind: "rooted", code: resolved };
      }
      case "integer":
      case "hex":
        return { kind: "numeric", text: label.text, negative: label.negative };
      case "binary":
        return { kind: "binary", text: label.text, negative: false };
      case "char":
        return { kind: "char", text: label.text };
      case "missing":
        return { kind: "none" };
    }
  }

  /**
   * A const named as a case label (#1739), in any of ADR-016's spellings
   * (#1629). C switches only on an integer constant expression, which no
   * const object is, so any const with a value is written as that value.
   *
   * The value comes from the binding, whatever the spelling: `LIMIT` and
   * `global.LIMIT` naming one file-scope const fold alike. The spelling only
   * decides the name of a label that does not fold -- a bare one the C name
   * every bare identifier emits under, or null for an enum member the
   * generator qualifies; a rooted one the declaration its root binds.
   */
  private resolveCaseConst(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): string | null {
    const binding = this.host.state.bindingAt(root, name, at);
    const declared = CodeGenWalker.boundCName(binding);
    const constant =
      declared === null
        ? null
        : PrivateConstValue.constant(
            this.host.getState(),
            this.planner.transpileState,
            declared,
          );
    if (constant !== null) {
      // ADR-025's const label, recorded where it is written as its value so
      // a codegen-only fixture occupies its matrix cell (#1241)
      AdrProvenance.record("025", at.line);
      this.host.applyEffects(constant.effects);
      return constant.code;
    }
    // `global.HDR_K`: a header's macro binds nothing, and is written as its
    // name, as the value position writes it
    if (root === "global") return declared ?? name;
    if (root !== null) return declared;
    return TypeValidator.resolveBoundIdentifier(
      name,
      binding,
      at,
      (typeName: string) => this.host.isKnownStruct(typeName),
      this.host.state,
    );
  }

  /** The C name of the declaration a binding names, when it has one */
  private static boundCName(binding: TValueBinding | null): string | null {
    switch (binding?.kind) {
      case "variable":
      case "function":
        return binding.symbol.fullyQualifiedCName;
      case "foreign":
        return binding.name;
      default:
        return null;
    }
  }

  /** A resolved name, or -- for a private const -- its value (#741, #1739) */
  private constOrName(resolved: string): string {
    const inlined = PrivateConstValue.inlined(
      this.host.getState(),
      this.planner.transpileState,
      resolved,
    );
    if (inlined === null) return resolved;
    this.host.applyEffects(inlined.effects);
    return inlined.code;
  }

  /** Every statement of a block, rendered in order. */
  private renderStatements(block: TBlockSyntax): readonly string[] {
    return block.statements.map((statement) => this.renderStatement(statement));
  }

  /**
   * Resolve 'this' keyword to scope marker
   * ADR-016: 'this' returns a marker that postfixOps will transform to Scope_member
   */
  private _resolveThisKeyword(): string {
    // #1322: the `!currentScopePath` guard that stood here is now E0431 in 2.1,
    // with a real position. It threw the same string from four places in
    // `output/`, and every one reached the user as `1:0`.
    return "__THIS_SCOPE__";
  }

  /**
   * Resolve an identifier in a primary expression context
   * Handles: main args, parameters, local variables, scope resolution, enum members
   */
  private _resolveIdentifierExpression(
    id: string,
    at: ISourcePosition,
  ): string {
    // Special case: main function's args parameter -> argv
    if (this.host.state.mainArgsName && id === this.host.state.mainArgsName) {
      return "argv";
    }

    // ADR-006: Check if it's a function parameter
    const parameter = this.host.state.parameterBindingAt(id, at);
    if (parameter) {
      return ParameterDereferenceResolver.resolve(
        parameter,
        this._buildParameterDereferenceDeps(),
      );
    }

    // ADR-016: Resolve bare identifier using local -> scope -> global priority
    const resolved = TypeValidator.resolveBareIdentifier(
      id,
      at,
      (name: string) => this.host.isKnownStruct(name),
      this.host.state,
    );
    if (resolved !== null) {
      return this.constOrName(resolved);
    }

    // Issue #452: Check if identifier is an unqualified enum member reference
    const enumResolved = this._resolveUnqualifiedEnumMember(id);
    if (enumResolved !== null) {
      return enumResolved;
    }

    return id;
  }

  /**
   * Resolve an unqualified identifier as an enum member
   * Issue #452: Uses expectedType for type-aware resolution, falls back to searching all enums
   * @returns The qualified enum member access, or null if not an enum member
   */
  private _resolveUnqualifiedEnumMember(id: string): string | null {
    // Issue #872: MISRA contexts set expectedType for U suffix but suppress enum resolution
    // Bare enum resolution in function args was never allowed and requires ADR approval to change
    if (this.host.state.suppressBareEnumResolution) {
      // Fall through to error handling below - don't resolve bare enums
    } else if (
      // Type-aware resolution: check only the expected enum type
      this.host.state.expectedType &&
      this.host.state.symbols!.knownEnums.has(this.host.state.expectedType)
    ) {
      const members = this.host.state.symbols!.enumMembers.get(
        this.host.state.expectedType,
      );
      if (members?.has(id)) {
        return QualifiedCName.fromSourceName([
          this.host.state.expectedType,
          id,
        ]);
      }
      // Not a member of the expected enum: falls through to the assertion
      // below. Before #1322 this returned null and the bare name was emitted
      // into C when another enum declared it.
    }

    // #1322: a bare member with no enum naming its position is E0424 in pass
    // 2.1 (ADR-017). Reaching here with a match means the emission would put a
    // bare `RED` into C, so it is asserted rather than guessed at.
    const matchingEnums: string[] = [];
    for (const [enumName, members] of this.host.state.symbols!.enumMembers) {
      if (members.has(id)) {
        matchingEnums.push(enumName);
      }
    }
    invariant(
      matchingEnums.length === 0,
      `a bare enum member is resolved by its position -- E0424 rejects '${id}' ` +
        `(declared by ${matchingEnums.join(", ")}) here in pass 2.1, before this runs`,
    );
    return null;
  }

  /**
   * Generate a literal expression with C++ mode handling
   * Uses extracted literal generator
   */
  private _generateLiteralExpression(
    text: string,
    narrowing: TPlannedNarrowing | null,
  ): string {
    const result = generateLiteral(
      text,
      this.host.getState(),
      this.planner.transpileState,
      narrowing,
    );
    this.host.applyEffects(result.effects);

    // Issue #304/#644: Transform NULL → nullptr in C++ mode
    if (result.code === "NULL") {
      return CppModeHelper.nullLiteral(this.host.state);
    }

    return result.code;
  }

  /**
   * ADR-017: Generate cast expression
   * C mode:   (u8)State.IDLE -> (uint8_t)State_IDLE
   * C++ mode: (u8)State.IDLE -> static_cast<uint8_t>(State_IDLE)
   * Issue #267: Use C++ casts when cppMode is enabled
   */
  /**
   * What rendering a cast needs. The render order is fixed HERE, not in the
   * generator: the target type is rendered before the operand because
   * `generateType` may register an include and rendering the operand may
   * allocate a `cnx_tmp<N>`, and swapping them renames temps in emitted C.
   *
   * #1322: ADR-024's cast rules -- narrowing and sign change -- are E0869 in
   * pass 2.1. They stood here as two throws that reached the user as `1:0`.
   */
  private planCast(expr: TExpressionOf<"cast">): IPlannedCast {
    const planned = this.filePlan.casts.get(expr);
    invariant(
      planned !== undefined,
      `2.2 planned every cast 2.3 renders (got line ${expr.span.line})`,
    );
    this.rendering.casts.add(expr);
    const targetType = this.renderType(expr.type);
    return {
      targetType,
      targetTypeName: expr.type.text,
      operandCode: this.renderUnary(expr.operand),
      ...planned,
    };
  }

  /**
   * Generate temp variable declarations for string lengths that are accessed 2+ times.
   * Returns the declarations as a string and populates the lengthCache.
   */
  /**
   * Generate all needed overflow helper functions
   * Delegates to HelperGenerator
   *
   * Takes the ops from the PLAN, not from `CodeGenState`. Reading the state
   * here while the plan also carried them was the fact in two places with the
   * renderer using the other one -- the duplicate path this pass exists to
   * remove, reintroduced by the pass itself. The panic-or-clamp flavor comes
   * off the plan too (#1997): the block that decides it carries its cost.
   */
  private generateOverflowHelpers(plan: IEmissionPlan): string[] {
    return helperGenerateOverflowHelpers(
      new Set(plan.clampOps),
      plan.panicOverflowHelpers !== null,
    );
  }

  /**
   * Format leading comments with current indentation
   */
  private formatLeadingComments(comments: readonly IComment[]): string[] {
    const indent = FormatUtils.indent(this.host.state.indentLevel);
    return this.commentFormatter.formatLeadingComments([...comments], indent);
  }

  /**
   * ADR-051: Generate safe division helper functions for used integer types only
   * Delegates to HelperGenerator
   */
  private generateSafeDivHelpers(safeDivOps: readonly string[]): string[] {
    return helperGenerateSafeDivHelpers(new Set(safeDivOps));
  }
}

export default CodeGenWalker;
