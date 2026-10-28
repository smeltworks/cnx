/**
 * #1668 / #1664: a file's lexical frames -- every scope, function, braced
 * block and `for` header, what each declares, and how they nest.
 *
 * 2.1 and 2.2 each answered "what does this name mean HERE" from their own
 * walk: 2.1 from per-analyzer frame maps keyed on parse nodes, 2.2 from one
 * flat registry keyed by name, which a shadowing local overwrote. This is the
 * one answer, built once by 1.3 from 1.2's syntax of one file, so it rides
 * on `IFileSymbols` and 1.4 settles it with the rest.
 *
 * Globals and scope members are not recorded: they are `IVariableSymbol`s.
 * A local's facts come from `VariableCollector.declaredFacts` and a
 * parameter's from `FunctionCollector.collectParameters`, the functions that
 * already derive them for symbols, so a declaration means the same thing
 * wherever it is written.
 */
import FunctionCollector from "./FunctionCollector";
import VariableCollector from "./VariableCollector";
import type SymbolRegistry from "../../SymbolRegistry";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";
import ScopeUtils from "../../../../utils/ScopeUtils";
import type ILexicalFrame from "../../../../types/ILexicalFrame";
import type ILocalDeclaration from "../../../../types/ILocalDeclaration";
import type ISourceSpan from "../../../../types/ISourceSpan";
import type IFunctionDeclarationSyntax from "../../../../types/syntax/IFunctionDeclarationSyntax";
import type IProgramSyntax from "../../../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../../../types/syntax/IVariableDeclarationSyntax";
import type TBlockSyntax from "../../../../types/syntax/TBlockSyntax";
import type TStatement from "../../../../types/syntax/TStatement";
import type IDeclareTypeFacts from "../../types/IDeclareTypeFacts";

/** A frame while it is being filled */
interface IFrameBuilder {
  readonly kind: ILexicalFrame["kind"];
  readonly span: ISourceSpan;
  readonly scopePath: string;
  readonly functionCName: string | null;
  readonly declarations: ILocalDeclaration[];
  readonly children: IFrameBuilder[];
}

/** Walks 1.2's syntax in source order, opening a frame where the code does */
class FrameWalker {
  constructor(
    private readonly registry: SymbolRegistry,
    private readonly typeFacts: IDeclareTypeFacts,
  ) {}

  private static open(
    parent: IFrameBuilder,
    kind: ILexicalFrame["kind"],
    span: ISourceSpan,
    scopePath: string,
    functionCName: string | null = null,
  ): IFrameBuilder {
    const frame: IFrameBuilder = {
      kind,
      span,
      scopePath,
      functionCName,
      declarations: [],
      children: [],
    };
    parent.children.push(frame);
    return frame;
  }

  /** Globals and scope members are symbols, so only functions hold locals */
  program(root: IFrameBuilder, program: IProgramSyntax): void {
    for (const { declaration } of program.declarations) {
      if (declaration.kind === "function") {
        this.function(root, declaration);
      } else if (declaration.kind === "scope") {
        const scope = FrameWalker.open(
          root,
          "scope",
          declaration.span,
          ScopeUtils.pathOf(this.registry.getOrCreateScope(declaration.name)),
        );
        for (const member of declaration.members) {
          if (member.declaration.kind === "function") {
            this.function(scope, member.declaration);
          }
        }
      }
    }
  }

  private function(
    parent: IFrameBuilder,
    fn: IFunctionDeclarationSyntax,
  ): void {
    const scopePath = parent.scopePath;
    const frame = FrameWalker.open(
      parent,
      "function",
      fn.span,
      scopePath,
      ScopeUtils.getTranspiledCName({ name: fn.name, scopePath }),
    );
    const parameters = fn.parameters ?? [];
    const infos = FunctionCollector.collectParameters(
      parameters,
      scopePath,
      this.typeFacts,
    );
    infos.forEach((info, index) => {
      frame.declarations.push({
        name: info.name,
        kind: "parameter",
        span: parameters[index].nameSpan,
        extent: parameters[index].span,
        type: info.type,
        arrayDimensions: info.arrayDimensions ?? [],
        arrayDimensionExprs: info.arrayDimensionExprs ?? [],
        isConst: info.isConst,
        isAtomic: false,
        isVolatile: false,
        // A parameter has no overflow modifier in the grammar
        overflowBehavior: OverflowBehaviorUtils.fromModifier(null),
        initialValue: null,
        initialValueExpr: null,
        spellsOwnName: false,
        initializerCallee: null,
        constValue: null,
        emittedName: null,
        nameMoves: [],
      });
    });
    this.block(frame, fn.body);
  }

  private block(parent: IFrameBuilder, body: TBlockSyntax): void {
    const frame = FrameWalker.open(
      parent,
      "block",
      body.span,
      parent.scopePath,
    );
    for (const statement of body.statements) {
      this.statement(frame, statement);
    }
  }

  private statement(frame: IFrameBuilder, statement: TStatement): void {
    switch (statement.kind) {
      case "variableDeclaration":
        this.record(frame, VariableCollector.asVariable(statement), "local");
        return;
      case "constructorDeclaration":
        this.record(
          frame,
          VariableCollector.asVariable(statement),
          "constructor",
        );
        return;
      case "block":
        this.block(frame, statement);
        return;
      case "if":
        this.statement(frame, statement.whenTrue);
        if (statement.whenFalse) {
          this.statement(frame, statement.whenFalse);
        }
        return;
      case "while":
        this.statement(frame, statement.body);
        return;
      case "doWhile":
      case "forever":
      case "critical":
        this.block(frame, statement.body);
        return;
      case "for":
        this.forStatement(frame, statement);
        return;
      case "switch":
        for (const switchCase of statement.cases) {
          this.block(frame, switchCase.body);
        }
        if (statement.defaultCase) {
          this.block(frame, statement.defaultCase.body);
        }
        return;
      case "assignment":
      case "expression":
      case "return":
      case "missing":
        return;
    }
  }

  private forStatement(
    parent: IFrameBuilder,
    statement: Extract<TStatement, { kind: "for" }>,
  ): void {
    const frame = FrameWalker.open(
      parent,
      "for",
      statement.span,
      parent.scopePath,
    );
    if (statement.init?.kind === "variableDeclaration") {
      this.record(frame, statement.init, "for");
    }
    this.statement(frame, statement.body);
  }

  private record(
    frame: IFrameBuilder,
    declaration: IVariableDeclarationSyntax,
    kind: ILocalDeclaration["kind"],
  ): void {
    // #1664 box 7: a local's `u8[N]` keeps `N` as written, so 1.4 folds it
    // where it is declared -- after a local `const N` that shadows a global one.
    const facts = VariableCollector.declaredFacts(
      declaration,
      frame.scopePath,
      this.typeFacts,
    );
    frame.declarations.push({
      name: declaration.name,
      kind,
      span: declaration.nameSpan,
      extent: declaration.span,
      type: facts.type,
      arrayDimensions: facts.arrayDimensions,
      arrayDimensionExprs: facts.arrayDimensionExprs,
      isConst: facts.isConst,
      isAtomic: facts.isAtomic,
      isVolatile: facts.isVolatile,
      overflowBehavior: facts.overflowBehavior,
      initialValue: facts.initialValue ?? null,
      initialValueExpr: facts.initialValueExpr,
      spellsOwnName: declaration.spellsOwnName,
      initializerCallee: facts.initializerCallee,
      constValue: null,
      emittedName: null,
      nameMoves: [],
    });
  }
}

class LexicalScopeCollector {
  /**
   * The file frame of `program`, with every frame nested in it.
   *
   * Array dimensions are left for 1.4 to fold in each declaration's lexical
   * environment, except a literal, which needs no const.
   *
   * @param typeFacts ADR-057: is this QUALIFIED name a scope type this file
   *   declares? A bare type it cannot settle is deferred, as for symbols
   */
  static collect(
    program: IProgramSyntax,
    registry: SymbolRegistry,
    typeFacts: IDeclareTypeFacts,
  ): ILexicalFrame {
    const root: IFrameBuilder = {
      kind: "file",
      span: program.span,
      scopePath: "",
      functionCName: null,
      declarations: [],
      children: [],
    };
    new FrameWalker(registry, typeFacts).program(root, program);
    return root;
  }
}

export default LexicalScopeCollector;
