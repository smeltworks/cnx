import type IParameterPassing from "../../types/IParameterPassing";

/**
 * Represents a function parameter symbol
 */
interface IParameterSymbol {
  /** The source name, which per-parameter facts are keyed by */
  name: string;
  /** #1290: the C name the prototype writes, as 1.4 settled it (ADR-057) */
  emittedName: string;
  type: string; // cnx type (u32, Configuration, etc.)
  isConst: boolean;
  isArray: boolean;
  arrayDimensions?: string[]; // e.g., ["10", "20"] or ["", ""] for unbounded
  passing?: IParameterPassing; // #1639: decided once in 2.2, as the .c signature reads it
  isCallback?: boolean; // ADR-029/#1164: the param's declared type IS a callback function
  callbackTypedefName?: string; // ADR-029/#1164: the typedef to write it as (e.g. "onReceive_fp")
  isRegister?: boolean; // ADR-072: a register parameter, a pointer to its layout
  isOpaqueHandle?: boolean; // Issue #995: type is opaque (incomplete struct), needs pointer not reference -- each element's, for an array (#996)
}

export default IParameterSymbol;
