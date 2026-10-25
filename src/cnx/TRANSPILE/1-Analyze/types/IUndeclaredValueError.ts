import type IBaseAnalysisError from "./IBaseAnalysisError";
/**
 * E0427: a bare identifier in a value position that denotes nothing visible in
 * the file that used it.
 */
interface IUndeclaredValueError extends IBaseAnalysisError {
  readonly identifier: string;
}

export default IUndeclaredValueError;
