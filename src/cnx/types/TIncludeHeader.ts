/**
 * Header include types that can be required by generators.
 *
 * `<stdint.h>` and `<stdbool.h>` are not here: they are decided from the C
 * types a file emits (`CTypeIncludes`, #1927), so a generator records the type
 * rather than asking for the header.
 *
 * - string: String functions (strlen, strcmp, etc.)
 * - cmsis: CMSIS intrinsics (for atomic operations)
 * - irq_wrappers: IRQ wrapper functions for critical sections (avoids macro collisions)
 * - float_static_assert: Static assert for float bit indexing size verification
 * - limits: limits.h for float-to-int clamp casts
 * - stddef: stddef.h for the `NULL` a C file writes (#1610)
 * - isr: ISR function pointer typedef (ADR-040)
 */
type TIncludeHeader =
  | "string"
  | "cmsis"
  | "irq_wrappers"
  | "float_static_assert"
  | "limits"
  | "stddef"
  | "isr";

export default TIncludeHeader;
