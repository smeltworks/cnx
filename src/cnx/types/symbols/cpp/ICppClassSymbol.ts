import type ICppBaseSymbol from "./ICppBaseSymbol";
import type ICppFieldInfo from "./ICppFieldInfo";

/**
 * Symbol representing a C++ class or struct type definition.
 */
interface ICppClassSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "class" */
  readonly kind: "class";

  /** Map of field name to field metadata (only populated if SymbolTable was provided) */
  readonly fields?: ReadonlyMap<string, ICppFieldInfo>;

  /** #2473 review: the methods it also declares a member template of, whose overloads 1.3 does not all record */
  readonly templateMethods?: readonly string[];
}

export default ICppClassSymbol;
