import type IBaseSymbol from "./IBaseSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "../TType";
import type TOverflowBehavior from "../TOverflowBehavior";
import type TConstExpr from "../TConstExpr";

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

  /**
   * #1209: an array return's dimensions as written, where 1.3 could not size
   * them (a const's name); 1.4 Resolve settles them, as a variable's
   */
  readonly returnDimensionExprs?: ReadonlyArray<TConstExpr | null>;

  /** ADR-044: a call result's overflow behavior, from the return type's modifier */
  readonly returnOverflowBehavior: TOverflowBehavior;
}

export default IFunctionSymbol;
