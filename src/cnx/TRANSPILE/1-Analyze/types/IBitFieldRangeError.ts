/**
 * A header bit-field with no range cnx can know (ADR-034).
 *
 * Error codes:
 * - E0944: a read or write of a bit-field whose type says neither signed nor unsigned
 * - E0946: a read or write of a bit-field whose width cnx cannot read (#2494)
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IBitFieldRangeError extends IBaseAnalysisError {}

export default IBitFieldRangeError;
