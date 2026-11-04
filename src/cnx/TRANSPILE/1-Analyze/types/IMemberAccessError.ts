/**
 * A `.name` on a value with no such member (#1805).
 *
 * Error code:
 * - E0927: the value's type has no members, or does not answer that property
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IMemberAccessError extends IBaseAnalysisError {}

export default IMemberAccessError;
