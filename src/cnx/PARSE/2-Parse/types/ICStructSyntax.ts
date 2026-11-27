import type ICFieldSyntax from "./ICFieldSyntax";
import type ICEnumSyntax from "./ICEnumSyntax";

interface ICStructSyntax {
  readonly tag: string | null;
  readonly isUnion: boolean;
  /** Whether a field is a bit-field (`uint32_t a : 3`), which C packs */
  readonly hasBitField: boolean;
  /**
   * #1975 review: a member with no name, `union { ... };` or `struct { ...
   * };`, whose fields the struct holds but `fields` does not list
   */
  readonly hasUnnamedMember: boolean;
  readonly hasBody: boolean;
  readonly fields: readonly ICFieldSyntax[];
  /**
   * #2510 review: each enum its body defines, a nested struct's too, whose
   * constants C gives file scope (`struct P { enum { N = 3 } kind; };`
   * declares `N`)
   */
  readonly enums: readonly ICEnumSyntax[];
}

export default ICStructSyntax;
