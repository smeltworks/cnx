/**
 * VariableCollector - Extracts variable declarations from parse trees.
 * Handles types, const modifier, arrays, and initial values.
 *
 * Produces TType-based IVariableSymbol with proper IScopeSymbol references.
 */

import DimensionResolver from "../utils/DimensionResolver";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import ArrayInitializerUtils from "../utils/ArrayInitializerUtils";
import TypeUtils from "../utils/TypeUtils";
import StringUtils from "../../../../utils/StringUtils";
import TTypeUtils from "../../../../utils/TTypeUtils";
import type TType from "../../../../types/TType";
import type TOverflowBehavior from "../../../../types/TOverflowBehavior";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";
import ConstExprLowering from "../../../../utils/ConstExprLowering";
import type TConstExpr from "../../../../types/TConstExpr";
import type IDeclaredDimension from "../types/IDeclaredDimension";
import invariant from "../../../../utils/invariant";
import type IVariableDeclarationSyntax from "../../../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../../types/syntax/TExpression";
import type TStatement from "../../../../types/syntax/TStatement";
import type IDeclareTypeFacts from "../../types/IDeclareTypeFacts";

/** A declaration 1.2 lowered from `variableDeclaration`, with or without a constructor */
type TVariableSyntax = Extract<
  TStatement,
  { kind: "variableDeclaration" | "constructorDeclaration" }
>;

class VariableCollector {
  /**
   * Resolve a variable's declared type.
   *
   * ADR-045: a bare `string` takes its capacity from the initializing literal.
   * TypeResolver cannot do this on the type string alone — bare `string` matches
   * no pattern there and falls through to a *struct* named "string", which the
   * header then emits verbatim (`extern const string VERSION;`). The `.c` path
   * inferred the capacity independently, so the two disagreed silently until
   * the `.c` began including its own header (#1164).
   *
   * The inference rule itself is StringUtils.literalLength, shared with codegen.
   */
  private static resolveDeclaredType(
    typeStr: string,
    initializer: TExpression | null,
    resolved: TType,
  ): TType {
    if (
      typeStr !== "string" ||
      initializer?.kind !== "literal" ||
      initializer.literalKind !== "string"
    ) {
      return resolved;
    }
    return TTypeUtils.createString(StringUtils.literalLength(initializer.text));
  }

  /**
   * One array dimension. A literal folds here; a const or a C macro keeps its
   * text (#455), and 1.4 folds a const where the declaration is written
   * (#1664 box 7). Issue #1127: both spellings fold through the shared
   * resolver, so a dimension resolves identically here and in codegen.
   */
  private static dimension(
    size: TExpression | null,
    countedFrom: TExpression | null,
  ): IDeclaredDimension {
    if (size) return DimensionResolver.resolve(size);
    // Issue #636: Empty dimension [] - infer size from array initializer
    return { size: VariableCollector.omittedSize(countedFrom), expr: null };
  }

  /**
   * #1822: an omitted size, counted from a one-dimensional declaration's list
   * or string literal. With nothing to count it is E0892, and it is recorded
   * as "" -- unknown, as a C macro dimension is -- so the array keeps its
   * rank: dropping it made `u8[2][] rows` one-dimensional, and an includer's
   * `rows[1][2][0]` a false E0856 (#1824 review).
   */
  private static omittedSize(countedFrom: TExpression | null): number | string {
    return (
      (countedFrom && ArrayInitializerUtils.getInferredSize(countedFrom)) ?? ""
    );
  }

  /**
   * A constructor declaration (`Foo f(a);`, #375) declares a variable with no
   * modifiers, dimensions or initializer.
   */
  static asVariable(declaration: TVariableSyntax): IVariableDeclarationSyntax {
    if (declaration.kind === "variableDeclaration") return declaration;
    return {
      modifiers: {
        atomic: false,
        volatile: false,
        const: false,
        // The constructor form has no modifier slot; a C++ object built this
        // way is written through its own methods, so it stays writable.
        mut: true,
        atomicMut: false,
        overflow: null,
      },
      type: declaration.type,
      name: declaration.name,
      nameSpan: declaration.nameSpan,
      dimensions: [],
      dimensionSpans: [],
      initializer: null,
      spellsOwnName: declaration.spellsOwnName,
      span: declaration.span,
      written: declaration.written,
    };
  }

  /**
   * What a declaration SAYS: its type, modifiers, dimensions and initializer.
   *
   * #1668: shared by a global or scope member (`collect`, below) and a local
   * or `for` variable (`LexicalScopeCollector`), so a declaration means the
   * same thing wherever it is written. No const folds here: a literal
   * dimension folds, and every name stays its text for 1.4 Resolve
   * to fold in the declaration's lexical environment (#1664 box 7).
   */
  static declaredFacts(
    declaration: IVariableDeclarationSyntax,
    scopePath: string,
    typeFacts?: IDeclareTypeFacts,
  ): {
    type: TType;
    isConst: boolean;
    isAtomic: boolean;
    isVolatile: boolean;
    overflowBehavior: TOverflowBehavior;
    isArray: boolean;
    arrayDimensions: (number | string)[];
    arrayDimensionExprs: (TConstExpr | null)[];
    initialValue: string | undefined;
    initialValueExpr: TConstExpr | null;
    initializerCallee: string | null;
  } {
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    const typeStr = TypeUtils.getTypeName(
      declaration.type,
      scopePath,
      typeFacts,
    );
    const initializer = declaration.initializer;
    const type = VariableCollector.resolveDeclaredType(
      typeStr,
      initializer,
      TypeUtils.resolveType(declaration.type, scopePath, typeFacts),
    );
    // ADR-071: read-only unless declared `mut`
    const isConst = !declaration.modifiers.mut;

    // Both spellings: cnx's `u16[4][4] arr` first, then C's `arr[4]`
    const sizes = [
      ...(declaration.type.kind === "array" ? declaration.type.dimensions : []),
      ...declaration.dimensions,
    ];

    // #1822 (ADR-035): only a one-dimensional array's size is counted from its
    // list. An empty dimension anywhere else is E0892, and counting the OUTER
    // list for it invented a size that another file then bounds-checked
    // against (`u8[2][] m` read as [2][2] for rows of three).
    const countedFrom = sizes.length === 1 ? initializer : null;
    const declaredDimensions = sizes.map((size) =>
      VariableCollector.dimension(size, countedFrom),
    );

    return {
      type,
      isConst,
      // Issue #468
      isAtomic: declaration.modifiers.atomic,
      isVolatile: declaration.modifiers.volatile,
      // Issue #1303: ADR-044's clamp/wrap is a declared fact like const and
      // volatile above, so it is read HERE and carried on the symbol. Reading it
      // only in codegen meant it existed for the declaring file and nowhere else.
      overflowBehavior: OverflowBehaviorUtils.fromModifier(
        declaration.modifiers.overflow,
      ),
      isArray: sizes.length > 0,
      arrayDimensions: declaredDimensions.map((dim) => dim.size),
      arrayDimensionExprs: declaredDimensions.map((dim) => dim.expr),
      // Issue #282: Capture initial value for const inlining
      initialValue: initializer?.written,
      // #1175: a const's value folds from this, in 1.4, never from the text
      initialValueExpr:
        isConst && initializer ? ConstExprLowering.lower(initializer) : null,
      // #895: what the initializer calls, for `DeclaredPointer.of`
      initializerCallee: VariableCollector.calleeOf(initializer),
    };
  }

  /**
   * The function an initializer calls, when it is shaped `f(...)` or
   * `global.f(...)` -- source text, recorded on the declaration. Whether it
   * names a C function is `DeclaredPointer.of`'s question, asked of the
   * headers once they are known. The call is the chain's LAST operation
   * (#1760 review): `f()[2]` is an element of what `f` returns, not it.
   */
  private static calleeOf(expr: TExpression | null): string | null {
    if (expr?.kind !== "postfix") return null;
    const primary = expr.primary;
    const ops = expr.ops;
    if (primary.kind === "root" && primary.root === "global") {
      const member = ops[0];
      return member.kind === "member" &&
        ops.length === 2 &&
        ops[1].kind === "call"
        ? member.name
        : null;
    }
    return primary.kind === "identifier" &&
      ops.length === 1 &&
      ops[0].kind === "call"
      ? primary.name
      : null;
  }

  /**
   * A global or scope member: its identity, and what its declaration says.
   * @param declaration What 1.2 lowered the declaration to
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this variable belongs to (dotted path, "" at file scope)
   * @param visibility Required: #1161 -- a default here is a third source of
   *   truth for one fact, which is how #1300 happened to the type kinds
   * @param typeFacts ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The variable symbol with TType-based types and scope reference
   */
  static collect(
    declaration: TDeclarationSyntax,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    typeFacts?: IDeclareTypeFacts,
  ): IVariableSymbol {
    invariant(
      declaration.kind === "variableDeclaration" ||
        declaration.kind === "constructorDeclaration",
      `1.2 lowered this declaration as ${declaration.kind}, and 1.3 read it as a variable`,
    );
    const variable = VariableCollector.asVariable(declaration);
    const name = variable.name;
    const facts = VariableCollector.declaredFacts(
      variable,
      scopePath,
      typeFacts,
    );

    // Build base symbol
    const symbol: IVariableSymbol = {
      kind: "variable",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      ...ScopeUtils.identityOf({ name, scopePath }),
      sourceFile,
      span: variable.span,
      sourceLanguage: ESourceLanguage.Cnx,
      visibility,
      type: facts.type,
      isConst: facts.isConst,
      isAtomic: facts.isAtomic,
      isVolatile: facts.isVolatile,
      overflowBehavior: facts.overflowBehavior,
      isArray: facts.isArray,
      arrayDimensions:
        facts.arrayDimensions.length > 0 ? facts.arrayDimensions : undefined,
      arrayDimensionExprs:
        facts.arrayDimensions.length > 0
          ? facts.arrayDimensionExprs
          : undefined,
      initialValue: facts.initialValue,
      initialValueExpr: facts.initialValueExpr ?? undefined,
      initializerCallee: facts.initializerCallee,
      isConstructed: declaration.kind === "constructorDeclaration" || undefined,
    };

    return symbol;
  }
}

export default VariableCollector;
