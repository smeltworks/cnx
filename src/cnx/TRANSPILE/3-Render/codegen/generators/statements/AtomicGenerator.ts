/**
 * Atomic Operation Generators
 *
 * Generates C code for atomic Read-Modify-Write operations (ADR-049):
 * - LDREX/STREX loops for platforms with exclusive access support
 * - PRIMASK-based wrappers for interrupt-safe operations
 * - GNU `__atomic` compare-exchange loops where neither exists (#1789)
 *
 * These are helper functions called from assignment generation,
 * not top-level statement generators.
 */
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import type IPlannedAtomic from "../../../../types/IPlannedAtomic";
import invariant from "../../../../../utils/invariant";
import COMPOUND_TO_BINARY from "../../../../2-Plan/types/COMPOUND_TO_BINARY";
import InterruptMask from "../../helpers/InterruptMask";
import type ICompareExchangeViews from "../../../../types/ICompareExchangeViews";

/**
 * Generate the inner operation for atomic RMW.
 * Handles clamp/wrap behavior for arithmetic operations.
 *
 * @returns Object with code and effects
 */
function generateInnerAtomicOp(
  cOp: string,
  value: string,
  overflowHelper: string | null,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];
  const simpleOp = COMPOUND_TO_BINARY[cOp];
  invariant(
    simpleOp !== undefined,
    `an atomic read-modify-write is a compound assignment (got '${cOp}')`,
  );

  // Call the overflow helper the classifier chose
  if (overflowHelper) {
    return { code: `${overflowHelper}(__old, ${value})`, effects };
  }

  // For wrap behavior, floats, or non-clamp ops, use natural arithmetic
  return { code: `__old ${simpleOp} ${value}`, effects };
}

/**
 * The name a retry loop reads its value through. #1807: the value is
 * evaluated once, before the loop, so a failed attempt does not evaluate a
 * call in it again.
 */
const OPERAND = "__operand";

/**
 * Generate LDREX/STREX retry loop for atomic RMW.
 * Uses ARM exclusive access instructions for lock-free atomics.
 *
 * @param value - The value expression, evaluated once before the loop
 * @param innerOp - The new value, computed from `__old` and `__operand`
 * @returns Object with code and effects
 */
function generateLdrexStrexLoop(
  target: string,
  value: string,
  innerOp: string,
  atomic: IPlannedAtomic,
  innerEffects: readonly TGeneratorEffect[],
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [...innerEffects];
  const exclusive = atomic.exclusive;
  invariant(
    exclusive !== null,
    `2.2 plans an LDREX/STREX loop only with its exclusive access (got ${atomic.cType})`,
  );
  const ldrex = exclusive.ldrex;
  const strex = exclusive.strex;
  const cType = atomic.cType;
  const operandType = atomic.operandCType;
  // #2208: CMSIS's intrinsics take an unsigned pointer; a signed value is
  // accessed through its unsigned type of the same width, as 2.2 planned
  const exclusiveType = exclusive.pointee;
  const address =
    exclusiveType === cType
      ? `&${target}`
      : `(volatile ${exclusiveType} *)&${target}`;
  const loaded =
    exclusiveType === cType
      ? `${ldrex}(${address})`
      : `(${cType})${ldrex}(${address})`;
  const stored = exclusiveType === cType ? "__new" : `(${exclusiveType})__new`;
  // Rule 11.3 allows a cast to a pointer to a character type (uint8_t)
  const deviation =
    exclusiveType === cType || exclusiveType === "uint8_t"
      ? ""
      : ` MISRA C:2012 Rule 11.3 deviation (Issue #2208): the signed value is accessed through its same-width unsigned type, because CMSIS's ${ldrex}/${strex} take a pointer to ${exclusiveType}; C11 6.5p7 makes the access defined.`;

  // Uses do-while because we always need at least one attempt
  const code = `{
    /* ADR-049 / Issue #1807: atomic read-modify-write as an LDREX/STREX retry loop. The value is evaluated once, before the loop, so a failed store-exclusive does not evaluate it again.${deviation} */
    ${operandType} ${OPERAND} = ${value};
    do {
        ${cType} __old = ${loaded};
        ${cType} __new = ${innerOp};
        if (${strex}(${stored}, ${address}) == 0) {
            break;
        }
    } while (1);
}`;

  return { code, effects };
}

/** `__old` and `__new` as the value's own C type: exchanged and computed whole */
function plainViews(cType: string): ICompareExchangeViews {
  return {
    declare: (name) => `${cType} ${name};`,
    exchanged: "",
    computed: "",
  };
}

/**
 * #1789: a compare-exchange retry loop, for a target with neither LDREX/STREX
 * nor interrupt masking. The generic builtins take any type the variable can
 * have, floats included, and `__old` is reloaded by a failed exchange.
 *
 * @param value - The value expression, evaluated once before the loop
 * @param innerOp - The new value, computed from `__old` and `__operand`
 * @param libatomic - The type is wider than the target's word (ADR-049
 *   `word_size`), so GCC calls libatomic for it; the comment says so
 * @param cType - The C type the atomic value is accessed as
 * @param views - How `__old` and `__new` are declared and accessed: the
 *   value's own type, or an atomic float's bits unions (#2155 review)
 */
function generateCompareExchangeLoop(
  target: string,
  value: string,
  innerOp: string,
  cType: string,
  innerEffects: readonly TGeneratorEffect[],
  operandType: string = cType,
  libatomic: boolean = false,
  views: ICompareExchangeViews = plainViews(cType),
): IGeneratorOutput {
  const wide = libatomic
    ? " The type is wider than the target's word, so the compiler calls libatomic's __atomic_*_N for it."
    : "";
  const code = `{
    /* ADR-049 / Issue #1789: atomic read-modify-write as a compare-exchange retry loop, for a target with neither LDREX/STREX nor an interrupt mask. The GNU __atomic builtins are a compiler extension (MISRA C:2012 Rule 1.2).${wide} The value is evaluated once, before the loop, so a failed exchange does not evaluate it again (Issue #1807). */
    ${operandType} ${OPERAND} = ${value};
    ${views.declare("__old")}
    ${views.declare("__new")}
    __atomic_load(&${target}, &__old${views.exchanged}, __ATOMIC_RELAXED);
    do {
        __new${views.computed} = ${innerOp};
    } while (!__atomic_compare_exchange(&${target}, &__old${views.exchanged}, &__new${views.exchanged}, 0, __ATOMIC_SEQ_CST, __ATOMIC_RELAXED));
}`;
  return { code, effects: [...innerEffects] };
}

/**
 * Generate an interrupt-masked atomic read-modify-write: the ADR-050 masked
 * region a `critical` block takes, through the same `__cnx_` IRQ wrappers
 * (#1146: this emitted raw CMSIS with no platform guard, so AVR got CMSIS
 * calls where `critical` got SREG).
 *
 * @returns Object with code and effects
 */
function generatePrimaskWrapper(
  target: string,
  cOp: string,
  value: string,
  overflowHelper: string | null,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];

  // Generate the actual assignment operation inside the masked region
  let assignment: string;

  // Call the overflow helper the classifier chose
  if (overflowHelper) {
    assignment = `${target} = ${overflowHelper}(${target}, ${value});`;
  } else {
    assignment = `${target} ${cOp} ${value};`;
  }

  const masked = InterruptMask.wrap(assignment);
  return { code: masked.code, effects: [...effects, ...masked.effects] };
}

/**
 * ADR-049: Generate atomic Read-Modify-Write operation.
 * Written in the form 2.2 decided: LDREX/STREX, the masked region, or a
 * compare-exchange loop, with the types 2.2 planned.
 *
 * @param target - The target variable expression
 * @param cOp - The C compound assignment operator (+=, -=, etc.)
 * @param value - The value expression
 * @param atomic - 2.2's plan: the form, what the value is accessed as, and
 *   the C type `__operand` holds the value in
 * @param overflowHelper - the ADR-044 helper 2.2 planned
 *   (`AssignmentClassifier.compoundOverflow`), or null for plain arithmetic
 * @returns Generated code and effects
 */
function generateAtomicRMW(
  target: string,
  cOp: string,
  value: string,
  atomic: IPlannedAtomic,
  overflowHelper: string | null,
): IGeneratorOutput {
  if (atomic.form === "interrupt-mask") {
    return generatePrimaskWrapper(target, cOp, value, overflowHelper);
  }

  // A retry loop reads the value once, through `__operand` (#1807)
  const innerResult = generateInnerAtomicOp(cOp, OPERAND, overflowHelper);

  if (atomic.form === "ldrex-strex") {
    return generateLdrexStrexLoop(
      target,
      value,
      innerResult.code,
      atomic,
      innerResult.effects,
    );
  }
  return generateCompareExchangeLoop(
    target,
    value,
    innerResult.code,
    atomic.cType,
    innerResult.effects,
    atomic.operandCType,
    atomic.form === "compare-exchange-libatomic",
  );
}

/**
 * A float's bits written atomically: the retry loop's views of the float
 * (exchanged whole, its bits computed in the integer view), and the masked
 * region's whole body
 */
interface IAtomicFloatViews {
  readonly views: ICompareExchangeViews;
  readonly masked: string;
}

/**
 * ADR-049 (#2200): a bit, bit-range or bitmap-field write to an `atomic`
 * value, in the form 2.2 planned. `newValue` is the value stored, computed
 * from the value read: the target itself inside the masked region, `__old`
 * in a retry loop, which reads the written value once, through `__operand`.
 *
 * @param atomic - 2.2's plan: the form, what the value is accessed as, and
 *   the C type `__operand` holds the written value in
 */
function generateAtomicStore(
  target: string,
  value: string,
  atomic: IPlannedAtomic,
  newValue: (read: string, value: string) => string,
  float: IAtomicFloatViews | null = null,
): IGeneratorOutput {
  if (atomic.form === "interrupt-mask") {
    return InterruptMask.wrap(
      float === null ? `${target} = ${newValue(target, value)};` : float.masked,
    );
  }
  const inner = newValue(`__old${float?.views.computed ?? ""}`, OPERAND);
  if (atomic.form === "ldrex-strex") {
    invariant(
      float === null,
      "2.2 plans no exclusive access for a float: LDREX_MAP names none",
    );
    return generateLdrexStrexLoop(target, value, inner, atomic, []);
  }
  return generateCompareExchangeLoop(
    target,
    value,
    inner,
    atomic.cType,
    [],
    atomic.operandCType,
    atomic.form === "compare-exchange-libatomic",
    float?.views,
  );
}

// Export all atomic generators
const atomicGenerators = {
  generateAtomicRMW,
  generateAtomicStore,
  generateInnerAtomicOp,
  generateLdrexStrexLoop,
  generateCompareExchangeLoop,
  generatePrimaskWrapper,
};

export default atomicGenerators;
