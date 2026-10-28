/**
 * 2.2 Plan -- which system headers a file's public header includes.
 *
 * `docs/architecture/README.md` §1: "**2.2 decides, 2.3 formats.** 'Does this
 * file need `<stdint.h>`?' is decided once, in the plan."
 *
 * ## Why this can be a symbol walk now, and could not be before
 *
 * #1517 first made the header precise by scanning the declarations it had just
 * rendered, and deliberately so: deciding from the SYMBOLS would have meant
 * working out, a second time, what `mapType` works out when it renders -- that
 * `u32` becomes `uint32_t`. Two derivations of one mapping is the defect the
 * whole pass exists to remove, and putting one in the plan would only have
 * moved it somewhere more respectable.
 *
 * #1520 removed the second derivation. `headerCType` is now the one answer to
 * "what does this header call this type", shared by struct fields, function
 * returns and parameters -- so asking it here is asking the renderer's own
 * question, not re-deciding it. The scan can go, and with it Render's last
 * say in what a header contains.
 *
 * ## Under-including is the direction that breaks a build
 *
 * A type this misses loses its header. `npm run headers:standalone:check`
 * compiles all 1305 generated headers alone, so a miss is a red build rather
 * than something a consumer discovers -- which is what makes a walk safe to
 * prefer over a text scan that could only ever over-include.
 */

import type TSymbol from "../../types/symbols/TSymbol";
import headerCType from "../../utils/headerCType";
import CTypeIncludes from "./CTypeIncludes";
import HeaderTypeNames from "./HeaderTypeNames";
import UnwrittenIncludes from "./UnwrittenIncludes";

class HeaderIncludes {
  /**
   * The system headers this file's public header emits, in emission order.
   *
   * The decision is `CTypeIncludes`', the same one the implementation file
   * makes (#1927); this only names the C types the header declares.
   *
   * @param exportedSymbols the file's public interface, as `PublicInterface`
   *   settled it -- the same list the header is generated from
   * @param writtenIncludes the `#include` lines the header carries through
   *   from the source, whose system headers it must not include twice (#2188)
   */
  static decide(
    exportedSymbols: readonly TSymbol[],
    writtenIncludes: readonly string[],
  ): string[] {
    return UnwrittenIncludes.of(
      CTypeIncludes.decide(
        [...HeaderTypeNames.collect(exportedSymbols)].map((named) =>
          headerCType(named),
        ),
      ),
      writtenIncludes.flatMap((line) => UnwrittenIncludes.targetOf(line) ?? []),
    );
  }
}

export default HeaderIncludes;
