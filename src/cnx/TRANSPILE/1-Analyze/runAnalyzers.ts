/**
 * Pass 2.1: every rejection cnx makes about a parsed program.
 *
 * The steps run in the order declared below, and the loop STOPS at the first
 * non-advisory step that finds anything -- so a step's position is a decision
 * about which diagnostic a program with several faults is shown, not a detail.
 * Each entry carries a `label` saying why it sits where it does.
 *
 * 1.2's form errors are not steps here: 1.2 rejects the file and the run stops
 * before 1.4, so no file reaches this table (docs/architecture/README.md, #1991).
 *
 * The header used to say "All 14 analyzers (plus comment validation)", a count
 * carried verbatim from the pre-#1322 path and wrong by a factor of three by
 * the time it moved here. It is deliberately not replaced with a new number:
 * a literal in a comment beside the table it describes is the doc-rot this
 * card exists to remove, and `docs/error-codes.md` plus
 * `docs/architecture/throw-classification.md` carry the counts that ARE
 * gated.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IComment from "../../types/IComment";
import CodedErrorText from "../../utils/CodedErrorText";
import CppClassInitializerAnalyzer from "./CppClassInitializerAnalyzer";
import DefineDirectiveAnalyzer from "./DefineDirectiveAnalyzer";
import ParameterNamingAnalyzer from "./ParameterNamingAnalyzer";
import StructFieldAnalyzer from "./StructFieldAnalyzer";
import TypeDeclarationAnalyzer from "./TypeDeclarationAnalyzer";
import InitializationAnalyzer from "./InitializationAnalyzer";
import FunctionCallAnalyzer from "./FunctionCallAnalyzer";
import UndeclaredTypeAnalyzer from "./UndeclaredTypeAnalyzer";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import NullCheckAnalyzer from "./NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "./DivisionByZeroAnalyzer";
import ArrayIndexTypeAnalyzer from "./ArrayIndexTypeAnalyzer";
import ShiftAnalyzer from "./ShiftAnalyzer";
import OperatorOperandAnalyzer from "./OperatorOperandAnalyzer";
import MixedTypeCategoryAnalyzer from "./MixedTypeCategoryAnalyzer";
import ReturnPathAnalyzer from "./ReturnPathAnalyzer";
import ReturnValueUseAnalyzer from "./ReturnValueUseAnalyzer";
import CompoundAssignmentAnalyzer from "./CompoundAssignmentAnalyzer";
import ConstructorArgumentAnalyzer from "./ConstructorArgumentAnalyzer";
import CriticalSectionAnalyzer from "./CriticalSectionAnalyzer";
import ResolvedTarget from "../../utils/ResolvedTarget";
import EnumTypeSafetyAnalyzer from "./EnumTypeSafetyAnalyzer";
import ScopeAccessAnalyzer from "./ScopeAccessAnalyzer";
import RegisterAccessAnalyzer from "./RegisterAccessAnalyzer";
import BracedBodyAnalyzer from "./BracedBodyAnalyzer";
import RedeclarationAnalyzer from "./RedeclarationAnalyzer";
import BareEnumMemberAnalyzer from "./BareEnumMemberAnalyzer";
import ArrayDeclarationAnalyzer from "./ArrayDeclarationAnalyzer";
import ConstantDimensionAnalyzer from "./ConstantDimensionAnalyzer";
import StaticInitializerAnalyzer from "./StaticInitializerAnalyzer";
import ArrayIndexBoundsAnalyzer from "./ArrayIndexBoundsAnalyzer";
import CallbackAssignmentAnalyzer from "./CallbackAssignmentAnalyzer";
import BitmapAccessAnalyzer from "./BitmapAccessAnalyzer";
import SafeDivisionAnalyzer from "./SafeDivisionAnalyzer";
import CPointerArgumentAnalyzer from "./CPointerArgumentAnalyzer";
import BitAccessAnalyzer from "./BitAccessAnalyzer";
import DeclarationModifierAnalyzer from "./DeclarationModifierAnalyzer";
import SizeofAnalyzer from "./SizeofAnalyzer";
import StructLiteralAnalyzer from "./StructLiteralAnalyzer";
import WholeArrayValueAnalyzer from "./WholeArrayValueAnalyzer";
import ConstAssignmentAnalyzer from "./ConstAssignmentAnalyzer";
import type IMutSite from "../../types/IMutSite";
import LoopAnalyzer from "./LoopAnalyzer";
import SliceAssignmentAnalyzer from "./SliceAssignmentAnalyzer";
import ControllingExpressionAnalyzer from "./ControllingExpressionAnalyzer";
import IntegerConversionAnalyzer from "./IntegerConversionAnalyzer";
import ValuePositions from "./helpers/ValuePositions";
import type IFileAnalysis from "./types/IFileAnalysis";
import type IValuePositions from "../../types/IValuePositions";
import LengthPropertyAnalyzer from "./LengthPropertyAnalyzer";
import TypeNameValueAnalyzer from "./TypeNameValueAnalyzer";
import StringDeclarationAnalyzer from "./StringDeclarationAnalyzer";
import SwitchStatementAnalyzer from "./SwitchStatementAnalyzer";
import NestedTernaryAnalyzer from "./NestedTernaryAnalyzer";
import ThisOutsideScopeAnalyzer from "./ThisOutsideScopeAnalyzer";
import CommentExtractor from "./CommentExtractor";
import ITranspileError from "../../types/ITranspileError";
import IncludeDirectiveAnalyzer from "./IncludeDirectiveAnalyzer";
import type IAnalyzerOptions from "./types/IAnalyzerOptions";

/**
 * Generic analyzer error with common fields.
 *
 * Deliberately WIDER than `IBaseAnalysisError`, not a copy of it: `code` is
 * optional and `rule` exists because this must also accept a step whose code is
 * not an `E` number. `helpText` is here for the opposite reason -- it was absent,
 * so every analyzer's suggested fix was silently discarded on the way through
 * (#1306). A field missing from an accepting type drops data without failing.
 */
interface IAnalyzerError {
  line: number;
  column: number;
  message: string;
  code?: string;
  rule?: string;
  helpText?: string;
  severity?: "error" | "warning";
  declaredAt?: IMutSite;
}

/**
 * Convert analyzer errors to ITranspileError format and add to accumulator.
 * Returns true if any errors were added (for early return logic); a warning
 * is reported and stops nothing.
 */
function collectErrors<E extends IAnalyzerError>(
  analyzerErrors: E[],
  target: ITranspileError[],
  formatMessage: (err: E) => string,
): boolean {
  for (const err of analyzerErrors) {
    // #1306: `helpText` was set at 21 analyzer sites and read at none -- it was
    // dropped here, so the "Help" column in docs/error-codes.md documented output
    // that did not exist. Carrying it through moves 92 `.expected.error` files,
    // which is the evidence the advice now reaches a user rather than a cost to
    // route around.
    target.push({
      line: err.line,
      column: err.column,
      message: formatMessage(err),
      severity: err.severity ?? "error",
      helpText: err.helpText,
      ...(err.declaredAt && { declaredAt: err.declaredAt }),
    });
  }
  return analyzerErrors.some((err) => err.severity !== "warning");
}

/**
 * One analysis step.
 *
 * #1399 review: the body was fifteen repetitions of
 * `if (collectErrors(x.analyze(tree), errors, fmt)) return errors;`, which is a
 * table written as control flow -- cognitive complexity 16, over the 15 limit,
 * and growing by one with every analyzer added. The ordering constraints were
 * real but survived only as prose between the blocks; as entries they are data
 * that moves with the step.
 */
interface IAnalyzerStepBase {
  /** Why this step sits here, when its position matters. */
  readonly label: string;
  /** When true, findings are reported and later steps still run. */
  readonly advisory?: boolean;
}

/** An error the default `error[CODE]: message` form can spell. */
type TCodedAnalyzerError = IAnalyzerError & { code: string };

/**
 * #1873: a step with no `format` is spelled `error[CODE]:`, so its errors must
 * have a code. With one step type and `code` optional, a step whose errors had
 * none compiled and printed `error[undefined]:`.
 */
interface ICodedAnalyzerStep extends IAnalyzerStepBase {
  readonly run: () => TCodedAnalyzerError[];
  readonly format?: undefined;
}

/** A step whose errors carry no code spells them itself. */
interface IFormattedAnalyzerStep extends IAnalyzerStepBase {
  readonly run: () => IAnalyzerError[];
  readonly format: (err: IAnalyzerError) => string;
}

type TAnalyzerStep = ICodedAnalyzerStep | IFormattedAnalyzerStep;

/**
 * Run all semantic analyzers on a parsed program.
 *
 * @param parsed - 1.2 Parse's comments (MISRA 3.1/3.2) and its syntax
 * @param options - Optional configuration including external struct info
 * @returns Array of errors (empty if all pass)
 */
function runAnalyzers(
  parsed: {
    readonly comments: readonly IComment[];
    readonly program: IProgramSyntax;
  },
  options: IAnalyzerOptions,
): IFileAnalysis {
  const comments = parsed.comments;
  const errors: ITranspileError[] = [];
  const formatWithCode = (e: TCodedAnalyzerError) =>
    CodedErrorText.of(e.code, e.message, e.severity);

  // #1456: the caller's, always. No fallback to shared state -- see the field.
  const context = options.context;
  // #1991: one walk, shared by every step that types a value by its
  // position, and handed on to 2.2. Walked when the first such step runs, as
  // each step walked it itself before; an earlier step's error stops the run
  // first.
  let walked: IValuePositions | null = null;
  const positions = (): IValuePositions => {
    walked ??= ValuePositions.of(parsed.program, context);
    return walked;
  };

  const steps: readonly TAnalyzerStep[] = [
    {
      // #1322: before anything reads a declaration. A file's directives
      // precede every declaration in the grammar, so a bad one is never a
      // consequence of the code below it -- and reporting the code below it
      // first would tell the author to fix the wrong line. Worse for includes
      // specifically: including the wrong file changes which names exist, so
      // every later step would be answering about a program the author did not
      // write.
      label: "#include targets (ADR-010: headers only, .cnx over .h)",
      run: () =>
        new IncludeDirectiveAnalyzer().analyze(
          parsed.program,
          options.includes,
        ),
    },
    {
      label: "#define shape (ADR-037: flag-only defines)",
      run: () => new DefineDirectiveAnalyzer().analyze(parsed.program),
    },
    {
      // #1322: a C++ class initializer that has nowhere to put its
      // assignments. Reads only the run's mode and the symbol table, both
      // settled before this pass.
      label:
        "C++ class initializers (Issue #517: no statement position at file scope)",
      run: () =>
        new CppClassInitializerAnalyzer(context).analyze(
          parsed.program,
          positions().positions,
        ),
    },
    {
      // #1090: a body's braces decide its scope. An unbraced declaration kept
      // its name in scope after the `if` (#1795), so every later step would
      // answer about scoping the author did not write.
      label: "braced bodies (MISRA C:2012 Rule 15.6, E0716)",
      run: () => new BracedBodyAnalyzer().analyze(parsed.program),
    },
    {
      // #2011: before anything binds a name. With two declarations of one
      // name in one scope, every later step would answer about whichever one
      // it happened to find.
      label: "redeclaration in one scope (#2011, E0425)",
      run: () => new RedeclarationAnalyzer(context).analyze(),
    },
    {
      label: "parameter naming (Issue #227: reserved naming patterns)",
      run: () => new ParameterNamingAnalyzer().analyze(parsed.program),
    },
    {
      label: "struct fields (reserved field names like 'length')",
      run: () => new StructFieldAnalyzer().analyze(parsed.program),
    },
    {
      // ADR-051: a compile-time zero divisor is E0800/E0802 wherever it is
      // written, so before the enum values and the array dimensions that
      // would each report it as a value with no size (E0909, #1268 review)
      label: "division by zero (ADR-051: compile-time detection)",
      run: () => new DivisionByZeroAnalyzer(context).analyze(parsed.program),
    },
    {
      // #1531: before anything reads a bitmap's fields or an enum's values.
      // A declaration whose own shape is wrong is the cause; a later step
      // reading it would report a consequence.
      label:
        "declared type shape (ADR-034 bitmap width E0893, ADR-017 enum values E0894, E0909-E0911)",
      run: () => new TypeDeclarationAnalyzer(context).analyze(),
    },
    {
      label: "initialization (Rust-style use-before-init)",
      run: () => new InitializationAnalyzer(context).analyze(parsed.program),
    },
    {
      // Before the call and essential-type analyses: a type that denotes
      // nothing feeds an unknown type into every later question, so the
      // diagnostics after it would name a consequence rather than the cause.
      label: "undefined type references (#1312)",
      run: () => new UndeclaredTypeAnalyzer(context).analyze(parsed.program),
    },
    {
      // After the type check, so a file whose type is undefined reports the
      // type rather than every use of it.
      label: "undefined value references (#1353)",
      run: () => new UndeclaredValueAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "call analysis (ADR-030: define-before-use)",
      run: () => new FunctionCallAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "NULL checks (ADR-047: C library interop)",
      run: () => new NullCheckAnalyzer().analyze(parsed.program),
    },
    {
      // #1175: before anything that reads a dimension's size -- a slice's
      // bounds (E0858), a count against it, a value's width -- since one with
      // no size is the cause, and those would report a consequence (#1863
      // review). After E0427 and E0800, which own an undeclared bare name and
      // a divisor that is a compile-time zero.
      label:
        "constant array dimensions (ADR-023 no VLAs, ADR-044, E0909/E0910)",
      run: () => new ConstantDimensionAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "array index type (ADR-054: unsigned indexes only)",
      run: () => new ArrayIndexTypeAnalyzer(context).analyze(parsed.program),
    },
    {
      label:
        "shift operands and amounts (MISRA C:2012 Rules 10.1 and 12.2, E0805/E0873)",
      run: () => new ShiftAnalyzer(context).analyze(parsed.program),
    },
    {
      // Before the Rule 10.4 check, so an operand its operator does not take
      // is reported as "not a number" rather than as a category mismatch with
      // whatever it was combined with: E0925 needs one operand's type, E0810
      // two. Owner ruling (#2347): "whichever one can be detected first in
      // the earliest layer". After the array-index and shift checks, so a
      // file with both a float `%` (E0804) and a signed index (E0850) now
      // reports E0850 first (#1191).
      label:
        "operator operand types (MISRA C:2012 Rule 10.1, E0804/E0806/E0807/E0925)",
      run: () => new OperatorOperandAnalyzer(context).analyze(parsed.program),
    },
    {
      label:
        "mixed essential type category (MISRA C:2012 Rule 10.4, ADR-024 / Issue #1091)",
      run: () => new MixedTypeCategoryAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "return paths (ADR-067: non-void must return on all paths)",
      run: () => new ReturnPathAnalyzer().analyze(parsed.program),
    },
    {
      label:
        "return-value use (ADR-070 / MISRA C:2012 Rule 17.7 at source level)",
      run: () => ReturnValueUseAnalyzer.analyze(parsed.program, context),
    },
    // ---------------------------------------------------------------------
    // #1322 relocations: appended as a BLOCK, never inserted among the steps
    // above. The loop breaks at the first non-advisory step that finds
    // anything, so where a step sits decides which diagnostic a file reports
    // when two would fire. Appending is the only placement that CANNOT change
    // what an existing fixture says -- every file that reaches an older
    // analyzer today still reaches it first -- and a fixture that quietly
    // starts reporting a different code is what
    // `diagnostics:manifest:check` calls `code-removed`, which the suite
    // stays green through.
    //
    // Order WITHIN this block is not load-bearing: no fixture triggers two of
    // these rules, so no diagnostic depends on it. A later relocation that
    // needs to preempt a step ABOVE the block states its
    // cause-before-consequence reason at its own entry, as the pairs above do.
    // ---------------------------------------------------------------------
    {
      label: "nested ternary in a condition or branch (ADR-022, E0710)",
      run: () => new NestedTernaryAnalyzer().analyze(parsed.program),
    },
    {
      label:
        "compound assignment needs a whole storage location (ADR-007, E0857)",
      run: () =>
        new CompoundAssignmentAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "C++ constructor arguments must be read-only (ADR-071, #375)",
      run: () =>
        new ConstructorArgumentAnalyzer(context).analyze(parsed.program),
    },
    {
      label:
        "`return` inside a critical section, or one the target cannot mask (ADR-050, E0853, E0916)",
      run: () =>
        new CriticalSectionAnalyzer(
          ResolvedTarget.of(context.program.target()),
        ).analyze(parsed.program),
    },
    {
      label: "`this` outside a scope (ADR-016)",
      run: () => new ThisOutsideScopeAnalyzer().analyze(parsed.program),
    },
    {
      // Before the enum type-safety step: `Color c <- YELLOW` with YELLOW
      // declared by another enum is a bare member in the wrong place, and
      // "did you mean 'Status.YELLOW'" is the useful answer; the type-safety
      // step would call the same line a non-enum value.
      label: "bare enum members (ADR-017, E0424)",
      run: () =>
        new BareEnumMemberAnalyzer(context).analyze(
          parsed.program,
          positions(),
        ),
    },
    {
      label: "enum type safety (ADR-017, E0428/E0434)",
      run: () => new EnumTypeSafetyAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "slice assignment (ADR-007, E0858-E0861)",
      run: () => new SliceAssignmentAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "switch statements (ADR-025, E0711-E0714)",
      run: () => new SwitchStatementAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "controlling expressions (ADR-022, MISRA 14.4/13.5, E0701/E0702)",
      run: () =>
        new ControllingExpressionAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "string declarations (ADR-045, E0864-E0865)",
      run: () =>
        new StringDeclarationAnalyzer(context).analyze(
          parsed.program,
          positions(),
        ),
    },
    {
      label: "length properties (ADR-058, E0867)",
      run: () => new LengthPropertyAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "a type named as a value (ADR-058, E0897)",
      run: () => new TypeNameValueAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "integer conversions (ADR-024, E0868/E0869/E0910)",
      run: () =>
        new IntegerConversionAnalyzer(context).analyze(
          parsed.program,
          positions().positions,
        ),
    },
    {
      label: "scope access (ADR-016, E0435-E0437)",
      run: () => new ScopeAccessAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "register access modifiers (ADR-004, E0870-E0872)",
      run: () => new RegisterAccessAnalyzer(context).analyze(parsed.program),
    },
    {
      // After controlling expressions: the always-true check assumes E0701
      // already guaranteed a comparison, as it did in codegen.
      label:
        "loops and break/continue (ADR-068/ADR-026, E0703/E0705/E0707/E0715)",
      run: () => new LoopAnalyzer(context).analyze(parsed.program),
    },
    {
      label:
        "array initializer element counts (ADR-035, E0866); a header typedef array in a for header (ADR-036, E0917)",
      run: () => new ArrayDeclarationAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "constant array index bounds (ADR-036, E0854)",
      run: () => new ArrayIndexBoundsAnalyzer(context).analyze(parsed.program),
    },
    {
      // Before read-only enforcement: `atomic mut` is E0919 once, not E0899
      // asking for `atomic` to go and then for `mut` (#2155 review 8)
      label: "declaration modifiers (ADR-049, E0889/E0919)",
      run: () => new DeclarationModifierAnalyzer().analyze(parsed.program),
    },
    {
      label: "read-only enforcement (ADR-071, E0900/E0899)",
      run: () => new ConstAssignmentAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "callback typing (ADR-029, E0879/E0880)",
      run: () =>
        new CallbackAssignmentAnalyzer(context).analyze(
          parsed.program,
          positions().positions,
        ),
    },
    {
      label: "whole-array values (ADR-014/ADR-035, E0866)",
      run: () => new WholeArrayValueAnalyzer(context).analyze(positions()),
    },
    {
      label: "struct initializers (ADR-014, E0357/E0358)",
      run: () =>
        new StructLiteralAnalyzer(context).analyze(
          parsed.program,
          positions().positions,
        ),
    },
    {
      label: "bitmap access (ADR-034, E0881-E0883)",
      run: () => new BitmapAccessAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "safe_div/safe_mod call shape (ADR-051, E0884/E0885)",
      run: () => new SafeDivisionAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "C pointer parameter arguments (#1977, E0895)",
      run: () => new CPointerArgumentAnalyzer(context).analyze(parsed.program),
    },
    {
      label: "no sizeof (ADR-023, E0603)",
      run: () => new SizeofAnalyzer().analyze(parsed.program),
    },
    {
      label: "bit indexing depth and scope (ADR-007/036, E0856/E0888)",
      run: () => new BitAccessAnalyzer(context).analyze(parsed.program),
    },
    {
      // #1735: after every rule that owns a cause a value can have no value
      // for -- a shift (E0805), a division (E0800), a dimension's own (E0909)
      // -- so a program is told that cause, once
      label: "static-storage initializers (ADR-044, E0909/E0910)",
      run: () =>
        new StaticInitializerAnalyzer(context).analyze(
          parsed.program,
          positions(),
        ),
    },
    {
      // Last, and does not halt: comment findings are reported alongside
      // whatever else the file produced.
      label: "comment validation (MISRA C:2012 Rules 3.1, 3.2 -- ADR-043)",
      run: () => new CommentExtractor(comments).validate(),
      format: (e) => CodedErrorText.of(`MISRA-${e.rule}`, e.message),
      advisory: true,
    },
  ];

  let halted = false;
  for (const step of steps) {
    const found =
      step.format === undefined
        ? collectErrors(step.run(), errors, formatWithCode)
        : collectErrors(step.run(), errors, step.format);
    // `break`, not an early `return`: both exits hand back the same `errors`
    // array, so returning from inside the loop reads as two exits with one
    // value (S3516) when it is really one exit and a stopping condition. What
    // varies is what `errors` CONTAINS, which no return statement expresses.
    if (found && !step.advisory) {
      halted = true;
      break;
    }
  }

  return { errors, valuePositions: halted ? null : positions() };
}

export default runAnalyzers;
