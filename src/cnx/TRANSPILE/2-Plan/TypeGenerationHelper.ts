/**
 * TypeGenerationHelper
 *
 * Helper class for generating C type strings from cnx types.
 * Handles primitive types, scoped types, qualified types, user types, and array types.
 *
 * Extracted from CodeGenerator._generateType for improved testability.
 *
 * ## It renders a plan, not a type context (#1445)
 *
 * The six type alternatives are classified once, by `TypeNameLadder` -- the
 * one ladder every pass asks, whose header already named this helper as one of the
 * seven it was meant to collapse. This module received `ITypeAccessors` and
 * walked them again, so the ladder was still standing in two places and the
 * two agreed only because nothing had changed either since #1285.
 *
 * Three methods went with it. `generateScopedType`, `generateGlobalType` and
 * `generateQualifiedType` had no caller outside that ladder and no caller
 * outside this file's TESTS, which is why knip could not report them (#1418):
 * a test counts as a user. Their decisions are `TypeNameLadder`'s now -- and were
 * already identical, `forMember(path, name)` being a one-line call to the
 * `ScopeUtils.qualifyInScope` that ladder uses.
 *
 * What is left here is the part that really is 2.3's: ADR-046's `cstring`,
 * the `struct` keyword C needs for a tag with no typedef, `TYPE_MAP`, and
 * `char` for a bounded string. `TypeNameLadder` answers those differently on
 * purpose -- it yields `string<32>` where this yields `char` -- which is why
 * the plan keeps them as separate fields instead of folding them into the
 * union.
 */

import TYPE_MAP from "./types/TYPE_MAP";
import TIncludeHeader from "../../types/TIncludeHeader";
import AdrProvenance from "../../instrumentation/AdrProvenance";
import type INamedTypeResolution from "../../types/INamedTypeResolution";
import type IPlannedType from "./types/IPlannedType";
import userCType from "../../utils/userCType";
import type ITypeGenerationDeps from "./types/ITypeGenerationDeps";

/**
 * Result of generating a primitive type.
 */
interface IPrimitiveTypeResult {
  cType: string;
  include: TIncludeHeader | null;
}

class TypeGenerationHelper {
  /**
   * Generate C type for a primitive type.
   * Returns the C type and any required include header.
   */
  static generatePrimitiveType(type: string): IPrimitiveTypeResult {
    let include: TIncludeHeader | null = null;

    // `<stdint.h>` / `<stdbool.h>` are decided from the C type returned here,
    // not from the cnx name (#1927): `f32` is in `TYPE_MAP` and needs
    // neither.
    if (type === "ISR") {
      include = "isr";
    }

    const cType = TYPE_MAP[type] || type;
    return { cType, include };
  }

  /**
   * Generate string type (bounded strings).
   * Returns the base type for char arrays.
   */
  /**
   * #2332: a cnx type name as C spells it, for a value with no written type
   * of its own (a ternary's)
   */
  static generateByName(typeName: string, deps: ITypeGenerationDeps): string {
    return typeName in TYPE_MAP
      ? TypeGenerationHelper.primitiveCType(typeName)
      : TypeGenerationHelper.userTypeCType(typeName, deps);
  }

  /** A primitive's C spelling: `generate`'s and `generateByName`'s one table read */
  private static primitiveCType(primitiveName: string): string {
    return TYPE_MAP[primitiveName] || primitiveName;
  }

  /** A bare user type's C spelling: `renderNamed`'s and `generateByName`'s */
  private static userTypeCType(
    typeName: string,
    deps: ITypeGenerationDeps,
  ): string {
    return userCType(typeName, deps.checkNeedsStructKeyword(typeName));
  }

  static generateStringType(): string {
    return "char";
  }

  /**
   * Render a named type from the branch `TypeNameLadder` classified.
   *
   * The four branches are the same four that ladder reports, and three of them
   * are its name verbatim: `this.T` qualified against the scope chain,
   * `global.T` bare, and `Scope.T` through the caller's C++-aware resolver.
   * Only the bare branch is decorated, because only it can be a `cstring` or a
   * C tag that needs the `struct` keyword -- and only it can be captured by an
   * enclosing scope, which is what the provenance below records.
   *
   * ADR provenance is recorded HERE, against the name about to be emitted,
   * rather than against a second resolution performed by the caller.
   * `generateType` used to call `getTypeName` purely for this and discard the
   * result: two resolvers, agreeing today with nothing asserting they must,
   * and provenance attached to the one that is NOT emitted. Occupancy only
   * ever reads as "a fixture reached this cell", so that divergence would have
   * been silent.
   */
  private static renderNamed(
    named: INamedTypeResolution,
    line: number | undefined,
    deps: ITypeGenerationDeps,
  ): string {
    if (named.branch !== "bare") {
      return named.name;
    }

    // #1508: ADR-010's promise -- a type declared in an included file is
    // usable where a local one is -- firing at a position.
    if (deps.isCrossFileDeclaration(named.name)) {
      AdrProvenance.record("010", line);
    }

    if (named.name !== named.written) {
      // #1241: the enclosing scope captured a bare name -- ADR-057's rule
      // firing, observably, at a position. Recorded so a codegen-only fixture
      // can occupy a matrix cell; without it ADR-057's eleven fixtures were
      // invisible because they assert generated C and emit no diagnostic.
      AdrProvenance.record("057", line, "binds-scope");
      return named.name;
    }

    // `written`, though `name` is equal to it on this line -- the branch above
    // returned when they differ. Naming the written one says which of the two
    // the question is ABOUT: a C tag with no typedef is something the source
    // spelled, not something ADR-057 produced. Mutating it to `name` reddens
    // nothing, and cannot: the two are the same string here.
    //
    // ADR-046's `cstring` is answered inside `generateUserType`, which owns it
    // for the cast path too. It used to be answered here as well, before the
    // provenance lines -- two spellings of one mapping, and removing this one
    // reddened nothing because the other one caught it.
    return TypeGenerationHelper.userTypeCType(named.written, deps);
  }

  /**
   * The C type a planned type renders as.
   *
   * `plan.text` is the fallback for every alternative the plan does not name
   * -- a C++ `templateType` passes through unchanged. `void` needed its own
   * branch only because the old code spelled the fallback twice: `void`'s
   * source text IS `"void"`, so returning the text covers it.
   */
  static generate(plan: IPlannedType, deps: ITypeGenerationDeps): string {
    if (plan.isString) {
      return TypeGenerationHelper.generateStringType();
    }

    if (plan.named) {
      return TypeGenerationHelper.renderNamed(
        plan.named,
        plan.userTypeLine,
        deps,
      );
    }

    if (plan.primitiveName !== null) {
      return TypeGenerationHelper.primitiveCType(plan.primitiveName);
    }

    return plan.text;
  }

  /**
   * Get the required include header for a type.
   * Used by the caller to track includes separately from type generation.
   *
   * A sized string requires `<string.h>`, and so does an array of them
   * (#1569): a `string<N>[M]` struct field has no other route to it, so a
   * file whose only string is such a field emitted `strncpy` undeclared.
   */
  static getRequiredInclude(plan: IPlannedType): TIncludeHeader | null {
    if (plan.primitiveName !== null) {
      return TypeGenerationHelper.generatePrimitiveType(plan.primitiveName)
        .include;
    }

    if (plan.isString) {
      return "string";
    }

    return null;
  }
}

export default TypeGenerationHelper;
