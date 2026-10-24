import type TStringValueForm from "../../../types/TStringValueForm";
import type IPlannedArgument from "./IPlannedArgument";
import type IPlannedFunctionParameter from "./IPlannedFunctionParameter";
import type IParameterSyntax from "../../../types/syntax/IParameterSyntax";
import type IPlannedFloatBits from "./IPlannedFloatBits";
import type IEmissionPlan from "../../../types/IEmissionPlan";
import type TPlannedNarrowing from "./TPlannedNarrowing";
import type IPlannedAtomic from "../../types/IPlannedAtomic";
import type IBitmapFieldTarget from "../../../types/IBitmapFieldTarget";
import type IAssignmentSyntax from "../../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type IVariableDeclarationSyntax from "../../../types/syntax/IVariableDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";
import type TExpressionOf from "../../../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";
import type IPlannedCast from "./IPlannedCast";
import type IPlannedClamp from "./IPlannedClamp";
import type IPlannedSliceSource from "./IPlannedSliceSource";
import type IPlannedWholeArrayWrite from "./IPlannedWholeArrayWrite";
import type IPlannedExpectedType from "./IPlannedExpectedType";
import type IPlannedStaticValue from "./IPlannedStaticValue";
import type IPlannedType from "./IPlannedType";
import type TNegativeMinimum from "./TNegativeMinimum";
import type TStructInitializerForm from "./TStructInitializerForm";
import type IFileSetup from "../../types/IFileSetup";
import type IHeaderSetup from "../../types/IHeaderSetup";

/**
 * 2.2 Plan's artifact for one file: every decision 2.3 Render reads, made
 * before any of the file is written. Render takes this and nothing else from
 * Plan (#1991).
 */
interface IFilePlan {
  /** 1.2's plain data for the file, which Render writes out */
  readonly program: IProgramSyntax;

  /** The file's own header, included first for its public interface, or null (#1164) */
  readonly selfInclude: string | null;

  /** Each of the file's own `#include`s as the C writes it */
  readonly includeDirectives: readonly string[];

  /** Which private scope consts are inlined, not declared (#282) */
  readonly inlinedConsts: ReadonlySet<TDeclarationSyntax>;
  /** ADR-015 / #1610: each uninitialized scalar whose C type is a pointer, at any site: its zero is the null pointer */
  readonly nullInitialized: ReadonlySet<IVariableDeclarationSyntax>;
  /** #1735: each static-storage value written as its folded value, as it is spelled */
  readonly staticValues: ReadonlyMap<TExpression, IPlannedStaticValue>;
  /** #1735: the declarations a name was folded in, annotated where they are written */
  readonly staticValueNotes: ReadonlySet<TDeclarationSyntax>;

  /** The plan for each type the file writes */
  readonly types: ReadonlyMap<TTypeSyntax, IPlannedType>;

  /** How each call argument is passed and written */
  readonly arguments: ReadonlyMap<TExpression, IPlannedArgument>;

  /** Each function parameter of the file, as its function's context reads it */
  readonly functionParameters: ReadonlyMap<
    IParameterSyntax,
    IPlannedFunctionParameter
  >;

  /** For each written `=`/`!=` comparison, whether it compares strings (ADR-045) */
  readonly comparisons: ReadonlyMap<TExpression, boolean>;

  /** For each written cast, the type it converts from and whether and how it saturates (ADR-024) */
  readonly casts: ReadonlyMap<
    TExpressionOf<"cast">,
    Pick<IPlannedCast, "operandType" | "clampForm">
  >;

  /** Each written `-` literal 2.3 spells as its type's minimum macro (MISRA 10.3) */
  readonly negativeMinimums: ReadonlyMap<
    TExpressionOf<"unary">,
    TNegativeMinimum
  >;
  /** MISRA 10.1: each written `~` of an unsigned operand, and the C type it is cast back to */
  readonly complementCasts: ReadonlyMap<TExpressionOf<"unary">, string>;
  /** ADR-007: each written range read of a float's bits, and its union */
  readonly floatBitReads: ReadonlyMap<TPostfixOpSyntax, IPlannedFloatBits>;
  /** ADR-007: each assignment target, and the union it writes a float's bits through (null: none) */
  readonly floatBitWrites: ReadonlyMap<TExpression, IPlannedFloatBits | null>;
  /** ADR-034: each assignment, and the bitmap field it writes (null: it writes none) */
  readonly bitmapFieldWrites: ReadonlyMap<
    IAssignmentSyntax,
    IBitmapFieldTarget | null
  >;
  /** ADR-049: each assignment, and how it is written atomically (null: it is not atomic) */
  readonly atomicForms: ReadonlyMap<IAssignmentSyntax, IPlannedAtomic | null>;
  /** ADR-051: each written `safe_div`/`safe_mod` call, and the helper it is written as */
  readonly safeDivisions: ReadonlyMap<TExpression, string>;
  /** ADR-044: each written `+ - *` chain, and the clamp helpers it calls (null: none) */
  readonly clampChains: ReadonlyMap<TExpression, IPlannedClamp | null>;
  /** ADR-044: each assignment, and the clamp helper it calls (null: none) */
  readonly compoundClamps: ReadonlyMap<
    IAssignmentSyntax,
    { operation: string; cnxType: string } | null
  >;
  /** #1081: how each slice write reads its source */
  readonly sliceSources: ReadonlyMap<IAssignmentSyntax, IPlannedSliceSource>;
  /** #1731: each assignment that writes one whole `string<N>`, and its capacity */
  readonly stringCopies: ReadonlyMap<IAssignmentSyntax, number>;
  /**
   * ADR-045: the form of each value written whole into a `string<N>` -- a
   * function's string initializer, and the value of each assignment in
   * `stringCopies` -- as `StringValueForm` decides it (#1257)
   */
  readonly stringValueForms: ReadonlyMap<TExpression, TStringValueForm>;
  /**
   * #2240: each substring part's length, keyed by its chain, folded once
   * here: E0922 has made every one a compile-time constant
   */
  readonly substringCounts: ReadonlyMap<TExpression, number>;
  /**
   * #2236: each struct initializer field value copied into its `string<N>`
   * field, by the field's capacity; its form is in `stringValueForms`
   */
  readonly stringFields: ReadonlyMap<TExpression, number>;
  /** #2207: whether the file copies a string, through `cnx_string_copy` */
  readonly stringCopyHelper: boolean;
  /**
   * #2110 (ADR-035): how many slots each fill-all fills, at every level of a
   * whole array's list. A fill whose size does not fold is absent.
   */
  readonly fillSizes: ReadonlyMap<TExpressionOf<"arrayInitializer">, number>;
  /** #1782: each assignment that writes a whole array, and its copy's shape */
  readonly wholeArrayWrites: ReadonlyMap<
    IAssignmentSyntax,
    IPlannedWholeArrayWrite
  >;

  /**
   * MISRA 10.3 (#845): the C type a compound write to a narrow variable is
   * cast back to, for each write that is cast
   */
  readonly compoundCasts: ReadonlyMap<IAssignmentSyntax, string>;

  /**
   * ADR-004: the `uintN_t` each byte-aligned write to a write-only register
   * member is written through, for each write that is one memory access
   */
  readonly registerAccesses: ReadonlyMap<IAssignmentSyntax, string>;
  /** ADR-044: every `<operation>_<cnxType>` helper the file calls */
  readonly clampOps: ReadonlySet<string>;
  /** #1927: the C types the file's text uses, which decide `<stdint.h>`/`<stdbool.h>` */
  readonly cTypes: ReadonlySet<string>;
  /** The type each value is rendered against; a value not listed has none */
  readonly expectedTypes: ReadonlyMap<TExpression, IPlannedExpectedType>;
  /**
   * MISRA 10.3: each written postfix or literal value, and the promoted
   * reads in it 2.3 casts or compares, by the index of its typer step (a
   * character literal is step 0) -- empty when it has none
   */
  readonly narrowings: ReadonlyMap<
    TExpression,
    ReadonlyMap<number, TPlannedNarrowing>
  >;
  /** ADR-014: how each written struct initializer is written */
  readonly structInitializers: ReadonlyMap<
    TExpressionOf<"structInitializer">,
    TStructInitializerForm
  >;
  /**
   * #2332: each `&&`/`||` operand after the first that holds a struct
   * initializer built before its statement, so it is built only when the
   * operand runs
   */
  readonly lazyOperands: ReadonlySet<TExpression>;
  /** #2332: the same for `?:`, by the C type of the value each branch sets */
  readonly lazyTernaries: ReadonlyMap<TExpressionOf<"ternary">, string>;

  /** What the file's text costs: its system includes, helpers and requirements */
  readonly emission: IEmissionPlan;
  /** What 2.2 set up for the file, which 2.3 starts from instead of 2.2's leftovers */
  readonly setup: IFileSetup;
  /** What 2.3 captures the file's header from */
  readonly header: IHeaderSetup;
}

export default IFilePlan;
