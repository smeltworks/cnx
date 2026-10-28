import type IArgumentPassing from "./types/IArgumentPassing";
import type ICArgumentFacts from "./types/ICArgumentFacts";
import type IPlanQueries from "./types/IPlanQueries";
import type TCArgumentForm from "./types/TCArgumentForm";
import C_TYPE_WIDTH from "./types/C_TYPE_WIDTH";
import CPointerParameter from "../../utils/CPointerParameter";
import CNX_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import ParameterByValue from "../../utils/ParameterByValue";

type TTypeQueries = Pick<
  IPlanQueries,
  "isKnownStruct" | "isIntegerType" | "isFloatType"
>;

/**
 * How an argument to a C or C++ function is written: whether it takes `&` to
 * match the pointer parameter the callee declares (#1991). 2.2 decides it once
 * per argument and 2.3 writes the answer.
 */
class CArgumentAddress {
  static formOf(facts: ICArgumentFacts, queries: TTypeQueries): TCArgumentForm {
    const param = facts.param;
    if (!param?.baseType.endsWith("*")) return "as-written";
    // Issue #937: a callback-promoted parameter is already the pointer the
    // callback's typedef takes, so it is passed as its own name
    if (facts.promotedHandle) return "promoted-handle";
    if (facts.addressWritten) return "as-written";
    return CArgumentAddress.needsAddressOf(param, facts, queries)
      ? "address-of"
      : "as-written";
  }

  /**
   * Issue #322: a struct passed to a pointer parameter. Issue #832: a
   * typedef'd pointer type, a `handle_t` passed to a `handle_t*`.
   *
   * A value that is already a pointer takes `&` only for a parameter exactly
   * one pointer deeper: a handle IS the argument for a `Dev*`, and its address
   * is the argument for a `Dev**`, an out-parameter the callee writes a new
   * handle through.
   *
   * A whole array never takes `&`. C decays it to a pointer to its first
   * element, which is what a pointer parameter takes; its address is a pointer
   * to the ARRAY -- `CPoint (*)[2]`, or `CPoint**` for a parameter.
   */
  private static needsAddressOf(
    param: NonNullable<IArgumentPassing["param"]>,
    facts: ICArgumentFacts,
    queries: TTypeQueries,
  ): boolean {
    const argType = facts.argType;
    if (argType === null || param.isArray || facts.isArray) return false;
    const valueDepth = CArgumentAddress.valueDepth(
      argType,
      facts.declared?.isPointer ?? false,
      facts.isHandleArrayElement || facts.isHandleField,
    );
    if (valueDepth > 0) {
      return CArgumentAddress.pointerDepth(param.baseType) === valueDepth + 1;
    }
    return (
      queries.isKnownStruct(argType) ||
      CArgumentAddress.parameterTakesAddress(
        param.baseType,
        argType,
        facts.declared !== undefined && !facts.declared.isArray,
        queries,
      )
    );
  }

  /**
   * Whether a pointer parameter takes the address of a value of `argType`.
   *
   * An array of primitives decays to a pointer by itself (uint8_t[] to
   * uint8_t*); a declared scalar of the pointee's type is passed by its
   * address (#1978: `const u8 b` to `const uint8_t*` was `b`, a pointer made
   * from an integer). A typedef'd pointer type matches: `handle_t` takes `&`
   * for a `handle_t*`.
   */
  private static parameterTakesAddress(
    paramType: string,
    argType: string,
    declaredScalar: boolean,
    queries: TTypeQueries,
  ): boolean {
    if (
      queries.isIntegerType(argType) ||
      queries.isFloatType(argType) ||
      ParameterByValue.isKnownPrimitiveType(argType)
    ) {
      return (
        declaredScalar &&
        CNX_TO_C_TYPE_MAP[argType] === CPointerParameter.pointee(paramType)
      );
    }
    if (argType in C_TYPE_WIDTH) return false;
    // indexOf/slice instead of a regex, which SonarCloud S5852 flags
    const starIndex = paramType.indexOf("*");
    const paramBaseType =
      starIndex >= 0 ? paramType.slice(0, starIndex).trim() : paramType.trim();
    return paramBaseType === argType;
  }

  /** How many levels of pointer a C type spells: `Dev**` is 2, `const Dev*` 1 */
  private static pointerDepth(cType: string): number {
    return cType.split("*").length - 1;
  }

  /**
   * How many pointers deep an argument's VALUE already is.
   *
   * A C variable says so in its declared type: `Dev**` is 2. Issue #895 Bug B:
   * a variable inferred as a pointer is one; so is an opaque handle (ADR-030),
   * held in a scope variable (#948), as an element of an array of handles
   * (#996) or in a struct field (#1744). Anything else is a value, 0.
   */
  private static valueDepth(
    argType: string,
    declaredPointer: boolean,
    isHeldHandle: boolean,
  ): number {
    if (argType.endsWith("*")) return CArgumentAddress.pointerDepth(argType);
    return declaredPointer || isHeldHandle ? 1 : 0;
  }
}

export default CArgumentAddress;
