/**
 * Issue #517 / ADR-014: a C++ class initializer with nowhere to put its
 * assignments -- E0508.
 *
 * #1322. One throw in `VariableDeclHelper.finalizeCppClassAssignments`,
 * reported as `1:0`.
 *
 * ## The throw was at the drain, not at the offender, and that is a defect
 *
 * A C++ class is not an aggregate, so `{ value: 42 }` cannot be a designated
 * initializer; codegen lowers it to `obj.value = 42;`. Until #1534 it pushed
 * those onto a queue from inside the initializer and drained it at the NEXT
 * variable declaration it finalized. Those are different nodes, and the gap
 * between them was observable:
 *
 * - a scope member's initializer pushes and is never drained, so
 *   `private CppTestClass inner <- { value: 5 }` emitted
 *   `static CppTestClass Holder__inner = {};` at exit 0 -- the value silently
 *   dropped, no diagnostic;
 * - with an unrelated global after it, the drain fires against THAT
 *   declaration and reports `C++ class 'u32' with constructor cannot use
 *   struct initializer syntax` -- naming a type with no constructor, three
 *   lines from the initializer that caused it.
 *
 * So this rule is not a transcription of codegen's guard. It is authored at
 * the STRUCT INITIALIZER, which is the node that is wrong, and it asks two
 * questions of that node: does a function body enclose it, and is the type it
 * builds a C++ class with a constructor?
 *
 * The first question also closes the scope-member hole above: a scope member
 * is emitted as a file-scope `static`, so it has no more statement position
 * than a global does.
 *
 * ## What it may read
 *
 * The run's mode is read from `Program` (#1428), which carries 1.1's answer,
 * never from `TranspileState`, whose copy is written inside
 * `CodeGenWalker.generate()` -- measured `false` for a run's first file and the
 * PREVIOUS file's value afterwards. The symbol
 * table is filled in stage 2 and is correct here; `CppConstructorHelper` was
 * moved to the shared `utils/` root because asking it is a symbol-model question, and 2.1
 * may not import `output/`.
 */

import CppConstructorHelper from "../../utils/CppConstructorHelper";
import OperandTyper from "../../utils/OperandTyper";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import FunctionReference from "./helpers/FunctionReference";
import ValuePositions from "./helpers/ValuePositions";
import type IValuePosition from "../../types/IValuePosition";
import ICppClassInitializerError from "./types/ICppClassInitializerError";
import type IAnalysisContext from "./types/IAnalysisContext";

class CppClassInitializerCheck {
  private readonly found: ICppClassInitializerError[] = [];

  public constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  public errors(): ICppClassInitializerError[] {
    return this.found;
  }

  public checkExpression(init: TExpression): void {
    if (init.kind !== "structInitializer") return;

    const typeText = ValuePositions.at(this.positions, init).typeText;
    if (typeText === null) return; // E0357's to report

    const cppClass = this.cppClassWithConstructor(
      typeText,
      OperandTyper.scopePathAt(init.span, this.context),
    );
    if (cppClass === null) return;

    const line = init.span.line;
    const column = init.span.column;
    this.found.push({
      code: "E0508",
      line,
      column,
      message: `C++ class '${cppClass}' has a constructor, so struct initializer syntax cannot be used outside a function body`,
      helpText:
        "A class with a constructor is not an aggregate, so the fields are assigned one at a time -- and a declaration outside a function body has no statement to assign them in. Initialize it inside a function, or use constructor syntax.",
    });
  }

  /**
   * The C++ name of the class this type text denotes, when it has a
   * constructor. Null for anything else, including a plain aggregate.
   *
   * The text in hand is the SOURCE spelling: `TestNS.MyClass`, which the symbol
   * table does not hold. `candidatesForTypeText` is the same ADR-057 mapping
   * every other rule here uses, and it produces `TestNS__MyClass`, which
   * `CppConstructorHelper` re-spells as `TestNS::MyClass` to look up.
   */
  private cppClassWithConstructor(
    typeText: string,
    scopePath: string,
  ): string | null {
    for (const candidate of FunctionReference.candidatesForTypeText(
      typeText,
      scopePath,
    )) {
      if (
        CppConstructorHelper.hasConstructor(candidate, this.context.symbolTable)
      ) {
        return CppConstructorHelper.toQualifiedName(candidate);
      }
    }
    return null;
  }
}

class CppClassInitializerAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax; a function body's initializers are skipped */
  public analyze(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): ICppClassInitializerError[] {
    if (!this.context.program.cppMode()) return [];
    const check = new CppClassInitializerCheck(this.context, positions);
    const visit = (declaration: TDeclarationSyntax): void => {
      if (declaration.kind === "scope") {
        for (const member of declaration.members) visit(member.declaration);
        return;
      }
      if (declaration.kind === "function") return;
      for (const expr of DeclarationParts.of(declaration).flatMap(
        ExpressionNodes.of,
      )) {
        check.checkExpression(expr);
      }
    };
    for (const member of program.declarations) visit(member.declaration);
    return check.errors();
  }
}

export default CppClassInitializerAnalyzer;
