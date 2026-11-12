import OperandTyper from "../../../utils/OperandTyper";
import CPointerParameter from "../../../utils/CPointerParameter";
import ScanfFormat from "../../../utils/ScanfFormat";
import type IAnalysisContext from "../types/IAnalysisContext";
import CCallee from "./CCallee";
import type ICCallee from "../types/ICCallee";

/**
 * Whether a C callee may write what one argument hands it (ADR-071 Decision
 * 2): a parameter it can write through, or -- past a variadic callee's
 * declared parameters, where C says nothing -- an argument a scanf-family
 * call's literal format fills (`ScanfFormat`, #2117): `sscanf("5", "%d", x)`
 * writes `x`. Past any other variadic callee's parameters, an array or a
 * string, which C passes as a pointer to its first element. A C++ overload set
 * writes it when every overload the call can reach does: a `const` one is
 * the one a read-only argument calls. E0899's write tracking and E0900's
 * check read this one answer.
 */
class CArgumentWrite {
  static mayWrite(
    callee: ICCallee,
    index: number,
    context: IAnalysisContext,
  ): boolean {
    const reached = CCallee.reachable(callee);
    return (
      reached.length > 0 &&
      reached.every((signature) => {
        const parameter = signature.parameters[index];
        if (parameter !== undefined) {
          return CPointerParameter.writesThrough(parameter);
        }
        return (
          signature.isVariadic &&
          CArgumentWrite.variadicWrites(callee, index, context)
        );
      })
    );
  }

  /** What fills a variadic callee's `...` at `index` may be written */
  private static variadicWrites(
    callee: ICCallee,
    index: number,
    context: IAnalysisContext,
  ): boolean {
    const writes = ScanfFormat.writesOf(callee.name, callee.arguments);
    if (writes.kind === "literal") return writes.written.has(index);
    // E0930 rejects the call; a format cnx cannot read may fill any argument
    if (writes.kind === "format-not-literal") return true;
    return OperandTyper.decaysToPointer(
      OperandTyper.typeOf(callee.arguments[index], context),
    );
  }
}

export default CArgumentWrite;
