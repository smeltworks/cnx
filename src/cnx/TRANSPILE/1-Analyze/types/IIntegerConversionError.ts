/**
 * ADR-024 integer conversions.
 *
 * Error codes:
 * - E0868: an integer literal does not fit the target type's range
 * - E0869: an implicit narrowing or sign-changing conversion
 * - E0891: an implicit floating-to-integer conversion
 * - E0910: a value known at compile time overflows (#1618)
 * - E0914: a string value landing in an integer, float or bool
 * - E0923: a value that is not a string landing in a string<N>
 * - E0927: a value that is not a character landing in a string's character
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IIntegerConversionError extends IBaseAnalysisError {}

export default IIntegerConversionError;
