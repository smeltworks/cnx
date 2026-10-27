import type SymbolRegistry from "../../3-Declare/SymbolRegistry";
import type ILexicalFrame from "../../../types/ILexicalFrame";
import type TSymbol from "../../../types/symbols/TSymbol";
import type IForeignValue from "./IForeignValue";

/**
 * What `Program.bindValue` reads to decide what a spelling means.
 *
 * Built twice, from the same declarations: once while 1.4 folds consts and
 * dimensions, over the frames and symbols as 1.3 declared them, and once for
 * the finished program, over the settled ones. A binding reads only names,
 * spans and scope paths, which settling does not change, so both give the
 * same answer -- and the fold binds a name exactly as every later pass does
 * (#1664 review).
 */
interface IBindingFacts {
  readonly framesByFile: ReadonlyMap<string, ILexicalFrame>;
  readonly symbolsByCName: ReadonlyMap<string, TSymbol>;
  /** Every symbol by its scope path and name (`Program.identityKey`, #2116). */
  readonly symbolsByIdentity: ReadonlyMap<string, TSymbol>;
  readonly registry: SymbolRegistry | null;
  readonly foreignNames: ReadonlySet<string>;
  /**
   * #1175: the variables and functions among `foreignNames` -- what a
   * constant expression naming one is worth
   */
  readonly foreignValues: ReadonlyMap<string, IForeignValue>;
  /**
   * The files each file can see: itself and its include closure. A scope
   * member or global declared anywhere else binds nothing there (#1760
   * second review: the run-wide index let a sibling's scope member beat a
   * visible global).
   */
  readonly visibleFiles: ReadonlyMap<string, ReadonlySet<string>>;
}

export default IBindingFacts;
