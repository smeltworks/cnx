/**
 * Issue #1317: the committed inventory of modules holding an ANTLR parse tree.
 *
 * `docs/architecture/README.md` makes the AST Tier 1 with a short lifetime and
 * rests the whole lifetime axis on one rule -- 1.3 consumes `ParsedFile` and
 * does not re-export it, so the tree is not reachable from any artifact a
 * downstream pass holds. Nothing enforced it.
 *
 * The population is NOT scanned here. It is read from the violations of
 * `parse-tree-sites` in `.dependency-cruiser.cjs`, so the question
 * "what counts as holding a parse tree" has exactly one answer, in the rule,
 * rather than one in the rule and a second in a grep that must agree with it.
 * That second definition is the duplicate-path anti-pattern this project
 * forbids, and it would fail in the quiet direction: a rule and a scanner that
 * disagree leave a module gated by neither while both report green.
 *
 * Keyed on the MODULE, not on `file:line`. `throw-classification.md`
 * records what line citations cost -- adding one import shifts every later
 * citation down one and all 20 missed by exactly one (#1399) -- and a module
 * path moves only when the module does, which is a reviewable diff rather than
 * silent drift.
 */

import type IDepcruiseViolation from "../types/IDepcruiseViolation";
import type ICheckOutcome from "../types/ICheckOutcome";

/** One module outside the parser that holds a parse context, and what from. */
interface ISite {
  readonly module: string;
  /** `grammar`, `antlr4ng`, or both -- sorted, so the row is stable. */
  readonly holds: readonly string[];
}

class ParseTreeSites {
  /** The rule whose violations ARE this document. Named once. */
  static readonly RULE = "parse-tree-sites";

  /**
   * The layer a module path belongs to, longest prefix first.
   *
   * Ordered, not a map: `src/cnx/TRANSPILE/3-Render/` must be tested before
   * `src/cnx/TRANSPILE/`, or the render layer collapses into the generic pass row
   * and its share -- the number the issue says matters -- disappears. The same
   * trap under a different path since #1450 box 5 moved `transpiler/output/`
   * there: the prefix that must win is the LONGER one, and the generic pass
   * root now shares a stem with it.
   */
  private static readonly LAYERS: readonly string[] = [
    "src/cnx/PARSE/",
    "src/cnx/TRANSPILE/3-Render/",
    "src/cnx/TRANSPILE/",
    "src/cnx/types/",
    "src/cnx/instrumentation/",
    "src/cnx/utils/",
    "src/cli/",
    "src/lib/",
  ];

  /**
   * Which dependency a violation edge points at, in the document's vocabulary.
   *
   * Anchored rather than a substring test: `includes("antlr4ng")` would classify
   * any future repo path containing that string as the runtime. The rule's `to`
   * already states the exact shape, so matching it keeps the two in step.
   */
  private static holdKind(to: string): string {
    return to.startsWith("node_modules/antlr4ng/") ? "antlr4ng" : "grammar";
  }

  /** The layer heading a module sits under. */
  static layerOf(module: string): string {
    return (
      ParseTreeSites.LAYERS.find((layer) => module.startsWith(layer)) ??
      "src/ (root)"
    );
  }

  /**
   * Distinct modules, from the rule's violation edges.
   *
   * A module holding two parse contexts produces two edges and one row: the
   * document counts MODULES, which is what the issue's baseline measures and
   * what "the tree is not reachable from any artifact a downstream pass holds"
   * is a claim about. Edge counts would move when an import is split across two
   * statements, which is not the coupling changing.
   */
  static sites(violations: readonly IDepcruiseViolation[]): readonly ISite[] {
    const holdsByModule = new Map<string, Set<string>>();
    for (const violation of violations) {
      if (violation.rule?.name !== ParseTreeSites.RULE) continue;
      const holds = holdsByModule.get(violation.from) ?? new Set<string>();
      holds.add(ParseTreeSites.holdKind(violation.to));
      holdsByModule.set(violation.from, holds);
    }
    return [...holdsByModule.entries()]
      .map(([module, holds]) => ({ module, holds: [...holds].sort() }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }

  /**
   * The per-layer tally both `render` and `check` report.
   *
   * Shared rather than computed twice -- the two must agree, and jscpd flags the
   * copy the moment it exists (the lesson `ScopeJoinSites.summarize` records).
   */
  static summarize(sites: readonly ISite[]): {
    readonly total: number;
    readonly byLayer: readonly (readonly [string, number])[];
  } {
    const tally = new Map<string, number>();
    for (const site of sites) {
      const layer = ParseTreeSites.layerOf(site.module);
      tally.set(layer, (tally.get(layer) ?? 0) + 1);
    }
    return {
      total: sites.length,
      byLayer: [...tally.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    };
  }

  /**
   * Why an empty population is a broken run rather than a clean one, or null.
   *
   * Returns instead of exiting, for the reason `GeneratedMarkdown.parseMode`
   * gives about its own guard: "a guard that can only be observed by watching a
   * process die is a guard nobody checks." It lived in the CLI's `main()` and
   * was the one branch in #1317 no test could reach -- and `scripts/` sits
   * outside vitest's coverage `include`, so nothing would have reported the gap
   * either.
   *
   * That matters more here than for a typical guard: this is the guard against
   * the whole gate going inert, which is the failure `options.exclude` actually
   * caused on this branch -- the rule reported a clean zero against the entire
   * population because its `to` named a path excluded from the graph.
   */
  static emptinessError(sites: readonly ISite[]): string | null {
    if (sites.length > 0) return null;
    return (
      `No module violates \`${ParseTreeSites.RULE}\`. That rule is expected ` +
      "to match the whole population, so an empty result means it stopped " +
      "matching -- check that `.dependency-cruiser.cjs` still carries it " +
      "and that the grammar is in `doNotFollow`, not `exclude`."
    );
  }

  /** The committed document body. No timestamp: it would churn every run (#1150). */
  static render(sites: readonly ISite[]): string {
    const { total, byLayer } = ParseTreeSites.summarize(sites);
    return [
      "# Modules holding an ANTLR parse tree",
      "",
      "<!-- Generated by `npm run parse-tree`. Do not edit by hand. -->",
      "",
      "Issue #1317. Each row is one module outside `src/cnx/PARSE/2-Parse/`",
      "that imports a generated parser context, the `antlr4ng` runtime, or a",
      "1.2 parser that returns a tree, which its caller holds unnamed (#1957).",
      "",
      "**The population is not scanned.** It is the violation set of the",
      "`parse-tree-sites` rule in `.dependency-cruiser.cjs`, so the",
      "rule is the single definition of what counts. A second definition here --",
      "a grep that must agree with the rule -- is the duplicate-path anti-pattern,",
      "and it fails quietly: where the two disagree a module is gated by neither",
      "while both report green.",
      "",
      "**A row is not by itself a defect.** `IParsedFile.ts` IS 1.2 Parse's",
      "artifact, and holding a parse context is its job -- 1.3 consumes that",
      "same artifact rather than re-exporting the tree in one of its own, which",
      "is what #1445 box 2 closed when it deleted `IDeclaredFile.ts`.",
      "What the lifetime axis forbids is the",
      "population GROWING -- a pass reaching for the tree to answer a question its",
      "own artifact should already answer. So the inventory rule is `info`, and",
      "this document is the gate: `npm run parse-tree:check` fails when a module",
      "is added to the list, and when the list is stale because one was removed.",
      "",
      "Which holders are allowed is ruled by `parse-tree-confined-to-parser`,",
      "at `error` (#1932): 1.2 Parse, 1.3 Declare, 2.1 Analyze, the shared",
      "helpers only they call, the host that hands them 1.2's artifact, and 1.1's",
      "lexer-only include scan. Nothing from 2.2 Plan on.",
      "",
      "## By layer",
      "",
      "| Layer | Modules |",
      "| --- | ---: |",
      ...byLayer.map(([layer, count]) => `| \`${layer}\` | ${count} |`),
      `| **total** | **${total}** |`,
      "",
      "`src/cnx/TRANSPILE/3-Render/` is the render layer, and its share is the number",
      "the issue singles out: the render layer holding parse nodes is how a",
      "diagnostic can originate there at all, which is what #1322 relocates.",
      "",
      "## Modules",
      "",
      "| Module | Holds |",
      "| --- | --- |",
      ...sites.map(
        (site) => `| \`${site.module}\` | ${site.holds.join(", ")} |`,
      ),
      "",
      `${total} module(s).`,
      "",
    ].join("\n");
  }

  /**
   * Everything `check` mode concluded, as a value.
   *
   * Follows `DiagnosticManifest.checkOutcome` rather than the older shape in
   * `scope-join-sites.ts`: every decision is HERE and the CLI only prints, so
   * the ordering between "the population moved" and "the document is stale" is
   * reachable from a test instead of buried in an entry point. #1317 copied the
   * older shape and the two had already drifted apart --
   *
   *     scope-join-sites.ts   if (stale && outcome.ok) ... ; if (!outcome.ok) ...
   *     parse-tree-sites.ts   if (!outcome.ok) ... ;         if (stale) ...
   *
   * -- with the same exit code either way, so nothing could fail on the
   * difference. That is agreeing by coincidence, and the repository had already
   * decided against it one script over.
   *
   * Errors are COLLECTED, not returned early, for the reason the sibling gives:
   * one failure hiding another is how the second gets fixed a release later.
   *
   * `committedDocument` is nullable so the missing-file case is a decision here
   * too, rather than an `existsSync` branch in the CLI that no test can reach.
   */
  static checkOutcome(
    committedDocument: string | null,
    sites: readonly ISite[],
    freshDocument: string,
  ): ICheckOutcome {
    const errors: string[] = [];

    // First and independently: an empty population is a broken run, and it stays
    // reportable alongside whatever else is wrong.
    const empty = ParseTreeSites.emptinessError(sites);
    if (empty !== null) errors.push(empty);

    const { total, byLayer } = ParseTreeSites.summarize(sites);
    const renderLayer =
      byLayer.find(([layer]) => layer === "src/cnx/TRANSPILE/3-Render/")?.[1] ??
      0;
    const info = [
      `${total} module(s) hold a parse tree; ${renderLayer} in the render layer.`,
    ];

    if (committedDocument === null) {
      errors.push(
        "docs/architecture/parse-tree-sites.md is missing. Run `npm run parse-tree`.",
      );
      return { ok: false, errors, info };
    }

    // Tolerant of padding: the committed document is Prettier-formatted, which
    // pads table cells to a common width. A parser requiring single spaces
    // fails against the very file the generator just wrote.
    const expected = new Set<string>();
    for (const match of committedDocument.matchAll(
      /^\|\s*`(src\/[^`]+)`\s*\|\s*(?:grammar|antlr4ng)/gm,
    )) {
      expected.add(match[1]);
    }
    const actual = new Set(sites.map((site) => site.module));

    for (const module of actual) {
      if (!expected.has(module)) {
        errors.push(
          `${module}: now holds a parse context and is not in the baseline -- ` +
            "a pass reaching for the tree is what the lifetime axis forbids. " +
            "If it is genuinely the right place, run `npm run parse-tree` " +
            "and say on the PR which artifact could not answer the question",
        );
      }
    }
    for (const module of expected) {
      if (!actual.has(module)) {
        errors.push(
          `${module}: no longer holds a parse context -- run ` +
            "`npm run parse-tree` so the baseline records the smaller " +
            "number. Leaving it stale re-admits this module for free",
        );
      }
    }

    // Staleness is an INDEPENDENT defect only when the population agrees: a
    // moved population makes the document stale as a consequence, and reporting
    // "edited by hand" there would name the wrong cause. That conditional is the
    // decision this method exists to make testable.
    if (freshDocument !== committedDocument && errors.length === 0) {
      errors.push(
        "docs/architecture/parse-tree-sites.md does not match what the " +
          "generator produces, though the module list agrees -- prose or the " +
          "per-layer table was edited by hand. Run `npm run parse-tree`.",
      );
    }

    return { ok: errors.length === 0, errors, info };
  }
}

export default ParseTreeSites;
