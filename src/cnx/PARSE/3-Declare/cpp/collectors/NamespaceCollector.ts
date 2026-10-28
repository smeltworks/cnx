/**
 * NamespaceCollector - C++ namespace symbols from 1.2's lowered header (#1991).
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import ICppNamespaceSymbol from "../../../../types/symbols/cpp/ICppNamespaceSymbol";
import type ISourceSpan from "../../../../types/ISourceSpan";

class NamespaceCollector {
  /** A namespace; null for an anonymous one */
  static collect(
    name: string | null,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
  ): ICppNamespaceSymbol | null {
    if (!name) return null;
    return {
      kind: "namespace",
      name: CppNamespaceUtils.qualify(currentNamespace, name),
      unqualifiedName: name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
    };
  }

  /** The namespace a body declares into: an anonymous one keeps its parent's */
  static getFullNamespaceName(
    name: string | null,
    currentNamespace?: string,
  ): string | undefined {
    if (!name) return currentNamespace;
    return CppNamespaceUtils.qualify(currentNamespace, name);
  }
}

export default NamespaceCollector;
