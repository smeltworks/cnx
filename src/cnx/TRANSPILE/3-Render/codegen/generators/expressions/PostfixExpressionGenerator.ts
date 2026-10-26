/**
 * Postfix Expression Generator (Issue #644)
 *
 * Handles postfix expressions including:
 * - Member access (obj.field)
 * - Array subscripts (arr[i])
 * - Bit access (value[3] or value[0, 8])
 * - Function calls (func())
 * - Property access (.length, .capacity, .size)
 *
 * This generator was extracted from CodeGenerator._generatePostfixExpr
 * to reduce the size and complexity of CodeGenerator.ts.
 */
import type IPlannedFloatBits from "../../../../2-Plan/types/IPlannedFloatBits";
import FloatBitType from "../../../../2-Plan/FloatBitType";
import type TPlannedNarrowing from "../../../../2-Plan/types/TPlannedNarrowing";
import type IChainBase from "../../../../../types/IChainBase";
import type TParameterInfo from "../../../../../types/TParameterInfo";
import type IOperandType from "../../../../../types/IOperandType";
import IGeneratorOutput from "../IGeneratorOutput";
import IPlannedPostfix from "../../types/IPlannedPostfix";
import TPlannedPostfixOp from "../../types/TPlannedPostfixOp";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import accessGenerators from "./AccessExprGenerator";
import generateFunctionCall from "./CallExprGenerator";
import memberAccessChain from "../../memberAccessChain";
import type IRootHolding from "../../types/IRootHolding";
import BitmapAccessHelper from "./BitmapAccessHelper";
import BitRangeHelper from "../../helpers/BitRangeHelper";
import FloatBitHelper from "../../helpers/FloatBitHelper";
import NarrowingCastHelper from "../../../../2-Plan/NarrowingCastHelper";
import BitUtils from "../../../../../utils/BitUtils";
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";
import C_TYPE_WIDTH from "../../../../2-Plan/types/C_TYPE_WIDTH";
import ForeignTypeFacts from "../../../../../utils/ForeignTypeFacts";
import ResolvedTarget from "../../../../../utils/ResolvedTarget";
import LengthProperty from "../../../../../utils/LengthProperty";
import LengthSubject from "../../../../../utils/LengthSubject";
import type ILengthName from "../../../../../utils/types/ILengthName";
import type IChainStep from "../../../../../types/IChainStep";
import TYPE_MAP from "../../../../2-Plan/types/TYPE_MAP";
import type IStructSymbol from "../../../../../types/symbols/IStructSymbol";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import CppNamespaceUtils from "../../../../../utils/CppNamespaceUtils";
import OperandTyper from "../../../../../utils/OperandTyper";
import invariant from "../../../../../utils/invariant";
import QualifiedNameGenerator from "../../../../../utils/QualifiedNameGenerator";
import DeclaredTypeFacts from "../../../../../utils/DeclaredTypeFacts";
import PrivateConstValue from "../../PrivateConstValue";

// ========================================================================
// Tracking State
// ========================================================================

/**
 * Mutable tracking state threaded through the postfix op loop.
 */
interface ITrackingState {
  /**
   * #1668 (C7): what the chain's leading names bind, planned once -- the
   * root, and the variable the leading part reaches. Every declared-type read
   * below is this, not a registry keyed by a name the walk re-derived.
   */
  readonly base: IChainBase;
  result: string;
  isRegisterChain: boolean;
  resolvedIdentifier: string | undefined;
  subscriptDepth: number;
  isGlobalAccess: boolean;
  isCppAccessChain: boolean;
}

/**
 * The C expression that reads ONE bit, narrowed per MISRA 10.3.
 *
 * #1450: written out three times -- for a register access, a primitive int
 * member, and a `bit_single` subscript -- byte-identical each time, and
 * reported by `analyze:duplication` as a three-way clone. The three callers
 * differ only in what they do with `output` afterwards, which is why the
 * expression is what is shared and the assignment is not.
 *
 * Two decisions live here, and both are the reason it is one function:
 * shifting is skipped at index 0 (`0` or the MISRA-suffixed `0U`, since the
 * suffix is applied before this runs), and the `& 1` result is an `int` by C's
 * integer promotions, so a narrower target needs the cast MISRA 10.3 requires.
 * Changing either used to mean finding all three.
 *
 * @param base generated C for the value being read from
 * @param index generated C for the bit index
 */
const singleBitRead = (
  base: string,
  index: string,
  narrowing: TPlannedNarrowing | null,
  orchestrator: IOrchestrator,
): string => {
  const expr =
    index === "0" || index === "0U"
      ? `((${base}) & 1)`
      : `((${base} >> ${index}) & 1)`;
  return NarrowingCastHelper.apply(expr, narrowing, orchestrator.state);
};

/**
 * Initialize tracking state from the primary expression.
 */
const initializeTrackingState = (
  base: IChainBase,
  rootIdentifier: string | undefined,
  result: string,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): ITrackingState => {
  const isRegisterChain = rootIdentifier
    ? input.symbols!.knownRegisters.has(rootIdentifier)
    : false;

  let isCppAccessChain = false;
  if (rootIdentifier && orchestrator.isCppScopeSymbol(rootIdentifier)) {
    isCppAccessChain = true;
  }

  return {
    base,
    result,
    isRegisterChain,
    resolvedIdentifier: rootIdentifier,
    subscriptDepth: 0,
    isGlobalAccess: false,
    isCppAccessChain,
  };
};

/**
 * Context for the postfix expression being processed.
 * Bundles values that don't change during the postfix op loop,
 * except for `effects` which accumulates side effects via push().
 */
interface IPostfixContext {
  rootIdentifier: string | undefined;
  /** #1969: the parameter the root binds to where it is written */
  rootParameter: TParameterInfo | undefined;
  /** How the root is held (`memberAccessChain.rootHolding`) */
  holding: IRootHolding;
  input: IGeneratorInput;
  state: IGeneratorState;
  orchestrator: IOrchestrator;
  effects: TGeneratorEffect[];
}

// ========================================================================
// Main Entry Point
// ========================================================================

/**
 * Generate C code for a postfix expression.
 *
 * A postfix expression consists of a primary expression followed by
 * zero or more postfix operations (member access, subscripts, function calls).
 *
 * @param ctx - The postfix expression context
 * @param input - Generator input (symbols, symbol table, etc.)
 * @param state - Generator state (current scope, parameters, etc.)
 * @param orchestrator - Orchestrator for callbacks into CodeGenerator
 * @returns Generated code and effects
 */
const generatePostfixExpression = (
  plan: IPlannedPostfix,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  const ops = plan.ops;

  // How the root is held -- a struct parameter, or a local #895 made a
  // pointer -- and so whether its members take `->` (the one answer the
  // write path reads too)
  const rootIdentifier = plan.rootIdentifier;
  const holding = memberAccessChain.rootHolding(
    plan.rootParameter,
    rootIdentifier ? plan.base.rootTypeInfo : undefined,
    orchestrator,
  );
  // Issue #1100: Subscripted parameters resolve through the normal primary
  // expression path (ParameterDereferenceResolver), same as any other
  // parameter reference. This is a no-op for array/struct/string params
  // (already pointer-like, so `buf[idx]` is unaffected), and correctly
  // dereferences a scalar parameter that became a pointer because it's
  // modified elsewhere in the function, so bit access (`v[4]`) reads
  // through the pointer instead of pointer-indexing past it.
  const result: string = plan.renderPrimary();

  const tracking = initializeTrackingState(
    plan.base,
    rootIdentifier,
    result,
    input,
    orchestrator,
  );

  const postfixCtx: IPostfixContext = {
    rootIdentifier,
    rootParameter: plan.rootParameter,
    holding,
    input,
    state,
    orchestrator,
    effects,
  };

  for (const op of ops) {
    if (op.kind === "member") {
      handleMemberOp(op, tracking, postfixCtx);
    } else if (op.kind === "subscript") {
      const subscriptResult = generateSubscriptAccess(
        {
          base: tracking.base,
          result: tracking.result,
          subscript: op,
          rootIdentifier,
          resolvedIdentifier: tracking.resolvedIdentifier,
          subscriptDepth: tracking.subscriptDepth,
          isRegisterChain: tracking.isRegisterChain,
        },
        input,
        state,
        orchestrator,
      );

      tracking.result = subscriptResult.result;
      tracking.subscriptDepth =
        subscriptResult.subscriptDepth ?? tracking.subscriptDepth;
    } else {
      // #1508: ADR-010's promise -- a declaration reached through an `#include`
      // is callable exactly where a local one is -- firing, observably, at a
      // position. Recorded at the CALL rather than at the directive: an
      // `#include` is grammatical only before the first declaration, so it sits
      // in no scope, function or variable and the matrix's context axis has
      // nothing to ask it. The use site is enclosed by a declaration like any
      // other expression, which is what makes the cell derivable at all.
      if (orchestrator.state.isCrossFileDeclaration(tracking.result)) {
        AdrProvenance.record("010", op.line);
      }
      const callResult = generateFunctionCall(
        tracking.result,
        // #1445: the plan is built by the orchestrator -- this is the only
        // dispatcher, and keeping the derivation there is what lets the call
        // generator name no parse type.
        op.planArguments(),
        state,
        op.safeDivisionHelper,
      );
      applyAccessEffects(callResult.effects, effects);
      tracking.result = callResult.code;
    }
  }

  // ADR-006: a struct or bitmap parameter used as a whole value is
  // dereferenced where it is held through a pointer; `wholeParamValue` holds
  // the rule and its exceptions (an opaque handle, an array parameter), for
  // the write side too. Issue #937: an argument to a pointer parameter is
  // taken from the identifier by CallExprGenerator instead.
  if (ops.length === 0) {
    return {
      code: memberAccessChain.wholeParamValue(
        result,
        plan.rootParameter,
        orchestrator.isCppMode(),
      ),
      effects,
    };
  }

  return { code: tracking.result, effects };
};

// ========================================================================
// Member Operation Handling
// ========================================================================

/**
 * Handle a member access operation (the `.identifier` part of postfix).
 * Mutates `tracking` in place.
 */
const handleMemberOp = (
  op: Extract<TPlannedPostfixOp, { kind: "member" }>,
  tracking: ITrackingState,
  ctx: IPostfixContext,
): void => {
  const memberName = op.name;
  const step = op.step;
  const isRootOp = op.appliesToRoot;
  // ADR-016: Handle global. prefix
  if (handleGlobalPrefix(memberName, tracking, ctx)) {
    return;
  }

  // Property access (.type_bit_length, .capacity, ...). #1760 review: whether the
  // name reads the property or a field named like it is the typer's, on the
  // step -- so `this.length` naming a scope member (#212) and a struct's
  // `length` field are members, with no special case for either
  const property = step?.property ?? null;
  if (
    property !== null &&
    tryPropertyAccess(
      property,
      step,
      tracking,
      ctx.rootIdentifier,
      ctx.input,
      ctx.state,
      ctx.effects,
    )
  ) {
    return;
  }

  // Handle bitmap field access, scope member access, enum member access, etc.
  const memberResult = generateMemberAccess(
    {
      base: tracking.base,
      result: tracking.result,
      memberName,
      rootIdentifier: ctx.rootIdentifier,
      isRootOp,
      rootParameter: ctx.rootParameter,
      holding: ctx.holding,
      isGlobalAccess: tracking.isGlobalAccess,
      isCppAccessChain: tracking.isCppAccessChain,
      typed: step?.before ?? null,
      narrowing: op.narrowing,
      resolvedIdentifier: tracking.resolvedIdentifier,
      isRegisterChain: tracking.isRegisterChain,
    },
    ctx.input,
    ctx.state,
    ctx.orchestrator,
    ctx.effects,
  );

  tracking.result = memberResult.result;
  // `??`, so a handler CANNOT clear this by returning undefined -- the old
  // value is restored instead. `generateDefaultAccess` used to write
  // `resolvedIdentifier = undefined` here for exactly that effect and never
  // got it; both directions of that write redden 0 of 1248 fixtures. Resetting
  // the identifier mid-chain needs a sentinel the merge can tell from "no
  // opinion", not an undefined.
  tracking.resolvedIdentifier =
    memberResult.resolvedIdentifier ?? tracking.resolvedIdentifier;
  tracking.isRegisterChain =
    memberResult.isRegisterChain ?? tracking.isRegisterChain;
  tracking.isCppAccessChain =
    memberResult.isCppAccessChain ?? tracking.isCppAccessChain;
};

/**
 * Handle `global.X` prefix. Returns true if handled (caller should skip).
 */
const handleGlobalPrefix = (
  memberName: string,
  tracking: ITrackingState,
  ctx: IPostfixContext,
): boolean => {
  if (tracking.result !== "__GLOBAL_PREFIX__") {
    return false;
  }

  tracking.result = memberName;
  tracking.resolvedIdentifier = memberName;
  tracking.isGlobalAccess = true;

  // ADR-057: a local shadowing this global does NOT make it unreachable. The
  // shadowing local is emitted under a distinct C name, so plain `memberName`
  // still denotes the global here.

  if (ctx.orchestrator.isCppScopeSymbol(memberName)) {
    tracking.isCppAccessChain = true;
  }
  if (ctx.input.symbols!.knownRegisters.has(memberName)) {
    tracking.isRegisterChain = true;
  }

  return true;
};

/**
 * A string's capacity as the typer gives it, or null for anything else --
 * what `.capacity` and `.size` read (ADR-045).
 */
const stringCapacityOf = (measured: IOperandType | null): number | null =>
  measured !== null && OperandTyper.isString(measured)
    ? measured.stringCapacity
    : null;

/**
 * Try handling property access (.capacity, .size, .type_bit_length, .type_byte_length,
 * .type_element_count, .value_char_count). Returns true if handled.
 *
 * #1668 review: what a property measures is the typer's type for the value
 * it is taken of -- the property step's `before` -- for a root and a member
 * alike, which is what 2.1's E0867/E0887 decide from too. Render read a
 * root's declared type info and a member's typed step: two answers, so a
 * header `double`'s `.type_bit_length` was 64 as a variable and 32 as a field on
 * a target whose `double` is 32 bits, a header `long` root was an internal
 * error, and a member reached through a subscripted array of structs was
 * measured at the wrong depth.
 *
 * Note: .length was removed in favor of explicit properties (ADR-058).
 */
const tryPropertyAccess = (
  memberName: string,
  step: IChainStep | null,
  tracking: ITrackingState,
  rootIdentifier: string | undefined,
  input: IGeneratorInput,
  state: IGeneratorState,
  effects: TGeneratorEffect[],
): boolean => {
  // #1322: ADR-058's deprecation of `.length` is E0886 in pass 2.1, which
  // rejects the NAME wherever it appears and so needs no subject at all --
  // this site had to resolve one just to name it in the message.
  invariant(
    memberName !== "length",
    "`.length` is deprecated -- E0886 rejects this in pass 2.1, before this runs",
  );

  const measured = step?.before ?? null;
  const ctx: IPropertyContext = {
    measured,
    result: tracking.result,
    rootIdentifier,
    resolvedIdentifier: tracking.resolvedIdentifier,
  };
  const length = LengthProperty.parse(memberName);
  if (length !== null) {
    tracking.result = generateLengthProperty(length, step, ctx, input, state);
    return true;
  }
  let result: string;
  switch (memberName) {
    // ADR-045: string storage
    case "capacity":
    case "size": {
      const capacity = stringCapacityOf(measured);
      const output =
        memberName === "capacity"
          ? accessGenerators.generateCapacityProperty(capacity)
          : accessGenerators.generateSizeProperty(capacity);
      applyAccessEffects(output.effects, effects);
      result = output.code;
      break;
    }
    default:
      return false;
  }
  tracking.result = result;
  return true;
};

// ========================================================================
// ADR-058: Explicit Length Properties
// ========================================================================

/**
 * What a property generator reads: the value measured, and the expression
 * rendered so far.
 */
interface IPropertyContext {
  /** The typer's type for the value the property is taken of */
  measured: IOperandType | null;
  result: string;
  rootIdentifier: string | undefined;
  resolvedIdentifier: string | undefined;
}

/**
 * Get the numeric bit width for a type (internal helper for ADR-058).
 * Returns 0 if type is unknown.
 */
const getNumericBitWidth = (typeName: string, input: IGeneratorInput): number =>
  // #1175: cnx's own widths are the one rule the constant evaluator reads
  // too; a C header type's width, from a table 1.4 may not read, is render's
  LengthProperty.elementBits(typeName, {
    enumBitWidth: (name) => input.symbolTable?.getEnumBitWidth(name) || null,
    enumBits: (name) => {
      const members = input.symbols?.enumMembers?.get(name);
      return members === undefined
        ? null
        : LengthProperty.enumBits(members.values());
    },
    bitmapBitWidth: (name) => input.symbols?.bitmapBitWidth?.get(name) || null,
  }) ??
  C_TYPE_WIDTH[typeName] ??
  0;

/** A cnx struct the measured value's element is; undefined for any other */
const measuredStruct = (
  measured: IOperandType | null,
  input: IGeneratorInput,
): IStructSymbol | undefined => {
  const program = input.program;
  if (measured?.typeName == null || program === null) return undefined;
  return LengthProperty.struct(measured.typeName, (cName) =>
    program.symbolByCName(cName),
  );
};

/** #1975 review: a header struct's field count, as 1.4 folds it */
const measuredHeaderFields = (
  measured: IOperandType | null,
  input: IGeneratorInput,
): number | undefined => {
  const symbols = input.symbolTable;
  if (measured?.typeName == null || symbols === null) return undefined;
  return ForeignTypeFacts.fieldCount(measured.typeName, symbols) ?? undefined;
};

/** The bits one element of the measured value holds; 0 if not known */
const elementBitWidth = (
  measured: IOperandType,
  input: IGeneratorInput,
): number => {
  if (OperandTyper.isString(measured)) {
    // ADR-058: a string's buffer, `.size x 8`
    invariant(
      measured.stringCapacity !== null,
      `E0867 rejects this in pass 2.1 -- Cannot determine .type_bit_length for string with unknown capacity.`,
    );
    return LengthProperty.stringElementBits(measured.stringCapacity);
  }
  // an enum's logical width is its members', not the C int it is stored in
  if (measured.bitWidth !== null && measured.category !== "enum") {
    return measured.bitWidth;
  }
  // #1535: its fields' sizes together, without C padding (ADR-058 q7); a
  // header's struct by the same rule, and a cnx field of one (#1975)
  const program = input.program;
  const headers = input.symbolTable;
  const headerBits =
    headers === null || headers === undefined
      ? undefined
      : ForeignTypeFacts.headerBits(
          headers,
          ResolvedTarget.of(program?.target()),
        );
  const struct = measuredStruct(measured, input);
  if (struct !== undefined && program !== null) {
    const bits = LengthProperty.structBits(
      struct,
      (cName) => program.symbolByCName(cName),
      headerBits,
    );
    invariant(
      bits !== null,
      `E0867 rejects this in pass 2.1 -- Cannot determine the length of struct '${measured.typeName}'.`,
    );
    return bits;
  }
  if (measured.typeName === null) return 0;
  if (headers?.getStructFields(measured.typeName) !== undefined) {
    const bits = headerBits?.(measured.typeName) ?? null;
    invariant(
      bits !== null,
      `E0867 rejects this in pass 2.1 -- Cannot determine the length of header struct '${measured.typeName}'.`,
    );
    return bits;
  }
  return getNumericBitWidth(measured.typeName, input);
};

/**
 * ADR-058 (#1975 review 2): a length property, as `LengthProperty.rule`
 * decides it for the subject -- the one table 2.1 judged it by and 1.4 folds
 * it by.
 */
const generateLengthProperty = (
  name: ILengthName,
  step: IChainStep | null,
  ctx: IPropertyContext,
  input: IGeneratorInput,
  state: IGeneratorState,
): string => {
  const property = `.${name.kind}_${name.unit}`;
  // `args` answers only an element count: argc
  const isArgs = Boolean(
    state.mainArgsName && ctx.rootIdentifier === state.mainArgsName,
  );
  invariant(
    !isArgs || name.unit === "element_count",
    `E0867 rejects this in pass 2.1 -- ${property} is not available on 'args'.`,
  );
  if (isArgs) return "argc";
  const program = input.program;
  const subject =
    step === null
      ? null
      : LengthSubject.of(
          step,
          LengthSubject.structTest(
            (cName) => program?.symbolByCName(cName),
            input.symbolTable ?? null,
          ),
        );
  invariant(
    subject !== null && ctx.measured !== null,
    `E0867 rejects this in pass 2.1 -- Cannot determine ${property} for '${ctx.result}'.`,
  );
  const measured = ctx.measured;
  const rule = LengthProperty.rule(name, subject);
  if (rule.kind === "error") {
    invariant(false, `E0867 rejects this in pass 2.1 -- ${rule.message}.`);
  }
  const bits = name.unit === "bit_length";
  switch (rule.kind) {
    case "logical":
      return name.unit === "element_count"
        ? generateElementCount(ctx, input)
        : measuredLength(ctx, input, name.unit as "bit_length" | "byte_length");
    case "spelling":
      return String(subject.spelling.length);
    case "stringBuffer":
      return String(stringBufferChars(measured));
    case "memory":
      return memoryLength(measured, input, bits);
    case "bits": {
      // 2.2 planned the helper with the read (HelperGenerator)
      const valueBits = `${LengthProperty.VALUE_BIT_LENGTH}(${ctx.result})`;
      return bits ? valueBits : `((${valueBits} + 7U) / 8U)`;
    }
    case "decimal":
      return `${rule.signed ? LengthProperty.VALUE_CHAR_COUNT_SIGNED : LengthProperty.VALUE_CHAR_COUNT}(${ctx.result})`;
    case "string": {
      const chars = stringChars(ctx, state);
      return bits ? `((${LengthProperty.PRODUCT_C_TYPE})${chars} * 8U)` : chars;
    }
  }
};

/**
 * The measured value's logical length in bits or in bytes: every element's
 * bits, together, and bytes rounded up (ADR-058). A dimension that does not
 * fold (a C macro) leaves the product for the C compiler to fold, as
 * `_element_count` leaves the macro (#1760 review: this emitted a literal 0
 * behind a comment naming the dimension). The product is taken in
 * `uint32_t`, as a folded one is read: in `unsigned int` it would wrap past
 * 65535 where that is 16 bits (AVR).
 */
const measuredLength = (
  ctx: IPropertyContext,
  input: IGeneratorInput,
  unit: "bit_length" | "byte_length",
): string => {
  const measured = ctx.measured!;
  const element = elementBitWidth(measured, input);
  invariant(
    element > 0,
    `E0867 rejects this in pass 2.1 -- Cannot determine the length of unsupported type '${measured.typeName ?? "unknown"}'.`,
  );
  const dimensions = measured.dimensions;
  // #1175: the one rule the constant evaluator folds a dimension by, too
  const folded = LengthProperty.of(unit, dimensions, element);
  if (folded !== null) return String(folded);
  const factors = dimensions.map((dim) =>
    typeof dim === "number" ? `${dim}U` : `(${dim})`,
  );
  // a whole-byte element's bytes multiply out; any other rounds up the bits
  const wholeBytes = unit === "byte_length" && element % 8 === 0;
  const factor = wholeBytes ? element / 8 : element;
  const product = `(${LengthProperty.PRODUCT_C_TYPE})${[...factors, `${factor}U`].join(" * ")}`;
  return unit === "bit_length" || wholeBytes
    ? `(${product})`
    : `((${product} + 7U) / 8U)`;
};

/**
 * ADR-058: C's memory, `sizeof` of the subject's C type -- never of the
 * expression, which in a parameter is a pointer -- for the C compiler to
 * answer for its target. A string's buffer holds its `\0` too.
 */
const memoryLength = (
  measured: IOperandType,
  input: IGeneratorInput,
  bits: boolean,
): string => {
  const element = OperandTyper.isString(measured)
    ? `${stringBufferChars(measured)}U`
    : `sizeof(${memoryCType(measured, input)})`;
  return LengthProperty.memoryC(element, measured.dimensions, bits);
};

/** The C type `sizeof` measures: a cnx type as 2.3 declares it, a header's as C spells it */
const memoryCType = (
  measured: IOperandType,
  input: IGeneratorInput,
): string => {
  const typeName = measured.typeName;
  if (typeName === null) {
    invariant(
      measured.cType !== null,
      "E0867 rejects this in pass 2.1 -- a length's subject has no C type.",
    );
    return measured.cType;
  }
  const primitive = TYPE_MAP[typeName];
  if (primitive !== undefined) return primitive;
  return input.symbolTable?.checkNeedsStructKeyword(typeName)
    ? `struct ${typeName}`
    : typeName;
};

/** A string's buffer in chars, its terminator included (ADR-045's `.size`) */
const stringBufferChars = (measured: IOperandType): number => {
  invariant(
    measured.stringCapacity !== null,
    "E0867 rejects this in pass 2.1 -- a string with unknown capacity has no buffer length.",
  );
  return LengthProperty.stringBufferChars(measured.stringCapacity);
};

/** The first dimension no subscript has taken, or a struct's field count (#1535) */
const generateElementCount = (
  ctx: IPropertyContext,
  input: IGeneratorInput,
): string => {
  const first =
    ctx.measured?.dimensions[0] ??
    // #1535: a struct's element count is its field count, a header's too
    measuredStruct(ctx.measured, input)?.fields.size ??
    measuredHeaderFields(ctx.measured, input);
  invariant(
    first !== undefined,
    `E0867 rejects this in pass 2.1 -- an element count is only available on arrays and structs, not on '${ctx.result}'.`,
  );
  return String(first);
};

/** The chars a string holds now: `strlen`, from 2.2's cache when it planned one */
const stringChars = (ctx: IPropertyContext, state: IGeneratorState): string => {
  // 2.2 required <string.h> when it planned the read (#1991)

  // #1946/#1650: the cache is keyed by the operand it measured, rendered as
  // this read renders it, so a read takes it exactly when both name one object.
  const cached = state.lengthCache?.get(ctx.result);
  if (cached !== undefined) {
    return cached;
  }

  // Use ctx.result which contains the full expression including any subscripts
  // e.g., for arr[0].value_char_count, ctx.result is "arr[0]" not "arr"
  return `strlen(${ctx.result})`;
};

// ========================================================================
// Member Access
// ========================================================================

/**
 * Member access result.
 */
interface MemberAccessResult {
  result: string;
  resolvedIdentifier?: string;
  isRegisterChain?: boolean;
  isCppAccessChain?: boolean;
}

/**
 * Context for member access generation.
 */
interface IMemberAccessContext {
  base: IChainBase;
  result: string;
  memberName: string;
  rootIdentifier: string | undefined;
  /**
   * The member is applied to the chain's root: the op's `appliesToRoot`,
   * decided once by the chain head as the write path's is (#1994), not by
   * comparing text -- the rendered root is its C name, which differs from the
   * name as written once ADR-057 moves it
   */
  isRootOp: boolean;
  /** #1969: the parameter the root binds to where it is written */
  rootParameter: TParameterInfo | undefined;
  /** How the root is held (`memberAccessChain.rootHolding`) */
  holding: IRootHolding;
  isGlobalAccess: boolean;
  isCppAccessChain: boolean;
  /**
   * #1668 (C12): the value this member is read from, as the one operand
   * typer typed it; null where its root consumed the op or nothing typed it
   */
  typed: IOperandType | null;
  /** 2.2's decision for a bitmap field read (MISRA 10.3), or null */
  narrowing: TPlannedNarrowing | null;
  resolvedIdentifier: string | undefined;
  isRegisterChain: boolean;
}

/**
 * Initialize the default member access output from context.
 */
const initializeMemberOutput = (
  ctx: IMemberAccessContext,
): MemberAccessResult => ({
  result: ctx.result,
  resolvedIdentifier: ctx.resolvedIdentifier,
  isRegisterChain: ctx.isRegisterChain,
  isCppAccessChain: ctx.isCppAccessChain,
});

/**
 * Emit `<result><separator><member>` and advance the struct-type tracking to
 * that member's type.
 *
 * The struct-parameter path and the default path derived this separately: the
 * same six lines, differing only in the separator each had already chosen. A
 * change to how member access advances the chain -- what `currentStructType`
 * becomes, whether `currentMemberIsArray` is set from the member or the parent
 * -- needed two edits with nothing holding them together.

 *
 * ## The difference between the two paths was not one
 *
 * The default path also carried `output.resolvedIdentifier = undefined` inside
 * this branch, and the struct-param path did not -- which reads as a decision
 * about whether a member access resets the chain's resolved identifier. It is
 * not one. `handleMemberOp` merges the field with
 * `memberResult.resolvedIdentifier ?? tracking.resolvedIdentifier`, so an
 * `undefined` from a handler restores exactly the value it was trying to clear.
 * The write cannot take effect.
 *
 * Measured both ways rather than reasoned about: giving the struct-param path
 * the clear reddens 0 of 1248 fixtures, and taking it off the default path
 * reddens 0. It is gone, so the two paths are identical rather than looking
 * deliberately different, and the merge site says why re-adding it would be
 * inert.
 */
const advanceMemberAccess = (
  ctx: IMemberAccessContext,
  separator: string,
): MemberAccessResult => {
  const output = initializeMemberOutput(ctx);
  output.result = `${ctx.result}${separator}${ctx.memberName}`;
  return output;
};

/**
 * Generate member access (obj.field).
 * Dispatches to specialized handlers via null-coalescing chain.
 */
const generateMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): MemberAccessResult => {
  return (
    tryBitmapFieldAccess(ctx, input, effects, orchestrator) ??
    tryScopeMemberAccess(ctx, state, orchestrator, effects) ??
    tryKnownScopeAccess(ctx, orchestrator) ??
    tryEnumMemberAccess(ctx, input) ??
    tryRegisterMemberAccess(ctx, input) ??
    tryStructParamAccess(ctx, orchestrator) ??
    tryRegisterBitmapAccess(ctx, input, effects, orchestrator) ??
    tryStructBitmapAccess(ctx, input, effects, orchestrator) ??
    generateDefaultAccess(ctx)
  );
};

// ========================================================================
// Member Access Handlers
// ========================================================================

/**
 * Check for primary bitmap type field access (e.g., status.Running).
 */
const tryBitmapFieldAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  if (!ctx.rootIdentifier) {
    return null;
  }
  const typeInfo = ctx.base.rootTypeInfo;
  if (!typeInfo?.isBitmap || !typeInfo.bitmapTypeName) {
    return null;
  }

  // A bitmap parameter's field is worked in its whole value (#1760 second
  // review: `s.C` shifted the pointer `s`)
  const whole = ctx.isRootOp
    ? memberAccessChain.wholeParamValue(
        ctx.result,
        ctx.rootParameter,
        orchestrator.isCppMode(),
      )
    : ctx.result;
  const output = initializeMemberOutput(ctx);
  const bitmapResult = BitmapAccessHelper.generate(
    whole,
    ctx.memberName,
    typeInfo.bitmapTypeName,
    input.symbols!.bitmapFields,
    `type '${typeInfo.bitmapTypeName}'`,
    ctx.narrowing,
    orchestrator.state,
  );
  applyAccessEffects(bitmapResult.effects, effects);
  output.result = bitmapResult.code;
  return output;
};

/**
 * Check for scope member access (this.member).
 */
const tryScopeMemberAccess = (
  ctx: IMemberAccessContext,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): MemberAccessResult | null => {
  if (ctx.result !== "__THIS_SCOPE__") {
    return null;
  }
  // #1322: `this` outside a scope is E0431 in 2.1.
  const output = initializeMemberOutput(ctx);
  const fullName = QualifiedNameGenerator.forMember(
    state.currentScopePath,
    ctx.memberName,
  );
  // #1739: a private const is written as its settled value
  const inlined = PrivateConstValue.inlined(
    state,
    orchestrator.state,
    fullName,
  );
  if (inlined !== null) effects.push(...inlined.effects);
  output.result = inlined?.code ?? fullName;
  output.resolvedIdentifier = fullName;
  return output;
};

/**
 * Check for known scope access (e.g., LED.on).
 */
// #1322: ADR-016's access rules -- own scope by name, private from outside, a
// shadowed global reached bare -- are E0435-E0437 in pass 2.1. Four call sites
// stood in the handlers below, checking each position on its own path.
const tryKnownScopeAccess = (
  ctx: IMemberAccessContext,
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  if (!orchestrator.isKnownScope(ctx.result)) {
    return null;
  }

  const output = initializeMemberOutput(ctx);
  output.result = ctx.isCppAccessChain
    ? CppNamespaceUtils.fromParts([ctx.result, ctx.memberName])
    : ScopeUtils.qualifyInScope(ctx.memberName, ctx.result);
  output.resolvedIdentifier = output.result;
  return output;
};

/**
 * Check for enum member access (e.g., Color.Red).
 */
const tryEnumMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
): MemberAccessResult | null => {
  if (!input.symbols!.knownEnums.has(ctx.result)) {
    return null;
  }

  const output = initializeMemberOutput(ctx);
  output.result = ctx.isCppAccessChain
    ? CppNamespaceUtils.fromParts([ctx.result, ctx.memberName])
    : QualifiedCName.fromSourceName([ctx.result, ctx.memberName]);
  return output;
};

/**
 * Check for register member access (e.g., GPIO.PIN0).
 */
const tryRegisterMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
): MemberAccessResult | null => {
  if (!input.symbols!.knownRegisters.has(ctx.result)) {
    return null;
  }

  // #1322: a read of a `wo` member is E0870 in pass 2.1 (ADR-004).
  const output = initializeMemberOutput(ctx);
  output.result = QualifiedCName.fromSourceName([ctx.result, ctx.memberName]);
  output.isRegisterChain = true;
  return output;
};

/**
 * Check for struct parameter access (e.g., point->x or point.x in C++).
 */
const tryStructParamAccess = (
  ctx: IMemberAccessContext,
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  const held = ctx.holding.isStructParam || ctx.holding.isPointerLocal;
  if (!held || !ctx.isRootOp) {
    return null;
  }

  // Issue #895: a callback-compatible param, and a local held through a
  // pointer, take -> in C++ too -- decided by the helper, from the holding
  const structParamSep = memberAccessChain.rootMemberSeparator(
    ctx.holding,
    orchestrator.isCppMode(),
  );

  return advanceMemberAccess(ctx, structParamSep);
};

/**
 * Check for register member with bitmap type (e.g., MOTOR_CTRL.Running).
 */
const tryRegisterBitmapAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  const bitmapType = DeclaredTypeFacts.registerMemberBitmap(
    input.symbols!,
    ctx.result,
  );
  if (bitmapType === null) {
    return null;
  }

  const output = initializeMemberOutput(ctx);
  const bitmapResult = BitmapAccessHelper.generate(
    ctx.result,
    ctx.memberName,
    bitmapType,
    input.symbols!.bitmapFields,
    `register member '${ctx.result}' (bitmap type '${bitmapType}')`,
    ctx.narrowing,
    orchestrator.state,
  );
  applyAccessEffects(bitmapResult.effects, effects);
  output.result = bitmapResult.code;
  return output;
};

/**
 * Check for struct member with bitmap type (e.g., device.flags.Active).
 */
const tryStructBitmapAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  // #1668 (C12): the bitmap type is the typer's, for the value read from
  const bitmapType = ctx.typed?.bitmapTypeName ?? null;
  if (bitmapType === null || !input.symbols!.bitmapFields.has(bitmapType)) {
    return null;
  }

  const output = initializeMemberOutput(ctx);
  const bitmapResult = BitmapAccessHelper.generate(
    ctx.result,
    ctx.memberName,
    bitmapType,
    input.symbols!.bitmapFields,
    `struct member '${ctx.result}' (bitmap type '${bitmapType}')`,
    ctx.narrowing,
    orchestrator.state,
  );
  applyAccessEffects(bitmapResult.effects, effects);
  output.result = bitmapResult.code;
  return output;
};

/**
 * Default member access (dot or :: separator with struct type tracking).
 */
const generateDefaultAccess = (
  ctx: IMemberAccessContext,
): MemberAccessResult => {
  const separator = ctx.isCppAccessChain ? "::" : ".";
  return advanceMemberAccess(ctx, separator);
};

// ========================================================================
// Subscript Access
// ========================================================================

/**
 * Subscript access result.
 */
interface SubscriptAccessResult {
  result: string;
  subscriptDepth?: number;
}

/**
 * Context for subscript access generation.
 */
interface ISubscriptAccessContext {
  base: IChainBase;
  result: string;
  subscript: Extract<TPlannedPostfixOp, { kind: "subscript" }>;
  rootIdentifier: string | undefined;
  resolvedIdentifier: string | undefined;
  subscriptDepth: number;
  isRegisterChain: boolean;
}

/**
 * Generate subscript access (arr[i] or value[bit]).
 * Dispatches to single-index or dual-index handler.
 */
const generateSubscriptAccess = (
  ctx: ISubscriptAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): SubscriptAccessResult => {
  const output: SubscriptAccessResult = {
    result: ctx.result,
    subscriptDepth: ctx.subscriptDepth,
  };

  // The arity is checked BEFORE anything renders: the grammar admits only one
  // or two indexes, and the old shape returned without generating for any
  // other count.
  const indexCount = ctx.subscript.indexCount;
  if (indexCount !== 1 && indexCount !== 2) {
    return output;
  }

  // 2.2 plans each index against size_t (unsigned) per MISRA 7.2, which is
  // what gives an index literal its U suffix regardless of element type (#1991)
  const indexes = ctx.subscript.renderIndexes();

  if (indexCount === 1) {
    return handleSingleSubscript(ctx, indexes[0], input, orchestrator, output);
  }

  return handleBitRangeSubscript(ctx, indexes, state, orchestrator, output);
};

/**
 * Handle single-index subscript (arr[i] or value[bit]).
 *
 * #1668 (C12): an element access or a bit read, as the one operand typer
 * typed the subscript (`typedAs`) -- the answer 2.1's bit rules read. This
 * walked the chain itself: whether the current member was an array, how many
 * of the root's dimensions remained, whether the member's type was an
 * integer, and only then fell back to the typer. Every branch emitted one of
 * the same two texts.
 */
const handleSingleSubscript = (
  ctx: ISubscriptAccessContext,
  index: string,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  // Check if result is a register member with bitmap type (throws)
  validateNotBitmapMember(ctx, input);

  // #1322: constant index bounds (ADR-036, E0854) are checked in pass 2.1,
  // in value position and in a target alike.
  if (
    checkRegisterAccess(ctx, input) ||
    ctx.subscript.typedAs === "bit_single"
  ) {
    output.result = singleBitRead(
      ctx.result,
      index,
      ctx.subscript.narrowing,
      orchestrator,
    );
    return output;
  }
  output.result = `${ctx.result}[${index}]`;
  output.subscriptDepth = ctx.subscriptDepth + 1;
  return output;
};

/**
 * Validate that result is not a bitmap member (which requires named access).
 */
const validateNotBitmapMember = (
  ctx: ISubscriptAccessContext,
  input: IGeneratorInput,
): void => {
  const bitmapType = DeclaredTypeFacts.registerMemberBitmap(
    input.symbols!,
    ctx.result,
  );
  if (bitmapType === null) return;

  invariant(
    !input.symbols!.bitmapFields.has(bitmapType),
    `a bitmap is addressed by named field, never by bit index ` +
      `('${bitmapType}') -- E0883 rejects this in pass 2.1, before this runs`,
  );
};

/**
 * Check if this is a register access (bit extraction).
 */
const checkRegisterAccess = (
  ctx: ISubscriptAccessContext,
  input: IGeneratorInput,
): boolean => {
  if (ctx.isRegisterChain) return true;
  if (!ctx.rootIdentifier) return false;
  return input.symbols!.knownRegisters.has(ctx.rootIdentifier);
};

/**
 * Handle dual-index subscript (value[start, width] — bit range).
 */
const handleBitRangeSubscript = (
  ctx: ISubscriptAccessContext,
  indexes: readonly string[],
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  const [start, width] = indexes;

  // Issue #1094: resolve a const/macro width to its numeric value so the mask is
  // precomputed (byte-identical to a literal width) instead of a runtime
  // ((1U << W) - 1) — which is UB at full width (1U << 32) and uses the wrong
  // base type for >32-bit widths. The "U" suffix matches the literal path, which
  // generates bit widths under a size_t expectedType.
  const maskWidth = BitUtils.widthText({
    text: width,
    folded: ctx.subscript.foldWidth(),
  });

  const floatBits = ctx.subscript.floatBits;
  if (floatBits !== null) {
    output.result = handleFloatBitRange(
      {
        result: ctx.result,
        rootIdentifier: ctx.rootIdentifier,
        floatBits,
        start,
        maskWidth,
      },
      state,
      orchestrator,
    );
  } else {
    invariant(
      ctx.subscript.step?.before?.category !== "floating",
      `2.2 planned every float bit range 2.3 reads (${ctx.result})`,
    );
    // Issue #1094, #1668: a width known only at run time computes its mask
    // in the operand's own width, so a 64-bit operand's does not shift past
    // a 32-bit literal's, nor a 32-bit one's past a 16-bit int's. #1760
    // review: the operand is the value ranged, as the typer types it and as
    // a write reads it -- not the root, which a field or a `this.` root is not
    const ranged = ctx.subscript.step?.before ?? null;
    const mask = BitUtils.generateMask(maskWidth, BitUtils.storageOf(ranged));
    // Skip shift when start is 0 (either "0" or "0U" with MISRA suffix)
    let expr: string;
    if (start === "0" || start === "0U") {
      expr = `((${ctx.result}) & ${mask})`;
    } else {
      expr = `((${ctx.result} >> ${start}) & ${mask})`;
    }

    // MISRA 10.3: bit operations promote to int; 2.2 decided the cast
    output.result = NarrowingCastHelper.apply(
      expr,
      ctx.subscript.narrowing,
      orchestrator.state,
    );
  }

  return output;
};

/**
 * Context for float bit range access.
 */
interface IFloatBitRangeContext {
  /** The float read, as written in C */
  result: string;
  /** The variable whose shadow a shared read uses */
  rootIdentifier: string | undefined;
  /** 2.2's decision for this read (ADR-007) */
  floatBits: IPlannedFloatBits;
  start: string;
  /** Width formatted for mask generation (const-resolved when possible, #1094). */
  maskWidth: string;
}

/**
 * A variable's shadow union, declared at its first read or write and copied
 * into only when a whole-variable write made it stale.
 */
const sharedShadow = (
  ctx: IFloatBitRangeContext,
  orchestrator: IOrchestrator,
): string => {
  invariant(
    ctx.rootIdentifier !== undefined,
    `a shared float shadow is a named variable's (${ctx.result})`,
  );
  const shadowName = BitRangeHelper.getShadowVarName(ctx.rootIdentifier);
  if (!orchestrator.hasFloatBitShadow(shadowName)) {
    orchestrator.registerFloatBitShadow(shadowName);
    orchestrator.addPendingTempDeclaration(
      FloatBitHelper.unionDeclaration(ctx.floatBits.floatType, shadowName),
    );
  }
  const shadowIsCurrent = orchestrator.isFloatShadowCurrent(shadowName);
  orchestrator.markFloatShadowCurrent(shadowName);
  if (!shadowIsCurrent) {
    orchestrator.addPendingTempDeclaration(`${shadowName}.f = ${ctx.result};`);
  }
  return shadowName;
};

/**
 * A union of the read's own, for a float with no shadow -- a `this.`/`global.`
 * member, a field, an element -- copied into at this read (#2057, #1099).
 */
const ownUnion = (
  ctx: IFloatBitRangeContext,
  orchestrator: IOrchestrator,
): string => {
  const name = orchestrator.nextTempName();
  orchestrator.addPendingTempDeclaration(
    FloatBitHelper.unionDeclaration(ctx.floatBits.floatType, name),
  );
  orchestrator.addPendingTempDeclaration(`${name}.f = ${ctx.result};`);
  return name;
};

/**
 * Handle float bit range access with union-based type punning.
 * Uses union { float f; uint32_t u; } for MISRA C:2012 Rule 21.15 compliance.
 */
const handleFloatBitRange = (
  ctx: IFloatBitRangeContext,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string => {
  // #1322: ADR-007's file-scope restriction is E0888 in pass 2.1, which asks
  // the parse tree whether a function encloses the read rather than reading a
  // generator flag.
  invariant(
    state.inFunctionBody,
    `a float bit range is read inside a function (${ctx.result}) -- E0888 rejects this in pass 2.1, before this runs`,
  );

  const intType = FloatBitType.of(ctx.floatBits.floatType);
  const mask = BitUtils.generateMask(ctx.maskWidth, intType);
  const shadowName = ctx.floatBits.shared
    ? sharedShadow(ctx, orchestrator)
    : ownUnion(ctx, orchestrator);

  // Return just the bit read expression using union member .u
  // Skip shift when start is 0 (either "0" or "0U" with MISRA suffix)
  if (ctx.start === "0" || ctx.start === "0U") {
    return `(${shadowName}.u & ${mask})`;
  }
  return `((${shadowName}.u >> ${ctx.start}) & ${mask})`;
};

// ========================================================================
// Utilities
// ========================================================================

/**
 * Apply effects from access generators.
 */
const applyAccessEffects = (
  sourceEffects: readonly TGeneratorEffect[],
  targetEffects: TGeneratorEffect[],
): void => {
  for (const effect of sourceEffects) {
    targetEffects.push(effect);
  }
};

export default generatePostfixExpression;
