import { describe, expect, it } from "vitest";

import ParseTreeSites from "../parse-tree/ParseTreeSites";

/**
 * Issue #1317. Every branch of `check` gets a mutation: a fixture that breaks
 * exactly one property and an assertion that the check fires. Feeding a gate
 * only correct input proves it can PASS, which is the failure mode the gate
 * exists to catch -- the argument `gate-roster.test.ts` makes and #1222 records
 * as regression fixtures that cannot fail when the fix is reverted.
 */

const violation = (from: string, to: string, rule = ParseTreeSites.RULE) => ({
  from,
  to,
  rule: { name: rule },
});

const GRAMMAR = "src/cnx/PARSE/2-Parse/grammar/CnxParser.ts";
const RUNTIME = "node_modules/antlr4ng/dist/index.cjs";

describe("ParseTreeSites.sites", () => {
  it("keeps only this rule's violations", () => {
    const sites = ParseTreeSites.sites([
      violation("src/cnx/utils/A.ts", GRAMMAR),
      violation("src/cnx/utils/B.ts", GRAMMAR, "no-circular"),
    ]);

    expect(sites.map((site) => site.module)).toEqual(["src/cnx/utils/A.ts"]);
  });

  it("collapses a module's several edges into one row", () => {
    // The document counts MODULES. Splitting one import into two statements is
    // not the coupling changing, so it must not move the number.
    const sites = ParseTreeSites.sites([
      violation("src/cnx/utils/A.ts", GRAMMAR),
      violation("src/cnx/utils/A.ts", RUNTIME),
    ]);

    expect(sites).toHaveLength(1);
    expect(sites[0].holds).toEqual(["antlr4ng", "grammar"]);
  });

  it("classifies the runtime by anchored path, not substring", () => {
    // `includes("antlr4ng")` would classify any repo path containing that
    // string as the runtime; the rule's `to` names the exact shape.
    const decoy = ParseTreeSites.sites([
      violation("src/cnx/utils/A.ts", "src/vendor/antlr4ng-shim/Thing.ts"),
    ]);

    expect(decoy[0].holds).toEqual(["grammar"]);
    expect(
      ParseTreeSites.sites([violation("src/cnx/utils/B.ts", RUNTIME)])[0].holds,
    ).toEqual(["antlr4ng"]);
  });

  it("sorts by module so the committed diff is stable", () => {
    const sites = ParseTreeSites.sites([
      violation("src/cnx/utils/B.ts", GRAMMAR),
      violation("src/cnx/utils/A.ts", GRAMMAR),
    ]);

    expect(sites.map((site) => site.module)).toEqual([
      "src/cnx/utils/A.ts",
      "src/cnx/utils/B.ts",
    ]);
  });
});

describe("ParseTreeSites.layerOf", () => {
  it("prefers the longest prefix", () => {
    // The ordering IS the assertion: with `src/cnx/TRANSPILE/` tested first, every
    // render module collapses into the layer's row and the render layer's
    // share -- the number #1317 singles out -- disappears from the document.
    expect(
      ParseTreeSites.layerOf("src/cnx/TRANSPILE/3-Render/codegen/X.ts"),
    ).toBe("src/cnx/TRANSPILE/3-Render/");
    expect(ParseTreeSites.layerOf("src/cnx/TRANSPILE/CodeGenWalker.ts")).toBe(
      "src/cnx/TRANSPILE/",
    );
  });

  it("falls back to a named root rather than undefined", () => {
    expect(ParseTreeSites.layerOf("src/index.ts")).toBe("src/ (root)");
  });
});

describe("ParseTreeSites.emptinessError", () => {
  it("is silent when the rule matched anything", () => {
    expect(
      ParseTreeSites.emptinessError(
        ParseTreeSites.sites([violation("src/cnx/utils/A.ts", GRAMMAR)]),
      ),
    ).toBeNull();
  });

  it("fires on an empty population, naming the two ways the rule goes inert", () => {
    // The guard against the whole gate going inert -- the failure
    // `options.exclude` actually caused on this branch. It was unreachable from
    // a test until it moved out of the CLI, which is the point of moving it.
    const message = ParseTreeSites.emptinessError([]);

    expect(message).not.toBeNull();
    expect(message).toContain(ParseTreeSites.RULE);
    expect(message).toContain("doNotFollow");
    expect(message).toContain("exclude");
  });
});

describe("ParseTreeSites.render", () => {
  const sites = ParseTreeSites.sites([
    violation("src/cnx/TRANSPILE/3-Render/A.ts", GRAMMAR),
    violation("src/cnx/utils/B.ts", RUNTIME),
  ]);

  it("states no count of its rows", () => {
    // #2520: a line that counts the rows changes in every pull request that
    // changes the list, so two of them conflict on it. The check prints them.
    const document = ParseTreeSites.render(sites);

    expect(document).not.toContain("**total**");
    expect(document).not.toContain("module(s)");
    expect(document).not.toContain("## By layer");
    expect(document).not.toMatch(/\|\s*\d+\s*\|/);
  });

  it("emits no timestamp", () => {
    // #1150: a timestamp churns every run and makes a diff gate useless.
    expect(ParseTreeSites.render(sites)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("ParseTreeSites.checkOutcome", () => {
  const sites = ParseTreeSites.sites([
    violation("src/cnx/TRANSPILE/3-Render/A.ts", GRAMMAR),
    violation("src/cnx/utils/B.ts", RUNTIME),
  ]);
  const committed = ParseTreeSites.render(sites);

  it("passes against the document the generator just produced", () => {
    expect(ParseTreeSites.checkOutcome(committed, sites, committed).ok).toBe(
      true,
    );
  });

  it("tolerates Prettier's cell padding", () => {
    // The committed file is Prettier-formatted, which pads table cells to a
    // common width. A parser requiring single spaces fails against the very
    // file the generator wrote.
    const padded = committed.replace(
      "| `src/cnx/utils/B.ts` | antlr4ng |",
      "| `src/cnx/utils/B.ts`   |   antlr4ng   |",
    );

    expect(ParseTreeSites.checkOutcome(padded, sites, padded).ok).toBe(true);
  });

  it("fires when a module joins the population", () => {
    const grown = ParseTreeSites.sites([
      violation("src/cnx/TRANSPILE/3-Render/A.ts", GRAMMAR),
      violation("src/cnx/utils/B.ts", RUNTIME),
      violation("src/cnx/TRANSPILE/2-Plan/New.ts", GRAMMAR),
    ]);
    const outcome = ParseTreeSites.checkOutcome(
      committed,
      grown,
      ParseTreeSites.render(grown),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain(
      "src/cnx/TRANSPILE/2-Plan/New.ts",
    );
  });

  it("fires when the baseline is stale because a module left", () => {
    // Shrinkage must fail too. A stale baseline re-admits the departed module
    // for free, so the next rise is measured against a number nobody
    // re-derived.
    const shrunk = ParseTreeSites.sites([
      violation("src/cnx/TRANSPILE/3-Render/A.ts", GRAMMAR),
    ]);
    const outcome = ParseTreeSites.checkOutcome(
      committed,
      shrunk,
      ParseTreeSites.render(shrunk),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("src/cnx/utils/B.ts");
  });

  it("reports a missing document as a decision, not a CLI branch", () => {
    // `committedDocument === null` used to be an `existsSync` branch in main()
    // that no test could reach.
    const outcome = ParseTreeSites.checkOutcome(null, sites, committed);

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("is missing");
  });

  it("blames a hand edit only when the population agrees", () => {
    // THE ordering decision. It lived in main(), had already diverged from
    // scope-join-sites.ts, and both spellings exited 1 so nothing could fail on
    // the difference. A hand-edited preamble with an intact module list is the
    // only case where "edited by hand" is the right cause.
    const handEdited = committed.replace(
      "Issue #1317.",
      "Issue #1317. Edited by a human.",
    );
    const outcome = ParseTreeSites.checkOutcome(handEdited, sites, committed);

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("edited by hand");
  });

  it("does not blame a hand edit when the population moved", () => {
    // The other half, and the reason the conditional exists: a moved population
    // makes the document stale as a CONSEQUENCE, so naming a hand edit there
    // points the reader at the wrong cause.
    const grown = ParseTreeSites.sites([
      violation("src/cnx/TRANSPILE/3-Render/A.ts", GRAMMAR),
      violation("src/cnx/utils/B.ts", RUNTIME),
      violation("src/cnx/TRANSPILE/2-Plan/New.ts", GRAMMAR),
    ]);
    const outcome = ParseTreeSites.checkOutcome(
      committed,
      grown,
      ParseTreeSites.render(grown),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).not.toContain("edited by hand");
  });

  it("reports the render-layer count, not just the total", () => {
    expect(
      ParseTreeSites.checkOutcome(committed, sites, committed).info.join(),
    ).toContain("1 in the render layer");
  });

  it("reports the per-layer tally the document no longer holds (#2520)", () => {
    expect(
      ParseTreeSites.checkOutcome(committed, sites, committed).info,
    ).toContain("By layer: src/cnx/TRANSPILE/3-Render/ 1, src/cnx/utils/ 1.");
  });

  it("reports an empty population alongside, not instead of, other errors", () => {
    // Collected rather than early-returned: one failure hiding another is how
    // the second gets fixed a release later.
    const outcome = ParseTreeSites.checkOutcome(null, [], committed);

    expect(outcome.errors.length).toBeGreaterThan(1);
    expect(outcome.errors.join("\n")).toContain(ParseTreeSites.RULE);
    expect(outcome.errors.join("\n")).toContain("is missing");
  });
});
