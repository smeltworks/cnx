/**
 * TypeNameLadder -- the one ladder from a written type's plain data to its
 * resolved cnx name (#1285, #1932).
 *
 * Seven independent `scopedType()/globalType()/qualifiedType()/userType()`
 * ladders existed: two in TypeRegistrationEngine, one each in TypeUtils,
 * CodeGenerator.getTypeName, FunctionContextManager, TypeGenerationHelper, and
 * CodeGenerator's parameter path. Each decided ADR-057 qualification for itself,
 * so unifying the encoder (#1285 PR3) left seven places that still had to agree
 * about WHICH branch to apply it in.
 *
 * They already disagreed about coverage: each handled a different subset of the
 * six `arrayType` element alternatives, and their fallbacks differed (null vs
 * the raw parse text). Those subsets ARE reachable, and collapsing the ladders
 * closed two of them:
 *
 *   - `CodeGenerator.getTypeName` handled only `primitiveType` and `userType`
 *     inside `arrayType`, so `const Scope.TItem[] items <- ...` fell through to
 *     `ctx.getText()` and yielded the raw parse text `Scope.TItem[]`. The field
 *     types were then unknown and the initializer literals lost their integer
 *     suffixes (tests/header-generation/const-struct-array-inferred).
 *   - `getZeroInitializer` resolved a bare `userType()` unqualified, so a
 *     scope-local enum missed `knownEnums` and got the aggregate zero brace
 *     instead of ADR-017's zero member
 *     (tests/bugs/issue-1285-scope-enum-zero-init).
 *
 * So this is a bug fix as well as a unification, and the corpus does move --
 * in exactly those two places, both verified as corrections rather than
 * regressions before their snapshots were regenerated.
 *
 * Split out of 1.3's `TypeBinding` (#1932, owner decision on #1952), which
 * read parse contexts through `ITypeAccessors`. Its last caller lowers the type
 * with `SyntaxLowering` and asks here instead (#1960 review), so `TypeBinding`
 * is gone: 1.3, 2.1, the walker and Render all ask this one ladder, over plain
 * data. The predicates are injected rather than read from codegen state.
 */
import type INamedTypeResolution from "../types/INamedTypeResolution";
import type ITypeBindingDeps from "../types/ITypeBindingDeps";
import QualifiedCName from "./QualifiedCName";
import ScopeUtils from "./ScopeUtils";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import type ISyntaxNode from "../types/syntax/ISyntaxNode";

/** A lowered type's four named arms */
type TNamedTypeSyntax = Extract<
  TTypeSyntax,
  { readonly kind: "scoped" | "global" | "qualified" | "user" }
>;
type TWithoutNode<T> = T extends unknown
  ? Omit<T, keyof ISyntaxNode | "text">
  : never;
/**
 * The four spellings a named type is written in: `TTypeSyntax`'s own arms
 * without their node fields, so a field renamed there is a compile error here.
 */
type TNamedTypeSpelling = TWithoutNode<TNamedTypeSyntax>;

class TypeNameLadder {
  /**
   * The ladder itself, over a written type's plain data: a lowered
   * `TTypeSyntax` is one, so a pass that holds no parse tree asks the same
   * question. Null for a type that is not a named one.
   */
  static classifyNamed(
    type: TTypeSyntax | TNamedTypeSpelling,
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): INamedTypeResolution | null {
    switch (type.kind) {
      // this.T -- the scope is stated, so qualify against the chain unconditionally
      case "scoped":
        return {
          branch: "this",
          written: type.name,
          name:
            deps?.memberCName?.(scopePath, type.name) ??
            ScopeUtils.qualifyInScope(type.name, scopePath),
        };
      // global.T -- explicitly opts out of scope qualification
      case "global":
        return { branch: "global", written: type.name, name: type.name };
      // Scope.T -- the path is stated in full
      case "qualified":
        return {
          branch: "qualified",
          written: type.path.join("."),
          // #2116: a declared `Scope.T` reads its stored C name; only a path
          // no cnx symbol declares is spelled as written
          name: deps?.resolveQualifiedType
            ? deps.resolveQualifiedType([...type.path])
            : (deps?.memberCName?.(
                type.path[0],
                type.path.slice(1).join("."),
              ) ?? QualifiedCName.fromSourceName(type.path.join("."))),
        };
      // Bare T -- the ONLY branch that resolves local -> scope -> global
      case "user":
        return {
          branch: "bare",
          written: type.name,
          name: deps?.scopeTypeCName
            ? (deps.scopeTypeCName(scopePath, type.name) ?? type.name)
            : deps?.isScopeType
              ? ScopeUtils.qualifyScopeType(
                  type.name,
                  scopePath,
                  deps.isScopeType,
                )
              : type.name,
        };
      default:
        return null;
    }
  }

  /**
   * The cnx name a type is written as -- a named type resolved, a primitive,
   * an array's element, `string<N>` or `string` -- or null for template and
   * `void`, which each caller answers for itself.
   *
   * The one ladder: 1.3's symbols (the `.h`, through `TypeUtils.getTypeName`)
   * and the walker (the `.c`) both ask it, so the two files cannot disagree on
   * a type's name. Its alternatives are exclusive in the grammar, so branch
   * order carries no meaning (#1285, #1932).
   */
  static resolveWrittenName(
    type: TTypeSyntax,
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): string | null {
    const named = TypeNameLadder.classifyNamed(type, scopePath, deps);
    if (named !== null) {
      return named.name;
    }
    switch (type.kind) {
      case "primitive":
        return type.name;
      case "array":
        return TypeNameLadder.resolveWrittenName(type.element, scopePath, deps);
      case "string":
        return type.capacity === null ? "string" : `string<${type.capacity}>`;
      default:
        return null;
    }
  }
}

export default TypeNameLadder;
