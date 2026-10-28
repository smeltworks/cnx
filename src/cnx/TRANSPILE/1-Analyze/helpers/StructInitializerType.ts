/**
 * The struct a `{ field: value }` initializer builds.
 *
 * #1322. An explicit `Point { x: 1 }` says so; an inferred `{ x: 1 }` is typed
 * by where it stands -- a declaration's type, the field it initializes in an
 * enclosing initializer, the element type of the array it sits in, the
 * assignment target, the parameter it is passed to, or the enclosing
 * function's return type. Codegen typed the first three through its
 * `expectedType` control flow and could not type the last (#1277). Where it
 * stands comes from `ValuePositions`, a walk down 1.2's syntax (#1991).
 *
 * Answers with the C name the per-file view keys struct fields by, so a
 * caller can go straight to `structFields`.
 */

import OperandTyper from "../../../utils/OperandTyper";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import DeclaredTypeFacts from "../../../utils/DeclaredTypeFacts";
import ForeignTypeFacts from "../../../utils/ForeignTypeFacts";
import FunctionReference from "./FunctionReference";
import TypeText from "../../../utils/TypeText";
import type IAnalysisContext from "../types/IAnalysisContext";
import type IValuePosition from "../../../types/IValuePosition";
import type ISourcePosition from "../../../utils/types/ISourcePosition";

/** What an establishing position gives the value under it */

class StructInitializerType {
  /** The struct a type spelling names, as keyed in `structFields`, or null. */
  static structNamed(
    typeText: string,
    scopePath: string,
    context: IAnalysisContext,
  ): string | null {
    const fields = context.symbols.structFields;
    if (!fields) return null;
    return (
      FunctionReference.candidatesForTypeText(
        typeText,
        scopePath,
        context.sourceFile,
        context.program,
      ).find((c) => fields.has(c)) ?? null
    );
  }

  /**
   * Whether ANY enclosing position supplies a type for this initializer,
   * without asking what that type resolves to.
   *
   * ADR-014's two diagnostics need only this. Asking for the resolved NAME
   * conflates "no position supplies a type" with "a position supplies one and
   * this pass cannot name it", and those are opposite answers: the first is
   * E0357, the second must stay silent. The distinction is not hypothetical --
   * a field of a struct declared in an included C header resolves through the
   * C symbols rather than the cnx view, so `{ flag_a: 1 }` inside
   * `SimpleConfig cfg <- { flags: { flag_a: 1 } }` has a position supplying a
   * type that this pass cannot name, and nine `tests/interop` fixtures say so.
   */
  /**
   * #1802: the type a struct initializer gives a value to, when that type is
   * not a struct. Null when it is a struct, or when this pass does not know
   * the type. An element of an array's list is checked at the element's
   * type, while an array's whole initializer is E0866's.
   *
   * The positive question, asked of each type's one home (#1760 second
   * review): a bitmap first, since `DeclaredTypeFacts.isStruct` counts it
   * struct-like (#551); then a cnx struct, and a header's struct, union
   * or opaque type. Any other type this pass knows is not a struct. Asking
   * "known NOT to be a struct" let a header's pointer or function-pointer
   * typedef and an ADR-029 function type through, since none has a category.
   */
  static nonStructTypeOf(
    established: Pick<IValuePosition, "typeText" | "isArray" | "inList">,
    at: ISourcePosition,
    context: IAnalysisContext,
  ): { readonly typeName: string; readonly isBitmap: boolean } | null {
    const typeText = established.typeText;
    if (typeText === null) return null;
    if (established.isArray && !established.inList) return null;
    const typeName = TypeText.withoutDimensions(typeText);
    const symbols = context.symbols;
    const candidates = FunctionReference.candidatesForTypeText(
      typeName,
      OperandTyper.scopePathAt(at, context),
      context.sourceFile,
      context.program,
    );
    if (candidates.some((c) => DeclaredTypeFacts.isBitmap(symbols, c))) {
      return { typeName, isBitmap: true };
    }
    const isStruct =
      candidates.some((c) =>
        DeclaredTypeFacts.isStruct(symbols, context.symbolTable, c),
      ) ||
      ForeignTypeFacts.isStructType(
        typeName,
        context.symbolTable,
        OperandTyper.target(context),
      );
    if (isStruct) return null;
    return StructInitializerType.isKnownType(typeName, candidates, context)
      ? { typeName, isBitmap: false }
      : null;
  }

  /**
   * Whether this pass knows a type that is not a struct: a primitive or a
   * string, an enum or an ADR-029 function type this file sees, or a type a
   * header declares.
   */
  private static isKnownType(
    typeName: string,
    candidates: readonly string[],
    context: IAnalysisContext,
  ): boolean {
    const symbols = context.symbols;
    return (
      OperandTyper.categoryOf(typeName) !== "none" ||
      TypeCheckUtils.isSizedStringName(typeName) ||
      candidates.some(
        (c) =>
          DeclaredTypeFacts.isEnum(symbols, c) ||
          symbols.functionReturnTypes.has(c),
      ) ||
      ForeignTypeFacts.isForeignType(
        typeName,
        context.symbolTable,
        OperandTyper.target(context),
      )
    );
  }

  /**
   * The type a value's position gives it, the way it gives one to an
   * initializer: a declaration's (a `for` header's too), the field it
   * initializes, the element of the array list it sits in, the assignment
   * target's, the parameter it is passed to, or the enclosing function's
   * return type. Null when no position types it, and for a whole-array
   * position. #1760 second review: E0891 asks this of every value, so a
   * float reaches an integer parameter, return, field or element only
   * through a cast, as it reaches a declaration.
   */
  static valueTypeAt(
    established: Pick<IValuePosition, "typeText" | "isArray" | "inList">,
  ): string | null {
    const typeText = established.typeText;
    if (typeText === null) return null;
    if (established.isArray && !established.inList) return null;
    return TypeText.withoutDimensions(typeText);
  }

  /**
   * Whether a struct initializer stands where a whole array is taken, other
   * than a declaration's initializer, which ADR-035's rule checks itself: a
   * field, an assignment target or a parameter that is an array. ADR-014:
   * an array's whole initializer is ADR-035's list (E0866). #1760 second
   * review: these positions typed the element, so the initializer was
   * E0358's -- or, for an array of structs, emitted as one struct.
   */
  static takesWholeArrayAt(
    established: Pick<IValuePosition, "isArray" | "inList" | "isDeclaration">,
  ): boolean {
    return (
      established.isArray && !established.inList && !established.isDeclaration
    );
  }
}

export default StructInitializerType;
