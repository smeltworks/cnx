/**
 * Base interface for all analysis errors.
 *
 * All analyzer error interfaces extend this common base,
 * providing a consistent structure for error reporting.
 */
import type ISourceSite from "../../../types/ISourceSite";
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
  /** Where the declaration the error is about sits (`ITranspileError`) */
  declaredAt?: ISourceSite;
}

export default IBaseAnalysisError;
