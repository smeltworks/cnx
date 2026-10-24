import type ISourceSpan from "../../../types/ISourceSpan";
/**
 * MISRA C:2012 comment violation (ADR-043)
 */
interface ICommentError {
  /** MISRA rule violated */
  rule: "3.1" | "3.2";
  /** Error message */
  message: string;
  /** Line number (1-based) */
  span: ISourceSpan;
}

export default ICommentError;
