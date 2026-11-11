/**
 * A string compared with something that is not a string (ADR-045).
 *
 * Error codes:
 * - E0929: `=` / `!=` between a string and a value that is not one
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IStringComparisonError extends IBaseAnalysisError {}

export default IStringComparisonError;
