/**
 * Struct Header Generator
 *
 * Generates C typedef struct declarations from symbol information.
 * Used by HeaderGenerator to emit full struct definitions in headers.
 */

import headerCType from "../../../../utils/headerCType";
import DeclaredPointer from "../../../../utils/DeclaredPointer";
import IHeaderTypeInput from "./IHeaderTypeInput";
/**
 * Resolve the C type for a struct field, checking for callback types first.
 */
function resolveFieldCType(fieldType: string, input: IHeaderTypeInput): string {
  // ADR-029: Check if field type is a callback type and use typedef name
  const callbackInfo = input.callbackTypes?.get(fieldType);
  if (callbackInfo) {
    return callbackInfo.typedefName;
  }
  // Issue #502/#522: a C++ namespaced type is written `A::B`, as 1.3 stored
  // it (#2116). Shared with the function-prototype path, so the two cannot
  // name one type two ways (#1520).
  return headerCType(fieldType);
}

/**
 * Generate the field line for a struct member, handling embedded dimensions.
 *
 * Issue #461: Handle string<N> types which map to char[N+1]
 * The embedded dimension must come after array dimensions in C syntax.
 * Example: string<64> arr[4] -> char arr[4][65], not char[65] arr[4]
 */
function generateFieldLine(
  fieldName: string,
  cType: string,
  dims: readonly (number | string)[] | undefined,
): string {
  const dimSuffix =
    dims && dims.length > 0 ? dims.map((d) => `[${d}]`).join("") : "";
  const embeddedMatch = /^(\w+)\[(\d+)\]$/.exec(cType);

  if (!embeddedMatch) {
    return `    ${cType} ${fieldName}${dimSuffix};`;
  }

  const baseType = embeddedMatch[1];
  const embeddedDim = embeddedMatch[2];
  // When dims are provided, they already include string capacity from StructCollector
  if (dims && dims.length > 0) {
    return `    ${baseType} ${fieldName}${dimSuffix};`;
  }
  return `    ${baseType} ${fieldName}[${embeddedDim}];`;
}

/**
 * Generate a C typedef struct declaration for the given struct name.
 *
 * Output format (Issue #296: uses named struct for forward declaration compatibility):
 * ```c
 * typedef struct StructName {
 *     uint32_t field1;
 *     uint8_t buffer[256];
 * } StructName;
 * ```
 *
 * @param name - The struct type name
 * @param input - Symbol information containing struct fields
 * @returns C typedef struct declaration, or forward declaration if data unavailable
 */
function generateStructHeader(name: string, input: IHeaderTypeInput): string {
  const fields = input.structFields.get(name);

  // Graceful fallback if struct data not available
  if (!fields || fields.size === 0) {
    return `typedef struct ${name} ${name};`;
  }

  const dimensions = input.structFieldDimensions.get(name);
  const handles = input.structFieldHandles?.get(name);
  const lines: string[] = [];
  // Issue #296: Use named struct for forward declaration compatibility
  lines.push(`typedef struct ${name} {`);

  // Iterate fields in insertion order (Map preserves order)
  for (const [fieldName, fieldType] of fields) {
    // #1744: a field of an opaque C type holds the handle
    const cType = DeclaredPointer.spell(
      resolveFieldCType(fieldType, input),
      handles?.has(fieldName) ?? false,
    );
    const dims = dimensions?.get(fieldName);
    lines.push(generateFieldLine(fieldName, cType, dims));
  }

  lines.push(`} ${name};`);

  return lines.join("\n");
}

export default generateStructHeader;
