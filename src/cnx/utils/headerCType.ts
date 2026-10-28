import TypeMapping from "./mapType";

/**
 * The C or C++ type name a header declares a thing with.
 *
 * A C++ namespaced type already arrives as `SeaDash::Parse::ParseResult`: 1.3
 * spelled the written path once, from the header's symbols, and every later
 * layer reads that spelling (#2116). What is left is the cnx to C mapping.
 *
 * ## Why it is one function
 *
 * It was two, and only one of them converted. `resolveFieldCType` called
 * `convertToCppNamespace` before `mapType`; `generateFunctionPrototype` and
 * `generateParameter` called `mapType` alone. So the same type was written
 * `SeaDash::Parse::ParseResult` as a struct field and
 * `SeaDash__Parse__ParseResult` as a function parameter, in the same header --
 * the second naming a type nothing declares, which is why
 * `tests/issue-502/function-param-init` would not compile (#1520).
 */
function headerCType(typeName: string): string {
  return TypeMapping.mapType(typeName);
}

export default headerCType;
