import type IOperandType from "../types/IOperandType";

type TOperandForm = IOperandType["form"];

/**
 * An operand with only a type name and a form settled: no category, width,
 * dimensions or qualifiers. The one literal every other typing spreads over.
 */
class BareOperand {
  static of(typeName: string | null, form: TOperandForm): IOperandType {
    return {
      typeName,
      cType: null,
      dimensions: [],
      category: "none",
      bitWidth: null,
      stringCapacity: null,
      enumTypeName: null,
      bitmapTypeName: null,
      callbackTypeName: null,
      overflow: null,
      hasSideEffect: false,
      volatileAccess: false,
      signChosenByCompiler: false,
      form,
      binding: null,
    };
  }
}

export default BareOperand;
