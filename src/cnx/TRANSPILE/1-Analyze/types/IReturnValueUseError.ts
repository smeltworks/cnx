import type IBaseAnalysisError from "./IBaseAnalysisError";
/**
 * Error reported by ReturnValueUseAnalyzer (ADR-070, E0708).
 */
interface IReturnValueUseError extends IBaseAnalysisError {
  helpText: string;
}

export default IReturnValueUseError;
