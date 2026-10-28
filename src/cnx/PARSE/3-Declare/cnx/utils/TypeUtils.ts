/**
 * TypeUtils - Utilities for extracting and converting cnx types.
 */

import type TTypeSyntax from "../../../../types/syntax/TTypeSyntax";
import TypeNameLadder from "../../../../utils/TypeNameLadder";
import TypeResolver from "../../../../utils/TypeResolver";
import TTypeUtils from "../../../../utils/TTypeUtils";
import ScopeUtils from "../../../../utils/ScopeUtils";
import type TType from "../../../../types/TType";
import type ITypeBindingDeps from "../../../../types/ITypeBindingDeps";
import invariant from "../../../../utils/invariant";
import type IDeclareTypeFacts from "../../types/IDeclareTypeFacts";

/**
 * Static utility class for extracting and converting cnx type names.
 */
class TypeUtils {
  /**
   * Extract the type name from a type context.
   * Handles scoped types (this.Type), qualified types (Scope.Type),
   * and simple types.
   *
   * @param ctx The type context (may be null)
   * @param scopePath Enclosing scope path for this.Type resolution ("" at file
   *                  scope)
   * @param typeFacts ADR-057: predicate answering whether a *qualified* name
   *                    is a type declared in the current scope. Omit at call
   *                    sites that have no scope context.
   * @returns The resolved type name
   */
  static getTypeName(
    type: TTypeSyntax | null,
    scopePath = "",
    typeFacts?: IDeclareTypeFacts,
  ): string {
    if (!type) return "void";

    // #1285/#1932: one ladder for a type's written name. The walker asks the
    // same `resolveWrittenName`, so the `.h` and the `.c` cannot disagree.
    const result = TypeNameLadder.resolveWrittenName(
      type,
      scopePath,
      TypeUtils.depsOf(typeFacts),
    );
    if (result !== null) {
      return result;
    }

    // templateType and `void` are the alternatives resolveWrittenName does not
    // answer for; both are already their own text.
    return type.text;
  }

  /**
   * The `TType` for a type context, deferring what 1.3 Declare cannot settle.
   *
   * Declare knows only the scope types THIS file declares. A bare `T` inside a
   * scope may name one from an included file, and ADR-057 cannot be applied
   * later from the resolved string, because a bare `Mode` that stayed bare and
   * `global.Mode` are byte-identical by then. So the unsettled case is recorded
   * as `TDeferredType`, carrying the written identifier and the scope it was
   * written in, and 1.4 Resolve settles it against the scope types the file
   * and its include closure declare.
   *
   * Everything else resolves exactly as before, through `getTypeName`, so the
   * settled path keeps one implementation rather than gaining a second.
   */
  static resolveType(
    type: TTypeSyntax | null,
    scopePath = "",
    typeFacts?: IDeclareTypeFacts,
  ): TType {
    const deferred = TypeUtils.deferredIfUnsettled(type, scopePath, typeFacts);
    return (
      deferred ??
      TypeResolver.resolve(TypeUtils.getTypeName(type, scopePath, typeFacts))
    );
  }

  /**
   * A `TDeferredType` when this context names a bare type Declare cannot
   * settle, and null when it can.
   *
   * Only the BARE branch is ever unsettled: `this.T`, `global.T` and `Scope.T`
   * state their answer in the syntax. A bare name that qualified is settled
   * too -- the predicate recognized it, so this file declares it. What remains
   * is a bare name that stayed bare inside a scope, which is either a global
   * type or a scope type from an included file, and Declare cannot tell those
   * apart without a cross-file fact it is not allowed to hold.
   *
   * At file scope there is nothing to defer: ADR-057 qualification does not
   * apply, so a bare name there is already its own answer.
   *
   * An array defers on its ELEMENT type, because `resolveWrittenName` treats an
   * array as its element -- dimensions live in their own slot on the symbol.
   * The type is lowered once and classified by the same `TypeNameLadder` that
   * `getTypeName` resolves through, so the spelling is derived in one place.
   */
  private static deferredIfUnsettled(
    type: TTypeSyntax | null,
    scopePath: string,
    typeFacts?: IDeclareTypeFacts,
  ): TType | null {
    if (!type || !typeFacts || ScopeUtils.isGlobalScopePath(scopePath)) {
      return null;
    }

    const lowered = type;
    const element = lowered.kind === "array" ? lowered.element : lowered;
    const classified = TypeNameLadder.classifyNamed(
      element,
      scopePath,
      TypeUtils.depsOf(typeFacts),
    );
    if (classified?.branch !== "bare") {
      return null;
    }

    // Qualified by the predicate, so this file declares it -- settled.
    if (classified.name !== classified.written) {
      return null;
    }

    return TTypeUtils.createDeferred(classified.written, scopePath);
  }

  /** 1.3's ladder deps: ADR-057's predicate, and the stored `Scope.T` spelling */
  private static depsOf(
    typeFacts?: IDeclareTypeFacts,
  ): ITypeBindingDeps | undefined {
    if (!typeFacts) return undefined;
    return {
      isScopeType: (qualifiedName) => typeFacts.isScopeType(qualifiedName),
      resolveQualifiedType: (identifiers) => {
        const written = identifiers.join(".");
        const stored = typeFacts.qualifiedTypeName(written);
        invariant(
          stored !== undefined,
          `1.3 spells every qualified type a file writes ('${written}')`,
        );
        return stored;
      },
    };
  }
}

export default TypeUtils;
