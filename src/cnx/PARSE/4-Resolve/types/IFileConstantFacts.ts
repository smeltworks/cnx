import type IForeignOrigin from "../../../types/IForeignOrigin";
import type IStructFieldInfo from "../../../types/symbols/IStructFieldInfo";
import type TType from "../../../types/TType";

/**
 * What a constant name's facts read of the program's files, beside the binder
 * (#1175): the same answers for 1.4's settling and every later pass.
 */
interface IFileConstantFacts {
  /** ADR-057: whether a qualified type name is a scope type `sourceFile` sees */
  isScopeTypeVisibleFrom(sourceFile: string, qualifiedName: string): boolean;
  /** `IProgram.qualifiedTypeName`: the spelling 1.3 gave a written `Scope.T` */
  qualifiedTypeName(sourceFile: string, written: string): string;
  /** Whether `sourceFile` includes a C or C++ header, so a name may be a macro */
  includesForeignHeader(sourceFile: string): boolean;
  /** `IProgram.seesHeaderMacro` */
  seesHeaderMacro(sourceFile: string, name: string): boolean;
  /** `IProgram.seesForeignSymbol` */
  seesForeignSymbol(sourceFile: string, symbol: IForeignOrigin): boolean;
  /** `IProgram.hidesHeaderName` */
  hidesHeaderName(sourceFile: string, name: string): boolean;
  /**
   * #2076: a header struct's fields, as `sourceFile` reads the headers
   * (#2474); undefined for a name no header's struct has
   */
  headerStructFields(
    sourceFile: string,
    structName: string,
  ): ReadonlyMap<string, IStructFieldInfo> | undefined;
  /**
   * #2076: `ForeignTypeFacts.typeBits` of a header's C type, for the run's
   * target, as `sourceFile` reads the headers (#2474)
   */
  headerTypeBits(sourceFile: string, cType: string): number | null;
  /** #1975 review: `TypeHead.header` over the headers `sourceFile` reads (#2474) */
  headerTypeHead(sourceFile: string, name: string): TType | null;
  /** #1975 review: `ForeignTypeFacts.fieldCount` over the headers `sourceFile` reads (#2474) */
  headerFieldCount(sourceFile: string, structName: string): number | null;
  /** A header struct declared without a typedef, which C names `struct X` */
  headerNeedsStructKeyword(structName: string): boolean;
}

export default IFileConstantFacts;
