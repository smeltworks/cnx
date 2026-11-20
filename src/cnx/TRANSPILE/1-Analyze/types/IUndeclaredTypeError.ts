import type IBaseAnalysisError from "./IBaseAnalysisError";
/**
 * A name in a type position that does not name a type.
 *
 * E0426: it denotes nothing visible in the file that used it.
 * E0937: it denotes a register instance, which is a value, not a type
 * (ADR-072, #1336).
 */
interface IUndeclaredTypeError extends IBaseAnalysisError {
  readonly typeName: string;
}

export default IUndeclaredTypeError;
