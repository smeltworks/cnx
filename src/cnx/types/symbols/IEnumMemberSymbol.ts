import type IBaseSymbol from "./IBaseSymbol";
import type TConstExpr from "../TConstExpr";

/**
 * Symbol representing one member of an enum.
 *
 * ## Why a symbol and not a number
 *
 * `IEnumSymbol.members` was `ReadonlyMap<string, number>`, so a member had a
 * value and nothing else -- no position, and no identity. Both were then
 * rebuilt by whoever needed them, and neither was rebuilt correctly:
 * `parseWithSymbols` reported the ENCLOSING ENUM's line for every member, which
 * is the "members carry their parent's position" defect #1318 exists to remove,
 * and it re-derived the qualified name by hand, which is the #1285 shape.
 *
 * ## Identity
 *
 * `scopePath` is the enum's `cnxScopedName` -- `EColor`, or `Motor.EMode` for a
 * scope-declared enum. `ScopeUtils.identityOf` then yields exactly the
 * identifier codegen already emits (`EColor__RED`, `Motor__EMode__HIGH`),
 * because `QualifiedCName.fromSourceName` expands the dotted component. Nothing here
 * invents an encoding; the member is spelled by the same encoder as everything
 * else, which is the whole point of ADR-063 being injective.
 *
 * ## Visibility
 *
 * A member is exactly as visible as the enum that declares it -- there is no
 * per-member access control in ADR-016 -- so it inherits, rather than
 * hardcoding "public" beside a parent that may be private. That hardcoded-flag
 * shape is what emitted every private struct, enum and bitmap into the public
 * header (#1300).
 */
interface IEnumMemberSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "enum_member" */
  readonly kind: "enum_member";

  /**
   * The member's value as written (`A <- FOO + 1`), or null when it continues
   * from the member before it.
   */
  readonly valueExpr: TConstExpr | null;

  /**
   * The member's numeric value, after ADR-017's auto-increment.
   *
   * Null out of 1.3 Declare, which cannot know it: a value may name a const or
   * an earlier member, and those settle across the whole program (#1669). 1.4
   * Resolve settles it, once, so a consumer never re-runs the increment and
   * the value a member carries is the value C is emitted with. Still null
   * after 1.4 only when the value has none -- it names a variable, overflows,
   * or leaves `i32` -- which 2.1 Analyze reports before anything emits it.
   */
  readonly value: number | null;
}

export default IEnumMemberSymbol;
