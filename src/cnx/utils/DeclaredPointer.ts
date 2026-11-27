/**
 * #1668: whether a declaration is a C pointer though cnx spelled its type
 * without one -- the one decision the emitted declaration and the
 * declaration's type info both read, so the two cannot disagree.
 *
 * A declaration whose C type is already a pointer (ADR-046's `cstring` is
 * `const char*`) is one. Otherwise three arms decide, in order (they were
 * `CodeGenWalker._inferVariableType`'s):
 *
 * 1. #958: a C header's typedef struct is always handled through a pointer.
 * 2. #895 Bug B: an initializer that calls a C function returning `T*`, for a
 *    declared `T`, makes the variable a `T*`.
 * 3. ADR-046: a `c_`-prefixed variable initialized from one of the C library
 *    functions that return a struct pointer.
 */
import type IResolvedSymbols from "../types/IResolvedSymbols";
import ForeignTypeFacts from "./ForeignTypeFacts";
import STRUCT_POINTER_C_FUNCTIONS from "./constants/STRUCT_POINTER_C_FUNCTIONS";

/** What the three arms read of a declaration */
interface IPointerFacts {
  /** The declared type as C spells it (`uint8_t`, `char*`, `widget_t`) */
  readonly cType: string;
  readonly name: string;
  /** What the initializer calls, as 1.3 recorded it */
  readonly initializerCallee: string | null;
  /** The initializer's source text, or null when there is none */
  readonly initialValue: string | null;
}

class DeclaredPointer {
  /**
   * The C type a declaration is written with: its type, and a `*` when it
   * is a pointer its type does not already spell. The one consequence the
   * `.c` definition and the `.h` declaration both follow.
   */
  static spell(cType: string, isPointer: boolean): string {
    return isPointer && !cType.endsWith("*") ? `${cType}*` : cType;
  }

  /**
   * ADR-030 / #958: whether a type is a C handle -- an incomplete (opaque) or
   * typedef struct type from a C header, which cnx only ever holds through
   * a pointer. Arm 1 below, and `TranspileState.isHeldThroughPointer`, which
   * every other declaration site asks: one predicate, so a declaration's
   * pointer-ness and the sites that ask about its type cannot differ.
   */
  static isHandleType(
    cType: string,
    foreign: Pick<IResolvedSymbols, "isOpaqueType">,
  ): boolean {
    return foreign.isOpaqueType(cType);
  }

  /** Whether the declaration is a pointer, by the three arms above */
  static of(
    facts: IPointerFacts,
    foreign: Pick<
      IResolvedSymbols,
      "isOpaqueType" | "getCSymbol" | "getCppSymbol"
    >,
  ): boolean {
    if (facts.cType.endsWith("*")) return true;
    if (DeclaredPointer.isHandleType(facts.cType, foreign)) return true;
    if (facts.initialValue === null) return false;

    if (facts.initializerCallee !== null) {
      // #2058: a C++ prototype says so as a C one does
      const callee = ForeignTypeFacts.foreignSymbol(
        foreign,
        facts.initializerCallee,
      );
      // `widget_t *` or `widget_t*` for a declared `widget_t`
      if (
        callee?.kind === "function" &&
        callee.type.endsWith("*") &&
        callee.type.slice(0, -1).trim() === facts.cType
      ) {
        return true;
      }
    }

    const initialValue = facts.initialValue;
    return (
      facts.name.startsWith("c_") &&
      [...STRUCT_POINTER_C_FUNCTIONS].some((fn) =>
        // As written: `fopen ("f", "r")` calls `fopen` too
        new RegExp(String.raw`${fn}\s*\(`).test(initialValue),
      )
    );
  }
}

export default DeclaredPointer;
