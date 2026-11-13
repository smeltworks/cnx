import type IPlannedSafeDivision from "./IPlannedSafeDivision";
import type IPlannedBlock from "./IPlannedBlock";
import type IRecordedRequirement from "./IRecordedRequirement";

/**
 * 2.2 Plan's artifact: what C should exist for ONE file.
 *
 * `docs/architecture/README.md` §1 -- "**2.2 decides, 2.3 formats.** 'Does this
 * file need `<stdint.h>`?' is decided once, in the plan. Render reads the plan
 * and produces text from it."
 *
 * ## Per-file, and no mode field
 *
 * #1313 grooming decision 3. `cppMode` is a one-shot latch -- seeded from
 * `--cpp`, raised by reading an included header, never lowered -- so it is
 * monotone, therefore order-independent, therefore a Tier 2 fact on `Program`
 * rather than an axis a plan is indexed by. The plan READS it to decide
 * `keyword` above; it does not carry it, and there is no (file x mode) pair.
 *
 * ## What may live here, and what may not
 *
 * Every field must be a DECISION -- an answer to "what C should exist?" that a
 * renderer consumes without asking anything further. A field a renderer has to
 * interpret is a decision that did not get made, and the interpretation is the
 * second derivation this artifact exists to remove.
 *
 * That is why `systemIncludes` holds `"<stdint.h>"` and not `needsStdint`: the
 * flag is a question, the string is the answer. Before #1449 the `.c` asked the
 * flag and emitted conditionally while the header emitted `<stdint.h>` and
 * `<stdbool.h>` unconditionally -- one question with two derivations that
 * agreed only where both happened to be true.
 *
 * It carries no `sourcePath`. A draft had one and nothing read it: the plan is
 * built and consumed inside one file's turn, so nothing keys by it -- unlike
 * `IFileSymbols.sourceFile`, which `Program.build` genuinely indexes on. A
 * member written and never read is the shape #1394 is filed against, and
 * "#1450 will want it" is a reason to add it then, with its consumer.
 */
interface IEmissionPlan {
  /**
   * System headers the implementation file includes, already spelled as they
   * are emitted and in emission order. Empty when it needs none.
   */
  readonly systemIncludes: readonly string[];

  /** The float-size static asserts, or null when the file has no float bit indexing. */
  readonly floatStaticAssert: IPlannedBlock | null;

  /**
   * The IRQ wrapper chain, or null when the file opens no critical section.
   *
   * Carries ALL four platform requirements, never one: the emitted block is a
   * single `#if`/`#elif`/`#else` chain and which arm applies is decided by the
   * compiler, not here. Recording one would force an answer to a per-target
   * question (#1143).
   */
  readonly irqWrappers: IPlannedBlock | null;

  /**
   * Whether the file emits ADR-040's `ISR` typedef itself.
   *
   * False when the file includes its own header, which owns the typedef --
   * emitting both is a redeclaration error (#369/#1164).
   */
  readonly isrTypedef: boolean;

  /** ADR-044 overflow-clamp helper keys (`"add_u32"`), in emission order. */
  readonly clampOps: readonly string[];

  /** ADR-044 (#1790): `wrap` overflow helper keys (`"div_i32"`), in emission order. */
  readonly wrapOps: readonly string[];

  /** #2207: whether the file defines `cnx_string_copy` */
  readonly stringCopyHelper: boolean;

  /**
   * ADR-044 debug mode's panicking overflow helpers, or null when the helpers
   * clamp or there are none. Render picks the panic templates from this, so
   * the hosted-libc cost and the `<stdio.h>` it pays for are one decision
   * (#1997).
   */
  readonly panicOverflowHelpers: IPlannedBlock | null;

  /** ADR-051 safe-division helpers, in emission order. */
  readonly safeDivOps: readonly IPlannedSafeDivision[];

  /** #1668: single-evaluation saturating cast keys (`"f32_u8"`), in emission order. */
  readonly castHelpers: readonly string[];

  /** ADR-058: runtime integer length helpers, in emission order */
  readonly lengthHelpers: readonly string[];

  /**
   * #1997: the requirements no planned block carries -- the mode baseline, the
   * C++ initializer forms, LDREX/STREX atomics.
   * Render reports which forms it emitted; what each costs is decided here.
   */
  readonly formRequirements: readonly IRecordedRequirement[];
}

export default IEmissionPlan;
