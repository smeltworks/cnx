/**
 * TypeAliasCollector - `using X = Y;` symbols from 1.2's lowered header (#1991).
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ICppTypeAliasSymbol from "../../../../types/symbols/cpp/ICppTypeAliasSymbol";
import type ISourceSpan from "../../../../types/ISourceSpan";

class TypeAliasCollector {
  static collect(
    name: string,
    sourceFile: string,
    span: ISourceSpan,
    type: string | null,
    currentNamespace?: string,
  ): ICppTypeAliasSymbol {
    return {
      kind: "type",
      name,
      unqualifiedName: name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      ...(type !== null && { type }),
    };
  }
}

export default TypeAliasCollector;
