import type IPlannedSafeDivision from "./IPlannedSafeDivision";
import type IRequirementSite from "./IRequirementSite";

/**
 * The fully-resolved input to ONE file's emission decisions, gathered at the
 * end of 2.2 Plan's walk of the file, before 2.3 writes any of it (#1991).
 *
 * The `.c` analogue of `IHeaderEmissionFacts` (#1323): freezing the questions
 * into a record is what lets 2.2 decide from a value rather than from live
 * state, and what lets 2.3 Render take a plan instead of a state container.
 *
 * ## Questions, not answers
 *
 * Every field here is a QUESTION the file has raised -- "did anything ask for
 * `<string.h>`?". `IEmissionPlan` holds the answers. The split is the point:
 * the questions are what the generators accumulate while producing text, and
 * the answers are what a renderer may consume without deciding anything
 * further.
 */
interface IEmissionFacts {
  /**
   * Whether this run emits C++.
   *
   * Read to DECIDE a keyword, never carried into the plan: #1313 grooming
   * decision 3 makes the plan per-file with no mode axis, because `cppMode` is
   * a monotone latch and therefore a Tier 2 fact rather than a dimension.
   */
  readonly cppMode: boolean;

  /**
   * The C types 2.2 planned the file's text to spell (`uint8_t`, `bool`),
   * from which the plan decides `<stdint.h>` / `<stdbool.h>` (#1927, #1991)
   */
  readonly cTypes: ReadonlySet<string>;
  readonly needsString: boolean;
  readonly needsCMSIS: boolean;
  readonly needsLimits: boolean;
  /** #1610: the C file writes `NULL`, which `<stddef.h>` declares */
  readonly needsStddef: boolean;

  readonly needsFloatStaticAssert: boolean;
  readonly needsIrqWrappers: boolean;
  readonly needsISR: boolean;

  /**
   * Whether the implementation file includes its own header.
   *
   * The header owns ADR-040's `ISR` typedef, so a file that includes it must
   * not emit the typedef as well (#369/#1164).
   */
  readonly selfIncludeAdded: boolean;

  /**
   * Include targets the file already carries verbatim from its own source,
   * spelled as they are written (`"<stdint.h>"`).
   *
   * Passed in so the plan can decide the FINAL set rather than leaving a
   * renderer to subtract one list from another -- a subtraction is a decision,
   * and #1108's dedup used to make it by re-parsing text the renderer had
   * already emitted.
   */
  readonly existingIncludeTargets: readonly string[];

  /** ADR-044 clamp helper keys accumulated while generating (`"add_u32"`). */
  readonly clampOps: ReadonlySet<string>;
  /** ADR-044 (#1790): `wrap` overflow helper keys (`"div_i32"`). */
  readonly wrapOps: ReadonlySet<string>;
  /** #2207: a string copy goes through `cnx_string_copy` */
  readonly stringCopyHelper: boolean;
  /** #1668: single-evaluation saturating cast keys (`"f32_u8"`) */
  readonly castHelpers: ReadonlySet<string>;
  /** ADR-058: runtime integer length helpers (`"cnx_value_bit_length"`) */
  readonly lengthHelpers: ReadonlySet<string>;

  /** ADR-051 safe-division helpers, by name. */
  readonly safeDivOps: ReadonlyMap<string, IPlannedSafeDivision>;

  /** Sites that asked for the float static asserts, for attribution. */
  readonly floatAssertSites: readonly IRequirementSite[];

  /** Sites that asked for the IRQ wrappers, for attribution. */
  readonly irqWrapperSites: readonly IRequirementSite[];

  /** ADR-044 debug mode, from which 2.2 decides whether clamp helpers panic. */
  readonly debugMode: boolean;

  /** #1997: Render emitted a `.field = value` initializer, in either mode. */
  readonly emittedDesignatedInitializer: boolean;

  /** #1997: Render emitted a compound literal, in either mode. */
  readonly emittedCompoundLiteral: boolean;

  /** #1997: Render emitted an LDREX/STREX loop. */
  readonly emittedLdrexStrexLoop: boolean;

  /** Where Render emitted LDREX/STREX loops, for attribution only. */
  readonly ldrexStrexSites: readonly IRequirementSite[];

  /** #1789: Render emitted a GNU `__atomic` compare-exchange loop. */
  readonly emittedCompareExchangeLoop: boolean;

  /** Where Render emitted compare-exchange loops, for attribution only. */
  readonly compareExchangeSites: readonly IRequirementSite[];

  /** #1789 review: one of them is on a type wider than the target's word. */
  readonly emittedWideCompareExchangeLoop: boolean;

  /** Where Render emitted those, for attribution only. */
  readonly wideCompareExchangeSites: readonly IRequirementSite[];
}

export default IEmissionFacts;
