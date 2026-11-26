/**
 * A user-defined type as C spells it: ADR-046's `cstring` is `const char*` (#2311), and a C
 * struct tag with no typedef takes the `struct` keyword (#834).
 */
function userCType(typeName: string, needsStructKeyword: boolean): string {
  // ADR-046: cstring maps to const char* for C library interop. Its
  // characters are C's; `mut` reassigns the pointer (#2311).
  if (typeName === "cstring") {
    return "const char*";
  }
  if (needsStructKeyword) {
    return `struct ${typeName}`;
  }
  return typeName;
}

export default userCType;
