import type IBaseSymbol from "./IBaseSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "../TType";
import type TOverflowBehavior from "../TOverflowBehavior";

/**
 * Symbol representing a function definition.
 */
interface IFunctionSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "function" */
  readonly kind: "function";

  /** Function parameters */
  readonly parameters: ReadonlyArray<IParameterInfo>;

  /** Return type */
  readonly returnType: TType;

  /** ADR-044: a call result's overflow behavior, from the return type's modifier */
  readonly returnOverflowBehavior: TOverflowBehavior;
}

export default IFunctionSymbol;
