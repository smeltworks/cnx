import type TCSymbol from "../../../types/symbols/c/TCSymbol";
import type TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import type IStructFieldInfo from "../../../types/symbols/IStructFieldInfo";
import type IStructSymbolState from "../../../types/symbols/IStructSymbolState";
import type TJsonSafe from "../../../utils/types/TJsonSafe";

/**
 * One C/C++ header's declarations, as 1.3 declared them and the symbol cache
 * records them (#1225, #1991). 1.1 reads a cached one in place of the header's
 * text, and 1.3 restores it instead of declaring the header again.
 */
interface IHeaderDeclarationRecord {
  readonly symbols: ReadonlyArray<TCSymbol | TCppSymbol>;
  readonly structFields: Map<string, Map<string, IStructFieldInfo>>;
  readonly needsStructKeyword: string[];
  readonly enumBitWidth: Map<string, number>;
  /** #2494 review: the macros this header `#undef`s */
  readonly undefinedMacros: readonly string[];
  /** The whole table's struct state as it stood once the header was declared */
  readonly structState: TJsonSafe<Required<IStructSymbolState>>;
}

export default IHeaderDeclarationRecord;
