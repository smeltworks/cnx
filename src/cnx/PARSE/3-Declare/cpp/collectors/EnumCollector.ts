/**
 * EnumCollector - C++ enum symbols from 1.2's lowered header (#1991).
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import ICppEnumSymbol from "../../../../types/symbols/cpp/ICppEnumSymbol";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import type ICppEnumSyntax from "../../../2-Parse/types/ICppEnumSyntax";
import type ISourceSpan from "../../../../types/ISourceSpan";

class EnumCollector {
  /**
   * An enum; null when it has no name. A typed enum's width
   * (`enum EPressureType : uint8_t`) is recorded when a symbol table is given.
   */
  static collect(
    enumSyntax: ICppEnumSyntax,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
    symbolTable?: SymbolTable | null,
  ): ICppEnumSymbol | null {
    const name = enumSyntax.name;
    if (!name) return null;
    const fullName = CppNamespaceUtils.qualify(currentNamespace, name);

    let bitWidth: number | undefined;
    if (symbolTable && enumSyntax.baseType) {
      const width = SymbolUtils.getTypeWidth(enumSyntax.baseType);
      if (width > 0) {
        symbolTable.addEnumBitWidth(fullName, width);
        bitWidth = width;
      }
    }

    return {
      kind: "enum",
      name: fullName,
      unqualifiedName: name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      bitWidth,
    };
  }
}

export default EnumCollector;
