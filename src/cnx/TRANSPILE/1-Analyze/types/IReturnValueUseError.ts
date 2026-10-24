import type ISourceSpan from "../../../types/ISourceSpan";
/**
 * Error reported by ReturnValueUseAnalyzer (ADR-070, E0708).
 */
interface IReturnValueUseError {
  span: ISourceSpan;
  code: string;
  message: string;
  helpText: string;
}

export default IReturnValueUseError;
