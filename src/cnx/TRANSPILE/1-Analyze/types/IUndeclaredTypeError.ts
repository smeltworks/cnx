import type IBaseAnalysisError from "./IBaseAnalysisError";
/**
 * A name in a type position that does not name a type.
 *
 * E0426: it denotes nothing visible in the file that used it.
 * E0429: it denotes a register, which is not a type (ADR-004, #1336) --
 * retired when ADR-111 is implemented.
 */
interface IUndeclaredTypeError extends IBaseAnalysisError {
  readonly typeName: string;
}

export default IUndeclaredTypeError;
