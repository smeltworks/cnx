import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";

/** One call in a chain (#2473): where it is, what it reaches, and how a diagnostic names that */
interface IChainCall {
  readonly callAt: number;
  readonly call: Extract<TPostfixOpSyntax, { kind: "call" }>;
  /** Null for a C callee, or a name the program does not declare */
  readonly callee: IFunctionSymbol | null;
  readonly calledAs: string;
}

export default IChainCall;
