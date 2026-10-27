import type ILocalDeclaration from "../../../types/ILocalDeclaration";
import type TChainRoot from "../../../types/TChainRoot";
import type TConstResult from "../../../types/TConstResult";
import type TSymbol from "../../../types/symbols/TSymbol";
import type TValueBinding from "../../../types/TValueBinding";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type ISourcePosition from "../../../utils/types/ISourcePosition";
import type IForeignValue from "./IForeignValue";
import type TSettledConst from "../../../types/TSettledConst";
import type IFileConstantFacts from "./IFileConstantFacts";

/**
 * What `ConstantNames` asks while it walks a name's chain (#1175, #1669), as
 * seen from one file. 1.4 Resolve answers it twice -- while the program's
 * consts and enum values settle, and from the settled program for every later
 * pass -- from the same binder, so a name has one value in both.
 */
interface IConstantNameFacts {
  /** The binder's answer for a chain's head where it is written (ADR-057) */
  bind(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TValueBinding | null;
  /** The scope a position is in, for ADR-057's type qualification */
  scopePathAt(at: ISourcePosition): string;
  /** A cnx declaration this file can see, by C name */
  visibleSymbol(cName: string): TSymbol | undefined;
  /**
   * The member `name` of `scopePath` this file can see, found by its scope
   * path and name rather than an encoded C name (#2116).
   */
  visibleMember(scopePath: string, name: string): TSymbol | undefined;
  /** The scope type a bare `name` in `scopePath` binds to here (ADR-057) */
  scopeTypeOf(scopePath: string, name: string): TSymbol | undefined;
  /** A const's settled value, or why it has none; undefined until it settles */
  constValue(symbol: IVariableSymbol): TSettledConst | undefined;
  /** A local as settled; undefined when it has not settled (yet) */
  settledLocal(declaration: ILocalDeclaration): ILocalDeclaration | undefined;
  /**
   * Whether this file includes a C or C++ header, directly or transitively:
   * a name nothing binds may then be a macro, which only C can evaluate
   */
  readonly reachesForeignHeader: boolean;
  /** `IProgram.mayBeHeaderName`, for this file */
  mayBeHeaderName(root: TChainRoot, name: string, at: ISourcePosition): boolean;
  /** A header's variable or function the binder bound `name` to; null otherwise */
  foreignValue(name: string): IForeignValue | null;
  /** #2076: `IFileConstantFacts.headerStructFields` */
  headerStructFields: IFileConstantFacts["headerStructFields"];
  /** #2076: `IFileConstantFacts.headerTypeBits` */
  headerTypeBits: IFileConstantFacts["headerTypeBits"];
  /** #1975 review: `IFileConstantFacts.headerTypeHead` */
  headerTypeHead: IFileConstantFacts["headerTypeHead"];
  /** #1975 review: `IFileConstantFacts.headerFieldCount` */
  headerFieldCount: IFileConstantFacts["headerFieldCount"];
  /** `IFileConstantFacts.headerNeedsStructKeyword` */
  headerNeedsStructKeyword: IFileConstantFacts["headerNeedsStructKeyword"];
  /** A member of the enum with C name `enumCName` */
  enumMember(
    enumCName: string,
    member: string,
    spelling: string,
    at: ISourcePosition,
  ): TConstResult;
}

export default IConstantNameFacts;
