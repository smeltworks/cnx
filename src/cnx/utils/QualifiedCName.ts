/**
 * QualifiedCName - the single source of truth for how cnx builds C identifiers
 * from scope-qualified names.
 *
 * ADR-016 gives scope members the C name `Scope_member`; ADR-017 does the same for
 * enum members. ADR-063 reserves the separator so that join is injective: because a
 * cnx identifier may not end with `_` or contain `__`, a name built from N
 * components splits back into exactly those N components, and a plain identifier can
 * never collide with a qualified one.
 *
 * That guarantee only holds if EVERY producer and consumer agrees on the separator.
 * Before this module the separator was written out at ~80 independent sites and
 * reverse-parsed at 14 more, so changing it meant changing all of them in lockstep —
 * the duplicate-code-path anti-pattern this project forbids outright. Route all
 * qualified-name construction and decomposition through here.
 *
 * NOT for C++ namespace qualification (`Ns::Type`). That is a different separator for
 * a different target language; see FormatUtils.getScopeSeparator().
 */
class QualifiedCName {
  /**
   * The separator between components of a qualified C name.
   *
   * ADR-063 reserves this sequence: no cnx identifier may contain it, which is
   * what makes the join injective. Enforced by E0201 (1.2's IdentifierForm).
   */
  static readonly SEPARATOR = "__";

  /**
   * The separator used in cnx source to qualify a name (`Scope.member`).
   */
  static readonly SOURCE_SEPARATOR = ".";

  /**
   * The C name of a name the author wrote IN FULL -- `Motor.State.IDLE`, or its
   * identifier chain `["Motor", "State", "IDLE"]` -- outermost first.
   *
   * Empty and undefined parts are dropped, so a global symbol keeps its bare
   * name, and any part may itself be dotted (`"Outer.Inner"`).
   *
   * This translates a complete written name into its C spelling; it does not
   * qualify a member by its scope. A caller that holds a scope has a REFERENCE,
   * and the encoders in `ScopeUtils` take that reference's whole enclosing PATH.
   * Joining a scope's NAME to a member here would drop every outer scope -- the
   * divergence #1357 removed -- which is why every call is adjudicated by
   * `npm run scope-joins:check` (#2116).
   *
   * @param written The name as written, e.g. "Motor.State.IDLE"
   * @returns The generated C identifier, e.g. "Motor__State__IDLE"
   */
  static fromSourceName(
    written: string | readonly (string | undefined | null)[],
  ): string {
    return QualifiedCName.toParts(
      typeof written === "string" ? [written] : written,
    ).join(QualifiedCName.SEPARATOR);
  }

  /**
   * Build the SOURCE-language qualified name from its components, outermost
   * first — `Outer.Inner.tick`, the way a cnx author would write it.
   *
   * The counterpart to fromSourceName(). The two namespaces are separate on purpose:
   * `Outer__Inner__tick` is what the C compiler sees, `Outer.Inner.tick` is what
   * the author typed, and neither is derivable from the other at a call site
   * without knowing which one it already holds. A diagnostic wants this one; a
   * lookup key wants fromSourceName().
   *
   * Takes a complete path for the same reason fromSourceName() does -- the source
   * spelling is just as capable of dropping an outer scope as the C spelling.
   *
   * @param parts Ordered name parts, e.g. ["Motor", "State", "IDLE"]
   * @returns The source spelling, e.g. "Motor.State.IDLE"
   */
  static fromSourceParts(
    parts: readonly (string | undefined | null)[],
  ): string {
    return QualifiedCName.toParts(parts).join(QualifiedCName.SOURCE_SEPARATOR);
  }

  /**
   * Split a qualified C name back into its components.
   *
   * Exact inverse of fromSourceName() for names built from ADR-063-conformant identifiers.
   *
   * @param qualifiedName A generated C identifier, e.g. "Motor__State__IDLE"
   * @returns The components, e.g. ["Motor", "State", "IDLE"]
   */
  static split(qualifiedName: string): string[] {
    return qualifiedName.split(QualifiedCName.SEPARATOR);
  }

  /**
   * Whether a generated C identifier carries a scope qualification.
   *
   * Use instead of testing for a bare underscore: a plain identifier is allowed to
   * contain single underscores (`tick_count`), so `includes("_")` misreports those
   * as qualified.
   */
  static isQualified(name: string): boolean {
    return name.includes(QualifiedCName.SEPARATOR);
  }

  /**
   * Whether a qualified C name sits directly inside the given scope.
   *
   * Use instead of `name.startsWith(scope + "_")`, which hardcodes the separator.
   */
  static isInScope(
    name: string,
    scopePath: string | undefined | null,
  ): boolean {
    if (!scopePath) {
      return false;
    }
    return name.startsWith(QualifiedCName.prefixFor(scopePath));
  }

  /**
   * The prefix a member of the given scope carries, separator included.
   */
  static prefixFor(scopePath: string): string {
    return (
      QualifiedCName.toParts([scopePath]).join(QualifiedCName.SEPARATOR) +
      QualifiedCName.SEPARATOR
    );
  }

  /**
   * Re-qualify a generated C name for C++ namespace syntax (`A__B` -> `A::B`).
   *
   * Splits on the C separator rather than replacing every underscore, so a component
   * containing a single underscore (`tick_count`) survives intact.
   */
  static toCppQualified(name: string, cppSeparator: string): string {
    return QualifiedCName.split(name).join(cppSeparator);
  }

  /**
   * Expand components into flat parts, dropping empties and splitting dotted paths.
   */
  private static toParts(
    components: readonly (string | undefined | null)[],
  ): readonly string[] {
    const parts: string[] = [];
    for (const component of components) {
      if (!component) {
        continue;
      }
      for (const part of component.split(QualifiedCName.SOURCE_SEPARATOR)) {
        if (part) {
          parts.push(part);
        }
      }
    }
    return parts;
  }
}

export default QualifiedCName;
