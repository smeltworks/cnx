import type IArgumentPassing from "./IArgumentPassing";
import type TTypeInfo from "../../../types/TTypeInfo";

/** What 2.2 knows of one argument to a C or C++ function (#1991) */
interface ICArgumentFacts {
  /** The parameter it binds to, when the callee declares one */
  readonly param: IArgumentPassing["param"];
  /** Written with `&` already, so it is the pointer the parameter takes */
  readonly addressWritten: boolean;
  /** #937: a callback-promoted parameter of the function it is written in */
  readonly promotedHandle: boolean;
  /** Its type, or null when nothing names one */
  readonly argType: string | null;
  /** The declared type of the variable it names, when it names one */
  readonly declared: TTypeInfo | undefined;
  /** A whole array, which C decays to a pointer to its first element */
  readonly isArray: boolean;
  /** ADR-030: one element of an array of handles, already a pointer */
  readonly isHandleArrayElement: boolean;
  /** ADR-030 / #1744: a struct field holding a handle, or one element of an array of them */
  readonly isHandleField: boolean;
}

export default ICArgumentFacts;
