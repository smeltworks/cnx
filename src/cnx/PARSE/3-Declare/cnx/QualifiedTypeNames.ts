import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";
import CppNamespaceUtils from "../../../utils/CppNamespaceUtils";
import DeclarationParts from "../../../utils/DeclarationParts";
import ExpressionNodes from "../../../utils/ExpressionNodes";
import QualifiedCName from "../../../utils/QualifiedCName";

/**
 * Every `Scope.T` / `Ns.T` a file writes at a type position -- a declaration's
 * type or a cast's -- spelled once, by the first layer that can (#2116). 1.3
 * holds the C/C++ headers' symbols by now, so a path whose head is a C++
 * namespace, class or enum is `Ns::T`; any other is the written path as C
 * spells it, which is the name a cnx scope member is declared under. Later
 * layers read the spelling and never re-derive it from the text.
 */
class QualifiedTypeNames {
  static collect(
    program: IProgramSyntax,
    isCppScopeHead: (name: string) => boolean,
  ): ReadonlyMap<string, string> {
    const names = new Map<string, string>();
    const visit = (type: TTypeSyntax): void => {
      if (type.kind === "array") {
        visit(type.element);
      } else if (type.kind === "qualified") {
        names.set(
          type.path.join("."),
          isCppScopeHead(type.path[0])
            ? CppNamespaceUtils.fromParts(type.path)
            : QualifiedCName.fromSourceName(type.path.join(".")),
        );
      }
    };
    for (const { declaration } of program.members) {
      for (const part of DeclarationParts.of(declaration)) {
        if (part.kind === "type") visit(part.type);
        for (const node of ExpressionNodes.of(part)) {
          if (node.kind === "cast") visit(node.type);
        }
      }
    }
    return names;
  }
}

export default QualifiedTypeNames;
