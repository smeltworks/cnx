/**
 * What a value binding declares, for the rules that ask about the
 * declaration rather than the value: is it const, what does it initialize
 * to, is it a parameter (#1668), is it volatile or atomic (#2398).
 *
 * Program's binder answers WHICH declaration a spelling means; this reads the
 * two kinds that carry one -- a local's declaration and a variable's symbol --
 * so no rule re-derives the switch between them.
 */

import type TValueBinding from "../../../types/TValueBinding";

interface IBoundDeclaration {
  readonly isConst: boolean;
  readonly isParameter: boolean;
  /** The initializer's text, or null */
  readonly initialValue: string | null;
  readonly isVolatile: boolean;
  readonly isAtomic: boolean;
}

class BoundDeclaration {
  /** A local's or a variable's declaration, or null for anything else */
  static of(binding: TValueBinding | null): IBoundDeclaration | null {
    if (binding?.kind === "local") {
      const declaration = binding.declaration;
      return {
        isConst: declaration.isConst,
        isParameter: declaration.kind === "parameter",
        initialValue: declaration.initialValue,
        isVolatile: declaration.isVolatile,
        isAtomic: declaration.isAtomic,
      };
    }
    if (binding?.kind === "variable") {
      return {
        isConst: binding.symbol.isConst,
        isParameter: false,
        initialValue: binding.symbol.initialValue ?? null,
        isVolatile: binding.symbol.isVolatile,
        isAtomic: binding.symbol.isAtomic,
      };
    }
    return null;
  }
}

export default BoundDeclaration;
