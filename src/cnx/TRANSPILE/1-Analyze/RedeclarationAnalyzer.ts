/**
 * E0425: a name declared twice in one C scope (#2011).
 *
 * C forbids a second declaration of a name in the same scope, and gives a
 * function's parameters and its outermost block one scope. ADR-057 allows
 * shadowing "matching C behavior", so a declaration in a NESTED block is
 * shadowing and stays legal; these two are not:
 *
 * - two declarations of one name in the same block;
 * - a local in a function's outermost block named like one of its parameters.
 *
 * Unchecked, both reached the C, which gcc rejects. Reads 1.4's lexical
 * frames, where the parameters sit in the function frame and the outermost
 * block's declarations in its body frame.
 */
import type ILexicalFrame from "../../types/ILexicalFrame";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type IAnalysisContext from "./types/IAnalysisContext";
import IRedeclarationError from "./types/IRedeclarationError";

class RedeclarationAnalyzer {
  private readonly found: IRedeclarationError[] = [];

  constructor(private readonly context: IAnalysisContext) {}

  public analyze(): IRedeclarationError[] {
    const { program, sourceFile } = this.context;
    this.frame(program.lexicalFrameAt(sourceFile, { line: 0, column: 0 }));
    return this.found;
  }

  private frame(frame: ILexicalFrame): void {
    if (frame.kind === "function") {
      const [body, ...rest] = frame.children;
      this.oneScope([...frame.declarations, ...(body?.declarations ?? [])]);
      body?.children.forEach((child) => this.frame(child));
      rest.forEach((child) => this.frame(child));
      return;
    }
    this.oneScope(frame.declarations);
    frame.children.forEach((child) => this.frame(child));
  }

  /** Every declaration after the first of its name, in source order */
  private oneScope(declarations: readonly ILocalDeclaration[]): void {
    const seen = new Set<string>();
    const inOrder = [...declarations].sort(
      (a, b) => a.span.line - b.span.line || a.span.column - b.span.column,
    );
    for (const declaration of inOrder) {
      if (seen.has(declaration.name)) {
        this.found.push({
          code: "E0425",
          span: declaration.span,
          message: `'${declaration.name}' is already declared in this scope`,
          helpText:
            "Rename one declaration; a function's parameters and its outermost block share one scope, as in C",
        });
      }
      seen.add(declaration.name);
    }
  }
}

export default RedeclarationAnalyzer;
