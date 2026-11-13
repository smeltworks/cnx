/**
 * ReservedCnxName - the single source of truth for names the transpiler invents.
 *
 * ADR-063 part 2 reserves the `cnx_` prefix, compared case-insensitively, for
 * every name that corresponds to no user declaration: temporaries, the strlen
 * cache, overflow helpers, include guards. A user identifier may not begin with
 * it (E0202), which is what makes the transpiler's namespace and the user's
 * disjoint.
 *
 * Before this module each family spelled its own convention — `_tmp<N>`,
 * `_<var>_len`, `_cnx_tmp_<N>`, `cnx_clamp_*`, `<BASENAME>_H` — and three of the
 * five chose shapes a user could declare. Issue #1131 verified the consequence:
 * a user global `_msg_len` was shadowed by the generated strlen cache and every
 * later read silently bound to the wrong storage, with a clean `-Wall -Wextra`
 * compile and exit 0. Route all invented names through here.
 *
 * NOT for qualified user names (`Scope__member`). Those are built by
 * QualifiedCName, and the two must not be confused: `__` asserts "qualified user
 * name, component boundary here", which a temporary has no business claiming.
 */
import type TOverflowBehavior from "../types/TOverflowBehavior";
class ReservedCnxName {
  /**
   * The reserved prefix, in the case used for C identifiers.
   *
   * Rejected in user declarations by E0202 (1.2's IdentifierForm).
   */
  static readonly PREFIX = "cnx_";

  /**
   * Whether an identifier sits in the transpiler's reserved namespace.
   *
   * Prefix-only and case-insensitive, exactly as ADR-063 states. `my_cnx_buffer`
   * is legal — a prefix is all that is needed to keep the namespaces disjoint,
   * so that is all this checks.
   */
  static isReserved(identifierName: string): boolean {
    return identifierName.toLowerCase().startsWith(ReservedCnxName.PREFIX);
  }

  /**
   * Name for a generated temporary, e.g. `cnx_tmp3`.
   *
   * Replaces the former `_tmp<N>` (slice-assignment unroll) and `_cnx_tmp_<N>`
   * (argument temporary). Both drew from the same counter, so unifying the
   * spelling cannot make two live temporaries collide.
   */
  static temporary(counter: number): string {
    return `${ReservedCnxName.PREFIX}tmp${counter}`;
  }

  /**
   * Name for the cached `strlen` of a string variable, e.g. `cnx_len_message`.
   *
   * The variable name is a suffix rather than an infix (the former shape was
   * `_<var>_len`) so that every generated name reads prefix-first.
   */
  static stringLengthCache(variableName: string): string {
    return `${ReservedCnxName.PREFIX}len_${variableName}`;
  }

  /**
   * ADR-044 (#1790): an overflow helper of either family, `cnx_wrap_div_i32`.
   *
   * The clamp family already conformed before ADR-063 part 2; both families
   * are routed through here so the prefix has exactly one definition.
   */
  static overflowHelper(
    behavior: TOverflowBehavior,
    operation: string,
    cnxType: string,
  ): string {
    return `${ReservedCnxName.PREFIX}${behavior}_${operation}_${cnxType}`;
  }

  /** #1668: a single-evaluation saturating cast, `cnx_cast_sat_f32_u8` */
  static castHelper(sourceType: string, targetType: string): string {
    return `${ReservedCnxName.PREFIX}cast_sat_${sourceType}_${targetType}`;
  }
}

export default ReservedCnxName;
