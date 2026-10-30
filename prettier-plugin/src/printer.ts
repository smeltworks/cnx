/**
 * Printer for the cnx Prettier plugin (#1364).
 *
 * Prints ANTLR's parse tree directly. Every case dispatches on the *generated*
 * rule index (`CnxParser.RULE_*`), so `tests/rule-coverage.test.ts` can assert
 * that no grammar rule is unhandled -- which is what turns "the grammar grew
 * and the formatter did not" into a CI failure instead of silent bit-rot.
 *
 * The one invariant every layout function must hold: **print every child
 * exactly once**. Comments are anchored to tokens, so consuming a token and
 * discarding its doc -- synthesizing `","` in its place, say -- deletes that
 * token's comments. Only whitespace is ever synthesized here.
 *
 * Note that the `cursor.done()` check in `printNode` catches a child that was
 * never *consumed*, not one consumed and then dropped. Three comment-loss bugs
 * of the second kind reached review before that distinction was clear.
 *
 * Formatting style (asserted by tests/format.test.ts):
 * - 4-space indentation
 * - Same-line braces: `void foo() {`
 * - Spaced assignment: `x <- 5`
 * - Author's blank lines preserved, collapsed to at most one
 */

import { ParserRuleContext } from "antlr4ng";
import { AstPath, Doc, ParserOptions, doc } from "prettier";

import { CnxParser } from "../../src/cnx/PARSE/2-Parse/grammar/CnxParser";

import ChildCursor from "./childCursor";
import Cst from "./cst";
import ICommentAnchor from "./types/ICommentAnchor";
import ICommentNode from "./types/ICommentNode";
import TCstNode from "./types/TCstNode";

const {
  group,
  indent,
  join,
  hardline,
  softline,
  line,
  lineSuffix,
  breakParent,
} = doc.builders;

type TPrintFn = (path: AstPath<TCstNode>) => Doc;
type TPath = AstPath<TCstNode>;

/** Modifiers that may precede a type in a declaration, in grammar order. */
const DECLARATION_MODIFIERS: readonly number[] = [
  CnxParser.RULE_atomicModifier,
  CnxParser.RULE_volatileModifier,
  CnxParser.RULE_constModifier,
  CnxParser.RULE_mutModifier,
  CnxParser.RULE_overflowModifier,
];

/**
 * Rules whose text is exactly their tokens run together.
 *
 * Membership counts as "handled" for the rule-coverage gate.
 */
const CONCATENATED_RULES: ReadonlySet<number> = new Set([
  CnxParser.RULE_includeDirective,
  CnxParser.RULE_defineDirective,
  CnxParser.RULE_conditionalDirective,
  CnxParser.RULE_pragmaDirective,
  CnxParser.RULE_visibilityModifier,
  CnxParser.RULE_accessModifier,
  CnxParser.RULE_bitmapType,
  CnxParser.RULE_constModifier,
  CnxParser.RULE_mutModifier,
  CnxParser.RULE_volatileModifier,
  CnxParser.RULE_overflowModifier,
  CnxParser.RULE_atomicModifier,
  CnxParser.RULE_assignmentOperator,
  CnxParser.RULE_primitiveType,
  CnxParser.RULE_userType,
  CnxParser.RULE_literal,
  CnxParser.RULE_caseLabel,
  CnxParser.RULE_bitmapMember,
  CnxParser.RULE_scopedType,
  CnxParser.RULE_globalType,
  CnxParser.RULE_qualifiedType,
  CnxParser.RULE_stringType,
  // Also just their children run together: `sizeof(T)`, `a.b[i]`, `(expr)`,
  // `[N]`. Each had its own function with an identical body; the duplication
  // was copies of one decision. A cast is not one: `(clamp T)x` spaces its
  // modifier (ADR-044).
  CnxParser.RULE_assignmentTarget,
  CnxParser.RULE_primaryExpression,
  CnxParser.RULE_sizeofExpression,
  CnxParser.RULE_arrayDimension,
  CnxParser.RULE_arrayTypeDimension,
]);

/**
 * Rules that are a bare choice between alternatives: the layout belongs to
 * whichever alternative was taken, so they delegate to their only child.
 *
 * This is what collapses the precedence cascade -- `expression` down to
 * `primaryExpression` is 16 levels deep for a single literal.
 */
const DELEGATING_RULES: ReadonlySet<number> = new Set([
  CnxParser.RULE_preprocessorDirective,
  CnxParser.RULE_declaration,
  CnxParser.RULE_statement,
  CnxParser.RULE_expression,
  CnxParser.RULE_forInit,
  CnxParser.RULE_arrayInitializerElement,
  CnxParser.RULE_templateArgument,
  CnxParser.RULE_type,
  CnxParser.RULE_arrayType,
  CnxParser.RULE_postfixExpression,
]);

/** Left-associative binary chains, all of the shape `operand (OP operand)*`. */
const BINARY_CHAIN_RULES: ReadonlySet<number> = new Set([
  CnxParser.RULE_orExpression,
  CnxParser.RULE_andExpression,
  CnxParser.RULE_equalityExpression,
  CnxParser.RULE_relationalExpression,
  CnxParser.RULE_bitwiseOrExpression,
  CnxParser.RULE_bitwiseXorExpression,
  CnxParser.RULE_bitwiseAndExpression,
  CnxParser.RULE_shiftExpression,
  CnxParser.RULE_additiveExpression,
  CnxParser.RULE_multiplicativeExpression,
]);

/** Comma-separated lists that share one layout: `item (',' item)*`. */
const COMMA_LIST_RULES: ReadonlySet<number> = new Set([
  CnxParser.RULE_parameterList,
  CnxParser.RULE_argumentList,
  CnxParser.RULE_constructorArgumentList,
  CnxParser.RULE_templateArgumentList,
]);

// ============================================================================
// Comments
// ============================================================================

/** Comments that sat after a token on its own line. */
function printTrailingComments(comments: ICommentNode[]): Doc[] {
  const parts: Doc[] = [];
  for (const comment of comments) {
    if (comment.block) {
      // A block comment ends where it ends, so it can stay inline.
      parts.push(" ", comment.value);
      continue;
    }
    // A line comment runs to end of line. `lineSuffix` defers it to whatever
    // newline the enclosing layout already emits, so the comment terminates
    // the line without the printer having to add a second one -- emitting a
    // hardline here as well produced a blank line after every commented
    // bitmap field, and another on each subsequent run.
    parts.push(lineSuffix([" ", comment.value]), breakParent);
  }
  return parts;
}

/**
 * The comments leading a token, each on its own line.
 *
 * This is half of the anti-oscillation contract; the parser holds the other.
 * The parser calls a comment trailing exactly when it shares the previous
 * token's line, so rendering a *leading* comment anywhere but the start of a
 * line means the next run reads it as trailing something else and moves it.
 * Giving it its own line makes re-parsing reproduce the classification.
 */
function printLeadingComments(anchor: ICommentAnchor): Doc[] {
  if (anchor.before.length === 0) return [];
  const parts: Doc[] = [];
  // Nothing to break from at the very start of a file.
  if (!anchor.atFileStart) parts.push(hardline);
  for (let index = 0; index < anchor.before.length; index += 1) {
    const comment = anchor.before[index];
    if (index > 0) parts.push(hardline);
    if (comment.precededByBlankLine) parts.push(hardline);
    parts.push(comment.value);
  }
  // The token itself starts the next line.
  parts.push(hardline);
  if (anchor.blankLineBeforeToken) parts.push(hardline);
  return parts;
}

/**
 * The comments leading a token, laid out as their own lines.
 *
 * A closing brace is the anchor for any comment written just before it, but
 * the brace sits at the enclosing indentation while the comment belongs with
 * the body. Callers that own an indented body render those comments through
 * this and print the brace itself with `printTerminalBody`.
 */
function printLeadingCommentLines(node: TCstNode): Doc[] {
  const anchor = Cst.commentsOf(node);
  if (anchor === undefined || anchor.before.length === 0) return [];
  const lines: Doc[] = [];
  for (let index = 0; index < anchor.before.length; index += 1) {
    const comment = anchor.before[index];
    if (index > 0) lines.push(hardline);
    if (comment.precededByBlankLine) lines.push(hardline);
    lines.push(comment.value);
  }
  return lines;
}

/** A token and its trailing comments, without anything that leads it. */
function printTerminalBody(node: TCstNode): Doc {
  const anchor = Cst.commentsOf(node);
  const text = Cst.isEndOfFile(node) ? "" : Cst.textOf(node);
  if (anchor === undefined) return text;
  return [text, ...printTrailingComments(anchor.after)];
}

/**
 * Print a token, restoring the comments anchored to it.
 *
 * Comments were bound to their token during parsing, so they land exactly where
 * they were written: no formatting pass can migrate one across an operator.
 */
function printTerminal(node: TCstNode): Doc {
  const anchor = Cst.commentsOf(node);
  // EOF carries no text, but may still trail the file's last comments.
  const text = Cst.isEndOfFile(node) ? "" : Cst.textOf(node);
  if (anchor === undefined) return text;

  return [
    ...printLeadingComments(anchor),
    text,
    ...printTrailingComments(anchor.after),
  ];
}

// ============================================================================
// Shared layout
// ============================================================================

/**
 * Join docs with `separator`, preserving a single blank line wherever the
 * author left one. Collapsing two-or-more to one keeps the output idempotent.
 */
function joinPreservingBlankLines(
  taken: { doc: Doc; node: TCstNode }[],
  separator: Doc,
): Doc[] {
  const parts: Doc[] = [];
  for (let index = 0; index < taken.length; index += 1) {
    // An item whose first token carries leading comments already begins with a
    // break, and its comment records its own blank line. Adding the separator
    // too would open a blank line the author never wrote.
    if (index > 0 && !Cst.hasLeadingComments(taken[index].node)) {
      parts.push(separator);
      if (Cst.hasBlankLineBetween(taken[index - 1].node, taken[index].node)) {
        parts.push(hardline);
      }
    }
    parts.push(taken[index].doc);
  }
  return parts;
}

/**
 * `{ body }` with the real brace tokens, collapsing an empty body to `{}`.
 *
 * Takes the closing brace as a node rather than a printed doc so the comments
 * anchored to it can be laid out inside the braces, at body indentation, where
 * they were written.
 */
function printBraced(
  open: Doc,
  body: Doc[],
  closeNode: TCstNode,
  firstItem?: TCstNode,
): Doc {
  const trailingComments = printLeadingCommentLines(closeNode);
  const close = printTerminalBody(closeNode);
  const contents = [...body];
  if (trailingComments.length > 0) {
    if (contents.length > 0) contents.push(hardline);
    contents.push(...trailingComments);
  }
  if (contents.length === 0) return [open, close];
  // The first item supplies its own break when it starts with a comment.
  const opensBody =
    firstItem !== undefined && Cst.hasLeadingComments(firstItem)
      ? []
      : [hardline];
  return [open, indent([...opensBody, ...contents]), hardline, close];
}

/** A brace-delimited member list: `'{' member* '}'`. */
function printMemberBlock(cursor: ChildCursor, memberRule: number): Doc {
  const open = cursor.take();
  const members = cursor.takeWhileRule(memberRule);
  const close = cursor.takeChild();
  return printBraced(
    open,
    joinPreservingBlankLines(members, hardline),
    close.node,
    members[0]?.node,
  );
}

/**
 * A comma-separated member list inside braces: `'{' m (',' m)* ','? '}'`.
 *
 * The comma tokens are printed, not synthesized. A trailing comment such as
 * `RED <- 0, // implicit` is anchored to the comma, so consuming the comma
 * without printing it deletes the comment.
 */
function printCommaMemberBlock(cursor: ChildCursor, memberRule: number): Doc {
  const open = cursor.take();
  const parts: Doc[] = [];
  let previous: TCstNode | null = null;
  let first: TCstNode | undefined;
  while (cursor.peekRule() === memberRule) {
    const member = cursor.takeChild();
    first = first ?? member.node;
    if (previous !== null && Cst.hasBlankLineBetween(previous, member.node)) {
      parts.push(hardline);
    }
    parts.push(member.doc);
    previous = member.node;
    const comma = cursor.takeIfText(",");
    if (comma !== null) parts.push(comma);
    if (cursor.peekRule() === memberRule) parts.push(hardline);
  }
  const close = cursor.takeChild();
  return printBraced(open, parts, close.node, first);
}

/** `keyword body`, e.g. `critical { ... }` and `forever { ... }`. */
function printKeywordBlock(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  return [keyword, " ", cursor.take()];
}

/** Trailing array dimensions on a declarator: `name[4][4]`. */
function printDimensions(cursor: ChildCursor, dimensionRule: number): Doc[] {
  return cursor.takeWhileRule(dimensionRule).map((taken) => taken.doc);
}

/** `type name dims? ('<-' value)?` — shared by variable and for-loop decls. */
function printDeclarator(cursor: ChildCursor): Doc[] {
  const parts: Doc[] = [cursor.take(), " ", cursor.take()];
  parts.push(...printDimensions(cursor, CnxParser.RULE_arrayDimension));
  const arrow = cursor.takeIfText("<-");
  if (arrow !== null) parts.push(" ", arrow, " ", cursor.take());
  return parts;
}

// ============================================================================
// Top level
// ============================================================================

function printProgram(cursor: ChildCursor): Doc {
  const declarations = cursor.takeAllButLast(1);
  const endOfFile = cursor.takeChild();
  // Comments after the last declaration anchor to EOF, which carries no text of
  // its own. They are laid out as lines here rather than through the token, so
  // the file's single closing newline is not doubled.
  const trailing = printLeadingCommentLines(endOfFile.node);
  const parts = joinPreservingBlankLines(declarations, hardline);
  if (trailing.length > 0) {
    if (parts.length > 0) parts.push(hardline);
    parts.push(...trailing);
  }
  return [...parts, hardline];
}

// ============================================================================
// Declarations
// ============================================================================

function printScopeDeclaration(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const name = cursor.take();
  return [
    keyword,
    " ",
    name,
    " ",
    printMemberBlock(cursor, CnxParser.RULE_scopeMember),
  ];
}

function printRegisterDeclaration(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const name = cursor.take();
  const at = cursor.take();
  const address = cursor.take();
  return [
    keyword,
    " ",
    name,
    " ",
    at,
    " ",
    address,
    " ",
    printMemberBlock(cursor, CnxParser.RULE_registerMember),
  ];
}

function printRegisterMember(cursor: ChildCursor): Doc {
  const name = cursor.take();
  const colon = cursor.take();
  const type = cursor.take();
  const access = cursor.take();
  const at = cursor.take();
  const address = cursor.take();
  const comma = cursor.takeIfText(",");
  return [
    name,
    colon,
    " ",
    type,
    " ",
    access,
    " ",
    at,
    " ",
    address,
    // Only the comma the author wrote: the grammar's `','?` makes it optional,
    // and synthesizing one would break "only whitespace is synthesized here".
    comma ?? "",
  ];
}

function printStructDeclaration(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const name = cursor.take();
  return [
    keyword,
    " ",
    name,
    " ",
    printMemberBlock(cursor, CnxParser.RULE_structMember),
  ];
}

function printStructMember(cursor: ChildCursor): Doc {
  const parts: Doc[] = [];
  const modifiers = cursor.takeWhileAnyRule([CnxParser.RULE_overflowModifier]);
  for (const modifier of modifiers) parts.push(modifier.doc, " ");
  const type = cursor.take();
  const name = cursor.take();
  const dimensions = printDimensions(cursor, CnxParser.RULE_arrayDimension);
  return [...parts, type, " ", name, ...dimensions, cursor.take()];
}

function printEnumDeclaration(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const name = cursor.take();
  return [
    keyword,
    " ",
    name,
    " ",
    printCommaMemberBlock(cursor, CnxParser.RULE_enumMember),
  ];
}

function printEnumMember(cursor: ChildCursor): Doc {
  const name = cursor.take();
  const arrow = cursor.takeIfText("<-");
  if (arrow === null) return name;
  return [name, " ", arrow, " ", cursor.take()];
}

function printBitmapDeclaration(cursor: ChildCursor): Doc {
  const kind = cursor.take();
  const name = cursor.take();
  return [
    kind,
    " ",
    name,
    " ",
    printCommaMemberBlock(cursor, CnxParser.RULE_bitmapMember),
  ];
}

function printFunctionDeclaration(cursor: ChildCursor): Doc {
  const modifier = cursor.takeIfRule(CnxParser.RULE_overflowModifier);
  const type = cursor.take();
  const name = cursor.take();
  const open = cursor.take();
  const parameters = cursor.takeIfRule(CnxParser.RULE_parameterList);
  const close = cursor.take();
  const body = cursor.take();
  return [
    ...(modifier === null ? [] : [modifier, " "]),
    type,
    " ",
    name,
    open,
    parameters ?? "",
    close,
    " ",
    body,
  ];
}

/** `(T)x`, or `(clamp T)x` with ADR-044's modifier spaced from the type */
function printCastExpression(cursor: ChildCursor): Doc {
  const open = cursor.take();
  const modifier = cursor.takeIfRule(CnxParser.RULE_overflowModifier);
  const type = cursor.take();
  const close = cursor.take();
  const operand = cursor.take();
  return [
    open,
    ...(modifier === null ? [] : [modifier, " "]),
    type,
    close,
    operand,
  ];
}

function printParameter(cursor: ChildCursor): Doc {
  const parts: Doc[] = [];
  const constModifier = cursor.takeIfRule(CnxParser.RULE_constModifier);
  if (constModifier !== null) parts.push(constModifier, " ");
  const mutModifier = cursor.takeIfRule(CnxParser.RULE_mutModifier);
  if (mutModifier !== null) parts.push(mutModifier, " ");
  parts.push(cursor.take(), " ", cursor.take());
  parts.push(...printDimensions(cursor, CnxParser.RULE_arrayDimension));
  return parts;
}

function printVariableDeclaration(cursor: ChildCursor): Doc {
  const modifiers = cursor.takeWhileAnyRule(DECLARATION_MODIFIERS);
  const parts: Doc[] = [];
  for (const modifier of modifiers) parts.push(modifier.doc, " ");

  const type = cursor.take();
  const name = cursor.take();
  parts.push(type, " ", name);

  // Alternative 2 (issue #375): `Type name(constArg, ...)` C++ constructor form.
  const open = cursor.takeIfText("(");
  if (open !== null) {
    parts.push(open, cursor.take(), cursor.take(), cursor.take());
    return parts;
  }

  parts.push(...printDimensions(cursor, CnxParser.RULE_arrayDimension));
  const arrow = cursor.takeIfText("<-");
  if (arrow !== null) parts.push(" ", arrow, " ", cursor.take());
  parts.push(cursor.take());
  return parts;
}

// ============================================================================
// Statements
// ============================================================================

function printScopeMember(cursor: ChildCursor): Doc {
  return join(
    " ",
    cursor.takeRest().map((taken) => taken.doc),
  );
}

function printBlock(cursor: ChildCursor): Doc {
  return printMemberBlock(cursor, CnxParser.RULE_statement);
}

function printAssignmentLike(cursor: ChildCursor): Doc {
  const target = cursor.take();
  const operator = cursor.take();
  const value = cursor.take();
  const parts: Doc[] = [target, " ", operator, " ", value];
  if (!cursor.done()) parts.push(cursor.take());
  return parts;
}

function printPostfixOperation(cursor: ChildCursor): Doc {
  const parts: Doc[] = [cursor.take()];
  while (cursor.remaining() > 0) {
    if (cursor.peekText() === ",") {
      // The bit-range form is `'[' expression ',' expression ']'`. Print the
      // comma rather than synthesizing one: a comment written after it is
      // anchored to that token, and discarding its doc deletes the comment.
      parts.push(cursor.take(), " ");
      continue;
    }
    parts.push(cursor.take());
  }
  return parts;
}

function printExpressionStatement(cursor: ChildCursor): Doc {
  return [cursor.take(), cursor.take()];
}

function printIfStatement(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const open = cursor.take();
  const condition = cursor.take();
  const close = cursor.take();
  const parts: Doc[] = [
    keyword,
    " ",
    open,
    condition,
    close,
    " ",
    cursor.take(),
  ];
  const elseKeyword = cursor.takeIfText("else");
  if (elseKeyword !== null) parts.push(" ", elseKeyword, " ", cursor.take());
  return parts;
}

function printWhileStatement(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const open = cursor.take();
  const condition = cursor.take();
  const close = cursor.take();
  return [keyword, " ", open, condition, close, " ", cursor.take()];
}

function printDoWhileStatement(cursor: ChildCursor): Doc {
  const doKeyword = cursor.take();
  const body = cursor.take();
  const whileKeyword = cursor.take();
  const open = cursor.take();
  const condition = cursor.take();
  const close = cursor.take();
  const semicolon = cursor.take();
  return [
    doKeyword,
    " ",
    body,
    " ",
    whileKeyword,
    " ",
    open,
    condition,
    close,
    semicolon,
  ];
}

function printForStatement(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const open = cursor.take();
  const initializer = cursor.takeIfRule(CnxParser.RULE_forInit);
  const firstSemicolon = cursor.take();
  const condition = cursor.takeIfRule(CnxParser.RULE_expression);
  const secondSemicolon = cursor.take();
  const update = cursor.takeIfRule(CnxParser.RULE_forUpdate);
  const close = cursor.take();
  return [
    keyword,
    " ",
    open,
    initializer ?? "",
    firstSemicolon,
    " ",
    condition ?? "",
    secondSemicolon,
    " ",
    update ?? "",
    close,
    " ",
    cursor.take(),
  ];
}

function printForVarDecl(cursor: ChildCursor): Doc {
  const modifiers = cursor.takeWhileAnyRule(DECLARATION_MODIFIERS);
  const parts: Doc[] = [];
  for (const modifier of modifiers) parts.push(modifier.doc, " ");
  parts.push(...printDeclarator(cursor));
  return parts;
}

function printReturnStatement(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const value = cursor.takeIfRule(CnxParser.RULE_expression);
  const semicolon = cursor.take();
  return value === null
    ? [keyword, semicolon]
    : [keyword, " ", value, semicolon];
}

function printSwitchStatement(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const open = cursor.take();
  const subject = cursor.take();
  const close = cursor.take();
  const openBrace = cursor.take();
  const cases = cursor.takeAllButLast(1);
  const closeBrace = cursor.takeChild();
  return [
    keyword,
    " ",
    open,
    subject,
    close,
    " ",
    printBraced(
      openBrace,
      joinPreservingBlankLines(cases, hardline),
      closeBrace.node,
      cases[0]?.node,
    ),
  ];
}

function printSwitchCase(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const parts: Doc[] = [keyword, " "];
  parts.push(cursor.take());
  while (cursor.peekText() === "||") {
    parts.push(" ", cursor.take(), " ", cursor.take());
  }
  parts.push(" ", cursor.take());
  return parts;
}

function printDefaultCase(cursor: ChildCursor): Doc {
  const keyword = cursor.take();
  const parts: Doc[] = [keyword];
  const open = cursor.takeIfText("(");
  if (open !== null) parts.push(open, cursor.take(), cursor.take());
  parts.push(" ", cursor.take());
  return parts;
}

// ============================================================================
// Expressions
// ============================================================================

function printTernaryExpression(cursor: ChildCursor): Doc {
  // ADR-022 requires the parentheses, so the ternary form always starts with
  // the `(` token; the non-ternary alternative is a lone orExpression.
  const open = cursor.takeIfText("(");
  if (open === null) return cursor.take();
  const condition = cursor.take();
  const close = cursor.take();
  const question = cursor.take();
  const whenTrue = cursor.take();
  const colon = cursor.take();
  const whenFalse = cursor.take();
  return [
    open,
    condition,
    close,
    " ",
    question,
    " ",
    whenTrue,
    " ",
    colon,
    " ",
    whenFalse,
  ];
}

function printBinaryChain(cursor: ChildCursor, node: TCstNode): Doc {
  const broken = Cst.containsTrailingLineComment(node);
  const separator: Doc = broken ? indent(hardline) : " ";
  const parts: Doc[] = [cursor.take()];
  while (!cursor.done()) {
    parts.push(" ", cursor.take(), separator, cursor.take());
  }
  return parts;
}

function printUnaryExpression(cursor: ChildCursor): Doc {
  const first = cursor.take();
  if (cursor.done()) return first;
  return [first, cursor.take()];
}

function printStructInitializer(cursor: ChildCursor): Doc {
  // Explicit form carries the type name before the brace; inferred form does not.
  const name = cursor.peekText() === "{" ? null : cursor.take();
  const open = cursor.take();
  const fields = cursor.takeIfRule(CnxParser.RULE_fieldInitializerList);
  const close = cursor.take();
  const prefix: Doc[] = name === null ? [] : [name, " "];
  if (fields === null) return [...prefix, open, close];
  return group([...prefix, open, indent([line, fields]), line, close]);
}

function printFieldInitializerList(cursor: ChildCursor): Doc {
  const parts: Doc[] = [cursor.take()];
  while (cursor.peekText() === ",") {
    const comma = cursor.take();
    if (cursor.done()) {
      // The grammar allows a trailing comma. Print it, as the enum and bitmap
      // layout already does: a comment written after it anchors to that token,
      // so dropping the comma deletes the comment.
      parts.push(comma);
      break;
    }
    parts.push(comma, line, cursor.take());
  }
  return parts;
}

function printFieldInitializer(cursor: ChildCursor): Doc {
  const name = cursor.take();
  const colon = cursor.take();
  return [name, colon, " ", cursor.take()];
}

function printArrayInitializer(cursor: ChildCursor): Doc {
  const open = cursor.take();
  const first = cursor.take();
  // Fill-all form (ADR-035): `[0*]`
  if (cursor.peekText() === "*") {
    const star = cursor.take();
    return [open, first, star, cursor.take()];
  }
  const elements: Doc[] = [first];
  while (cursor.peekText() === ",") {
    const comma = cursor.take();
    if (cursor.remaining() <= 1) {
      // Trailing comma: grammatical, and printing it keeps any comment
      // anchored to it.
      elements.push(comma);
      break;
    }
    elements.push(comma, line, cursor.take());
  }
  const close = cursor.take();
  return group([open, indent([softline, ...elements]), softline, close]);
}

function printCommaList(cursor: ChildCursor, node: TCstNode): Doc {
  // A line comment inside the list must end a line, or the next item's comment
  // is deferred to the same newline and merges into it.
  const broken = Cst.containsTrailingLineComment(node);
  const separator: Doc = broken ? indent(hardline) : " ";
  const parts: Doc[] = [cursor.take()];
  while (!cursor.done()) {
    parts.push(cursor.take(), separator, cursor.take());
  }
  return parts;
}

// ============================================================================
// Types
// ============================================================================

function printTemplateType(cursor: ChildCursor): Doc {
  const name = cursor.take();
  const open = cursor.take();
  const argumentList = cursor.takeChild();
  const close = cursor.take();
  // `Container<Pair<A, B>>` lexes `>>` as a right shift, exactly as it did in
  // C++ before C++11. A nested template must keep the separating space, or the
  // formatter emits a file it cannot itself parse.
  const closesNestedTemplate = Cst.textOf(argumentList.node).endsWith(">");
  return [name, open, argumentList.doc, closesNestedTemplate ? " " : "", close];
}

// ============================================================================
// Dispatcher
// ============================================================================

/**
 * Layout per grammar rule, keyed by the *generated* rule index.
 *
 * A map rather than a switch so the set of handled rules is derived from the
 * dispatcher itself. `Printer.handledRuleIndices()` reads it directly, which is
 * what lets `tests/rule-coverage.test.ts` compare the printer against
 * `CnxParser.ruleNames` without maintaining a second list that could drift --
 * the drift being exactly how this plugin rotted for seven months.
 */
const RULE_LAYOUTS: ReadonlyMap<number, (cursor: ChildCursor) => Doc> = new Map(
  [
    [CnxParser.RULE_program, printProgram],
    [CnxParser.RULE_scopeDeclaration, printScopeDeclaration],
    [CnxParser.RULE_scopeMember, printScopeMember],
    [CnxParser.RULE_registerDeclaration, printRegisterDeclaration],
    [CnxParser.RULE_registerMember, printRegisterMember],
    [CnxParser.RULE_structDeclaration, printStructDeclaration],
    [CnxParser.RULE_structMember, printStructMember],
    [CnxParser.RULE_enumDeclaration, printEnumDeclaration],
    [CnxParser.RULE_enumMember, printEnumMember],
    [CnxParser.RULE_bitmapDeclaration, printBitmapDeclaration],
    [CnxParser.RULE_functionDeclaration, printFunctionDeclaration],
    [CnxParser.RULE_castExpression, printCastExpression],
    [CnxParser.RULE_parameter, printParameter],
    [CnxParser.RULE_variableDeclaration, printVariableDeclaration],
    [CnxParser.RULE_block, printBlock],
    [CnxParser.RULE_criticalStatement, printKeywordBlock],
    [CnxParser.RULE_foreverStatement, printKeywordBlock],
    [CnxParser.RULE_assignmentStatement, printAssignmentLike],
    [CnxParser.RULE_forAssignment, printAssignmentLike],
    [CnxParser.RULE_forUpdate, printAssignmentLike],
    [CnxParser.RULE_postfixTargetOp, printPostfixOperation],
    [CnxParser.RULE_postfixOp, printPostfixOperation],
    [CnxParser.RULE_expressionStatement, printExpressionStatement],
    [CnxParser.RULE_ifStatement, printIfStatement],
    [CnxParser.RULE_whileStatement, printWhileStatement],
    [CnxParser.RULE_doWhileStatement, printDoWhileStatement],
    [CnxParser.RULE_forStatement, printForStatement],
    [CnxParser.RULE_forVarDecl, printForVarDecl],
    [CnxParser.RULE_returnStatement, printReturnStatement],
    [CnxParser.RULE_switchStatement, printSwitchStatement],
    [CnxParser.RULE_switchCase, printSwitchCase],
    [CnxParser.RULE_defaultCase, printDefaultCase],
    [CnxParser.RULE_ternaryExpression, printTernaryExpression],
    [CnxParser.RULE_unaryExpression, printUnaryExpression],
    [CnxParser.RULE_structInitializer, printStructInitializer],
    [CnxParser.RULE_fieldInitializerList, printFieldInitializerList],
    [CnxParser.RULE_fieldInitializer, printFieldInitializer],
    [CnxParser.RULE_arrayInitializer, printArrayInitializer],
    [CnxParser.RULE_templateType, printTemplateType],
  ],
);

/** Print every remaining child with nothing between them. */
function printConcatenated(cursor: ChildCursor): Doc {
  return cursor.takeRest().map((taken) => taken.doc);
}

function printRule(
  cursor: ChildCursor,
  node: TCstNode,
  ruleIndex: number,
): Doc {
  if (CONCATENATED_RULES.has(ruleIndex)) return printConcatenated(cursor);
  if (DELEGATING_RULES.has(ruleIndex)) return printConcatenated(cursor);
  if (BINARY_CHAIN_RULES.has(ruleIndex)) {
    return printBinaryChain(cursor, node);
  }
  if (COMMA_LIST_RULES.has(ruleIndex)) return printCommaList(cursor, node);

  const layout = RULE_LAYOUTS.get(ruleIndex);
  if (layout !== undefined) return layout(cursor);

  // Never silently pass text through: a formatter that guesses at an unknown
  // construct can mangle it. Refusing leaves the file untouched.
  throw new Error(
    `cnx formatter has no layout for grammar rule '${Cst.ruleNameOf(node) ?? ruleIndex}'`,
  );
}

function printNode(
  path: TPath,
  _options: ParserOptions<TCstNode>,
  printChildNode: TPrintFn,
): Doc {
  const node = path.node;
  if (Cst.isTerminal(node)) return printTerminal(node);

  const ruleIndex = Cst.ruleIndexOf(node);
  if (ruleIndex === null) return "";

  const cursor = ChildCursor.over(node, (index) => {
    const contextPath = path as AstPath<ParserRuleContext>;
    return contextPath.call(
      (childPath) => printChildNode(childPath as TPath),
      "children",
      index,
    );
  });
  const result = printRule(cursor, node, ruleIndex);

  if (!cursor.done()) {
    // A layout that leaves children behind has dropped their text and any
    // comments anchored to them. Fail loudly rather than emit a lossy file.
    throw new Error(
      `cnx formatter left ${cursor.remaining()} child node(s) unprinted in rule '${Cst.ruleNameOf(node) ?? ruleIndex}'`,
    );
  }
  return result;
}

class CnxPrinter {
  /** Prettier's printer entry point. */
  static print(
    path: TPath,
    options: ParserOptions<TCstNode>,
    printChildNode: TPrintFn,
  ): Doc {
    return printNode(path, options, printChildNode);
  }

  /**
   * Every grammar rule index this printer can lay out.
   *
   * Derived from the dispatcher, never hand-listed: a hand-listed copy is the
   * same second model of the grammar that let the previous plugin rot.
   * @public the grammar list rule-coverage.test.ts enumerates; a hand-listed copy would be a second list
   */
  static handledRuleIndices(): Set<number> {
    return new Set<number>([
      ...CONCATENATED_RULES,
      ...DELEGATING_RULES,
      ...BINARY_CHAIN_RULES,
      ...COMMA_LIST_RULES,
      ...RULE_LAYOUTS.keys(),
    ]);
  }
}

export default CnxPrinter;
