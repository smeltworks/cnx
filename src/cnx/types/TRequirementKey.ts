/**
 * Issue #1143: Stable identity of one toolchain requirement.
 *
 * Keys are **per-arm, not per-feature**. The IRQ-wrapper block emits three
 * platform arms in one #if/#elif chain, and each arm depends on a
 * different platform library -- ARMv7-M, Arduino, avr-libc. Collapsing
 * them into one "critical section" key is what makes a requirements table lie:
 * it forces a single answer to a question whose answer is per-target.
 *
 * The union is closed, and TOOLCHAIN_REQUIREMENTS is a Record over it, so
 * adding a key without adding its registry entry is a compile error.
 */
type TRequirementKey =
  // --- baselines: what any file in a given mode already costs ---
  | "baseline-c"
  | "baseline-cpp"
  // --- float bit indexing ---
  | "float-assert-c11"
  | "float-assert-cpp11"
  // --- register layout asserts (ADR-072) ---
  | "register-layout-assert-c11"
  | "register-layout-assert-cpp11"
  // --- critical sections (ADR-050), one key per platform arm ---
  | "critical-arm-gnu"
  | "critical-arduino"
  | "critical-avr-libc"
  // --- atomics (ADR-049) ---
  | "atomic-ldrex-cmsis"
  | "atomic-gnu-builtins"
  | "atomic-libatomic"
  // --- struct initializers ---
  | "cpp-designated-initializer"
  | "cpp-compound-literal"
  // --- debug mode ---
  | "overflow-panic-hosted-libc";

export default TRequirementKey;
