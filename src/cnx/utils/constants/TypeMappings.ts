/**
 * cnx to C Type Mappings
 *
 * Single source of truth for the primitive type mappings.
 */

/**
 * Maps cnx primitive types to their C equivalents.
 *
 * Used by:
 * - Code generation for variable/parameter declarations
 * - Header generation for extern declarations
 * - Symbol resolution for type conversion
 */
const CNX_TO_C_TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
  f32: "float",
  f64: "double",
  bool: "bool",
  void: "void",
  ISR: "ISR", // ADR-040: Interrupt Service Routine function pointer
  cstring: "const char*", // ADR-046: C string pointer type (nullable, #2311)
};

export default CNX_TO_C_TYPE_MAP;
