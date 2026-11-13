import type IToolchainRequirement from "../../types/IToolchainRequirement";
import type TRequirementKey from "../../types/TRequirementKey";
import IRQ_WRAPPER_GUARDS from "./IRQ_WRAPPER_GUARDS";

/** A mode's baseline: what every file in that mode costs, unconditionally */
const BASELINE = {
  feature: "baseline",
  compiler: null,
  extensions: [],
  platformLib: null,
  condition: null,
  probe: null,
  misra: ["1.1"],
} as const satisfies Partial<IToolchainRequirement>;

/**
 * Issue #1143: The single source of truth for what generated output costs.
 *
 * Every construct the code generator emits whose acceptance depends on the
 * toolchain has an entry here. Its key is recorded by the Render emitter at
 * the moment it produces the text, or carried by the 2.2 plan block that
 * decided the text (#1928). The transpile-time report, the per-file
 * banner, docs/compatibility.md, the MISRA guideline rows and any compile-time
 * guard are all projections of this table -- none of them re-derives the
 * answer, so none of them can contradict what was emitted.
 *
 * Requirements are CONDITIONAL. A file that uses no critical section pays no
 * CMSIS cost; a file that does not index bits of a float pays no C11 cost. The
 * flat claim "generated code is standard C99" was false in both directions: it
 * overstated what plain files need and understated what these files need.
 *
 * Note there is currently no compiler-version floor anywhere in this table.
 * The only one that ever existed came from the unreachable
 * __builtin_*_overflow calls removed in #1143.
 */
const TOOLCHAIN_REQUIREMENTS: Record<TRequirementKey, IToolchainRequirement> = {
  "baseline-c": {
    ...BASELINE,
    key: "baseline-c",
    modes: ["c"],
    standard: "C99",
    reason: "stdint fixed-width types, // comments, mixed declarations",
    incurredBy: "any cnx file transpiled to C",
    adr: "ADR-044",
  },

  "baseline-cpp": {
    ...BASELINE,
    key: "baseline-cpp",
    modes: ["cpp"],
    standard: "C++11",
    reason: "nullptr, static_cast, reinterpret_cast",
    incurredBy: "any cnx file transpiled with --cpp",
    adr: "ADR-010",
  },

  "float-assert-c11": {
    key: "float-assert-c11",
    modes: ["c"],
    feature: "float bit indexing",
    standard: "C11",
    compiler: null,
    extensions: [],
    platformLib: null,
    condition: null,
    reason: "_Static_assert",
    incurredBy: "reading or writing a bit range of an f32 or f64",
    probe: /_Static_assert\(sizeof\((?:float|double)\)/,
    adr: "ADR-007",
    misra: ["1.1"],
  },

  "float-assert-cpp11": {
    key: "float-assert-cpp11",
    modes: ["cpp"],
    feature: "float bit indexing",
    standard: "C++11",
    compiler: null,
    extensions: [],
    platformLib: null,
    condition: null,
    reason: "static_assert",
    incurredBy: "reading or writing a bit range of an f32 or f64 with --cpp",
    probe: /static_assert\(sizeof\((?:float|double)\)/,
    adr: "ADR-007",
    misra: [],
  },

  "critical-arm-gnu": {
    key: "critical-arm-gnu",
    modes: ["c", "cpp"],
    // #1146: a critical block and an atomic read-modify-write both mask
    feature: "interrupt masking",
    standard: "C99",
    compiler: null,
    extensions: ["GNU inline assembly", "__attribute__((always_inline))"],
    platformLib: "ARMv7-M core",
    condition: IRQ_WRAPPER_GUARDS.arm,
    reason:
      '__asm volatile ("MRS %0, primask"), __attribute__((always_inline))',
    // #1146: an atomic read-modify-write masks through the same wrappers
    incurredBy:
      "a critical block, or an atomic read-modify-write on a target without LDREX/STREX",
    probe: /MRS %0, primask/,
    adr: "ADR-050",
    misra: ["1.2", "Dir 4.3", "20.8", "20.9", "20.14"],
  },

  "critical-arduino": {
    key: "critical-arduino",
    modes: ["c", "cpp"],
    // #1146: a critical block and an atomic read-modify-write both mask
    feature: "interrupt masking",
    standard: "C99",
    compiler: null,
    // The Arduino `#if` is nested INSIDE the ARM arm, so an ARM+Arduino target
    // compiles the PRIMASK helpers as well as noInterrupts(). It needs the ARM
    // arm's extensions too -- this is a refinement of that arm, not an
    // alternative to it, and declaring `[]` here understated it.
    extensions: ["GNU inline assembly", "__attribute__((always_inline))"],
    platformLib: "ARMv7-M core + Arduino core",
    condition: `(${IRQ_WRAPPER_GUARDS.arm}) && ${IRQ_WRAPPER_GUARDS.arduino}`,
    reason: "noInterrupts()",
    // #1146: an atomic read-modify-write masks through the same wrappers
    incurredBy:
      "a critical block, or an atomic read-modify-write on a target without LDREX/STREX",
    probe: /noInterrupts\(\)/,
    adr: "ADR-050",
    misra: ["Dir 4.9", "20.8", "20.9", "20.14"],
  },

  "critical-avr-libc": {
    key: "critical-avr-libc",
    modes: ["c", "cpp"],
    // #1146: a critical block and an atomic read-modify-write both mask
    feature: "interrupt masking",
    standard: "C99",
    compiler: null,
    // Issue #1147: the arm includes <avr/io.h> and <avr/interrupt.h>, which
    // avr-libc provides.
    platformLib: "avr-libc",
    extensions: [],
    condition: IRQ_WRAPPER_GUARDS.avr,
    reason: "SREG, cli()",
    // #1146: an atomic read-modify-write masks through the same wrappers
    incurredBy:
      "a critical block, or an atomic read-modify-write on a target without LDREX/STREX",
    probe: /return SREG;/,
    adr: "ADR-050",
    misra: ["Dir 4.9", "20.8", "20.9", "20.14"],
  },

  "atomic-ldrex-cmsis": {
    key: "atomic-ldrex-cmsis",
    modes: ["c", "cpp"],
    feature: "atomic read-modify-write",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: "CMSIS + ARMv7-M",
    condition: null,
    reason: "__LDREXB/H/W, __STREXB/H/W",
    incurredBy:
      "compound assignment to an atomic variable on a target with LDREX/STREX",
    probe: /__(?:LDREX|STREX)[BHW]\b/,
    adr: "ADR-049",
    misra: ["Dir 4.9"],
  },

  // #1789: a target with neither LDREX/STREX nor interrupt masking (host,
  // esp32) retries a compare-exchange; GCC lowers it to S32C1I on Xtensa
  "atomic-gnu-builtins": {
    key: "atomic-gnu-builtins",
    modes: ["c", "cpp"],
    feature: "atomic read-modify-write",
    standard: "C99",
    compiler: null,
    extensions: ["GNU __atomic builtins"],
    platformLib: null,
    condition: null,
    reason: "__atomic_load(), __atomic_compare_exchange()",
    incurredBy:
      "compound assignment to an atomic variable on a target without LDREX/STREX or interrupt masking",
    probe: /__atomic_compare_exchange\(/,
    adr: "ADR-049",
    misra: ["1.2"],
  },

  // #1789 review: GCC has no native compare-exchange for a type wider than
  // the target's word, so it calls libatomic's __atomic_*_N (u64 on esp32).
  "atomic-libatomic": {
    key: "atomic-libatomic",
    modes: ["c", "cpp"],
    feature: "atomic read-modify-write",
    standard: "C99",
    compiler: null,
    extensions: ["GNU __atomic builtins"],
    platformLib: "libatomic (or the platform's __atomic_*_N, e.g. ESP-IDF's)",
    condition: null,
    reason: "__atomic_load_N(), __atomic_compare_exchange_N() library calls",
    incurredBy:
      "compound assignment to an atomic variable wider than the target's word_size, on a target without LDREX/STREX or interrupt masking",
    probe: /calls libatomic's __atomic_\*_N/,
    adr: "ADR-049",
    misra: ["1.2"],
  },

  "cpp-designated-initializer": {
    key: "cpp-designated-initializer",
    modes: ["cpp"],
    feature: "struct initializer",
    standard: "C++20",
    compiler: null,
    // Accepted by GCC and Clang before C++20 as an extension, which is how the
    // repo's own -std=c++14 harness compiles this output.
    extensions: ["designated initializers in C++"],
    platformLib: null,
    condition: null,
    reason: ".field = value inside a braced initializer",
    incurredBy: "initializing a struct in --cpp mode",
    // Anchored on the brace, not on `= {`: the key is recorded before
    // formatStructInitializer decides whether to wrap the braces in a cast, so
    // the same requirement also appears as `= (T){ .field = ... }`. Anchoring
    // on the assignment made the probe unable to match a form it is recorded
    // for -- a recorded requirement whose emission the probe cannot see, which
    // is the #1141 shape this registry exists to prevent.
    probe: /\{\s*\.[A-Za-z_]\w*\s*=/,
    adr: "ADR-035",
    misra: [],
  },

  "cpp-compound-literal": {
    key: "cpp-compound-literal",
    modes: ["cpp"],
    feature: "struct initializer",
    standard: "C++11",
    compiler: null,
    // Compound literals are not ISO C++ at any version.
    extensions: ["compound literals in C++"],
    platformLib: null,
    condition: null,
    reason: "(T){ ... } in C++",
    incurredBy: "a non-declaration struct literal in --cpp mode",
    probe: /=\s*\([A-Za-z_][\w:]*\)\{/,
    adr: "ADR-035",
    misra: ["1.2"],
  },

  "overflow-panic-hosted-libc": {
    key: "overflow-panic-hosted-libc",
    modes: ["c", "cpp"],
    feature: "overflow panic (--debug)",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: "hosted libc",
    condition: null,
    reason: "fprintf(stderr, ...), abort()",
    incurredBy:
      "transpiling with --debug and using clamp or wrap integer arithmetic",
    probe: /fprintf\(stderr, "PANIC:/,
    adr: "ADR-044",
    misra: ["21.6", "21.8"],
  },
};

export default TOOLCHAIN_REQUIREMENTS;
