/**
 * Array assignment handlers (ADR-065).
 *
 * Handles assignments to array elements:
 * - ARRAY_ELEMENT: arr[i] <- value
 * - MULTI_DIM_ARRAY_ELEMENT: matrix[i][j] <- value
 * - ARRAY_SLICE: buffer[0, 10] <- source
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import TAssignmentHandler from "./TAssignmentHandler";
import type TTypeInfo from "../../../../../types/TTypeInfo";
import CNX_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";
import invariant from "../../../../../utils/invariant";
import SliceSource from "../../../../2-Plan/SliceSource";
import SliceWrites from "../SliceWrites";

/**
 * Handle simple array element: arr[i] <- value
 *
 * Uses resolvedTarget which includes scope prefix and subscript,
 * e.g., "data[0]" inside scope ArrayBug -> "ArrayBug_data[0]"
 */
function handleArrayElement(ctx: IAssignmentContext): string {
  return `${ctx.resolvedTarget} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle multi-dimensional array element: matrix[i][j] <- value
 *
 * Uses resolvedTarget which includes scope prefix and all subscripts.
 * Uses resolvedBaseIdentifier for type lookups to support scoped arrays.
 */
function handleMultiDimArrayElement(ctx: IAssignmentContext): string {
  // #1322: constant index bounds (ADR-036, E0854) are checked in pass 2.1.
  return `${ctx.resolvedTarget} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Per-element write strategy for a slice-assignment destination (Issue #1081).
 *
 * Slice assignment lowers to element-by-element little-endian writes rather than
 * a `memcpy(&dest[off], &value, len)`. `memcpy` between a byte buffer and a
 * wider integer passes incompatible pointer types, violating MISRA C:2012
 * Rule 21.15; writing each element explicitly avoids the call entirely.
 *
 * The destination *element* type determines:
 *  - `bytes`: the element stride. `dest[off + k]` indexes elements, matching
 *    the old `&dest[off]` base address, so a u16[] slice writes whole u16s.
 *  - `cType`: the C element type, used to detect whether an equivalent `memcpy`
 *    would have violated MISRA Rule 21.15 (incompatible pointer types).
 *  - `wrap`: the cast applied to each extracted little-endian chunk. MISRA
 *    Rule 10.8 forbids casting a composite expression (the `>>` result) across
 *    essential-type categories, so `char` and signed destinations cast through
 *    a same-width unsigned type first.
 *
 * Throws for element types that cannot be expressed as integer byte writes
 * (float/bool), which would require type punning and are unsupported.
 */
function resolveSliceElement(
  typeInfo: TTypeInfo | undefined,
  rawName: string,
): { bytes: number; cType: string; wrap: (chunk: string) => string } {
  const baseType = typeInfo?.baseType ?? "";
  const bytes = SliceSource.elementBytes(typeInfo);

  if (bytes > 0 && SliceSource.UNSIGNED_INT_RE.test(baseType)) {
    const cType = CNX_TO_C_TYPE_MAP[baseType];
    return { bytes, cType, wrap: (chunk) => `(${cType})${chunk}` };
  }

  if (bytes > 0 && SliceSource.SIGNED_INT_RE.test(baseType)) {
    const cType = CNX_TO_C_TYPE_MAP[baseType];
    const uType = CNX_TO_C_TYPE_MAP[`u${baseType.slice(1)}`];
    return { bytes, cType, wrap: (chunk) => `(${cType})(${uType})${chunk}` };
  }

  invariant(
    false,
    `a sliced array has an integer element type -- E0858 rejects ` +
      `'${baseType}' on '${rawName}' in pass 2.1, before this runs`,
  );
}

/**
 * Validate a slice's length/bounds against the destination element size and
 * buffer capacity, and return the number of destination elements written.
 *
 * `offset` is an *element* index and `capacity` is an *element* count, while
 * `length` is a *byte* count — so the bounds check compares element spans
 * (`offset + elementCount`), not bytes against elements (Issue #1085 review,
 * Finding 1). Mixing the two wrongly rejected in-bounds wide-element slices.
 */
function validateSliceSpan(
  dest: { bytes: number },
  src: { bytes: number },
  offsetValue: number,
  lengthValue: number,
  capacity: number,
  rawName: string,
): number {
  if (lengthValue % dest.bytes !== 0) {
    invariant(
      false,
      `a slice length divides the element size -- E0860 rejects ${lengthValue} ` +
        `against ${dest.bytes} bytes for '${rawName}' in pass 2.1`,
    );
  }

  const elementCount = lengthValue / dest.bytes;
  if (offsetValue + elementCount > capacity) {
    invariant(
      false,
      `a slice span fits its buffer -- E0860 rejects offset(${offsetValue}) + ` +
        `${elementCount} against capacity(${capacity}) for '${rawName}' in pass 2.1`,
    );
  }

  // A slice cannot copy more bytes than the source value holds — that would be
  // an out-of-range shift (undefined behavior) baked in at compile time.
  if (lengthValue > src.bytes) {
    invariant(
      false,
      `a slice length fits its source width -- E0861 rejects ${lengthValue} ` +
        `bytes against ${src.bytes} for '${rawName}' in pass 2.1`,
    );
  }

  return elementCount;
}

/** Validated, constant-folded geometry of a slice-assignment destination. */
interface ISliceGeometry {
  offsetValue: number;
  lengthValue: number;
  capacity: number;
}

/**
 * Build the unrolled, per-element little-endian writes for a slice assignment
 * (Issue #1081). Offset/length constants are already validated by the caller;
 * this focuses on the destination-element-aware codegen so `handleArraySlice`
 * stays within the cognitive-complexity budget.
 *
 * The source is materialized into a single unsigned temp before the writes so
 * it is evaluated exactly once — an impure source (function call, atomic read)
 * would otherwise be re-evaluated per element (Issue #1085 review, Finding 2) —
 * and so every shift has a known, in-range width (Finding 3). The temp is
 * skipped for a single-element slice, where the source is used only once.
 */
function buildSliceWrites(
  name: string,
  ctx: IAssignmentContext,
  typeInfo: TTypeInfo | undefined,
  geometry: ISliceGeometry,
  rawName: string,
): string {
  const dest = resolveSliceElement(typeInfo, rawName);
  const src = ctx.plannedSliceSource;
  invariant(src !== null, "2.2 planned every slice source 2.3 writes");
  const elementCount = validateSliceSpan(
    dest,
    src,
    geometry.offsetValue,
    geometry.lengthValue,
    geometry.capacity,
    rawName,
  );

  return SliceWrites.render({
    element: dest,
    source: src,
    value: ctx.generatedValue,
    lengthValue: geometry.lengthValue,
    elementCount,
    state: ctx.state,
    at: (k) => `${name}[${geometry.offsetValue + k}]`,
  }).join("\n");
}

/**
 * Handle array slice assignment: buffer[0, 10] <- source
 *
 * Validates:
 * - Offset and length must be compile-time constants
 * - Only valid on 1D arrays
 * - Bounds checking at compile time
 */
function handleArraySlice(ctx: IAssignmentContext): string {
  // #1322: compound assignment on this target is E0857 in pass 2.1.

  // Use resolvedBaseIdentifier for type lookup (includes scope prefix)
  const name = ctx.resolvedBaseIdentifier;
  const typeInfo = ctx.target.typeInfo;

  // Validate 1D array only
  if (typeInfo?.arrayDimensions && typeInfo.arrayDimensions.length > 1) {
    // Use raw identifier in error message for clarity
    const rawName = ctx.identifiers[0];
    invariant(
      false,
      `a sliced buffer is one-dimensional -- E0858 rejects ` +
        `${typeInfo.arrayDimensions.length} dimensions on '${rawName}' in pass 2.1`,
    );
  }

  // Validate offset is compile-time constant
  const offsetValue = ctx.foldSubscript(0);
  if (offsetValue === undefined) {
    invariant(
      false,
      "a slice offset folds at compile time -- E0859 rejects a runtime offset in pass 2.1",
    );
  }

  // Validate length is compile-time constant
  const lengthValue = ctx.foldSubscript(1);
  if (lengthValue === undefined) {
    invariant(
      false,
      "a slice length folds at compile time -- E0859 rejects a runtime length in pass 2.1",
    );
  }

  // Determine buffer capacity
  let capacity: number;
  // #2385: a string's characters are written by 2.3's character write, not here
  if (typeInfo?.arrayDimensions?.[0]) {
    capacity = typeInfo.arrayDimensions[0];
  } else {
    // Use raw identifier in error message for clarity
    const rawName = ctx.identifiers[0];
    invariant(
      false,
      `a sliced buffer has a foldable size -- E0858 rejects '${rawName}' in pass 2.1`,
    );
  }

  if (offsetValue < 0) {
    invariant(
      false,
      `a slice offset is not negative -- E0860 rejects ${offsetValue} in pass 2.1`,
    );
  }

  if (lengthValue <= 0) {
    invariant(
      false,
      `a slice length is positive -- E0860 rejects ${lengthValue} in pass 2.1`,
    );
  }

  // Issue #1081: emit per-element little-endian writes instead of memcpy.
  // memcpy between a byte buffer and a wider integer passes incompatible
  // pointer types (MISRA C:2012 Rule 21.15). The slice length is a compile-time
  // constant, so the copy can be fully unrolled at the destination's element
  // granularity with no library call. Element-span bounds, source-width, and
  // length-alignment are validated inside buildSliceWrites where the element
  // size is known.
  return buildSliceWrites(
    name,
    ctx,
    typeInfo,
    { offsetValue, lengthValue, capacity },
    ctx.identifiers[0],
  );
}

/**
 * All array handlers for registration.
 */
const arrayHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.ARRAY_ELEMENT, handleArrayElement],
  [AssignmentKind.MULTI_DIM_ARRAY_ELEMENT, handleMultiDimArrayElement],
  [AssignmentKind.ARRAY_SLICE, handleArraySlice],
];

export default arrayHandlers;
