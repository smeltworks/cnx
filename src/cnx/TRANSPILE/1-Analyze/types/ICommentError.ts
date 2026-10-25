import type ISourceSpan from "../../../types/ISourceSpan";
/**
 * MISRA C:2012 comment violation (ADR-043)
 */
interface ICommentError {
  /** MISRA rule violated */
  rule: "3.1" | "3.2";
  /** Error message */
  message: string;
  /** Where it is reported; its column is 0-based, like every diagnostic's */
  span: ISourceSpan;
}

export default ICommentError;
