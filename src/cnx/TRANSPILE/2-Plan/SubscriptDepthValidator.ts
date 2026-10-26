/**
 * Issue #1106: codegen's invariant for subscript-chain depth.
 *
 * Per ADR-036 each subscript peels one array dimension; per ADR-007 a scalar
 * integer/float may be bit-indexed once, and a `bool`, a `char` or a 1-bit
 * field not at all. A deeper chain indexes a value that is not an array --
 * e.g. `flags[4][3]` on a scalar `u8`, where `flags[4]` is already a single
 * bit. `SubscriptDepth` decides the limit of each run of subscripts, on the
 * typer's chain, and pass 2.1's E0856 reads the same answer.
 *
 * This is codegen's single place to assert that limit. The read path (the
 * postfix plan) and the write path (the assignment target's declaration) both
 * call it with the typer's steps, so every run E0856 measures -- a struct
 * field's included (#1114) -- is asserted here too. Struct, enum and string
 * bases (#2357, #2264) and C pointers (#2358) are not measured.
 */
import type TExpression from "../../types/syntax/TExpression";
import type IChainStep from "../../types/IChainStep";
import SubscriptDepth from "../../utils/SubscriptDepth";
import invariant from "../../utils/invariant";

class SubscriptDepthValidator {
  /**
   * Assert that no run of subscripts in `chain`, typed as `steps`, is deeper
   * than its value allows.
   *
   * #1322: the `line` parameter went with the throw. It existed only to be
   * spelled into the message, which is what a diagnostic's position is for.
   */
  static validate(chain: TExpression, steps: readonly IChainStep[]): void {
    if (chain.kind !== "postfix") return;
    const runs = SubscriptDepth.overIndexed(chain.ops, steps);
    invariant(
      runs.length === 0,
      `'${chain.written}' is subscripted no deeper than its shape allows -- E0856 rejects this in pass 2.1, before this runs`,
    );
  }
}

export default SubscriptDepthValidator;
