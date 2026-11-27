import type ICppBaseSymbol from "./ICppBaseSymbol";
import type ICppFieldInfo from "./ICppFieldInfo";
import type ICppMemberTemplate from "./ICppMemberTemplate";

/**
 * Symbol representing a C++ class or struct type definition.
 */
interface ICppClassSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "class" */
  readonly kind: "class";

  /** Map of field name to field metadata (only populated if SymbolTable was provided) */
  readonly fields?: ReadonlyMap<string, ICppFieldInfo>;

  /** #2473 review: its member templates, which a call to a method of the same name may reach */
  readonly templateMethods?: readonly ICppMemberTemplate[];

  /** #2510 review: its bases as written, whose constants its fields also read */
  readonly bases?: readonly string[];
}

export default ICppClassSymbol;
