import type TExpressionOf from "../../../types/syntax/TExpressionOf";
import OperandTyper from "../../../utils/OperandTyper";
import RegisterInstance from "../../../utils/RegisterInstance";
import FunctionReference from "./FunctionReference";
import type IAnalysisContext from "../types/IAnalysisContext";
import type IRegisterArgument from "../types/IRegisterArgument";

/**
 * The arguments a chain's calls place in register parameters (ADR-072), with
 * each parameter's register type: E0940 checks each one, and E0942 leaves
 * them alone, so both read this one answer.
 */
class RegisterArguments {
  static of(
    chain: TExpressionOf<"postfix">,
    context: IAnalysisContext,
  ): IRegisterArgument[] {
    const scopePath = OperandTyper.scopePathAt(chain.span, context);
    return FunctionReference.callsIn(chain, scopePath, context).flatMap(
      (chainCall) => {
        const callee = chainCall.callee;
        if (callee === null) return [];
        return chainCall.call.arguments.flatMap((arg, index) => {
          const param = callee.parameters[index];
          if (param === undefined) return [];
          const layout = RegisterInstance.typeNamedBy(
            context.program,
            param.type,
          );
          return layout === null
            ? []
            : [
                {
                  arg,
                  paramName: param.name,
                  callee,
                  calledAs: chainCall.calledAs,
                  layout,
                },
              ];
        });
      },
    );
  }
}

export default RegisterArguments;
