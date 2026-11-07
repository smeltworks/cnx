/**
 * Every file's symbols as 1.4 Resolve settles them, with the facts the
 * settling derived on the way (#2036).
 *
 * `Program.build` assembles its query surface from exactly this, and a caller
 * with no run -- `lib/parseWithSymbols`, which has one file and no mode or
 * target -- reads `symbolsByFile` alone. Both settle through the one step, so
 * the symbols an editor lists are the symbols a run generates from.
 *
 * The foreign symbols and visibility travel with the result, defaults applied,
 * so `build` reads what the files were settled against rather than resolving
 * its own copy of each default.
 */
import type ILexicalFrame from "../../../types/ILexicalFrame";
import type TSymbol from "../../../types/symbols/TSymbol";
import type IFileConstantFacts from "./IFileConstantFacts";
import type IForeignSymbols from "./IForeignSymbols";
import type IForeignValue from "./IForeignValue";
import type ISettledConstants from "./ISettledConstants";
import type IVisibilityInput from "./IVisibilityInput";
import type TRunTarget from "../../../types/TRunTarget";

interface ISettledFiles {
  /** Each file's symbols: types, const-folded dimensions, parameter names */
  readonly symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>;
  /** Each file's lexical frames, settled against what that file can see */
  readonly framesByFile: ReadonlyMap<string, ILexicalFrame>;
  /** Every const's and enum member's value, settled once for all files */
  readonly constants: ISettledConstants;
  /** ADR-057: whether `sourceFile` can see a scope type (#1724) */
  readonly isScopeTypeVisibleFrom: (
    sourceFile: string,
    qualifiedName: string,
  ) => boolean;
  /** What a constant name's facts read of the files (#1175) */
  readonly fileFacts: IFileConstantFacts;
  /** ADR-030: the typedefs that never received a body (#1722) */
  readonly opaqueTypes: ReadonlySet<string>;
  /** Each file's include closure, by path (#1435) */
  readonly visibleFiles: ReadonlyMap<string, ReadonlySet<string>>;
  /** Every name a C or C++ header declares */
  readonly foreignNames: ReadonlySet<string>;
  /** #1881: each file's foreign names, by its own header includes */
  readonly foreignNamesByFile: ReadonlyMap<string, ReadonlySet<string>>;
  /** The values the headers' constants and macros carry */
  readonly foreignValues: ReadonlyMap<string, IForeignValue>;
  /** What the C and C++ headers contributed, or none */
  readonly foreign: IForeignSymbols;
  /** Which cnx files each file includes, or none */
  readonly visibility: IVisibilityInput;
  /** The run's target, which a header's length properties are folded for; null with none */
  readonly target: TRunTarget | null;
}

export default ISettledFiles;
