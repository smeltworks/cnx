/**
 * Issue #579 / Issue #1100: Shared subscript classifier for array vs bit access
 *
 * Its one caller is the operand typer (`OperandTyper.subscriptOf`), which
 * classifies every subscript it walks, for an assignment target and an
 * expression alike; the assignment classifier and the postfix render read
 * the kind off the typer's step (#1668, C12 and review).
 *
 * The classification rule is:
 * 1. If isArray or isString -> array access
 * 2. Otherwise -> bit manipulation
 *
 * This rule is identical for parameters and local variables. ADR-006 requires
 * array parameters to use explicit array syntax (`u8[8] buf`), which sets
 * isArray on the parameter's type info exactly like a local array declaration
 * does. A scalar-typed parameter (no array brackets) is therefore classified
 * the same way a scalar local variable is: bit manipulation (ADR-007 — "Any
 * integer type can be indexed to access individual bits", with no carve-out
 * for parameters).
 *
 * Issue #1100: A prior version of this classifier treated ANY function
 * parameter without explicit array syntax as array access (`isParameter &&
 * !isArray -> array`), added in #579 to support buffer-style parameters
 * declared without brackets (e.g. `void fillBuffer(u8 buf)`). That blanket
 * rule was a divergent decision path from local-variable classification: it
 * silently broke ADR-007 bit-indexing for scalar parameters (`u32 v; ...
 * v[4]` inside a function became `v[4]` array-subscript C code on a pointer
 * instead of a shift-and-mask bit read), producing invalid/incorrect C
 * for the extremely common embedded pattern of reading a bit out of a
 * hardware-register-shaped scalar parameter. Buffer-style parameters must now
 * use explicit array syntax (`u8[N] buf`), which was already the ADR-006
 * documented and supported spelling — see tests/params/param-array-indexing.test.cnx.
 */
import TSubscriptKind from "../types/TSubscriptKind";
import TTypeInfo from "../types/TTypeInfo";
import TypeCheckUtils from "./TypeCheckUtils";

/**
 * Context needed for subscript classification
 */
interface ISubscriptContext {
  /** Type information for the variable being subscripted, null if unknown */
  typeInfo: Pick<TTypeInfo, "isArray" | "isString"> | null;
  /** Number of subscript expressions (1 for single index, 2 for range/slice) */
  subscriptCount: number;
  /** Whether this is a register access (registers always use bit manipulation) */
  isRegisterAccess?: boolean;
}

/**
 * Classifies subscript operations as array or bit access.
 *
 * This class provides a single source of truth for determining whether
 * a subscript operation like `x[i]` or `x[a, b]` should be treated as
 * array element access or bit manipulation.
 */
class SubscriptClassifier {
  /**
   * Classify a subscript operation.
   *
   * A subscript on a scalar `bool` or `char` classifies as a bit here, though
   * `depthLimit` gives neither a bit index: E0856 rejects it before codegen
   * asks.
   *
   * @param ctx - Classification context with type info and subscript count
   * @returns The kind of subscript operation (array or bit access)
   */
  static classify(ctx: ISubscriptContext): TSubscriptKind {
    const { typeInfo, subscriptCount, isRegisterAccess } = ctx;

    // Registers always use bit manipulation
    if (isRegisterAccess) {
      return subscriptCount === 2 ? "bit_range" : "bit_single";
    }

    // Check if this should be array access
    const isArrayAccess = SubscriptClassifier.isArrayAccess(typeInfo);

    if (isArrayAccess) {
      // Slice vs element access
      return subscriptCount === 2 ? "array_slice" : "array_element";
    }

    // Default: bit manipulation
    return subscriptCount === 2 ? "bit_range" : "bit_single";
  }

  /**
   * Determine if a type should use array access semantics.
   *
   * Array access is used when:
   * - Type is explicitly an array (isArray: true) — including array
   *   parameters declared with explicit syntax, e.g. `u8[8] buf` (ADR-006)
   * - Type is a string (strings are char arrays)
   *
   * Parameters are NOT special-cased here (Issue #1100): whether a subscript
   * is array access or bit access depends solely on the declared type, the
   * same rule used for local variables. A scalar parameter without array
   * syntax is bit-indexable exactly like a scalar local variable (ADR-007).
   *
   * @param typeInfo - Type information, or null if unknown
   * @returns true if subscript should be treated as array access
   */
  static isArrayAccess(
    typeInfo: Pick<TTypeInfo, "isArray" | "isString"> | null,
  ): boolean {
    if (!typeInfo) {
      // Unknown type - default to array access for safety
      // This matches the expression path's fallback behavior
      return true;
    }

    // Explicit array or string -> array access
    if (typeInfo.isArray || typeInfo.isString) {
      return true;
    }

    // Otherwise it's a scalar - use bit access
    return false;
  }

  /**
   * How many subscripts a value of primitive type `baseType` with
   * `dimensions` array dimensions takes, or null when the base is not a
   * primitive this limit covers (a string, a struct, an enum, a bitmap).
   *
   * ADR-036 gives one subscript per dimension; ADR-007 gives an integer or a
   * float one more, for a bit index. A `bool` gets none: it is already a
   * single bit, so indexing it makes no sense (owner ruling, #2354). A `char`
   * gets none either: a bit index is a shift and a mask, which MISRA C:2012
   * Rule 10.1 forbids on a character (ADR-045).
   */
  static depthLimit(baseType: string, dimensions: number): number | null {
    if (
      TypeCheckUtils.isInteger(baseType) ||
      TypeCheckUtils.isFloat(baseType)
    ) {
      return dimensions + 1;
    }
    return baseType === "bool" || baseType === "char" ? dimensions : null;
  }

  /**
   * How many subscripts a bit-field of `width` bits takes, a bitmap's or a C
   * struct's: a 1-bit field is a single bit, so none; a wider one takes one
   * bit index, as a scalar does (ADR-007, ADR-034).
   */
  static fieldDepthLimit(width: number): number {
    return width === 1 ? 0 : 1;
  }
}

export default SubscriptClassifier;
