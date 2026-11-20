import type TIncludeHeader from "./TIncludeHeader";

/**
 * A system header the plan can decide a generated file includes.
 *
 * Narrower than `TIncludeHeader` in one direction and wider in another: the
 * deferred-code members (`isr`, `float_static_assert`, `irq_wrappers`) are not
 * headers, and `stdint` / `stdbool` are not raised by anyone -- they are
 * decided from the C types a file emits (#1927), so no generator can ask for
 * them.
 */
type TSystemHeader =
  | "stdint"
  | "stdbool"
  | Exclude<
      TIncludeHeader,
      "isr" | "float_static_assert" | "register_layout_assert" | "irq_wrappers"
    >;

export default TSystemHeader;
