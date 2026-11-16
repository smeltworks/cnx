import type ITranspileError from "../../types/ITranspileError";
import CodedErrorText from "../../utils/CodedErrorText";
import type ISourcePosition from "../../utils/types/ISourcePosition";

/**
 * A 1.2 form check's error (#2115): every form checker reports a coded error
 * at a position it read, and this is the one place that builds it. A form
 * is what is written there, so the error is about its own position (#1402).
 */
class FormError {
  static at(
    position: ISourcePosition,
    code: string,
    message: string,
    helpText: string,
  ): ITranspileError {
    return {
      line: position.line,
      column: position.column,
      message: CodedErrorText.of(code, message),
      helpText,
      severity: "error",
      aboutItsPosition: true,
    };
  }
}

export default FormError;
