/**
 * #2311 / ADR-046: the `const` a read-only binding is written with. A C type
 * that already starts with `const` -- a `cstring` is `const char*` -- spells
 * it, so the binding adds none: a second `const` is a duplicate specifier,
 * which C diagnoses and C++ rejects. Every declaration form reads this one
 * answer, so a local, a scope member, a parameter and its header cannot
 * disagree.
 */
class ConstQualifier {
  static prefix(cType: string, isReadOnly: boolean): string {
    return isReadOnly && !ConstQualifier.isSpelled(cType) ? "const " : "";
  }

  static isSpelled(cType: string): boolean {
    return cType.startsWith("const ");
  }
}

export default ConstQualifier;
