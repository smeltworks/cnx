import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type TExpression from "../../../types/syntax/TExpression";
import type RegisterInstance from "../../../utils/RegisterInstance";

/** An argument a call places in a register parameter (ADR-072) */
interface IRegisterArgument {
  readonly arg: TExpression;
  readonly paramName: string;
  readonly callee: IFunctionSymbol;
  readonly calledAs: string;
  readonly layout: NonNullable<ReturnType<typeof RegisterInstance.typeNamedBy>>;
}

export default IRegisterArgument;
