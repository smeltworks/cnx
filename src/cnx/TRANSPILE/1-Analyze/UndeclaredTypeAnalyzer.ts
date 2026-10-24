/**
 * UndeclaredTypeAnalyzer — rejects a name in a type position that does not name
 * a type: one that denotes nothing this file can see (E0426), or one that
 * denotes a register, which is not a type (E0429, #1336).
 *
 * Issue #1312. `CodeGenerator.getTypeName` ends in `resolved ?? ctx.getText()`,
 * so a name that resolves to no type was emitted as the raw cnx source text
 * and the run exited 0. `Mode borrowedFromSibling <- Mode.MODE_A;` produced
 * `Mode borrowedFromSibling = Mode.MODE_A;`, which gcc rejects with
 * "unknown type name 'Mode'". The report framed this as a cross-file sibling
 * defect; measured on 0b0bd133 a lone file with no includes anywhere in the run
 * behaves identically, so the hole is the type position itself.
 *
 * ## Why an analyzer and not codegen
 *
 * Codegen-thrown errors report the synthetic position `1:0` -- 129 of 282
 * `.expected.error` fixtures begin that way (#1316's measurement, tracked as
 * #1184/#1318). #1312 asks for the type to be named *at its use site*, which
 * only a pass holding the parse tree can do. Analyzers already run with
 * `CodeGenState.symbols` populated (`Transpiler.ts:509`), so the position and
 * the symbol view are available in the same place.
 *
 * ## Why `enterUserType` and not a list of type positions
 *
 * A type appears in variable declarations, parameters, struct fields, return
 * types and for-init declarations. Enumerating them is the shape that leaves a
 * hole -- the project has been bitten by rules enforced in one context and
 * silently absent in another (#1219). `userType` is the single grammar rule for
 * a bare named type, so hooking it covers every position by construction, and a
 * new type position added to the grammar is covered without anyone remembering
 * to update this file.
 *
 * `this.T`, `global.T` and `Scope.T` are separate grammar branches that state
 * their scope outright. They are checked for define-before-use only (#1332:
 * the header defines types in source order, so a qualified use above its
 * definition is unknown to gcc); whether they name a type at all is #1458.
 */

import BUILTIN_TYPE_NAMES from "./BUILTIN_TYPE_NAMES";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import IUndeclaredTypeError from "./types/IUndeclaredTypeError";
import NameExistence from "../../PARSE/3-Declare/NameExistence";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import ScopeUtils from "../../utils/ScopeUtils";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionChildren from "../../utils/ExpressionChildren";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type IAnalysisContext from "./types/IAnalysisContext";
import type ISourceSpan from "../../types/ISourceSpan";

/**
 * #1991: walks 1.2's syntax, not the parse tree. Every bare type name a
 * declaration, parameter, field, register member or cast writes, in source
 * order, with the scope it is written in.
 */
class UndeclaredTypeWalk {
  public constructor(private readonly analyzer: UndeclaredTypeAnalyzer) {}

  public declaration(declaration: TDeclarationSyntax, scope: string): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration, declaration.name);
      }
      return;
    }
    for (const part of DeclarationParts.of(declaration)) {
      if (part.kind === "type") this.type(part.type, scope);
      else this.expression(part.expression, scope);
    }
  }

  private expression(expr: TExpression, scope: string): void {
    if (expr.kind === "cast") this.type(expr.type, scope);
    for (const child of ExpressionChildren.of(expr)) {
      this.expression(child, scope);
    }
  }

  private type(type: TTypeSyntax, scope: string): void {
    switch (type.kind) {
      case "user":
        this.analyzer.checkUse(
          type.name,
          scope,
          type.span.line,
          type.span.column,
        );
        return;
      case "scoped":
        this.analyzer.checkQualifiedUse(
          type.text,
          ScopeUtils.getCnxScopedName({ name: type.name, scopePath: scope }),
          type.span,
        );
        return;
      case "global":
        this.analyzer.checkQualifiedUse(type.text, type.name, type.span);
        return;
      case "qualified":
        this.analyzer.checkQualifiedUse(
          type.text,
          type.path.join("."),
          type.span,
        );
        return;
      case "array":
        this.type(type.element, scope);
        for (const dimension of type.dimensions) {
          if (dimension) this.expression(dimension, scope);
        }
        return;
      default:
        return;
    }
  }
}

class UndeclaredTypeAnalyzer {
  private readonly errors: IUndeclaredTypeError[] = [];

  /**
   * #1456: what the program declares, handed in rather than read off
   * `CodeGenState`. Constructor rather than a parameter on `analyze`, because
   * `isVisibleType` and `isRegister` are called by the walk and need it
   * too -- a parameter would have to reach them through it.
   */
  constructor(private readonly context: IAnalysisContext) {}

  /** Whether this file can see every name it may use (no foreign header) */
  knowsEveryName = false;

  private typesHere: ReadonlyMap<string, ISourceSpan> | null = null;

  analyze(program: IProgramSyntax): IUndeclaredTypeError[] {
    this.errors.length = 0;

    // Only diagnose where the transpiler actually knows the whole name
    // universe of the file. A C/C++ header is not parsed into the symbol table
    // -- `FILE` from <stdio.h> is the standing example -- so an unresolved name
    // in a file that can see one is indistinguishable from a type the compiler
    // will supply, and emitting it verbatim is the CORRECT behavior for C
    // interop (#985 external-symbol recovery).
    //
    // Rejecting valid interop code is a regression; failing to diagnose is the
    // status quo, so this declines rather than guesses.
    //
    // #1399 review: the answer is computed during discovery from the
    // resolver's own categorization and is TRANSITIVE. An earlier version
    // walked this file's own `#include` token text, which made a third
    // spelling of "is this a cnx include?" (not the resolver's) and stopped
    // at one hop -- so a macro reached through a `.cnx` include was REJECTED,
    // code that main compiles.
    this.knowsEveryName = !this.context.reachesForeignHeader;

    const walk = new UndeclaredTypeWalk(this);
    for (const member of program.declarations) {
      walk.declaration(member.declaration, "");
    }
    return this.errors;
  }

  /** One written type name: before its definition, unknown, or a register */
  checkUse(
    typeName: string,
    scope: string,
    line: number,
    column: number,
  ): void {
    if (BUILTIN_TYPE_NAMES.has(typeName)) {
      return;
    }
    const spellings = scope
      ? [
          ScopeUtils.getCnxScopedName({ name: typeName, scopePath: scope }),
          typeName,
        ]
      : [typeName];
    const definition = this.definitionAfter(spellings, line, column);
    if (definition !== null) {
      this.addUsedBeforeDefinitionError(typeName, line, column, definition);
      return;
    }
    if (!this.knowsEveryName || this.isVisibleType(typeName, scope)) {
      return;
    }
    if (this.isRegister(typeName, scope)) {
      this.addRegisterInTypePositionError(typeName, line, column);
      return;
    }
    this.addError(typeName, line, column);
  }

  /**
   * A `this.T`, `global.T` or `Scope.T` use: `scopedName` is the type's
   * `cnxScopedName` as the qualifier states it, so there is one spelling to try.
   */
  checkQualifiedUse(
    written: string,
    scopedName: string,
    span: ISourceSpan,
  ): void {
    const definition = this.definitionAfter(
      [scopedName],
      span.line,
      span.column,
    );
    if (definition !== null) {
      this.addUsedBeforeDefinitionError(
        written,
        span.line,
        span.column,
        definition,
      );
    }
  }

  /**
   * The definition of the type this file declares under the first of
   * `spellings` it declares, when that definition has not closed by
   * `line:column` -- it comes later in the file, or the use sits inside it (a
   * struct holding itself). Null when no spelling is this file's type, or it is
   * defined above. A bare use passes its scope-qualified spelling first, as
   * `isVisibleType` tries it.
   */
  definitionAfter(
    spellings: readonly string[],
    line: number,
    column: number,
  ): ISourceSpan | null {
    this.typesHere ??= new Map(
      this.context.program
        .symbolsInFile(this.context.sourceFile)
        .flatMap((symbol) =>
          symbol.kind === "struct" ||
          symbol.kind === "enum" ||
          symbol.kind === "bitmap"
            ? [[symbol.cnxScopedName, symbol.span] as const]
            : [],
        ),
    );
    const name = spellings.find((spelling) => this.typesHere!.has(spelling));
    const span = name === undefined ? undefined : this.typesHere.get(name);
    if (span === undefined) {
      return null;
    }
    const closesAfter =
      line < span.endLine || (line === span.endLine && column < span.endColumn);
    return closesAfter ? span : null;
  }

  /**
   * ADR-057: inside a scope a bare `T` may name a scope-declared type, which is
   * recorded under its qualified name. The bare spelling is still accepted,
   * because a scope may also reference a global type.
   */
  isVisibleType(typeName: string, scope: string): boolean {
    return UndeclaredTypeAnalyzer._eitherSpelling(
      typeName,
      scope,
      this.context.symbols,
      this.context.symbolTable,
      (name, fileSymbols, table) =>
        NameExistence.isTypeName(name, fileSymbols, table),
    );
  }

  /**
   * Whether the name denotes a register (ADR-004). Asked only after
   * `isVisibleType` has already answered no, to tell E0429 from E0426.
   *
   * Cross-file this answers no, and the name falls through to E0426. That is
   * currently TRUE rather than a gap: a register declared in an included file is
   * not visible in the consumer at all (#1453 -- its `#define` is written to the
   * implementation file and the header exports nothing), so "not defined" is the
   * accurate report. When #1453 makes such a register visible it lands in the
   * same `knownRegisters` set this reads, and E0429 begins firing there with no
   * change here.
   *
   * ADR-111: retire this with E0429 when a register becomes a type -- at which
   * point `isVisibleType` answers yes and this is never reached.
   */
  isRegister(typeName: string, scope: string): boolean {
    return UndeclaredTypeAnalyzer._eitherSpelling(
      typeName,
      scope,
      // Reached only after `isVisibleType` returned false, which requires a
      // symbol view -- see its guard.
      this.context.symbols,
      this.context.symbolTable,
      (name, fileSymbols) => NameExistence.isRegisterName(name, fileSymbols),
    );
  }

  /**
   * ADR-057: inside a scope a bare `T` may name a scope-declared type, recorded
   * under its qualified name. The bare spelling stays acceptable because a
   * scope may also reference a global type.
   *
   * Both questions must accept the SAME pair of spellings. A scoped register
   * that only the qualified spelling finds would otherwise fail the type test
   * and then fail the register test too, and be reported as undefined rather
   * than as a register -- so the walk lives here once and is asked twice.
   */
  private static _eitherSpelling(
    typeName: string,
    scope: string,
    symbols: ICodeGenSymbols,
    symbolTable: IResolvedSymbols,
    test: (
      name: string,
      symbols: ICodeGenSymbols,
      symbolTable: IResolvedSymbols,
    ) => boolean,
  ): boolean {
    if (scope) {
      const qualified = ScopeUtils.qualifyInScope(typeName, scope);
      if (test(qualified, symbols, symbolTable)) {
        return true;
      }
    }

    return test(typeName, symbols, symbolTable);
  }

  addError(typeName: string, line: number, column: number): void {
    this._push(
      "E0426",
      typeName,
      line,
      column,
      `type '${typeName}' is not defined`,
    );
  }

  /** E0426 for a use of this file's type before its definition closes */
  addUsedBeforeDefinitionError(
    typeName: string,
    line: number,
    column: number,
    definition: ISourceSpan,
  ): void {
    const where =
      line >= definition.line
        ? `inside its own definition (line ${definition.line}): a type cannot hold itself`
        : `before its definition at line ${definition.line}`;
    this._push(
      "E0426",
      typeName,
      line,
      column,
      `type '${typeName}' is not defined here: it is used ${where} (ADR-030: define before use)`,
    );
  }

  /**
   * E0429: the name is declared, but as a register, and a register is not a
   * type (ADR-004).
   *
   * ADR-111: this code exists only for as long as that is true. When ADR-111 is
   * IMPLEMENTED, `Control c;` becomes the instantiation form it designs and
   * this diagnostic is retired outright -- delete the method, its call site,
   * `NameExistence.isRegisterName`, the fixture, and the E0429 registry row.
   */
  addRegisterInTypePositionError(
    typeName: string,
    line: number,
    column: number,
  ): void {
    this._push(
      "E0429",
      typeName,
      line,
      column,
      `'${typeName}' is a register, not a type`,
    );
  }

  private _push(
    code: string,
    typeName: string,
    line: number,
    column: number,
    message: string,
  ): void {
    this.errors.push({ code, typeName, line, column, message });
  }
}

export default UndeclaredTypeAnalyzer;
