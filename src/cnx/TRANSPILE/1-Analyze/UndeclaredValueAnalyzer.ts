/**
 * UndeclaredValueAnalyzer — rejects a bare identifier in a value position that
 * denotes nothing this file can see (E0427).
 *
 * Issue #1353. `#985` closed this hole for a CALL (`E0422`); the value
 * reference was never covered, so `u32 v <- notDeclaredAnywhere;` exited 0 and
 * emitted `uint32_t v = notDeclaredAnywhere;`. The cause is the same shape as
 * #1312's: `TypeValidator.resolveBareIdentifier` returns `string | null` where
 * `null` means BOTH "emit it unchanged, it is fine" (a local needing no rename,
 * or a known global at file scope) and "no idea what this is", so no caller can
 * tell a resolved name from an unresolved one.
 *
 * Three positions can hold an undeclared name and they are one question asked
 * three ways -- "is this name visible here, as kind K?":
 *
 *   | position | owner                              |
 *   | -------- | ---------------------------------- |
 *   | call     | `FunctionCallAnalyzer` (E0422)     |
 *   | type     | `UndeclaredTypeAnalyzer` (E0426)   |
 *   | value    | this analyzer (E0427)              |
 *
 * The shared half is the lookup, not the policy: existence goes through
 * `NameExistence` and `ScopeFrameResolver`, while each position keeps its own
 * rules. E0422's are substantial and specific to calls -- ADR-030 ordering,
 * ADR-040 callable variables, ADR-057 implicit scope calls, stdlib header
 * hints -- and folding them in here would delete working behavior across ten
 * fixtures rather than remove a duplicate decision.
 *
 * A call target is therefore skipped outright: E0422 already owns it, and two
 * diagnostics for one name is worse than one.
 */

import type ISourcePosition from "../../utils/types/ISourcePosition";
import BUILTIN_TYPE_NAMES from "./BUILTIN_TYPE_NAMES";
import PrimitiveKindUtils from "../../utils/PrimitiveKindUtils";
import DeclarationParts from "../../utils/DeclarationParts";
import StatementNodes from "../../utils/StatementNodes";
import type TCaseLabelSyntax from "../../types/syntax/TCaseLabelSyntax";
import ExpressionChildren from "../../utils/ExpressionChildren";
import TypeParts from "../../utils/TypeParts";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type ISourceSpan from "../../types/ISourceSpan";
import type TExpression from "../../types/syntax/TExpression";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import ExpressionShape from "../../utils/ExpressionShape";
import type IChainHead from "../../types/IChainHead";
import IUndeclaredValueError from "./types/IUndeclaredValueError";
import NameExistence from "../../PARSE/3-Declare/NameExistence";
import REJECTED_KEYWORDS from "./REJECTED_KEYWORDS";
import ScopeUtils from "../../utils/ScopeUtils";
import PositionFreeScopeMember from "../../utils/PositionFreeScopeMember";
import OperandTyper from "../../utils/OperandTyper";
import TChainRoot from "../../types/TChainRoot";
import type IAnalysisContext from "./types/IAnalysisContext";

/**
 * #1991: walks 1.2's syntax, not the parse tree. A name is read at the head of
 * every chain -- a bare `x`, `x.y[i]`, `this.x`, `global.x` -- and written at
 * the head of every assignment target. 1.2 lists each target among its
 * statement's expressions, so one walk reaches both positions (#1582: the
 * target is its own grammar rule, and a tree walk over reads alone missed it).
 */
class UndeclaredValueWalk {
  constructor(private readonly analyzer: UndeclaredValueAnalyzer) {}

  part(part: TSyntaxPart): void {
    if (part.kind === "type") {
      for (const inner of TypeParts.of(part.type)) this.part(inner);
      return;
    }
    this.expression(part.expression);
  }

  private expression(expr: TExpression): void {
    if (expr.kind === "postfix" || expr.kind === "identifier") {
      this.chain(expr);
    }
    for (const child of ExpressionChildren.of(expr)) {
      // A chain's head name was asked above, as the chain's
      if (
        expr.kind === "postfix" &&
        child === expr.primary &&
        ExpressionShape.headOf(expr).identifier !== null
      ) {
        continue;
      }
      this.expression(child);
    }
  }

  /**
   * The READ position.
   *
   * ADR-016's three spellings read the chain from DIFFERENT offsets, which is
   * the whole of `ChainRoot`'s docstring: a bare name IS the primary, while
   * `this.x` and `global.x` put the keyword on the primary and the name in the
   * first op. Taking the name from the primary alone is why every rooted read
   * went unchecked -- `u32 v <- this.gx`, where `gx` is a file-scope global and
   * not a member of the enclosing scope, emitted `Scope__gx` at exit 0. That is
   * #1582's own defect one grammar rule over, and it is the case the write
   * position's fixture calls "the only witness to the split".
   */
  private chain(expr: TExpression): void {
    const head = ExpressionShape.headOf(expr);

    // `name(...)` is a call. E0422 owns undefined calls, with ADR-030/040/057
    // rules this analyzer deliberately does not reimplement. The root keyword
    // consumes the primary, so the parentheses sit `opsConsumed` further along
    // -- the offset travels with the root instead of being re-derived here.
    // An assignment target is never a call, so this skips no write.
    if (head.ops[head.opsConsumed]?.kind === "call") {
      return;
    }

    this.check(head.identifier, head.root, expr.span);
  }

  /**
   * The CASE LABEL position (#1629). `caseLabel` is its own grammar rule too,
   * reachable from neither hook above, so `case NOPE { }` reached the C as a
   * name nothing declares, at exit 0.
   *
   * A qualified label is asked about the name it starts from, as a qualified
   * read is: `NOPE.RUN` names nothing, while whether `EMode.NOPE` is a member
   * of `EMode` is the chain's question, not this one's. A bare enum member
   * (`case IDLE`) is visible, and whether it may stand bare is E0424's.
   */
  caseLabel(label: TCaseLabelSyntax): void {
    if (label.kind === "identifier") {
      this.check(
        { name: label.name, span: label.nameSpan },
        label.root,
        label.span,
      );
    } else if (label.kind === "qualified") {
      this.check(
        { name: label.path[0], span: label.headSpan },
        label.root,
        label.span,
      );
    }
  }

  /**
   * One name, one question, for every position.
   *
   * A read and a write differ only in where their chain sits -- the
   * `(root, identifier)` pair `ChainRoot` separates is read off both alike. Everything after that is
   * the same policy, so it is written once: a second copy would be free to
   * gain an exempt spelling the other did not, which is the read/write
   * divergence #1582 is about.
   *
   * `identifier` is nullable because a chain's primary may be a literal or a
   * parenthesised expression.
   */
  private check(
    identifier: IChainHead["identifier"],
    root: TChainRoot,
    at: ISourceSpan,
  ): void {
    if (!identifier) {
      return;
    }

    const name = identifier.name;

    // ADR-026: `break`/`continue` parse as identifiers and are rejected by
    // E0703, which names the structured alternative. Reporting them as
    // undefined would be true and useless.
    // The write position is E0703's too: `LoopAnalyzer` walks assignment
    // targets, so `break <- 5` is E0703 rather than `break = 5;` in the C
    // (#1632, fixture `tests/bugs/issue-1632-break-assignment`).
    if (REJECTED_KEYWORDS.has(name) || BUILTIN_TYPE_NAMES.has(name)) {
      return;
    }
    // `u32.type_byte_length` (#1975): the type keyword names a type, not a value
    if (PrimitiveKindUtils.isPrimitive(name)) return;

    if (
      this.analyzer.isVisible(name, root, { line: at.line, column: at.column })
    ) {
      return;
    }

    // The caret names the identifier, not the `this`/`global` keyword the
    // spelling may start with: the head's span is the name's own token.
    const { line, column } = identifier.span;
    this.analyzer.addError(name, line, column);
  }
}

class UndeclaredValueAnalyzer {
  private readonly errors: IUndeclaredValueError[] = [];

  /**
   * #1456: what the program declares, handed in rather than read off
   * `CodeGenState`. Constructor rather than a parameter on `analyze`, because
   * the predicates below are reached from the walk.
   */
  constructor(private readonly context: IAnalysisContext) {}

  analyze(program: IProgramSyntax): IUndeclaredValueError[] {
    this.errors.length = 0;

    const walk = new UndeclaredValueWalk(this);
    for (const member of program.members) {
      for (const part of DeclarationParts.of(member.declaration))
        walk.part(part);
      for (const label of StatementNodes.caseLabels(member.declaration)) {
        walk.caseLabel(label);
      }
    }
    return this.errors;
  }

  /**
   * Whether a name in a VALUE position denotes something this file can see.
   *
   * ADR-016's root is PART of the question, not a decoration on it: `this.x`
   * asks the enclosing scope, `global.x` asks file scope, and only a bare name
   * searches outward (#1322 found four copies of that distinction disagreeing,
   * three of which emitted broken C at exit 0). A local is Program's lexical
   * frames' answer (#1668). A variable -- local, file-scope or member -- is
   * `binds`', once its declaration closes (#1643, ADR-030); any other value
   * is `NameExistence.isValueName`'s or `isScopeMemberValue`'s.
   *
   * Without the split, `this.gx` where `gx` is a file-scope global -- not a
   * member of the enclosing scope -- passes on the bare lookup and emits
   * `Scope__gx`, a name nothing declares.
   *
   * Both POSITIONS ask this identically, which is why there is one predicate
   * and not two. #1582 first gave the split to the write position alone, and
   * the read position beside it could not see a rooted name at all: `this.gx
   * <- 5` was rejected while `u32 v <- this.gx` on the next line emitted
   * `Scope__gx` at exit 0. Two predicates that agree by inspection are the
   * divergence this analyzer exists to prevent.
   */
  isVisible(name: string, root: TChainRoot, at: ISourcePosition): boolean {
    if (this.isNamed(name, root, at)) {
      return true;
    }
    // ADR-030 / #2019: a name no declaration of this file would bind here may
    // be a header's `#define`, which reaches no symbol table
    return this.context.program.mayBeHeaderName(
      this.context.sourceFile,
      root,
      name,
      at,
    );
  }

  /** Whether the spelling denotes something cnx sees declared at `at` */
  private isNamed(
    name: string,
    root: TChainRoot,
    at: ISourcePosition,
  ): boolean {
    const symbols = this.context.symbols;
    const scopePath = OperandTyper.scopePathAt(at, this.context);

    if (root === null) {
      return (
        UndeclaredValueAnalyzer.isDeclaredValue(
          name,
          at,
          scopePath,
          this.context,
        ) || NameExistence.isKnownEnumMember(name, symbols)
      );
    }

    // `global.x` is a file-scope value, this file's or one an `#include`
    // brought: the include-filtered predicate answers both.
    if (root === "global") {
      return (
        UndeclaredValueAnalyzer.binds(root, name, at, this.context) ||
        NameExistence.isValueName(name, symbols, this.context.symbolTable)
      );
    }

    // `this.` outside any scope is E0431's to reject, and two diagnostics for
    // one name is worse than one.
    if (scopePath === "") {
      return true;
    }

    return (
      UndeclaredValueAnalyzer.binds(root, name, at, this.context) ||
      UndeclaredValueAnalyzer.isScopeMemberValue(name, scopePath, this.context)
    );
  }

  /**
   * #1643: whether the spelling binds a declaration at `at`. Every variable's
   * answer -- local, file-scope or member -- since `Program.bindValue` is the
   * one place a spelling becomes a declaration (#1668), and it binds one only
   * from a file this one sees (#1398) and once its declaration closes
   * (ADR-030).
   */
  private static binds(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
    context: IAnalysisContext,
  ): boolean {
    return (
      context.program.bindValue(context.sourceFile, root, name, at) !== null
    );
  }

  /**
   * Whether a name is a value declared by the scope at `scopePath`.
   *
   * Written once because the bare spelling and the `this.` spelling ask it
   * identically -- the bare outward walk reaches the enclosing scope, and
   * `this.` names it directly. #1582 briefly carried two copies eighty lines
   * apart, which is the shape CLAUDE.md forbids: the single source of truth is
   * the DECISION, and the term `scopeMembers` is missing (it spans the run
   * rather than the include graph, #1494) has to be added in one place.
   */
  private static isScopeMemberValue(
    name: string,
    scopePath: string,
    context: IAnalysisContext,
  ): boolean {
    const symbols = context.symbols;
    return (
      NameExistence.isValueName(
        ScopeUtils.qualifyInScope(name, scopePath),
        symbols,
        context.symbolTable,
      ) ||
      PositionFreeScopeMember.is(
        symbols.scopeMembers.get(scopePath),
        scopePath,
        name,
        context.program,
      )
    );
  }

  /**
   * Whether a bare name denotes a DECLARED value -- a variable, parameter,
   * const, function, register or type name this file can see -- as distinct
   * from an enum MEMBER, which `isVisible` also admits.
   *
   * #1322: split out for E0424. An enum member written bare is a name this
   * file can see (so it is not undefined), but whether it may stand bare is a
   * question about its POSITION, and that rule must first know the name is not
   * a variable that merely shares the spelling. One predicate answers both
   * analyzers, so "declared" cannot mean two things.
   */
  static isDeclaredValue(
    name: string,
    at: ISourcePosition,
    scopePath: string,
    context: IAnalysisContext,
  ): boolean {
    const symbolTable = context.symbolTable;
    // A local, parameter, `for` variable, file-scope variable or scope member
    // that is defined at `at` (#1668, #1643). #1398: binding sees only files
    // this one includes, so a sibling's const never answers here.
    if (UndeclaredValueAnalyzer.binds(null, name, at, context)) {
      return true;
    }

    const symbols = context.symbols;

    // A function referenced as a value (ADR-029 function-as-type), a type used
    // as the base of `Type.MEMBER`, a register, which is a value at an address
    // (ADR-004) and so answers here but NOT in the type position (#1336). A
    // variable is `binds`' above, never this predicate's (#1643).
    // ADR-111: when a register becomes a type, `isValueName` collapses into
    // `isTypeName`.
    //
    // #1430: `CodeGenState.knownFunctions` is deliberately NOT consulted, for
    // the reason `NameExistence`'s class comment already gives for
    // `callbackTypes`. Codegen fills it and `reset()` clears it, both after the
    // analyzers run, so at analysis time it is empty for the first file and
    // holds file N-1's function names for every file after. Because it is OR'd
    // toward "visible", a stale entry SUPPRESSED E0427: the same program with
    // its `#include` lines swapped either diagnosed the undefined name or
    // emitted C the compiler rejects at exit 0. It was redundant as well as
    // wrong -- `isValueName` reaches `symbols.functionReturnTypes`, the
    // per-file view of the same ADR-029 fact, on the identical key. The
    // qualified read below goes for the same reason, but on the key-shape
    // argument alone: reinstating it reddens no fixture.
    //
    // #1295 correction: that used to credit "the `scopeMembers` term beside it
    // already answers cross-file (#1494)", and `scopeMembers` does NOT cross a
    // file boundary -- `git grep -c scopeMembers -- VisibleSymbols.ts` is 0. It
    // is absent from the merge accumulator and survives only via the `...base`
    // spread, i.e. THIS file's symbols. `knownScopes` and
    // `scopeMemberVisibility`, written by the same `processScope`, ARE merged,
    // so the three disagree about what "visible" means. What actually answers
    // cross-file here is the run-wide `symbolTable` term below.
    if (NameExistence.isValueName(name, symbols, symbolTable)) {
      return true;
    }

    return (
      scopePath !== "" &&
      UndeclaredValueAnalyzer.isScopeMemberValue(name, scopePath, context)
    );
  }

  addError(identifier: string, line: number, column: number): void {
    this.errors.push({
      code: "E0427",
      identifier,
      line,
      column,
      message: `'${identifier}' is not defined`,
    });
  }
}

export default UndeclaredValueAnalyzer;
