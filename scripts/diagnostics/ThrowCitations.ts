/**
 * Issue #1365: the throw classification cites every site by `file:line`, and a
 * line number decays silently.
 *
 * `docs/architecture/throw-classification.md` (#1321) is the input that
 * splits #1322. It names every throw site in `output/` by file and
 * line. #1362 committed it with correct citations; #1363 then added 62 lines to
 * `TypeValidator.ts`, and 64 of the 180 citations silently began pointing at a
 * docstring or a closing brace. Each pull request was green on its own -- one
 * never looked at the doc, the other ran before the code change existed -- and
 * `main` is unprotected (#1344), so nothing evaluated the pair.
 *
 * A line number cannot be replaced by the message text: `Error: 'this' can only
 * be used inside a scope` is thrown from nine distinct sites, so message text
 * does not identify one. `file:line` is the only unique key, which is why this
 * gate verifies it rather than the doc trading it for something softer.
 *
 * Five invariants, all mechanical:
 *
 *   1. every cited `file:line` is exactly a line opening a throw statement
 *   2. every throw under `src/` is cited exactly once (`output/` until #1531)
 *   3. every row's anchor is a substring of what the throw at its line says
 *   4. no two rows in one file could trade line numbers and keep 3 holding
 *   5. a `file:line` written in PROSE lands on a throw too
 *
 * The second is the one that earns its keep beyond drift: it fails when a new
 * throw is added and nobody classifies it, which is how `output/` grows a
 * rejection the Plan/Render boundary has not accounted for.
 *
 * The third is #1374. Two rows can trade line numbers within a file and the
 * first two invariants still hold -- each cited line is a throw, each throw
 * is cited once -- while both rows now describe the other's site, which is
 * exactly what #1322's delete-and-relocate work produces. So each row also
 * carries an anchor: a verbatim substring of the throw's argument, at least
 * `MIN_ANCHOR_LENGTH` characters, which the gate holds to the statement at
 * the cited line. The line stays the key and the anchor corroborates it:
 * identically-messaged sites keep identical anchors and stay interchangeable,
 * because the source makes no distinction between them either.
 *
 * The fourth is what makes the third a gate rather than an audit. An anchor
 * that clears the floor can still stop just short of the text that tells two
 * different throws apart, and then both rows corroborate both sites. Whether
 * a pair could trade is directly computable from the rows of a file, so it
 * is computed -- the #1374 review found three such pairs by hand; this finds
 * them mechanically, and the next ones #1322 adds.
 *
 * The fifth is #1322, and it exists because the asymmetry was measurable: the
 * 181 gated rows were at 0% drift while 14 of 59 PROSE citations had rotted,
 * each short by the same few lines an intervening edit had added. The rows were
 * accurate because something checked them; the prose was not because nothing
 * did. That mattered beyond tidiness -- the tier tables and the split that
 * sizes #1322's phases are prose, and the claim "only 2 of 181 sites emit a
 * real position" (the true figure is 20, with 12 more computing a position and
 * spending it on text) is what tier A was scoped from.
 */

import LineMap from "./LineMap";
import type IRevision from "./IRevision";
import type ICheckOutcome from "../types/ICheckOutcome";

/**
 * Below this an anchor stops telling sites apart -- `Error` or `'` would
 * corroborate every row in the document, the #1143 shape.
 */
const MIN_ANCHOR_LENGTH = 8;

/**
 * A cited path: what a row's first cell, and a remapped `file:line`, may spell.
 *
 * #1531: one definition, read by all four patterns below. Four copies of this
 * class sat in this file, and none allowed `-` -- harmless while every path was
 * `codegen/...`, and silent once the corpus reached `1-Discover/` and
 * `4-Resolve/`: a row citing one was not read at all, so its throw reported as
 * unclassified beside the row that classified it. `-` is last so it is literal.
 */
const CITED_PATH = String.raw`[A-Za-z0-9_/….-]+\.ts`;

/** The start of a citation row, `| \`path.ts:N\``. */
const CITATION_ROW = new RegExp(String.raw`^\| \`${CITED_PATH}:\d+\``);

/** Prefix on a prose-citation error, naming the line OF THE DOCUMENT. */
const DOC_LINE_LABEL = "throw-classification.md:";

interface IThrowCitation {
  readonly path: string;
  readonly line: number;
  /** The second cell, when it is a lone code span; null when it is not. */
  readonly anchor: string | null;
}

/** A row whose line holds a throw and whose anchor cleared the floor. */
interface IAnchoredRow {
  readonly line: number;
  readonly anchor: string;
  readonly argument: string;
}

interface IRemapOutcome {
  readonly markdown: string;
  readonly rewritten: number;
  /** Files this refused to touch, and why. Non-empty means do not write. */
  readonly refusals: readonly string[];
}

class ThrowCitations {
  /**
   * Rewrite every `file:line` in the document against a previous revision.
   *
   * #1518. The header of `scripts/throw-citations.ts` used to say there could
   * be no write mode, because "a fixer would have to guess which throw a stale
   * citation meant, and nine sites share a message". That objection is about a
   * fixer reading the DOCUMENT ALONE, and it is correct about one. This reads
   * the previous revision as well, where no guessing is required: when a file's
   * `throw new` COUNT is unchanged, the Nth throw then is the Nth throw now,
   * because nothing was added or removed to renumber them against.
   *
   * It REFUSES per file when that count changes. That is exactly the case the
   * original objection describes -- a site appeared or vanished, and which row
   * means which is a judgement about content, not arithmetic. Refusing there is
   * what makes the rest safe to automate.
   *
   * Prose references to non-throw lines are remapped too, through `LineMap`,
   * which declines any line it cannot place. An unmapped line is left exactly
   * as written: visibly stale beats plausibly wrong, because the gate goes
   * green on plausibly wrong.
   *
   * #1531: keyed by repo path, and every cited path resolved against the
   * whole corpus. It was keyed by basename, which was safe while the corpus was
   * one directory and is not across `src/`: `utils/TypeResolver.ts` and
   * `codegen/TypeResolver.ts` would share a key, and resolving a cited path
   * against the changed files alone falls back to the basename and picks the
   * wrong one. `resolve` against every file is the same question `check` asks.
   *
   * @param revisions repo path -> that file's previous and current text
   * @param files every file in the corpus, which a cited path resolves against
   */
  static remap(
    markdown: string,
    revisions: ReadonlyMap<string, IRevision>,
    files: readonly string[],
  ): IRemapOutcome {
    const maps = new Map<string, ReadonlyMap<number, number>>();
    const refusals: string[] = [];

    for (const [path, revision] of revisions) {
      const before = ThrowCitations.throwLines(revision.previous);
      const after = ThrowCitations.throwLines(revision.current);
      if (before.length !== after.length) {
        // #1322 folded the anchor fallback in here rather than shipping a
        // second fixer beside this one. The objection this method's header
        // records -- "which row means which is not arithmetic" -- is exactly
        // right about ORDINALS, and #1374 is what changed the inputs: every row
        // now carries an ANCHOR, a verbatim substring of what its throw says.
        // Where an anchor identifies one throw there is still nothing to guess.
        //
        // It matters because a count change is not an edge case for this card:
        // #1322 deletes 23 sites and relocates 145, so refusing on count change
        // refuses on every commit it will make.
        //
        // Rows only. Prose in such a file keeps no mapping and is reported,
        // because prose carries no anchor and there is nothing to re-find it by.
        const [anchored, unplaced] = ThrowCitations.anchorPairs(
          markdown,
          path,
          files,
          revision.current,
        );
        if (anchored.size > 0) {
          maps.set(path, anchored);
        }
        refusals.push(
          ...unplaced.map(
            (why) =>
              `${path}: \`throw new\` count changed ${before.length} -> ${after.length}; ${why}`,
          ),
        );
        continue;
      }

      // Line mapping first, then the throw pairs OVER it. Where they disagree
      // the throw pairing wins: it is exact by construction, while the line map
      // is a best alignment and a throw may sit inside a region it declined.
      const map = new Map(
        LineMap.build(
          revision.previous.split("\n"),
          revision.current.split("\n"),
        ),
      );
      for (const [index, oldLine] of before.entries()) {
        map.set(oldLine, after[index]);
      }
      maps.set(path, map);
    }

    let rewritten = 0;
    const updated = markdown.replace(
      new RegExp(String.raw`(${CITED_PATH}):(\d+)`, "g"),
      (whole, cited: string, digits: string) => {
        const file = ThrowCitations.resolve(cited, files);
        const mapped =
          file === null
            ? undefined
            : maps.get(file)?.get(Number.parseInt(digits, 10));
        if (mapped === undefined) return whole;
        rewritten += 1;
        return `${cited}:${mapped}`;
      },
    );

    return { markdown: updated, rewritten, refusals };
  }

  /**
   * Old line -> new line for the rows of one file, matched by ANCHOR.
   *
   * Used when a file's throw count changed, so the ordinal pairing above cannot
   * apply. Returns the pairs it is certain of, and a reason for every row it is
   * not: a row whose anchor matches nothing, matches several throws its
   * siblings do not account for, or carries no anchor at all.
   *
   * A group of N rows sharing an anchor pairs in ascending order against N
   * candidates. That is a derivation, not a guess -- an edit elsewhere in the
   * file shifts every survivor and cannot reorder them -- and its precondition
   * is the equal counts. Unequal means one of the group was deleted and nothing
   * says which, so the whole group is refused rather than silently shifted.
   */
  static anchorPairs(
    markdown: string,
    file: string,
    files: readonly string[],
    current: string,
  ): [Map<number, number>, string[]] {
    const rows = ThrowCitations.parse(markdown).filter(
      (row) => ThrowCitations.resolve(row.path, files) === file,
    );
    const byAnchor = new Map<string, IThrowCitation[]>();
    const pairs = new Map<number, number>();
    const unplaced: string[] = [];

    // File-level ordinal pairing, tried first. When the document holds exactly
    // as many rows for a file as the file now has throws, the two lists are the
    // same sites in the same order: a deletion removes a row AND its throw, and
    // nothing an edit can do reorders the survivors.
    //
    // This is the same argument #1518 makes between two REVISIONS, applied
    // between the document and the source -- which is what lets it work when a
    // count changed, because the row count changed with it. It also avoids
    // per-anchor whack-a-mole in files like `PostfixExpressionGenerator`, where
    // a dozen messages differ only in an interpolated name and every anchor is
    // one edit away from matching its neighbor.
    const throwsNow = ThrowCitations.throwLines(current);
    if (rows.length === throwsNow.length && rows.length > 0) {
      const cited = rows.map((row) => row.line).sort((a, b) => a - b);
      const actual = [...throwsNow].sort((a, b) => a - b);
      cited.forEach((line, index) => pairs.set(line, actual[index]));
      return [pairs, unplaced];
    }

    for (const row of rows) {
      if (row.anchor === null) {
        unplaced.push(`row at :${row.line} carries no anchor to re-find it by`);
        continue;
      }
      byAnchor.set(row.anchor, [...(byAnchor.get(row.anchor) ?? []), row]);
    }

    for (const [anchor, group] of byAnchor) {
      const candidates = ThrowCitations.throwLines(current).filter((line) => {
        const argument = ThrowCitations.throwArgument(current, line);
        return argument !== null && argument.includes(anchor);
      });
      if (candidates.length === group.length) {
        const stale = group.map((row) => row.line).sort((a, b) => a - b);
        const targets = [...candidates].sort((a, b) => a - b);
        stale.forEach((line, index) => pairs.set(line, targets[index]));
        continue;
      }
      unplaced.push(
        `anchor \`${anchor}\` names ${group.length} row(s) and matches ` +
          `${candidates.length} throw(s), so the group does not pair`,
      );
    }
    return [pairs, unplaced];
  }

  /**
   * A citation is the first cell of a table row, `| \`Path.ts:123\` |`, and
   * its anchor is the second cell when that cell is nothing but a code span,
   * `| \`what the throw says\` |`.
   *
   * Anchored to the row start so prose mentioning a `file:line` elsewhere in
   * the document is not treated as a claim this gate has to defend. The
   * anchor cell must be the whole cell: prose that merely opens with a code
   * span is not an anchor, so the pre-#1374 row shape reads as anchor-less
   * rather than as a wrong anchor.
   */
  static parse(markdown: string): IThrowCitation[] {
    const pattern = new RegExp(
      String.raw`^\| \`(${CITED_PATH}):(\d+)\`\s*\|(?:\s*\`([^\`|]+)\`\s*\|)?`,
      "gm",
    );
    const found: IThrowCitation[] = [];
    let match = pattern.exec(markdown);
    while (match !== null) {
      found.push({
        path: match[1],
        line: Number.parseInt(match[2], 10),
        anchor: match[3] === undefined ? null : match[3].replace(/\s+/g, " "),
      });
      match = pattern.exec(markdown);
    }
    return found;
  }

  /**
   * 1-based line numbers of every throw STATEMENT in a source file.
   *
   * A raw substring test would count a comment or a string literal that merely
   * mentions `throw new`, and invariant 2 would then demand a classification
   * row for it -- pushing an author into corrupting the document this gate
   * exists to protect. That is not hypothetical here: five bucket-2 sites carry
   * an in-file comment whose subject is throwing.
   *
   * So the match is structural: the throw must OPEN the statement rather than
   * merely appear on the line.
   *
   * #1322: this used to require the literal spelling `throw new`, on a comment
   * that said "every site in `output/` is a bare `throw new` statement,
   * verified". That was false, and the gate could not report it -- a site it
   * does not count is also a site invariant 2 never demands a row for, so the
   * hole was silent in both directions. `CodeGenErrors` builds its Errors with
   * `return new Error(...)` and callers write `throw CodeGenErrors.x(...)`,
   * hiding three production sites, one of them `SubscriptDepthValidator.ts:95`
   * -- E0856, registered in `docs/error-codes.md` and asserted by two fixtures.
   * A user-facing diagnostic the classifier cannot see is one #1322 cannot
   * relocate.
   *
   * A factory call must open an argument list to count. That is what keeps a
   * bare rethrow (`throw err;`) out: it carries no message, so there is nothing
   * for an anchor to corroborate and no diagnostic to classify. `throw new` is
   * still counted without one, so `throw new Error;` keeps reaching
   * `throwArgument`'s null path rather than vanishing from the corpus.
   */
  private static readonly THROW_STATEMENT =
    /^throw\s+(?:new\b|[A-Za-z_$][\w$.]*\s*\()/;

  static throwLines(source: string): number[] {
    return source
      .split("\n")
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter((entry) => ThrowCitations.THROW_STATEMENT.test(entry.text))
      .map((entry) => entry.line);
  }

  /**
   * What the throw statement starting at `line` (1-based) says: its text from
   * that line to the first line ending in `;`, comment lines dropped,
   * whitespace collapsed, with the `throw new Ctor(` opener removed.
   *
   * The opener is scaffolding every site shares, so an anchor drawn from it
   * would corroborate every row; removing it is what makes `Error(` an
   * invalid anchor rather than a universally true one. 155 of the 181 sites
   * span several lines, so the anchor is held to the statement, not the line.
   *
   * Returns null when the statement opens no argument list at all. A strip
   * that silently did nothing would hand the opener back as text, and
   * `new Ctor(` would become the universally-true anchor the strip exists to
   * prevent -- so the miss is reported, not absorbed.
   */
  static throwArgument(source: string, line: number): string | null {
    const lines = source.split("\n");
    const collected: string[] = [];
    for (let index = line - 1; index < lines.length; index += 1) {
      const text = lines[index].trim();
      // A comment is not what the throw says, and one ending in `;` must
      // not end the scan early -- the hazard throwLines guards against.
      if (text.startsWith("//")) {
        continue;
      }
      collected.push(text);
      if (text.endsWith(";")) {
        break;
      }
    }
    const statement = collected.join(" ").replace(/\s+/g, " ");
    // `[^(]*` admits any constructor or factory expression -- dotted, generic
    // -- up to its argument list: the same breadth throwLines counts. `new` is
    // optional because a throw may name a factory instead (#1322); without the
    // strip, `CodeGenErrors.tooManySubscripts(` would be a valid anchor for
    // every site sharing that factory, which is the universally-true anchor
    // this strip exists to prevent.
    const opener = /^throw\s+(?:new\b)?[^(]*\(\s*/.exec(statement);
    return opener === null ? null : statement.slice(opener[0].length);
  }

  /**
   * The count each `## Bucket N — … (C)` heading declares, paired with the
   * citation rows beneath it.
   *
   * #1365 is a number in this document going stale with nothing noticing. The
   * bucket headings, the total, and the by-area table are the same kind of
   * claim as a citation, so they are held to the corpus the same way -- adding
   * a throw and its row must not leave a heading reading the old count.
   */
  static bucketCounts(
    markdown: string,
  ): Array<{ heading: string; declared: number; rows: number }> {
    // Headings nest: `## Bucket 1 — … (144)` contains `### <area> — 39`
    // subsections whose rows belong to both. A section therefore accumulates
    // rows until the next heading of the SAME OR HIGHER level, not until the
    // next heading of any level.
    const open: Array<{
      level: number;
      heading: string;
      declared: number;
      rows: number;
    }> = [];
    const closed: Array<{ heading: string; declared: number; rows: number }> =
      [];

    const close = (level: number): void => {
      while (open.length > 0 && open.at(-1)!.level >= level) {
        closed.push(open.pop()!);
      }
    };

    for (const line of markdown.split("\n")) {
      const heading = /^(#{2,6}) (.*)$/.exec(line);
      if (heading !== null) {
        const level = heading[1].length;
        close(level);
        // A count is declared either as `(144)` or as a trailing `— 39`.
        const declared = /\((\d+)\)\s*$|[—-]\s*(\d+)\s*$/.exec(heading[2]);
        if (declared !== null) {
          open.push({
            level,
            heading: line.trim(),
            declared: Number.parseInt(declared[1] ?? declared[2], 10),
            rows: 0,
          });
        }
        continue;
      }
      if (CITATION_ROW.test(line)) {
        for (const section of open) {
          section.rows += 1;
        }
      }
    }
    close(0);
    return closed;
  }

  /**
   * Resolve a cited path against the real files.
   *
   * The document abbreviates: a row may read `codegen/CodeGenerator.ts` or
   * `…/PostfixExpressionGenerator.ts`. Suffix match first, then basename. An
   * ambiguous basename returns null rather than picking one, because guessing
   * would let the gate pass while checking the wrong file.
   */
  static resolve(citedPath: string, files: readonly string[]): string | null {
    const normalized = citedPath.replace(/…\//g, "").replace(/^\/+/, "");
    const bySuffix = files.filter((file) => file.endsWith(`/${normalized}`));
    if (bySuffix.length === 1) {
      return bySuffix[0];
    }
    const base = normalized.split("/").at(-1);
    const byBase = files.filter((file) => file.split("/").at(-1) === base);
    return byBase.length === 1 ? byBase[0] : null;
  }

  /**
   * @param cited citation list from the document
   * @param sources the corpus `ThrowSources.read` returns, path to contents
   */
  static check(
    markdown: string,
    sources: ReadonlyMap<string, string>,
  ): ICheckOutcome {
    // Citations are parsed here rather than passed in: they are derived from
    // this same markdown, and two parameters that must agree is one more thing
    // a caller can get wrong.
    const cited = ThrowCitations.parse(markdown);
    const files = [...sources.keys()];
    const errors: string[] = [];
    const rowsByFile = new Map<string, IThrowCitation[]>();

    for (const citation of cited) {
      const file = ThrowCitations.resolve(citation.path, files);
      if (file === null) {
        errors.push(
          `${citation.path}:${citation.line} -- no single file matches this path`,
        );
        continue;
      }
      errors.push(
        ...ThrowCitations.checkCitation(citation, sources.get(file)!),
      );
      rowsByFile.set(file, [...(rowsByFile.get(file) ?? []), citation]);
    }

    let total = 0;
    const throwsByFile = new Map<string, number>();
    for (const [file, source] of sources) {
      const actual = ThrowCitations.throwLines(source);
      total += actual.length;
      throwsByFile.set(file, actual.length);
      const rows = rowsByFile.get(file) ?? [];
      const claimed = rows.map((row) => row.line);
      for (const line of actual) {
        if (!claimed.includes(line)) {
          errors.push(`${file}:${line} -- throw statement is not classified`);
        }
      }
      const duplicates = claimed.filter(
        (line, index) => claimed.indexOf(line) !== index,
      );
      for (const line of new Set(duplicates)) {
        errors.push(`${file}:${line} -- cited more than once`);
      }
      errors.push(...ThrowCitations.checkTradeable(file, rows, source));
    }

    errors.push(...ThrowCitations.checkProse(markdown, sources));
    errors.push(
      ...ThrowCitations.checkDeclaredCounts(
        markdown,
        cited.length,
        throwsByFile,
      ),
    );

    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${cited.length} citation(s) checked against ${total} throw site(s) in src/.`,
      ],
    };
  }

  /**
   * Invariant 5: a `file.ts:N` written in PROSE also lands on a throw.
   *
   * #1322. This gate used to defend table rows only, on the reasoning that
   * prose is not a claim it has to keep. The measurement says otherwise: the
   * 181 gated rows were at **0% drift**, and **14 of 59** prose citations had
   * rotted -- every one short by the same 4-6 lines some intervening edit
   * added, including a `4985-4767` that reads backwards. The rows were
   * accurate precisely because something checked them.
   *
   * That asymmetry is not cosmetic here. The tier tables and the `## Proposed
   * split` that sizes this card's phases are prose, so a stale prose citation
   * mis-sizes the work rather than merely misdirecting a reader -- and the
   * "only 2 of 181 sites emit a real position" claim, off by an order of
   * magnitude, is what tier A was scoped from.
   *
   * A row's own line is skipped: `checkCitation` already holds it to an anchor,
   * and reporting one drift twice adds nothing. The consequence of this
   * invariant is that the document may not cite a NON-throw line by number at
   * all -- name the file and the symbol instead. That is the intended
   * restriction: a symbol name does not move when a line does.
   */
  static checkProse(
    markdown: string,
    sources: ReadonlyMap<string, string>,
  ): string[] {
    const files = [...sources.keys()];
    const errors: string[] = [];
    markdown.split("\n").forEach((text, index) => {
      // A citation row is defended by invariants 1 and 3 already.
      if (CITATION_ROW.test(text)) return;
      // `Thing.ts:1`, `Thing.ts:1/2/3` and `Thing.ts:9-12` all appear in this
      // document; reading only the first number is how a drifted list passes.
      const pattern = /([A-Za-z0-9_]+\.ts):(\d+(?:[/-]\d+)*)/g;
      let match = pattern.exec(text);
      while (match !== null) {
        const where = `${DOC_LINE_LABEL}${index + 1}: ${match[1]}`;
        const lines = match[2].split(/[/-]/).map((n) => Number.parseInt(n, 10));
        const file = ThrowCitations.resolve(match[1], files);
        if (
          match[2].includes("-") &&
          lines.length === 2 &&
          lines[1] < lines[0]
        ) {
          errors.push(`${where}:${match[2]} -- prose cites a descending range`);
        } else if (file === null) {
          errors.push(`${where} -- prose names no single file under src/`);
        } else {
          const source = sources.get(file)!;
          const actual = ThrowCitations.throwLines(source);
          for (const line of lines) {
            if (!actual.includes(line)) {
              errors.push(
                `${where}:${line} -- prose cites a line that holds no throw`,
              );
            }
          }
        }
        match = pattern.exec(text);
      }
    });
    return errors;
  }

  /**
   * Invariants 1 and 3 for one citation whose file resolved: the cited line
   * holds a `throw new`, and the row's anchor is what that throw says.
   *
   * A line holding no throw has nothing to anchor against, so the anchor is
   * checked only where invariant 1 holds -- drift is reported once, naming
   * the nearest throw, not once per invariant.
   */
  static checkCitation(citation: IThrowCitation, source: string): string[] {
    const lines = ThrowCitations.throwLines(source);
    if (lines.includes(citation.line)) {
      return ThrowCitations.checkAnchor(citation, source);
    }
    const nearest = lines.reduce<number | null>(
      (best, line) =>
        best === null ||
        Math.abs(line - citation.line) < Math.abs(best - citation.line)
          ? line
          : best,
      null,
    );
    return [
      `${citation.path}:${citation.line} -- no \`throw new\` on that line` +
        (nearest === null ? "" : ` (nearest is :${nearest})`),
    ];
  }

  /**
   * Invariant 3: the row's anchor is a substring of what the throw at its
   * line says. Returns the errors for one citation whose line is known to
   * hold a throw.
   *
   * An anchor is required. Optional would leave every row #1322 adds without
   * one outside the swap check -- a gate that can be skipped silently is the
   * #1143 shape.
   */
  static checkAnchor(citation: IThrowCitation, source: string): string[] {
    const where = `${citation.path}:${citation.line}`;
    if (citation.anchor === null) {
      return [
        `${where} -- no anchor (the second cell must be a \`code span\` quoting the throw's argument)`,
      ];
    }
    if (citation.anchor.length < MIN_ANCHOR_LENGTH) {
      return [
        `${where} -- anchor \`${citation.anchor}\` is shorter than ${MIN_ANCHOR_LENGTH} characters`,
      ];
    }
    const argument = ThrowCitations.throwArgument(source, citation.line);
    if (argument === null) {
      return [
        `${where} -- unrecognized throw opener: no argument list to hold the anchor to`,
      ];
    }
    if (!argument.includes(citation.anchor)) {
      return [
        `${where} -- anchor \`${citation.anchor}\` not found in the throw at that line (it says: ${argument.slice(0, 80)})`,
      ];
    }
    return [];
  }

  /**
   * Invariant 4: no two rows in one file may be able to trade line numbers
   * undetected. A trade goes undetected exactly when each row's anchor is
   * also a substring of the other row's throw, so that is what is tested --
   * a mutual-substring check over a file's rows -- rather than a length
   * floor standing in for it with a hand audit behind that. The #1374 review
   * found three pairs the audit had missed; this check finds them.
   *
   * Throws with identical text are exempt: the source makes no distinction
   * between them, so a row cannot either, and their rows are interchangeable
   * by design. Rows already carrying an error -- no anchor, below the floor,
   * a line holding no throw, an anchor its own line does not contain -- are
   * left out: a trade invariant 3 caught is detected, not undetected.
   */
  static checkTradeable(
    file: string,
    rows: readonly IThrowCitation[],
    source: string,
  ): string[] {
    const throwsAt = new Set(ThrowCitations.throwLines(source));
    const anchored: IAnchoredRow[] = [];
    for (const row of rows) {
      if (
        row.anchor === null ||
        row.anchor.length < MIN_ANCHOR_LENGTH ||
        !throwsAt.has(row.line)
      ) {
        continue;
      }
      const argument = ThrowCitations.throwArgument(source, row.line);
      // A row whose anchor already fails on its own line was detected by
      // invariant 3; only rows that pass it can trade undetected.
      if (argument !== null && argument.includes(row.anchor)) {
        anchored.push({ line: row.line, anchor: row.anchor, argument });
      }
    }
    const errors: string[] = [];
    for (const [index, a] of anchored.entries()) {
      for (const b of anchored.slice(index + 1)) {
        if (ThrowCitations.canTrade(a, b)) {
          errors.push(
            `${file}:${a.line} and :${b.line} -- these rows could trade lines undetected; lengthen one anchor past the text both throws share`,
          );
        }
      }
    }
    return errors;
  }

  /** Both anchors match both throws, and the throws are not the same text. */
  private static canTrade(a: IAnchoredRow, b: IAnchoredRow): boolean {
    return (
      a.argument !== b.argument &&
      b.argument.includes(a.anchor) &&
      a.argument.includes(b.anchor)
    );
  }

  /**
   * Hold the document's self-describing numbers to its own rows.
   *
   * #1365 is a number here going stale with nothing noticing. A bucket heading,
   * the total, and the by-area table make the same kind of claim a citation
   * does, so adding a throw and its classification row must not be able to
   * leave any of them reading the old figure.
   *
   * #1531: every number now, not only the headings and the two totals. The
   * counts table's per-bucket rows and the by-area table's per-area rows were
   * read by nothing -- a bucket row could say 4 over a section of 3, and two
   * areas could trade counts with the sum intact, and the gate stayed green.
   *
   * @param throwsByFile the corpus's throw count per file, which an area row is
   *        held to
   */
  static checkDeclaredCounts(
    markdown: string,
    cited: number,
    throwsByFile: ReadonlyMap<string, number>,
  ): string[] {
    const errors: string[] = [];
    const sections = ThrowCitations.bucketCounts(markdown);

    // Sections nest, so their row counts deliberately overlap and are NOT
    // summed -- the total is held by the counts table and the by-area table
    // below, each against the citation count directly.
    for (const section of sections) {
      if (section.declared !== section.rows) {
        errors.push(
          `${section.heading} -- declares ${section.declared}, has ${section.rows} row(s)`,
        );
      }
    }

    const total = /^\|\s*\|\s*\*\*total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/m.exec(
      markdown,
    );
    if (total === null) {
      errors.push("counts table has no **total** row");
    } else if (Number.parseInt(total[1], 10) !== cited) {
      errors.push(
        `counts table total says ${total[1]}, document cites ${cited}`,
      );
    }

    errors.push(...ThrowCitations.checkBucketRows(markdown, sections));
    errors.push(...ThrowCitations.checkAreas(markdown, cited, throwsByFile));
    return errors;
  }

  /**
   * Each `| **N** | … | **C** |` row of the counts table, held to the rows
   * under `## Bucket N`. The heading's own `(C)` is held to the same rows
   * above, so the summary cannot disagree with the section it summarizes.
   *
   * Both directions, and read by a row's two ends (#1848 review). The first
   * version matched one three-cell shape and went from the table to the
   * sections only: a fourth column made every row vanish, and a bucket with no
   * row at all passed, so a change of table shape would have switched the
   * check off without a word.
   */
  private static checkBucketRows(
    markdown: string,
    sections: ReadonlyArray<{ heading: string; rows: number }>,
  ): string[] {
    const errors: string[] = [];
    const said = ThrowCitations.countsRows(markdown);
    const buckets = new Set<string>();
    for (const line of markdown.split("\n")) {
      const bucket = /^## Bucket (\d+)\b/.exec(line);
      if (bucket === null) continue;
      buckets.add(bucket[1]);
      const claims = said.get(bucket[1]) ?? [];
      const section = sections.find((s) => s.heading === line.trim());
      if (claims.length !== 1) {
        errors.push(
          `"## Bucket ${bucket[1]}" needs one counts-table row, and has ${claims.length}`,
        );
      } else if (section === undefined) {
        errors.push(`"${line.trim()}" declares no count to hold its rows to`);
      } else if (claims[0] !== section.rows) {
        errors.push(
          `counts table says bucket ${bucket[1]} holds ${claims[0]}, its section has ${section.rows} row(s)`,
        );
      }
    }
    for (const bucket of said.keys()) {
      if (!buckets.has(bucket)) {
        errors.push(
          `counts table names bucket ${bucket}, and no "## Bucket ${bucket}" heading declares it`,
        );
      }
    }
    return errors;
  }

  /**
   * The counts table's bucket rows, by bucket: any table row whose first cell
   * is `**N**` and whose last is `**C**`, however many cells sit between.
   */
  private static countsRows(markdown: string): Map<string, number[]> {
    const rows = new Map<string, number[]>();
    for (const line of markdown.split("\n")) {
      if (!line.startsWith("|")) continue;
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      const bucket = /^\*\*(\d+)\*\*$/.exec(cells[0] ?? "");
      const count = /^\*\*(\d+)\*\*$/.exec(cells.at(-1) ?? "");
      if (bucket === null || count === null || cells.length < 2) continue;
      rows.set(bucket[1], [
        ...(rows.get(bucket[1]) ?? []),
        Number.parseInt(count[1], 10),
      ]);
    }
    return rows;
  }

  /**
   * Each by-area row names a directory under `src/` in its first cell, and is
   * held to the throws the corpus has there. The sum is held to the citations
   * as well, so the rows must cover the corpus once: a throw in a directory no
   * row names, or two rows naming one directory, fails the sum.
   */
  private static checkAreas(
    markdown: string,
    cited: number,
    throwsByFile: ReadonlyMap<string, number>,
  ): string[] {
    const areas = [...markdown.matchAll(/^\| `([^`]+)`[^|]*\|\s*(\d+)\s*\|/gm)];
    if (areas.length === 0) {
      // #1848 review: an empty table switched this check off. With throws to
      // cite, a document with no area rows is missing one, like a total row.
      return cited > 0
        ? ["by-area table has no rows, and the document cites throws"]
        : [];
    }
    const errors: string[] = [];
    let summed = 0;
    for (const area of areas) {
      const prefix = area[1];
      const said = Number.parseInt(area[2], 10);
      summed += said;
      if (!prefix.startsWith("src/")) {
        errors.push(`by-area row \`${prefix}\` names no directory under src/`);
        continue;
      }
      let actual = 0;
      for (const [file, count] of throwsByFile) {
        if (file.startsWith(prefix)) actual += count;
      }
      if (actual !== said) {
        errors.push(
          `by-area row \`${prefix}\` says ${said}, and ${prefix} holds ${actual} throw site(s)`,
        );
      }
    }
    if (summed !== cited) {
      errors.push(`by-area table sums to ${summed}, document cites ${cited}`);
    }
    return errors;
  }
}

export default ThrowCitations;
