import type ISourceSpan from "../../../types/ISourceSpan";
/**
 * A name in a type position that does not name a type.
 *
 * E0426: it denotes nothing visible in the file that used it.
 * E0429: it denotes a register, which is not a type (ADR-004, #1336) --
 * retired when ADR-111 is implemented.
 */
interface IUndeclaredTypeError {
  readonly code: string;
  readonly typeName: string;
  readonly span: ISourceSpan;
  readonly message: string;
}

export default IUndeclaredTypeError;
