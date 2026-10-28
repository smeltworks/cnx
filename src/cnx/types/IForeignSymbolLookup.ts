import type TStructLayout from "./TStructLayout";
import type IStructFieldInfo from "./symbols/IStructFieldInfo";
import type TCSymbol from "./symbols/c/TCSymbol";
import type TCppSymbol from "./symbols/cpp/TCppSymbol";

/**
 * What the operand typer reads about C and C++ headers (#1668). Structural,
 * so no shared contract names `SymbolTable`, which satisfies it.
 */
interface IForeignSymbolLookup {
  getCSymbol(name: string): TCSymbol | undefined;
  getCppSymbol(name: string): TCppSymbol | undefined;
  getCOverloads(name: string): TCSymbol[];
  getCppOverloads(name: string): TCppSymbol[];
  /** #2116: `SymbolTable.getCppMembers` */
  getCppMembers(owner: string | undefined, member: string): TCppSymbol[];
  getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): IStructFieldInfo | undefined;
  getStructFields(
    structName: string,
  ): Map<string, IStructFieldInfo> | undefined;
  isOpaqueType(typeName: string): boolean;
  /** #1975: why a header struct has no length, or null when its fields sum */
  getStructLayout(structName: string): TStructLayout | null;
}

export default IForeignSymbolLookup;
