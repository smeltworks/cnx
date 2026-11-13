/**
 * 2.2 Plan -- decides what C should exist for one file.
 *
 * `docs/architecture/README.md` §1 gives this pass sole ownership of
 * declarations and order, includes, helpers, MISRA annotations and toolchain
 * requirements, and states the rule it exists to make checkable:
 *
 *   **2.2 decides, 2.3 formats.** "Does this file need `<stdint.h>`?" is
 *   decided once, in the plan. Render reads the plan and produces text from it.
 *
 * ## Why a decision, and not a flag, crosses the boundary
 *
 * Before this pass, `CodeGenState.needsStdint` crossed it -- and a flag is a
 * question, so every reader answered it again. `CodeGenerator.addAutoIncludes`
 * answered "emit `<stdint.h>` if the flag is set"; `HeaderGeneratorUtils`
 * answered "emit `<stdint.h>` always". One question, two derivations, agreeing
 * only on the files where both happened to be true. That is the shape CLAUDE.md
 * calls the project's worst anti-pattern, and it is why `systemIncludes` below
 * holds the strings to emit rather than the booleans to interpret.
 *
 * ## Shape
 *
 * Follows `Program` (1.4 Resolve): a `build` returning a frozen record, with
 * each derivation its own named step so that "why is `<limits.h>` here?" has an
 * answer that fits on a screen. Unlike `Program` it needs no query surface --
 * a plan is consumed field by field by one renderer, not queried by many
 * passes -- so the record is the artifact rather than a closure over hidden
 * tables.
 *
 * ## Why there is no negative control in this pass
 *
 * `Program` (1.4 Resolve) carries one -- it refuses to return while any type
 * is still deferred -- and that is right there, because a deferred type CAN
 * survive its derivation and the type system cannot say so.
 *
 * This pass is total over its inputs: every branch that plans a block writes
 * a non-empty requirement list from a literal or a module constant, so a
 * block carrying no cost is not reachable from any `IEmissionFacts`. A guard
 * for it would be one more thing that cannot fail on the case it exists to
 * catch, which is the `/* test-no-warnings *\/` shape (#1143) -- and the
 * property it would assert is asserted instead by the unit tests, which pin
 * each block's exact requirement list. One draft of this file had that guard;
 * it is recorded here so the next reader does not add it back believing it
 * ever ran.
 */

import type IEmissionFacts from "../../types/IEmissionFacts";
import type IEmissionPlan from "../../types/IEmissionPlan";
import type IPlannedBlock from "../../types/IPlannedBlock";
import type IRecordedRequirement from "../../types/IRecordedRequirement";
import type TRequirementKey from "../../types/TRequirementKey";
import SYSTEM_INCLUDE_TARGETS from "./SYSTEM_INCLUDE_TARGETS";
import UnwrittenIncludes from "./UnwrittenIncludes";
import CTypeIncludes from "./CTypeIncludes";
import HeaderOwnership from "./HeaderOwnership";

/**
 * The three platform arms of the emitted IRQ wrapper chain.
 *
 * All three are carried, never one. The block is a single `#if`/`#elif`/`#else`,
 * so which arm applies is decided by the compiler and not here; recording a
 * single "critical section" requirement would force one answer to a per-target
 * question, which is how a requirements table starts lying (#1143).
 */
const IRQ_WRAPPER_REQUIREMENTS: readonly TRequirementKey[] = [
  "critical-arm-gnu",
  "critical-arduino",
  "critical-avr-libc",
];

/**
 * System headers in emission order, each paired with the fact that asks for it,
 * after the ones `CTypeIncludes` decides from the emitted C types.
 *
 * A list rather than three `if` statements so that the order is data: adding a
 * header is one row, and the order it emits in is visible in one place instead
 * of being the order somebody happened to write the branches.
 */
const SYSTEM_INCLUDES: readonly {
  readonly target: string;
  readonly needed: (facts: IEmissionFacts) => boolean;
}[] = [
  { target: SYSTEM_INCLUDE_TARGETS.string, needed: (f) => f.needsString },
  { target: SYSTEM_INCLUDE_TARGETS.cmsis, needed: (f) => f.needsCMSIS },
  { target: SYSTEM_INCLUDE_TARGETS.limits, needed: (f) => f.needsLimits },
  { target: SYSTEM_INCLUDE_TARGETS.stddef, needed: (f) => f.needsStddef },
];

class EmissionPlan {
  /**
   * Decide this file's emission from the facts captured while it was warm.
   *
   * @param facts one file's accumulated questions, frozen at the warm moment
   */
  static build(facts: IEmissionFacts): IEmissionPlan {
    const plan: IEmissionPlan = {
      systemIncludes: EmissionPlan.decideSystemIncludes(facts),
      floatStaticAssert: EmissionPlan.decideFloatStaticAssert(facts),
      irqWrappers: EmissionPlan.decideIrqWrappers(facts),
      isrTypedef:
        facts.needsISR &&
        !HeaderOwnership.ownsDeclarations(facts.selfIncludeAdded),
      clampOps: [...facts.clampOps],
      wrapOps: [...facts.wrapOps],
      stringCopyHelper: facts.stringCopyHelper,
      panicOverflowHelpers: EmissionPlan.decidePanicOverflowHelpers(facts),
      safeDivOps: [...facts.safeDivOps.values()],
      castHelpers: [...facts.castHelpers].sort((a, b) => a.localeCompare(b)),
      lengthHelpers: [...facts.lengthHelpers].sort((a, b) =>
        a.localeCompare(b),
      ),
      formRequirements: EmissionPlan.decideFormRequirements(facts),
    };

    return Object.freeze(plan);
  }

  /**
   * Every `IEmissionPlan` field that holds a planned block, nullable or
   * optional. A block added to the plan and not listed here fails to compile,
   * instead of rendering with its cost missing from the banner -- #1143's
   * failure.
   */
  private static readonly PLANNED_BLOCKS: {
    readonly [K in keyof IEmissionPlan as NonNullable<
      IEmissionPlan[K]
    > extends IPlannedBlock
      ? K
      : never]-?: true;
  } = {
    floatStaticAssert: true,
    irqWrappers: true,
    panicOverflowHelpers: true,
  };

  /**
   * Every requirement the plan decided: the forms' and the blocks', each with
   * the sites that asked for it. A view of decisions already in the plan, not
   * a new one. Copied on the way out: `Object.freeze` is shallow, the banner
   * and `ITranspilerResult` both read this list, and the IRQ block's four keys
   * share one `sites` array.
   */
  static requirements(plan: IEmissionPlan): readonly IRecordedRequirement[] {
    const fields = Object.keys(
      EmissionPlan.PLANNED_BLOCKS,
    ) as (keyof typeof EmissionPlan.PLANNED_BLOCKS)[];
    return [
      ...plan.formRequirements.map((entry) => ({
        key: entry.key,
        sites: [...entry.sites],
      })),
      ...fields.flatMap((field) => {
        const block = plan[field] ?? null;
        return block === null
          ? []
          : block.requirements.map((key) => ({ key, sites: [...block.sites] }));
      }),
    ];
  }

  /**
   * What the forms Render emitted cost, beside the planned blocks (#1997).
   *
   * Render reports the form -- it wrote a designated initializer -- and this
   * decides the cost: C99 and free in C, C++20 in C++. Each branch reads an
   * `emitted*` fact; the LDREX sites ride along as attribution and decide
   * nothing (README §1: no decision consults instrumentation).
   */
  private static decideFormRequirements(
    facts: IEmissionFacts,
  ): readonly IRecordedRequirement[] {
    const decided: IRecordedRequirement[] = [
      { key: facts.cppMode ? "baseline-cpp" : "baseline-c", sites: [] },
    ];
    if (facts.cppMode && facts.emittedDesignatedInitializer) {
      decided.push({ key: "cpp-designated-initializer", sites: [] });
    }
    if (facts.cppMode && facts.emittedCompoundLiteral) {
      decided.push({ key: "cpp-compound-literal", sites: [] });
    }
    if (facts.emittedLdrexStrexLoop) {
      decided.push({
        key: "atomic-ldrex-cmsis",
        sites: [...facts.ldrexStrexSites],
      });
    }
    if (facts.emittedCompareExchangeLoop) {
      decided.push({
        key: "atomic-gnu-builtins",
        sites: [...facts.compareExchangeSites],
      });
    }
    if (facts.emittedWideCompareExchangeLoop) {
      decided.push({
        key: "atomic-libatomic",
        sites: [...facts.wideCompareExchangeSites],
      });
    }
    return decided;
  }

  /**
   * Whether the overflow helpers panic, with what that costs (#1997).
   *
   * Render reads this block to choose the panic templates, so the hosted-libc
   * key and the `<stdio.h>` it pays for are one decision rather than two
   * readings of `debugMode` that happen to agree.
   */
  private static decidePanicOverflowHelpers(
    facts: IEmissionFacts,
  ): IPlannedBlock | null {
    if (!facts.debugMode || facts.clampOps.size === 0) return null;
    return {
      keyword: null,
      requirements: ["overflow-panic-hosted-libc"],
      sites: [],
    };
  }

  /**
   * Which system headers the implementation file emits, already deduplicated
   * against what its own source includes.
   *
   * The subtraction happens here, not in the renderer. #1108 fixed the same
   * duplicate by having the renderer re-parse `#include` lines it had already
   * pushed -- which made the emitted text an input to the decision, so the
   * answer depended on how much of the file had been rendered so far.
   */
  private static decideSystemIncludes(
    facts: IEmissionFacts,
  ): readonly string[] {
    return UnwrittenIncludes.of(
      [
        ...CTypeIncludes.decide(facts.cTypes),
        ...SYSTEM_INCLUDES.filter((c) => c.needed(facts)).map((c) => c.target),
      ],
      facts.existingIncludeTargets,
    );
  }

  /**
   * The float-size static asserts, with the keyword and the requirement key
   * decided together.
   *
   * `_Static_assert` is C11 and `static_assert` is C++11, and the pair has to
   * move together or the banner claims a standard the text does not use. They
   * used to be produced by one ternary at the emission site, which kept them in
   * step by co-location; here they are two fields of one record, which keeps
   * them in step by construction.
   */
  private static decideFloatStaticAssert(
    facts: IEmissionFacts,
  ): IPlannedBlock | null {
    if (!facts.needsFloatStaticAssert) return null;
    return {
      keyword: facts.cppMode ? "static_assert" : "_Static_assert",
      requirements: [facts.cppMode ? "float-assert-cpp11" : "float-assert-c11"],
      sites: [...facts.floatAssertSites],
    };
  }

  /** The IRQ wrapper chain and all four of its platform requirements. */
  private static decideIrqWrappers(
    facts: IEmissionFacts,
  ): IPlannedBlock | null {
    if (!facts.needsIrqWrappers) return null;
    return {
      keyword: null,
      requirements: IRQ_WRAPPER_REQUIREMENTS,
      sites: [...facts.irqWrapperSites],
    };
  }
}

export default EmissionPlan;
