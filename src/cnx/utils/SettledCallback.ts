import type IProgram from "../types/IProgram";
import type TType from "../types/TType";
import TTypeUtils from "./TTypeUtils";

/**
 * #1984: 1.4's answer to "is this a function used as a type?", read off a
 * settled type. 1.4 decided it against the file's include visibility; a later
 * pass reads it here rather than looking the type's name up among functions.
 */
class SettledCallback {
  /** A settled type is a callback, or an array of one */
  static isType(type: TType): boolean {
    return TTypeUtils.isCallback(
      type.kind === "array" ? type.elementType : type,
    );
  }

  /** A struct field whose settled type is a callback, or an array of one */
  static isField(
    program: Pick<IProgram, "symbolByCName">,
    structName: string,
    fieldName: string,
  ): boolean {
    const struct = program.symbolByCName(structName);
    const field =
      struct?.kind === "struct" ? struct.fields.get(fieldName) : undefined;
    return field !== undefined && SettledCallback.isType(field.type);
  }
}

export default SettledCallback;
