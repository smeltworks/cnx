/**
 * Error reported when an operand is not of a type its operator takes.
 *
 * Error codes:
 * - E0804: `%` on a floating-point operand
 * - E0806: Compound assignment to a bool
 * - E0807: Operator not valid on a bool operand
 * - E0925: Operator not valid on any other operand outside its set
 *
 * MISRA C:2012 Rule 10.1: "Operands shall not be of an inappropriate essential
 * type." Each operator takes a set of operand types; anything else is one of
 * these codes, the bool and float-modulo cases keeping the codes they had.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IOperatorOperandError extends IBaseAnalysisError {}

export default IOperatorOperandError;
