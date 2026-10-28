import type TStructLayout from "./TStructLayout";
import type IConflict from "./IConflict";
import type ITargetDescription from "./ITargetDescription";
import type IStructFieldInfo from "./symbols/IStructFieldInfo";
import type TAnySymbol from "./symbols/TAnySymbol";
import type TSymbol from "./symbols/TSymbol";
import type TCSymbol from "./symbols/c/TCSymbol";
import type TCppSymbol from "./symbols/cpp/TCppSymbol";

/**
 * The run's symbol table as every pass after 1.4 sees it: read-only, reached
 * through `IProgram.symbolTable()` and nowhere else (#1991).
 *
 * 1.3 declares the header symbols into a `SymbolTable` and 1.4 adds the cnx
 * ones while it builds `Program`; nothing after that writes. Only queries are
 * declared here, so a later pass that tries to add or mark a symbol fails to
 * compile rather than mutating a table another file's pass already read.
 */
interface IResolvedSymbols {
  readonly size: number;
  getSymbol(name: string): TAnySymbol | undefined;
  getOverloads(name: string): TAnySymbol[];
  getOverloadsByCName(cName: string): TAnySymbol[];
  getAllSymbols(): TAnySymbol[];
  getSymbolsByFile(file: string): TAnySymbol[];
  getTSymbol(name: string): TSymbol | undefined;
  getTOverloads(name: string): TSymbol[];
  getTSymbolsByFile(file: string): TSymbol[];
  getAllTSymbols(): TSymbol[];
  getCSymbol(name: string): TCSymbol | undefined;
  getCOverloads(name: string): TCSymbol[];
  getCSymbolsByFile(file: string): TCSymbol[];
  getAllCSymbols(): TCSymbol[];
  getCppSymbol(name: string): TCppSymbol | undefined;
  getCOverloads(name: string): TCSymbol[];
  getCppOverloads(name: string): TCppSymbol[];
  /** #2116: `SymbolTable.getCppMembers` */
  getCppMembers(owner: string | undefined, member: string): TCppSymbol[];
  getCppSymbolsByFile(file: string): TCppSymbol[];
  getAllCppSymbols(): TCppSymbol[];
  hasExternalDeclaration(name: string): boolean;
  isCFunctionPointerTypedef(typeName: string): boolean;
  detectMISRA51Conflicts(target: ITargetDescription): IConflict[];
  getStructFields(
    structName: string,
  ): Map<string, IStructFieldInfo> | undefined;
  getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): IStructFieldInfo | undefined;
  getStructFieldTypes(structName: string): Map<string, string> | undefined;
  getAllStructFields(): Map<string, Map<string, IStructFieldInfo>>;
  getStructNamesByFile(file: string): string[];
  checkNeedsStructKeyword(structName: string): boolean;
  getAllNeedsStructKeyword(): string[];
  isPointerTypedef(typeName: string): boolean;
  /** #1610: whether a C typedef names a pointer type, any pointer */
  isCPointerTypedef(typeName: string): boolean;
  isOpaqueType(typeName: string): boolean;
  /** #1975: why a header struct has no length, or null when its fields sum */
  getStructLayout(structName: string): TStructLayout | null;
  getAllOpaqueTypes(): string[];
  getAllTypedefToTag(): Array<[string, string]>;
  getStructTagForTypedef(typedefName: string): string | undefined;
  getAllStructTagsWithBodies(): string[];
  getEnumBitWidth(enumName: string): number | undefined;
  getAllEnumBitWidths(): Map<string, number>;
}

export default IResolvedSymbols;
