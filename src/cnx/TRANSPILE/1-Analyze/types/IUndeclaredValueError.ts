import type ISourceSpan from "../../../types/ISourceSpan";
/**
 * E0427: a bare identifier in a value position that denotes nothing visible in
 * the file that used it.
 */
interface IUndeclaredValueError {
  readonly code: string;
  readonly identifier: string;
  readonly span: ISourceSpan;
  readonly message: string;
}

export default IUndeclaredValueError;
