import type IForeignOrigin from "../../../types/IForeignOrigin";
import type IForeignValue from "./IForeignValue";

/**
 * A header's value and the header that declares it (#2474): two headers may
 * declare one name differently, and a file reads the one it includes.
 */
interface IDeclaredForeignValue {
  readonly origin: IForeignOrigin;
  readonly value: IForeignValue;
  /** #2514: its header is one two cnx files' compiles read differently */
  readonly disputed: boolean;
}

export default IDeclaredForeignValue;
