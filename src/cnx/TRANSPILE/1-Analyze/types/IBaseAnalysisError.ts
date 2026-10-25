/**
 * Base interface for all analysis errors.
 *
 * All analyzer error interfaces extend this common base,
 * providing a consistent structure for error reporting.
 */
import type IMutSite from "../../../types/IMutSite";
import type ISourceSpan from "../../../types/ISourceSpan";

interface IBaseAnalysisError {
  /** Error code (e.g., E0381, E0800) */
  code: string;
  /** Where it is reported: the span 1.2 gave the node (#2115) */
  span: ISourceSpan;
  /** Human-readable error message */
  message: string;
  /** Optional help text with suggested fix */
  helpText?: string;
  /** A warning is reported and the file still compiles (E0896) */
  severity?: "error" | "warning";
  /** E0900 and E0879: where `mut` belongs on the binding (ADR-071) */
  declaredAt?: IMutSite;
}

export default IBaseAnalysisError;
