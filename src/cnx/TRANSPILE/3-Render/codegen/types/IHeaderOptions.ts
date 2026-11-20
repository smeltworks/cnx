/**
 * Options for header file generation
 */
interface IHeaderOptions {
  /** Include system headers in the output */
  includeSystemHeaders?: boolean;

  /**
   * Issue #424: User-provided includes from the source file.
   * These will be added to the generated header if any extern declarations
   * use macros (non-numeric array dimensions) from these headers.
   * Example: ['#include "config.h"', '#include "sizes.h"']
   */
  userIncludes?: string[];

  /**
   * Issue #497: Map of external type names to their C header include directives.
   * When a type from a C header is used in public interfaces, the header should
   * be included rather than generating a conflicting forward declaration.
   * Example: Map { "Data" => '#include "data-types.h"' }
   */
  externalTypeHeaders?: ReadonlyMap<string, string>;

  /**
   * Issue #1164: the source's own C/C++ headers were propagated into this
   * header because it names something only they define.
   *
   * When they are present an external type's real declaration is already in
   * scope, and the usual `typedef struct X X;` forward declaration becomes a
   * competing -- and for a pointer typedef, contradictory -- declaration of the
   * same name. Guessing is only justified when nothing better is available.
   */
  readonly cHeadersIncluded?: boolean;

  /**
   * ADR-040: this translation unit uses the `ISR` function-pointer type.
   *
   * The header used to decide this for itself by scanning exported
   * declarations, which is a strict subset of "the file needs ISR" -- an `ISR`
   * local inside a function body is invisible to it. Since the .c stops
   * emitting the typedef once it includes the header, that subset made the
   * suppression unsound: the type was emitted nowhere. Both sides now read the
   * same flag.
   */
  readonly needsIsrTypedef?: boolean;

  /**
   * Issue #1205: structs whose ADR-029 init function the `.c` emitted, so the
   * header can declare each one (MISRA C:2012 Rule 8.4).
   *
   * Passed in rather than derived here for the same reason as the flag above:
   * the header's own view of struct fields is a superset -- it includes
   * scope-nested structs, which get no init function (#1283) -- so deciding
   * locally would declare functions that are never defined.
   */
  readonly generatedStructInits?: ReadonlySet<string>;
  /**
   * #1453 / ADR-004: the accessor `#define` blocks of the registers this
   * header defines, rendered by the `.c` generator. Same contract as
   * `generatedStructInits`: captured, never read live.
   */
  readonly registerBlocks?: readonly string[];

  /**
   * ADR-072: every register type this header can name. One is never a
   * forward-declared external struct: its layout is in its own file's header.
   */
  readonly registerTypes?: ReadonlySet<string>;

  /**
   * Issue #1517: the system headers this header emits, decided by 2.2 Plan.
   *
   * Not a flag the renderer interprets -- the strings it prints. It used to
   * emit `<stdint.h>` and `<stdbool.h>` unconditionally while the `.c` was
   * precise, so one question had two derivations that agreed only where both
   * happened to be true.
   */
  systemIncludes?: readonly string[];
}

export default IHeaderOptions;
