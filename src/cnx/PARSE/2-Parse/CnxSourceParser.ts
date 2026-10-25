/**
 * CnxSourceParser
 * Handles parsing of cnx source code with error collection.
 *
 * Extracted from Pipeline.ts to reduce duplication and improve testability.
 */

import TargetDirectives from "./TargetDirectives";
import SourceOrder from "../../utils/SourceOrder";
import { CharStream, CommonTokenStream, Parser, Token } from "antlr4ng";

import { CnxLexer } from "./grammar/CnxLexer";
import { CnxParser } from "./grammar/CnxParser";
import CommentScanner from "./CommentScanner";
import ProgramLowering from "./ProgramLowering";
import IdentifierForm from "./IdentifierForm";
import ArrayForm from "./ArrayForm";
import StringForm from "./StringForm";
import MutabilityForm from "./MutabilityForm";
import LiteralForm from "./LiteralForm";
import IParsedFile from "./types/IParsedFile";
import ITranspileError from "../../types/ITranspileError";
import CodedErrorText from "../../utils/CodedErrorText";

/**
 * ADR-016 makes scopes a FLAT namespace, permanently: a scope declared inside
 * another is rejected, and no later release admits it.
 *
 * The C99 5.2.4.1 budget -- 31 significant initial characters in an external
 * identifier, which MISRA C:2012 Rule 5.1 is scored inside -- is why unbounded
 * depth was never on the table, not why depth 2 in particular is refused. It
 * proves depth must be BOUNDED and says nothing about where the bound goes:
 * `Hw__Gpio__init` is 14 characters, and a flat `HardwareAbstractionLayer__init`
 * already exceeds the budget with no nesting at all (#1306 review). Flatness is
 * the decision; the budget is the reason unbounded nesting was never a candidate.
 *
 * The rule is expressed in two places -- the grammar omits `scopeDeclaration` from
 * `scopeMember`, and this recognizer names the parse failure that omission causes.
 * They are welded by `tests/scope/nested-scope-error`: widening the grammar would
 * make the file parse, produce no error, and redden that fixture. Neither half can
 * change alone.
 */
const NESTED_SCOPE_MESSAGE = CodedErrorText.of(
  "E0430",
  "nested scopes are not allowed (ADR-016)",
);

/**
 * The advice, on the `help:` line every other coded diagnostic uses.
 *
 * It is hedged because the recognizer CANNOT tell a nested scope from an
 * unclosed one -- the token stream is identical. A file that opens `scope A`,
 * forgets the `}` and opens `scope B` produces exactly the same `scope`-where-a-
 * member-was-expected failure as a deliberate nesting, and telling that author
 * to flatten a scope they never nested sends them the wrong way (#1306 review).
 * Naming the missing brace first costs the deliberate-nesting reader one clause.
 *
 * An earlier version of this file put the advice in the MESSAGE, arguing that
 * `helpText` reached no renderer. That was true when it was written and false by
 * the time this PR landed: the same PR plumbed `helpText` through the CLI, so
 * E0430 was the one coded diagnostic whose advice sat in the wrong half.
 */
const NESTED_SCOPE_HELP =
  "close the enclosing scope before declaring another, or use a flat scope such as Hardware_GPIO";

/**
 * The innermost rule ANTLR reports when `scope` appears where a scope member was
 * expected. The bare form lands in `scopeDeclaration` -- the `scopeMember*` loop's
 * sync -- while a `private`/`public` prefix lands in `scopeMember`. Both spellings
 * are load-bearing.
 *
 * Held as rule INDICES rather than names: renaming `scopeMember` in the grammar
 * then fails to compile here instead of silently ceasing to match and leaving the
 * fixture as the only thing that notices (#1306 review).
 *
 * The exception object is NOT part of the predicate: it is null for the bare form
 * and a NoViableAltException for the prefixed one, so keying on it would match one
 * case and miss the other. A `scope` keyword inside a struct, register or function
 * body reports that construct's own rule and is correctly not matched.
 */
const NESTED_SCOPE_RULES: ReadonlySet<number> = new Set([
  CnxParser.RULE_scopeDeclaration,
  CnxParser.RULE_scopeMember,
]);

/**
 * Parses cnx source code and collects errors.
 *
 * Returns `IParsedFile` -- 1.2 Parse's artifact -- rather than a private result
 * shape of its own. Until #1445 this file declared an `IParseResult` that
 * restated `tree`, `tokenStream` and `declarationCount` verbatim, and
 * `Transpiler` destructured one into the other by hand; adding a field to the
 * artifact therefore meant editing both, which is the duplicate-path
 * anti-pattern CLAUDE.md forbids. There is now one shape and no conversion.
 */
class CnxSourceParser {
  /**
   * Whether this syntax error is a nested scope declaration.
   *
   * Reads the parser's own state rather than re-deriving "inside a scope body"
   * from the token stream, which would be a second encoding of the grammar's
   * structure and free to drift from it.
   */
  private static isNestedScope(
    recognizer: unknown,
    offendingSymbol: Token | null,
  ): boolean {
    if (!(recognizer instanceof Parser)) return false;
    if (offendingSymbol?.type !== CnxParser.SCOPE) return false;
    return NESTED_SCOPE_RULES.has(recognizer.context?.ruleIndex ?? -1);
  }

  /**
   * Whether this error is the recovery's OWN noise from the rejected nesting,
   * rather than a further defect in the file.
   *
   * Measured on the two shapes recovery actually produces, not assumed. After
   * E0430 is reported at the inner `scope`, ANTLR emits exactly two more:
   *
   *   `no viable alternative at input 'Inner{'`  from `scopeMember`
   *   `extraneous input '}'`                     from `program`, on the `}` the
   *                                              block ANTLR moved out left behind
   *
   * Both describe a tree already known to be wrong. Nothing else does. A blanket
   * "drop every later parser error" also swallowed `u8 y <- ;` in a separate
   * top-level function, which the comment here and ADR-016 both described as
   * recovery noise and which is nothing of the kind (#1306 review) -- so the
   * author fixed the scope, re-ran, and met a second error that had been sitting
   * there all along.
   *
   * The `program` half is narrowed by token as well as rule, because a genuine
   * top-level syntax error reports from `program` too. An extraneous `}` at file
   * scope, after a nesting was rejected, is left over from that move: the
   * braces are unbalanced BECAUSE of the construct already reported.
   */
  private static isNestedScopeRecoveryNoise(
    recognizer: unknown,
    offendingSymbol: Token | null,
  ): boolean {
    if (!(recognizer instanceof Parser)) return false;
    const rule = recognizer.context?.ruleIndex ?? -1;
    if (NESTED_SCOPE_RULES.has(rule)) return true;
    return (
      rule === CnxParser.RULE_program &&
      offendingSymbol?.type === CnxParser.RBRACE
    );
  }

  /**
   * Parse cnx source code
   * @param source - The source code string to parse
   * @returns 1.2 Parse's artifact for this source
   */
  static parse(source: string): IParsedFile {
    const charStream = CharStream.fromString(source);
    const lexer = new CnxLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CnxParser(tokenStream);

    const errors: ITranspileError[] = [];
    let nestedScopeReported = false;

    const errorListener = {
      syntaxError(
        recognizer: unknown,
        offendingSymbol: Token | null,
        line: number,
        charPositionInLine: number,
        msg: string,
      ): void {
        if (CnxSourceParser.isNestedScope(recognizer, offendingSymbol)) {
          nestedScopeReported = true;
          errors.push({
            line,
            column: charPositionInLine,
            message: NESTED_SCOPE_MESSAGE,
            helpText: NESTED_SCOPE_HELP,
            severity: "error" as const,
          });
          return;
        }

        // Suppressing the recovery's own noise is what lets the fixture assert
        // the RULE instead of the parser's token set, which is the whole point
        // of #1306. Only that noise is dropped -- see the predicate; a real
        // error elsewhere in the file still reports, and a further nested scope
        // is reported by the branch above rather than swallowed here.
        if (
          nestedScopeReported &&
          CnxSourceParser.isNestedScopeRecoveryNoise(
            recognizer,
            offendingSymbol,
          )
        ) {
          return;
        }

        errors.push({
          line,
          column: charPositionInLine,
          message: msg,
          severity: "error" as const,
        });
      },
      reportAmbiguity() {},
      reportAttemptingFullContext() {},
      reportContextSensitivity() {},
    };

    // Add error listener to both lexer and parser
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    const tree = parser.program();
    // Scanned off THIS token stream, which the parse has already filled, so
    // the hidden channel is a walk over tokens already in memory -- and
    // scanned LAZILY, because the only reader is 2.1's MISRA 3.1/3.2 check
    // and most callers of `parse` never ask. The prettier plugin, the
    // format-fidelity gate, `grammar-coverage`, `FixtureOccupancy` and every
    // `symbolOnly` include take the tree or the errors and nothing else;
    // making the scan eager charged all of them for a walk they discard.
    // `CommentScanner` memoizes, so the field is still computed at most once
    // per parse (#1445).
    //
    // What did NOT move: `ProgramLowering` asks the scanner
    // `getCommentsBefore` about a token INDEX (#1932). That is a positional
    // query, not a whole-file scan, so there was never a second
    // whole-file derivation to collapse -- an earlier draft of this comment
    // said there was, and `IParsedFile` already carries the correction.
    const scanner = new CommentScanner(tokenStream);
    // Lowered here, on parse (#1932): 1.2 authors the plain-data file, so
    // the tree can be released once 2.1 is done with it. Before the form
    // checks, which judge a variable declaration off it (#2073).
    const program = ProgramLowering.program(tree, scanner);
    // A recovery tree's spelling is not the source's, so form is checked only
    // on a tree that parsed.
    // In source order, as one file's diagnostics read, not checker by checker
    const formErrors =
      errors.length > 0
        ? []
        : [
            ...LiteralForm.errorsIn(tokenStream),
            ...IdentifierForm.errorsIn(tree),
            ...ArrayForm.errorsIn(tree, program),
            ...StringForm.errorsIn(program),
            ...MutabilityForm.errorsIn(tree),
          ].sort(SourceOrder.compare);
    const declarationCount = tree.declaration().length;

    return {
      tree,
      tokenStream,
      declarationCount,
      get comments() {
        return scanner.extractAll();
      },
      program,
      targetDirectives: TargetDirectives.read(tree),
      parseErrors: errors,
      formErrors,
    };
  }
}

export default CnxSourceParser;
