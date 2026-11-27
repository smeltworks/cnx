import type IHeaderDeclaratorSyntax from "../types/IHeaderDeclaratorSyntax";
import type ICTypeSpecifierSyntax from "../types/ICTypeSpecifierSyntax";

/** The C type a declarator spells, from 1.2's plain-data declarator (#1991); 1.2 spells a C parameter's with it too */
class DeclaratorTypes {
  /** The type specifiers before `end`, joined; C's implicit `int` if none */
  static baseType(
    specifiers: readonly ICTypeSpecifierSyntax[],
    end: number = specifiers.length,
  ): string {
    return (
      specifiers
        .slice(0, end)
        .map((spec) => spec.text)
        .join(" ") || "int"
    );
  }

  /** `baseType` with one `*` for each the declarator's pointer spells */
  static pointerType(
    baseType: string,
    declarator: IHeaderDeclaratorSyntax | null,
  ): string {
    return DeclaratorTypes.withPointers(
      baseType,
      declarator?.pointerDepth ?? 0,
    );
  }

  /** `baseType` with `depth` `*`s */
  static withPointers(baseType: string, depth: number): string {
    return baseType + "*".repeat(depth);
  }

  /**
   * The declared type: `base (*)(params)` for a function-pointer declarator,
   * otherwise `pointerType`. A function pointer's own `*`s before its
   * parentheses are its return's: `char* (*)(void)` (#2348 review).
   */
  static declaredType(
    baseType: string,
    declarator: IHeaderDeclaratorSyntax,
  ): string {
    if (declarator.functionPointerParams !== null) {
      return `${DeclaratorTypes.pointerType(baseType, declarator)} (*)(${declarator.functionPointerParams})`;
    }
    return DeclaratorTypes.pointerType(baseType, declarator);
  }
}

export default DeclaratorTypes;
