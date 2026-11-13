/**
 * A callback typedef a generated header owns, in the shape the header
 * generator consumes (ADR-029 Function-as-Type, issue #1164).
 *
 * Extracted from an inline anonymous type in `IHeaderTypeInput.callbackTypes`
 * (CLAUDE.md: two interfaces needing the same fields extract a shared type)
 * when `Transpiler._buildCallbackTypesForHeader()` needed the identical shape
 * -- it had its own inline copy that had drifted narrower (2 fields per
 * parameter instead of 6), a divergence TypeScript did not catch because the
 * wider object it actually built was assigned through a `.map()` call rather
 * than as a literal at the declaration site.
 */
import type ICallbackTypedefParameter from "./ICallbackTypedefParameter";

interface IHeaderCallbackType {
  readonly typedefName: string;
  readonly returnType: string;
  /** #1209: as `ICallbackTypeInfo.returnBuffer` */
  readonly returnBuffer: string | null;
  /**
   * Exactly what `CallbackTypedefFormatter` consumes, not a copy of it.
   *
   * The inline shape this replaced listed six of the seven fields and omitted
   * `isString`, so a `string<N>` parameter reached the formatter with the flag
   * undefined, fell past the branch that adds its `const`, and produced
   * `(char*)` against a `(const char*)` prototype in the SAME file at exit 0.
   * That is the identical defect the 2-field version caused (#1164), one field
   * later -- which is the argument for naming the formatter's own type rather
   * than re-listing its fields a third time.
   */
  readonly parameters: ReadonlyArray<ICallbackTypedefParameter>;
}

export default IHeaderCallbackType;
