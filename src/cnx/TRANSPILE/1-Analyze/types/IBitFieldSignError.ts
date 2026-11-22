/**
 * A header bit-field whose signedness the C compiler chooses (ADR-072 ruling 20).
 *
 * Error code:
 * - E0944: a read or write of a bit-field whose type says neither signed nor unsigned
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IBitFieldSignError extends IBaseAnalysisError {}

export default IBitFieldSignError;
