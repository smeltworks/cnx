import headerCType from "./headerCType";
import type IStructKeywordFacts from "./types/IStructKeywordFacts";
import userCType from "./userCType";

/**
 * A resolved cnx type name as C writes it: `headerCType`'s mapping, then the
 * `struct` keyword a C tag with no typedef needs (#834).
 *
 * ## Why it is one function
 * The .c definition asked for the keyword and the .h did not, so a
 * `struct Point` parameter was `struct Point* p` in one and `Point* p` in the
 * other, and gcc rejected the header (#1944). The prototype, the struct
 * field, the extern, the type alias, the .c declaration and the ADR-029 `_fp`
 * typedef all spell a type through here, so they cannot disagree.
 */
function cTypeName(typeName: string, facts: IStructKeywordFacts): string {
  return userCType(
    headerCType(typeName),
    facts.checkNeedsStructKeyword(typeName),
  );
}

export default cTypeName;
