/**
 * One header's declarations as a record (#590, #1225, #1991): what 1.3 hands
 * the symbol cache once it has declared a header, and what it restores from a
 * record 1.1 read back.
 */
import type IHeaderDeclarationRecord from "../1-Discover/types/IHeaderDeclarationRecord";
import type TAnySymbol from "../../types/symbols/TAnySymbol";
import type TCSymbol from "../../types/symbols/c/TCSymbol";
import type TCppSymbol from "../../types/symbols/cpp/TCppSymbol";
import type IStructFieldInfo from "../../types/symbols/IStructFieldInfo";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import type SymbolTable from "./SymbolTable";

class HeaderDeclarationRecord {
  /** What the header at `path` declared into `table`, as it stands now */
  static of(path: string, table: SymbolTable): IHeaderDeclarationRecord {
    const fileSymbols = table.getSymbolsByFile(path);
    const structNames = table.getStructNamesByFile(path);
    const allFields = table.getAllStructFields();
    const structFields = new Map<string, Map<string, IStructFieldInfo>>();
    for (const name of structNames) {
      const fields = allFields.get(name);
      if (fields) structFields.set(name, fields);
    }
    const needsKeyword = table.getAllNeedsStructKeyword();
    const allWidths = table.getAllEnumBitWidths();
    const enumBitWidth = new Map<string, number>();
    for (const symbol of fileSymbols) {
      if (symbol.kind !== "enum") continue;
      const width = allWidths.get(symbol.name);
      if (width !== undefined) enumBitWidth.set(symbol.name, width);
    }
    return {
      symbols: fileSymbols.filter(HeaderDeclarationRecord._isForeign),
      structFields,
      needsStructKeyword: structNames.filter((name) =>
        needsKeyword.includes(name),
      ),
      enumBitWidth,
      undefinedMacros: table.undefinedMacrosOf(path),
      structState: table.serializeStructState(),
    };
  }

  /**
   * Issue #1225: put a record back into `table`. The symbols come back as
   * themselves, so there is nothing to convert and nothing to forget.
   */
  static restore(
    record: IHeaderDeclarationRecord,
    path: string,
    table: SymbolTable,
  ): void {
    for (const symbol of record.symbols) {
      if (symbol.sourceLanguage === ESourceLanguage.C) {
        table.addCSymbol(symbol);
      } else {
        table.addCppSymbol(symbol);
      }
    }
    table.restoreStructFields(record.structFields);
    table.restoreNeedsStructKeyword(record.needsStructKeyword);
    table.restoreEnumBitWidths(record.enumBitWidth);
    table.markUndefinedMacros(path, record.undefinedMacros);
    // Issue #1225: the whole struct state at once. It used to be four separate
    // restore calls, which is how #1164's pointerTypedefs was missed.
    table.restoreStructState(record.structState);
  }

  private static _isForeign(
    symbol: TAnySymbol,
  ): symbol is TCSymbol | TCppSymbol {
    return symbol.sourceLanguage !== ESourceLanguage.Cnx;
  }
}

export default HeaderDeclarationRecord;
