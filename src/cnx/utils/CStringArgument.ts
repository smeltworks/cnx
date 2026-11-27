import CPointerParameter from "./CPointerParameter";
import type IResolvedSymbols from "../types/IResolvedSymbols";

/** What 2.1's checks and 2.2's plan read of one C parameter (#2348 review) */
interface ICStringParameter {
  readonly type: string;
  readonly isArray?: boolean;
}

/**
 * #2348 review: a concatenation or a substring handed to a C function is built
 * into a temporary when the parameter it is written for points to `char`:
 * `char*`, `const char*`, a typedef of one (`text_t`), or a `char` array
 * parameter, which C passes as a pointer. 2.1 judges the built argument
 * (E0915, E0947, E0948) and 2.2 plans its temporary from this one answer. A
 * pointer the callee returns may point into it when it can point at
 * characters: to a `char` of any sign, or to `void`.
 */
class CStringArgument {
  static isBuiltFor(
    parameter: ICStringParameter | undefined,
    symbols: IResolvedSymbols | null,
  ): boolean {
    if (parameter === undefined) return false;
    if (parameter.isArray === true) {
      return CStringArgument.unqualified(parameter.type) === "char";
    }
    return CStringArgument.pointee(parameter.type, symbols) === "char";
  }

  static mayPointInto(
    returnType: string | null,
    symbols: IResolvedSymbols | null,
  ): boolean {
    if (returnType === null) return false;
    const pointee = CStringArgument.pointee(returnType, symbols);
    return (
      pointee === "char" ||
      pointee === "signed char" ||
      pointee === "unsigned char" ||
      pointee === "void"
    );
  }

  /**
   * #2348 review: a `char*` C may write the characters through -- a pointer
   * to `char` that is not const, or a typedef of one. A `cstring` is
   * `const char*` (ADR-046), so it cannot land there.
   */
  static isWritableCharPointer(
    type: string,
    symbols: IResolvedSymbols | null,
  ): boolean {
    const pointer = CStringArgument.pointerOf(type, symbols);
    return (
      pointer !== null &&
      CPointerParameter.pointee(pointer.text) === "char" &&
      !pointer.pointeeConst
    );
  }

  /** What a type of one pointer points to, typedefs followed; null for any other */
  private static pointee(
    type: string,
    symbols: IResolvedSymbols | null,
  ): string | null {
    const pointer = CStringArgument.pointerOf(type, symbols);
    return pointer === null ? null : CPointerParameter.pointee(pointer.text);
  }

  /**
   * The spelling of one pointer a type is, typedefs followed, and whether it
   * points to const: spelled so, or by a typedef's specifiers (`typedef
   * const char* text_t`, whose `const` 1.3 keeps apart). Null for any other.
   */
  private static pointerOf(
    type: string,
    symbols: IResolvedSymbols | null,
  ): { readonly text: string; readonly pointeeConst: boolean } | null {
    const seen = new Set<string>();
    let text = type;
    let pointeeConst = false;
    for (;;) {
      if (CPointerParameter.pointee(text) !== null) {
        const head = text.slice(0, text.indexOf("*")).split(/\s+/);
        return {
          text: text.trim(),
          pointeeConst: pointeeConst || head.includes("const"),
        };
      }
      const name = CStringArgument.unqualified(text);
      if (symbols === null || seen.has(name)) return null;
      seen.add(name);
      const symbol = symbols.getCSymbol(name);
      if (symbol?.kind !== "type" || typeof symbol.type !== "string") {
        return null;
      }
      pointeeConst ||= symbol.isConst === true;
      text = symbol.type;
    }
  }

  private static unqualified(type: string): string {
    return type
      .replaceAll(/\b(?:const|volatile)\b/g, "")
      .replaceAll(/\s+/g, " ")
      .trim();
  }
}

export default CStringArgument;
