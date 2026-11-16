/**
 * How an ADR-016 scope member that declares a VARIABLE is emitted.
 *
 * Every scope variable is emitted at file scope under a scope-qualified C name,
 * with visibility deciding linkage. The three arms are the three shapes that
 * takes, and which one applies is decided from the declaration alone -- so the
 * choice is made once, here, and the renderer does not re-derive it.
 *
 * ## The `skipped` arm is why this is a union rather than a nullable record
 *
 * Issue #282 inlines a PRIVATE CONST SCALAR at its use sites instead of
 * emitting it, and Issue #500 exempts arrays because an array cannot be
 * inlined. A skipped member must render NOTHING -- not even its type --
 * because rendering a type registers an include: a file whose only `u32` is a
 * skipped private const would otherwise gain `#include <stdint.h>` for a
 * declaration that never appears. Stating the skip as an arm with no renders
 * on it makes that structural instead of a rule to remember.
 */
type TPlannedScopeVariable =
  /** Issue #282/#500: a private const scalar, inlined at its uses. */
  | { readonly kind: "skipped" }
  /** Issue #375: `Type name(arg, arg);` -- C++ constructor syntax. */
  | {
      readonly kind: "constructor";
      readonly fullName: string;
      readonly isPrivate: boolean;
      /** Argument identifiers, already resolved to their scope-qualified names. */
      readonly args: readonly string[];
      readonly renderType: () => string;
    }
  /** Everything else. */
  | {
      readonly kind: "regular";
      readonly fullName: string;
      readonly isPrivate: boolean;
      /** #1984: 1.4 settled the member's type as a callback (ADR-029) */
      readonly isCallback: boolean;
      readonly isConst: boolean;
      readonly isArray: boolean;
      /** #1668: the declaration's `DeclaredPointer` answer, which writes its `*` */
      readonly isPointer: boolean;
      /** ADR-030 provenance is recorded at the DECLARATION's position. */
      readonly declarationLine: number | undefined;
      /** Rendered `atomic`/`volatile` prefixes; at most one is non-empty. */
      readonly atomic: string;
      readonly volatile: string;
      readonly renderType: () => string;
      readonly renderArrayTypeDimensions: () => string;
      /** Null when the declaration carries no C-style trailing dimensions. */
      readonly renderCStyleDimensions: (() => string) | null;
      readonly renderStringCapacityDimension: () => string;
      readonly renderInitializer: () => string;
      /** #1735: the compliance annotation written above it, or "" */
      readonly note: string;
    };

export default TPlannedScopeVariable;
