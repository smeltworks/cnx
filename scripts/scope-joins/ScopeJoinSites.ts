/**
 * Issue #1357: the committed inventory of scope-denoting `fromParts` sites.
 *
 * `QualifiedCName.fromParts(parts)` builds a qualified C name from a COMPLETE
 * path. Passing a scope's NAME as the first element claims a complete path while
 * supplying a leaf, which drops every outer scope -- the divergence #1285 removed
 * from the collectors and #1357 removes from everywhere else.
 *
 * The type system already rejects the honest mistake: no API takes a scope name,
 * so a caller must either thread the `IScopeSymbol` (correct) or write the leaf
 * into a `fromParts` array (this list). What is left is a call SHAPE, which no
 * import-level rule can see -- `fromParts` is legitimately used 38 times by
 * callers that really do hold a whole path.
 *
 * Keyed on a per-file COUNT rather than `file:line`. Two reasons, both learned
 * the expensive way: an eleven-site change silently invalidated eighteen
 * `file:line` citations in `throw-classification.md` through pure line
 * drift, and #1374 records that a citation gate cannot detect two rows trading
 * sites. A count cannot rot when code moves and still fails the moment the
 * residue grows -- which is the requirement, since #1348 moved the population
 * 61 -> 65 with nothing going red.
 */

import RegExpUtils from "../../src/cnx/utils/RegExpUtils";
import type ICheckOutcome from "../types/ICheckOutcome";

/** One distinct call shape in one file, and how many times it occurs there. */
interface ISite {
  readonly file: string;
  readonly element: string;
  readonly count: number;
}

/**
 * What kind of join a site performs. An ORDERED partition, not a set of labels:
 * the descriptions overlap (a site can be built from source text AND read a
 * leaf-keyed map), so a site takes the FIRST kind that applies, in the order
 * declared here.
 *
 * Nothing APPLIES this -- no code picks a kind; the ordering is an instruction
 * to the human writing the row. But it is no longer stated twice: `TKind` is
 * derived from `KIND_SECTIONS`, and `render` emits the preamble bullets from
 * the same array, so the union and the document cannot disagree about
 * precedence. They did disagree once, in opposite directions, and the
 * preamble's order is what decides a site that several descriptions fit. The
 * worked example lives in `render()` ONLY, and deliberately: it used to be
 * stated here as well, the two copies disagreed the moment one row was
 * re-argued, and `scope-joins:check` cannot see prose. Reordering the array
 * moves the union and the document together, and a reorder that touches only
 * one is unrepresentable.
 *
 * A kind is an ARGUMENT, not a label: an entry has to be re-argued when the
 * collection it names is re-measured, which is why each row carries a `why`.
 */
const KIND_SECTIONS = [
  {
    kind: "encoder",
    lines: [
      "- **encoder** -- inside `ScopeUtils` itself, where joining an enclosing path",
      "  to a leaf IS the definition of the operation every other row is judged",
      "  against. #1298 made these visible: the enclosing path used to arrive as a",
      "  spread of a chain walk, which the scan could not see, and is now a named",
      "  `scopePath`. The path is complete by construction rather than a leaf",
      "  standing in for one, so there is nothing here to convert.",
    ],
  },
  {
    kind: "via-scope-utils",
    lines: [
      "- **via-scope-utils** -- already routed correctly, and matched only because",
      "  the enclosing block mentions a scope.",
    ],
  },
  {
    kind: "leaf-keyed",
    lines: [
      "- **leaf-keyed** -- paired with a collection filed under a leaf-built key.",
      "  Converting one side alone breaks the pairing, so the row names the",
      "  collection and the card that must move both.",
    ],
  },
  {
    kind: "path",
    lines: [
      "- **path** -- the first element is source text from a parse-tree identifier",
      "  chain. `ids[0]` in `Scope.REG.MEMBER` is what the author wrote, so joining",
      "  it rebuilds a lookup KEY rather than qualifying a member by its declaring",
      "  scope. Under nesting the author writes more components and the INDEXING",
      "  changes, not the join. `fromParts` documents this as its remaining use.",
    ],
  },
] as const;

type TKind = (typeof KIND_SECTIONS)[number]["kind"];

/** A reviewed judgement about one call shape. */
interface IAdjudication {
  readonly file: string;
  readonly element: string;
  readonly kind: TKind;
  /** The collection whose keying this join must match, for `leaf-keyed`. */
  readonly pairedWith: string | null;
  /** The card that must move this site, or null when nothing needs to. */
  readonly movesWith: string | null;
  readonly why: string;
}

class ScopeJoinSites {
  /** The builder whose first element must be an outermost path component. */
  private static readonly CALL = "QualifiedCName.fromParts([";

  /**
   * Identifiers that name a scope rather than a complete path.
   *
   * Deliberately a name heuristic: the alternative is type-directed analysis of
   * every call site, and a name is what a reviewer reads anyway. A false
   * positive costs one baseline row, which is the cheap direction.
   *
   * SHAPE-matched, not a list of exact names. It was a list, and #1298 renamed
   * two of its six entries -- `currentScope` -> `currentScopePath`,
   * `declaringScope` -> `declaringScopePath` -- across ~45 sites. `\b` does not
   * match between `Scope` and `Path`, so both replacements became invisible to
   * this scan in the same commit that created them: the gate's contract is "this
   * list may shrink freely, it may not grow", and it could no longer see growth.
   *
   * The docblock here used to claim a false negative "is caught the next time the
   * expression is renamed to say what it holds". A rename is precisely what hid
   * them, so the claim was the opposite of true. Matching the shape removes the
   * assumption instead of restating it -- any `<prefix>Scope`, with an optional
   * `Path`/`Name` suffix, is counted however it is spelled.
   */
  private static readonly SCOPE_DENOTING =
    /\b\w*[Ss]cope(?:Path|Name)?\b|scope\.name/;

  /**
   * Routing through one of these is the CORRECT form, whatever the argument is
   * called.
   *
   * Two spellings, one operation. `QualifiedNameGenerator.forMember` is a
   * one-line delegate to `ScopeUtils.qualifyInScope` -- its own doc calls it
   * "the canonical spelling for `output/`", because `logic/` cannot import from
   * `output/` and so needs the other door. #1450 converted the 14 `output/`
   * sites that still used the `ScopeUtils` spelling, and this list is why that
   * conversion does not read as fourteen sites regressing INTO the population:
   * the exclusion is about whether a join went through the single encoder, not
   * about which of the encoder's two public names was typed.
   */
  private static readonly VIA_ENCODER: readonly string[] = [
    "ScopeUtils.",
    "QualifiedNameGenerator.forMember(",
  ];

  /**
   * The reviewed judgement for every site the scan finds.
   *
   * Keyed on (file, first element) rather than `file:line`, for the reason the
   * module docblock gives: line citations rot silently when code moves. An
   * element text moves WITH its call, and when it does change -- a rename, a
   * different expression -- the site becomes undeclared and the gate says so.
   * That is the intended behavior: the adjudication was made about a specific
   * expression, so a different expression has not been adjudicated.
   *
   * `check` fails on a site with no entry here and on an entry matching no site,
   * so this list can neither miss a site nor keep a stale judgement. Before this
   * existed, the committed document classified the POPULATION in prose and left
   * the reader to work out which row was which -- and both sites it described as
   * "moving with #1295" turned out not to: one reads a map that is never written
   * (#1394), the other reads `constValues`, which #1295 does not own.
   */
  private static readonly ADJUDICATIONS: readonly IAdjudication[] = [
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "symbol.scopePath",
      kind: "encoder",
      pairedWith: null,
      movesWith: null,
      why: "`getTranspiledCName` -- the single encoder. The symbol carries its whole enclosing path (#1298), so this joins a complete path to a leaf rather than standing a leaf in for one",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "scopePath",
      kind: "encoder",
      pairedWith: null,
      movesWith: null,
      why: "`qualifyPathInScope` -- the one implementation the converted sites route to; its parameter IS the enclosing path",
    },
    {
      file: "src/cnx/TRANSPILE/1-Analyze/helpers/CalleeNameResolver.ts",
      element: "resolvedName",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "callee chain `Scope.method()`; `resolvedName` is source text, and the `isScope` guard only confirms the author named a scope",
    },
  ];

  /**
   * The adjudication for a site, or undefined when it has not been reviewed.
   *
   * `verdicts` defaults to the committed table and is injectable so the unit
   * tests exercise the MECHANISM rather than today's twelve sites -- otherwise
   * every test would have to name a real file, and closing a site would redden
   * tests that are not about it.
   */
  private static adjudicationFor(
    file: string,
    element: string,
    verdicts: readonly IAdjudication[],
  ): IAdjudication | undefined {
    return verdicts.find((row) => row.file === file && row.element === element);
  }

  /**
   * `source` with comments removed.
   *
   * The scan is a text search, and in this codebase the text it looks for appears
   * in JSDoc constantly -- these calls are what the prose is ABOUT
   * (`ScopeUtils.ts` and `HeaderSymbolAdapter.ts` each carry one today). Counting
   * a sentence produces a baseline row for a file with no such site, and the only
   * way to green that is to record the phantom permanently. `ScopeUtils.ts` is
   * precisely the file that must never hold a row, so the phantom would read as
   * the encoder itself having regressed, with nothing saying it came from a
   * comment.
   *
   * String literals are the other theoretical vector; no call is spelled inside
   * one today, so they are deliberately not handled.
   */
  private static withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  /**
   * The first array element of each `fromParts([...])` call in `source`.
   *
   * Scans for the matching delimiter rather than matching a regex: several of
   * these calls span four lines and contain nested calls with their own commas.
   * @public test seam: scope-join-sites.test.ts pins the #1357 gate's call scanner through it
   */
  static firstElements(rawSource: string): readonly string[] {
    return ScopeJoinSites.calls(rawSource).map((call) => call.element);
  }

  /**
   * Every `fromParts([...])` call: its first element and where it sits.
   *
   * The position is what lets `isScopeDenoting` look at the ENCLOSING BLOCK. A
   * file-wide search for the guard would count
   * `PostfixExpressionGenerator`'s two `ctx.result` calls, which are guarded by
   * `knownRegisters.has` while an unrelated function in the same file happens to
   * call `isKnownScope(ctx.result)` -- three false positives out of nine on a
   * naive pass, which is the argument for scoping the search rather than
   * widening it.
   */
  static calls(rawSource: string): readonly { element: string; at: number }[] {
    const source = ScopeJoinSites.withoutComments(rawSource);
    const found: { element: string; at: number }[] = [];
    let from = 0;
    for (;;) {
      const at = source.indexOf(ScopeJoinSites.CALL, from);
      if (at < 0) {
        return found;
      }
      let depth = 0;
      let element = "";
      let i = at + ScopeJoinSites.CALL.length;
      for (; i < source.length; i++) {
        const c = source[i];
        if ("([{".includes(c)) {
          depth++;
        } else if (")]}".includes(c)) {
          if (depth === 0) {
            break;
          }
          depth--;
        } else if (c === "," && depth === 0) {
          break;
        }
        element += c;
      }
      found.push({ element: element.trim().replace(/\s+/g, " "), at });
      from = i + 1;
    }
  }

  /**
   * Is `element` proven to hold a scope name by a guard in its enclosing block?
   *
   * The committed document's criterion is "passes a scope's NAME as the first
   * element". A name heuristic cannot see `parts[0]`, `ids[0]` or
   * `identifierChain[0]` -- and nobody is going to rename those, so the module's
   * stated mitigation ("caught the next time the expression is renamed") never
   * fires for them. Six sites satisfied the document's criterion and went
   * uncounted, which would have let PR 3 report a zero baseline with live sites
   * remaining, and a zero licenses removing this gate.
   *
   * The window runs from the head of the enclosing block to the call, so the
   * predicate must guard THIS call rather than merely appear in the file.
   */
  private static guardedByScopePredicate(
    source: string,
    element: string,
    at: number,
  ): boolean {
    let depth = 0;
    let open = -1;
    for (let i = at; i >= 0; i--) {
      const c = source[i];
      if (c === "}") depth++;
      else if (c === "{") {
        if (depth === 0) {
          open = i;
          break;
        }
        depth--;
      }
    }
    if (open < 0) return false;
    // Back up over the block's header (`if (...)`) to the previous statement end.
    let start = 0;
    for (let i = open - 1; i >= 0; i--) {
      if (";}{".includes(source[i])) {
        start = i + 1;
        break;
      }
    }
    const window = source.slice(start, at);
    const escaped = RegExpUtils.escape(element);
    return new RegExp(`\\bis(?:Known)?Scope\\(\\s*${escaped}\\s*[),]`).test(
      window,
    );
  }

  /** Does this first element name a scope instead of an outermost component? */
  static isScopeDenoting(element: string): boolean {
    if (ScopeJoinSites.VIA_ENCODER.some((door) => element.includes(door))) {
      return false;
    }
    return ScopeJoinSites.SCOPE_DENOTING.test(element);
  }

  /** Every counted call in `source`, as first-element texts. */
  private static countedElements(source: string): readonly string[] {
    const stripped = ScopeJoinSites.withoutComments(source);
    return ScopeJoinSites.calls(source)
      .filter(
        (call) =>
          ScopeJoinSites.isScopeDenoting(call.element) ||
          ScopeJoinSites.guardedByScopePredicate(
            stripped,
            call.element,
            call.at,
          ),
      )
      .map((call) => call.element);
  }

  /**
   * Distinct (file, first element) sites with their occurrence counts.
   *
   * Two calls in one file can share an element text -- `AssignmentClassifier`
   * has `scopeName` twice, in different methods. They collapse to one row on
   * purpose: an adjudication is about what the expression IS, and identical text
   * in one file is the same judgement. A row's count still fails the gate if it
   * grows, so the collapse cannot hide a new site.
   */
  static sites(sources: ReadonlyMap<string, string>): readonly ISite[] {
    const rows: ISite[] = [];
    for (const [file, source] of sources) {
      const tally = new Map<string, number>();
      for (const element of ScopeJoinSites.countedElements(source)) {
        tally.set(element, (tally.get(element) ?? 0) + 1);
      }
      for (const [element, count] of tally) {
        rows.push({ file, element, count });
      }
    }
    return rows.sort(
      (a, b) =>
        a.file.localeCompare(b.file) || a.element.localeCompare(b.element),
    );
  }

  /**
   * The totals both `render` and `check` report.
   *
   * Shared rather than computed twice: the two must agree, and jscpd caught the
   * copy the moment it existed.
   */
  private static summarize(
    sites: readonly ISite[],
    verdicts: readonly IAdjudication[],
  ): { total: number; files: number; moving: readonly ISite[] } {
    return {
      total: sites.reduce((sum, row) => sum + row.count, 0),
      files: new Set(sites.map((row) => row.file)).size,
      moving: sites.filter(
        (row) =>
          ScopeJoinSites.adjudicationFor(row.file, row.element, verdicts)
            ?.movesWith,
      ),
    };
  }

  /** The committed document body. No timestamp: it would churn every run. */
  static render(
    sites: readonly ISite[],
    verdicts: readonly IAdjudication[] = ScopeJoinSites.ADJUDICATIONS,
  ): string {
    const { total, files, moving } = ScopeJoinSites.summarize(sites, verdicts);
    const lines = [
      "# Scope-denoting `fromParts` sites",
      "",
      "<!-- Generated by `npm run scope-joins`. Do not edit by hand. -->",
      "",
      "Issue #1357. Each row is one call shape in one file: the first element",
      "reads as a scope, or a nearby `isScope` guard proves it is one.",
      "",
      "**A row is not by itself a defect.** The population that WAS one -- a",
      "scope's leaf name standing in for a complete path, correct only while",
      "`scopeMember` admits no `scopeDeclaration` (`grammar/Cnx.g4`) -- has been",
      "converted to `ScopeUtils.qualifyInScope`, which takes the whole",
      "enclosing PATH. Every row below carries the judgement that was made",
      "about it, so no reader has to re-derive which is which:",
      "",
      ...KIND_SECTIONS.flatMap((section) => section.lines),
      "",
      "They overlap as descriptions -- a site can be built from source text AND",
      "read a leaf-keyed map -- so a site takes the FIRST kind above that applies,",
      "which makes them a partition rather than labels. **Nothing computes this.**",
      "The order is an instruction to whoever writes the row. The worked example",
      "was the old symbol collector index's `scopeName`, deleted with 1.3's const pass (#1664",
      "box 7): source text from a parse-tree identifier, so `path` by description,",
      "though it was long filed as `leaf-keyed` on the grounds that it was paired",
      "with a collection. #1295 argued that the pairing did not exist -- the",
      "collection's key went through `fromParts`, which splits dotted paths -- so",
      "it was `path` on that argument.",
      "",
      "This list may shrink freely. It may not grow: `npm run scope-joins:check`",
      "fails on a file that gains a site, on a call shape nobody has adjudicated,",
      "and on a judgement that no longer matches any site. So the population cannot",
      "drift upward unnoticed the way it did when #1348 moved it 61 to 65, and a",
      "judgement cannot outlive the code it was made about. A new row is a prompt",
      "to adjudicate, not proof of a bug -- but it must be adjudicated before it",
      "lands.",
      "",
      "| File | First element | Sites | Kind | Moves with |",
      "| --- | --- | --- | --- | --- |",
      ...sites.map((row) => {
        const verdict = ScopeJoinSites.adjudicationFor(
          row.file,
          row.element,
          verdicts,
        );
        const kind = verdict?.kind ?? "**UNADJUDICATED**";
        const moves = verdict?.movesWith ?? "--";
        return `| \`${row.file}\` | \`${row.element}\` | ${row.count} | ${kind} | ${moves} |`;
      }),
      `| **total** | | **${total}** | | |`,
      "",
      `${total} site(s) across ${files} file(s).`,
      "",
      "## What must move, and with what",
      "",
    ];
    if (moving.length === 0) {
      lines.push(
        "Nothing. Every remaining site is adjudicated as needing no change.",
        "",
      );
    } else {
      lines.push(
        "The checklist for whoever re-keys these collections. Each row is a call",
        "shape that must change in the SAME commit as its collection's keying --",
        "a key built one way against a map filed another returns empty, which",
        'reads as "no such symbol" rather than "wrong question" (#1139).',
        "",
        "| Site | Paired with | Moves with | Why |",
        "| --- | --- | --- | --- |",
      );
      for (const row of moving) {
        const verdict = ScopeJoinSites.adjudicationFor(
          row.file,
          row.element,
          verdicts,
        )!;
        lines.push(
          `| \`${row.file}\` (\`${row.element}\`) | \`${verdict.pairedWith}\` | ${verdict.movesWith} | ${verdict.why} |`,
        );
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  /**
   * Everything `check` mode concluded, as a value.
   *
   * Was `check(committed, sites, verdicts)` with the missing-file branch and the
   * stale-vs-errors ordering left in the CLI's `main()`, where no test could
   * reach either. `diagnostic-manifest.ts` had already settled the shape --
   * "both modes decide in DiagnosticManifest and only print here, so the
   * ordering ... is reachable from a test rather than buried in a CLI entry
   * point" -- and #1317 copied THIS script instead, reproducing the gap and then
   * diverging from it: the two spelled the ordering opposite ways and both
   * exited 1, so nothing could fail on the difference. Brought onto the sibling's
   * shape so there is one generator pattern rather than two.
   *
   * `committedDocument` is nullable: a missing document is a decision here, not
   * an `existsSync` branch in the CLI.
   *
   * Behavior is unchanged -- same three outcomes, same messages, same exit
   * codes. `verdicts` stays injectable so the existing tests exercise the
   * MECHANISM rather than today's twelve sites.
   */
  static checkOutcome(
    committedDocument: string | null,
    sites: readonly ISite[],
    freshDocument: string,
    verdicts: readonly IAdjudication[] = ScopeJoinSites.ADJUDICATIONS,
  ): ICheckOutcome {
    const siteErrors: string[] = [];

    if (committedDocument === null) {
      return {
        ok: false,
        errors: [
          "docs/architecture/scope-join-sites.md is missing. Run `npm run scope-joins`.",
        ],
        info: [],
      };
    }
    const committed = committedDocument;

    // Tolerant of padding: the committed document is Prettier-formatted, which
    // pads table cells to a common width. A parser requiring single spaces
    // fails against the very file the generator just wrote.
    const expected = new Map<string, number>();
    for (const match of committed.matchAll(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|/gm,
    )) {
      expected.set(`${match[1]}\u0000${match[2]}`, Number(match[3]));
    }
    const actual = new Map(
      sites.map((row) => [`${row.file}\u0000${row.element}`, row.count]),
    );

    for (const [key, n] of actual) {
      const [file, element] = key.split("\u0000");
      const was = expected.get(key);
      if (was === undefined) {
        siteErrors.push(
          `${file}: new scope-denoting call shape \`${element}\` (${n} site(s))`,
        );
      } else if (n > was) {
        siteErrors.push(
          `${file}: \`${element}\` grew from ${was} to ${n} site(s)`,
        );
      }
    }
    for (const [key, was] of expected) {
      const [file, element] = key.split("\u0000");
      const now = actual.get(key) ?? 0;
      if (now < was) {
        siteErrors.push(
          `${file}: \`${element}\` down from ${was} to ${now} -- run ` +
            "`npm run scope-joins` AND update its `ADJUDICATIONS` entry: drop " +
            "it if the site is gone, re-key it if the expression was renamed. " +
            "Regenerating alone cannot green this -- the entry is source code",
        );
      }
    }

    // A site nobody has judged, and a judgement about code that is gone. The
    // first is the point of the table; the second keeps it from rotting into
    // the prose promise it replaced.
    for (const row of sites) {
      if (!ScopeJoinSites.adjudicationFor(row.file, row.element, verdicts)) {
        siteErrors.push(
          `${row.file}: \`${row.element}\` has no adjudication -- add one to ` +
            "`ScopeJoinSites.ADJUDICATIONS` saying which kind it is and why",
        );
      }
    }
    for (const verdict of verdicts) {
      const stillThere = sites.some(
        (row) => row.file === verdict.file && row.element === verdict.element,
      );
      if (!stillThere) {
        siteErrors.push(
          `${verdict.file}: adjudication for \`${verdict.element}\` matches no ` +
            "site -- remove it, the judgement outlived its code",
        );
      }
    }

    // Staleness is an INDEPENDENT defect only when the counts agree: a moved
    // population makes the document stale as a consequence, and "edited by hand"
    // would name the wrong cause there. That conditional lived in `main()`, was
    // unreachable from a test, and had already been spelled the opposite way
    // round in the script that copied this one -- both exiting 1, so nothing
    // could fail on the difference.
    //
    // The rows are not the whole document. Comparing only what the parser can
    // read leaves the preamble, the header comment and the total row free to
    // drift with the gate still green -- `diagnostic-manifest.ts` compares in
    // full for that reason. `render` emits no timestamp and Prettier is
    // deterministic, so equality holds.
    //
    // Framed here rather than in the CLI so the printed text is a property of
    // the decision and stays byte-identical to what `main()` used to emit.
    const errors: string[] = [];
    if (siteErrors.length > 0) {
      errors.push(
        "docs/architecture/scope-join-sites.md is out of date:\n" +
          siteErrors.map((error) => `  ${error}`).join("\n"),
      );
    } else if (freshDocument !== committed) {
      errors.push(
        `docs/architecture/scope-join-sites.md does not match what the ` +
          "generator produces, though the counts agree -- prose or the total " +
          "row was edited by hand. Run `npm run scope-joins`.",
      );
    }

    const { total, files, moving } = ScopeJoinSites.summarize(sites, verdicts);
    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${total} scope-denoting site(s) across ${files} file(s); ` +
          `${moving.length} awaiting another card.`,
      ],
    };
  }
}

export default ScopeJoinSites;
