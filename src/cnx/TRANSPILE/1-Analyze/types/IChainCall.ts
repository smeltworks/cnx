import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";
import type ICCallee from "./ICCallee";

/** One call in a chain (#2473): where it is, what it reaches, and how a diagnostic names that */
interface IChainCall {
  readonly callAt: number;
  readonly call: Extract<TPostfixOpSyntax, { kind: "call" }>;
  /** Null for a C callee, or a name the program does not declare */
  readonly callee: IFunctionSymbol | null;
  readonly calledAs: string;
  /** The C (or C++) function it reaches (`CCallee`); null for a cnx callee or one no header declares */
  readonly cCallee: ICCallee | null;
}

export default IChainCall;
