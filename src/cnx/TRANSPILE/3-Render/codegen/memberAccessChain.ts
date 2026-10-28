/**
 * Struct-parameter access helpers.
 *
 * ADR-006: Struct parameters need -> access (passed by pointer in C),
 *          or . access (passed by reference in C++)
 *
 * ## What used to be here, and why it is not
 *
 * #1445: this module also held `determineSeparator` and a 350-line generic
 * member-chain walker, `buildMemberAccessChain`, with eight private helpers.
 * Both were dead:
 *
 *   determineSeparator       0 production callers, 14 test callers
 *   buildMemberAccessChain   0 production callers, 17 test callers
 *
 * `buildMemberAccessChain`'s only two mentions outside its own tests were
 * PROSE -- `MemberChainAnalyzer`'s header said it "delegates to
 * buildMemberAccessChain to eliminate code duplication" while importing no
 * such thing. A reader who grepped for the delegation found something that
 * looked like confirmation and was not; both lines are corrected with this
 * deletion.
 *
 * This is the third instance of one defect. CLAUDE.md already records the
 * first -- `buildStructParamMemberAccess`, "no production caller ... and knip
 * could not report it, because its six test callers count as usage (#1418)",
 * deleted under #1450. knip cannot see these two either, and for a second
 * reason: they are members of an exported object literal, which the #1556
 * `include: ["classMembers"]` setting does not reach. Chains are built
 * incrementally by `MemberSeparatorResolver` and the postfix generator, never
 * in one call, so a general chain builder has never had a caller here.
 *
 * Deleting the walker is also what takes this module out of
 * `parse-tree-confined-to-parser`: its `ParseTree` import existed solely for
 * the `children` arrays the walker indexed, and the two helpers below name no
 * parse type at all.
 */

import type TParameterInfo from "../../../types/TParameterInfo";
import type TTypeInfo from "../../../types/TTypeInfo";
import type IRootHolding from "./types/IRootHolding";

/** What `rootHolding` asks of the types a root may name */
interface IRootHoldingFacts {
  isKnownStruct(typeName: string): boolean;
  isHeldThroughPointer(typeName: string): boolean;
}

/**
 * How a chain's root is held: the ONE answer the read path and the write path
 * read for its member separator and for a whole-value use. A struct parameter
 * is a pointer in C and a reference in C++ (ADR-006), unless a callback
 * typedef made it a pointer in both (#895). A local that `DeclaredPointer`
 * made a pointer to a struct -- a C function's `T*` held as a declared `T`
 * (#895) -- is a pointer in both. An opaque handle is never dereferenced.
 * #1760 review: both paths asked the parameter alone, so such a local's
 * members were written with `.` on a pointer, which C rejects.
 */
function rootHolding(
  paramInfo:
    | {
        readonly isStruct?: boolean;
        readonly forcePointerSemantics?: boolean;
      }
    | undefined,
  rootTypeInfo: TTypeInfo | undefined,
  facts: IRootHoldingFacts,
): IRootHolding {
  if (paramInfo !== undefined) {
    return {
      isStructParam: paramInfo.isStruct ?? false,
      forcePointerSemantics: paramInfo.forcePointerSemantics ?? false,
      isPointerLocal: false,
    };
  }
  return {
    isStructParam: false,
    forcePointerSemantics: false,
    isPointerLocal:
      rootTypeInfo?.isPointer === true &&
      facts.isKnownStruct(rootTypeInfo.baseType) &&
      !facts.isHeldThroughPointer(rootTypeInfo.baseType),
  };
}

/**
 * The separator a held root's first member takes: `->` for a pointer local
 * and for a parameter held through a pointer, `.` for a C++ reference
 */
function rootMemberSeparator(
  holding: IRootHolding,
  cppMode: boolean,
): "." | "->" {
  return getStructParamSeparator({
    cppMode,
    forcePointerSemantics:
      holding.forcePointerSemantics || holding.isPointerLocal,
  });
}

/**
 * Options for struct parameter access helpers.
 */
interface StructParamOptions {
  /** Whether we're in C++ mode (struct params are references) */
  cppMode: boolean;
  /**
   * Issue #895: the parameter takes a C callback typedef's pointer shape, so it
   * is a pointer in C++ too -- a C function pointer cannot take a reference.
   * Required so no caller can decide from the mode alone.
   */
  forcePointerSemantics: boolean;
}

/**
 * Whether a struct parameter is a pointer here, rather than a C++ reference --
 * the ONE decision both helpers below read.
 *
 * The member separator used to override the mode for a callback-promoted
 * parameter at each of its two call sites while the whole-value wrap asked the
 * mode alone, so in C++ `f->pokes` stood beside `Full copy = f;`, a `Full*`
 * where a `Full` belongs.
 */
function isPointer(options: StructParamOptions): boolean {
  return options.forcePointerSemantics || !options.cppMode;
}

/**
 * Get the member access separator for struct parameters.
 * Pointer: -> (C, or a callback-promoted parameter in C++); reference: .
 *
 * @param options - The struct param options
 * @returns "->" for a pointer, "." for a C++ reference
 */
function getStructParamSeparator(options: StructParamOptions): "." | "->" {
  return isPointer(options) ? "->" : ".";
}

/**
 * Wrap a struct parameter used as a whole value (not member access).
 * Pointer: (*param) - dereference it; reference: param - use it directly
 *
 * @param paramName - The parameter name
 * @param options - The struct param options
 * @returns The wrapped parameter expression
 */
function wrapStructParamValue(
  paramName: string,
  options: StructParamOptions,
): string {
  return isPointer(options) ? `(*${paramName})` : paramName;
}

/**
 * A parameter used as a whole value -- read, written, or the scalar a bitmap
 * parameter's field is worked in: wrapped as above when it is a struct or
 * bitmap parameter (#551 makes a bitmap struct-like), the name otherwise.
 * Never an opaque handle, whose value IS the pointer (ADR-030, #1722), nor an
 * array parameter, which is the pointer C passes an array as: `(*pts)` is its
 * first element.
 *
 * The one rule for every whole-value use (#1760 second review): only the read
 * side asked, so a written one was the bare pointer -- `p = (*q);` for a
 * struct, and `s.A <- true` masked the pointer `s` itself.
 */
function wholeParamValue(
  name: string,
  paramInfo:
    | Pick<
        TParameterInfo,
        "isStruct" | "isArray" | "isOpaqueHandle" | "forcePointerSemantics"
      >
    | undefined,
  cppMode: boolean,
): string {
  if (!paramInfo?.isStruct || paramInfo.isOpaqueHandle || paramInfo.isArray) {
    return name;
  }
  return wrapStructParamValue(name, {
    cppMode,
    forcePointerSemantics: paramInfo.forcePointerSemantics ?? false,
  });
}

export default {
  getStructParamSeparator,
  wholeParamValue,
  rootHolding,
  rootMemberSeparator,
};
