/**
 * Issues #1357 and #2116: the gate on qualified C name construction must be
 * able to fail.
 */

import { describe, it, expect } from "vitest";
import { format } from "prettier";

import ScopeJoinSites from "../scope-joins/ScopeJoinSites";

describe("ScopeJoinSites", () => {
  describe("elements", () => {
    it("reads the argument of a single-line call", () => {
      expect(
        ScopeJoinSites.elements(
          "const x = QualifiedCName.fromSourceName(type.name);",
        ),
      ).toEqual(["fromSourceName(type.name)"]);
    });

    it("reads a call that spans lines", () => {
      // The shape Prettier produces for anything past ~80 columns.
      expect(
        ScopeJoinSites.elements(
          "QualifiedCName.fromSourceName([\n  frame.scopeName,\n  memberName,\n]);",
        ),
      ).toEqual(["fromSourceName([frame.scopeName, memberName])"]);
    });

    it("does not stop at a closing bracket inside a nested call", () => {
      expect(
        ScopeJoinSites.elements(
          "QualifiedCName.fromSourceName([f(a, b), leaf]);",
        ),
      ).toEqual(["fromSourceName([f(a, b), leaf])"]);
    });

    it("finds every call in a file", () => {
      expect(
        ScopeJoinSites.elements(
          "QualifiedCName.fromSourceName(a); QualifiedCName.fromSourceName([scopeName, c]);",
        ),
      ).toEqual(["fromSourceName(a)", "fromSourceName([scopeName, c])"]);
    });

    it("counts a call whatever its argument is called", () => {
      // #2116 box 2: #1357's gate skipped a call whose first element did not
      // READ as a scope, so `parts[0]` holding one went never judged. No spelling
      // exempts a call now.
      expect(
        ScopeJoinSites.elements("QualifiedCName.fromSourceName([cName, x]);"),
      ).toEqual(["fromSourceName([cName, x])"]);
    });

    it("counts a scope prefix test by its whole argument", () => {
      // TypeValidator's `isInScope` call was invisible to #1357's scan, so a
      // leaf re-inlined there reddened nothing.
      expect(
        ScopeJoinSites.elements(
          "QualifiedCName.isInScope(id, ScopeUtils.leafOf(currentScopePath));",
        ),
      ).toEqual(["isInScope(id, ScopeUtils.leafOf(currentScopePath))"]);
    });

    it("counts a member access chain's join", () => {
      // A scope's name handed to `join` with a register step would spell
      // `Scope__member` outside the encoder.
      expect(
        ScopeJoinSites.elements(
          'MemberSeparatorResolver.join(scope.name, { kind: "register-member" }, m);',
        ),
      ).toEqual(['join(scope.name, { kind: "register-member" }, m)']);
    });

    it("counts the separator used by name", () => {
      expect(
        ScopeJoinSites.elements(
          "const n = `${scope}${QualifiedCName.SEPARATOR}${member}`;",
        ),
      ).toEqual(["QualifiedCName.SEPARATOR"]);
    });

    it("counts the separator spelled as text in a template", () => {
      // How three render sites built names that #1357's gate never saw.
      expect(
        ScopeJoinSites.elements("const n = `${scope.name}__${member}`;"),
      ).toEqual(["${scope.name}__"]);
    });

    it("counts the separator spelled as a joined or concatenated literal", () => {
      expect(
        ScopeJoinSites.elements(
          'a.join("__"); const n = scope + "__" + member;',
        ),
      ).toEqual(['.join("__")', '+ "__"']);
    });

    it("does not count text that merely contains two underscores", () => {
      // Negative control: a float bit shadow and a reserved-prefix test are not
      // joins, and counting them would make every row a false positive.
      expect(
        ScopeJoinSites.elements(
          'const s = `__bits_${name}`; if (id.startsWith("__")) {}',
        ),
      ).toEqual([]);
    });

    it("keeps a template argument out of the document's code span", () => {
      expect(
        ScopeJoinSites.elements(
          "QualifiedCName.fromSourceName(`${scope}.${member}`);",
        ),
      ).toEqual(["fromSourceName('${scope}.${member}')"]);
    });
  });

  describe("comment blindness (#1385 review)", () => {
    it("does not count a call that appears in a block comment", () => {
      // These builders are what the JSDoc in this repo is ABOUT, so the text the
      // scan looks for appears in prose constantly.
      expect(
        ScopeJoinSites.elements(
          "/** Prefer `QualifiedCName.fromSourceName(written)`. */",
        ),
      ).toEqual([]);
    });

    it("does not count a call that appears in a line comment", () => {
      expect(
        ScopeJoinSites.elements("// was QualifiedCName.SEPARATOR"),
      ).toEqual([]);
    });

    it("still counts the real call on a line that also has a comment", () => {
      // Negative control: stripping comments must not swallow code beside them.
      expect(
        ScopeJoinSites.elements(
          "const n = QualifiedCName.fromSourceName(x); // trailing note",
        ),
      ).toEqual(["fromSourceName(x)"]);
    });
  });

  describe("sites", () => {
    it("omits files with no site", () => {
      expect(
        ScopeJoinSites.sites(new Map([["src/clean.ts", "const x = 1;"]])),
      ).toEqual([]);
    });

    it("sorts by path so the committed document has a stable order", () => {
      // Without this the generated table would reorder on a filesystem whose
      // walk order differs, and every run would produce a spurious diff.
      const call = "QualifiedCName.fromSourceName(x);";
      const rows = ScopeJoinSites.sites(
        new Map([
          ["src/z.ts", call],
          ["src/a.ts", call],
          ["src/m.ts", call],
        ]),
      );

      expect(rows.map((row) => row.file)).toEqual([
        "src/a.ts",
        "src/m.ts",
        "src/z.ts",
      ]);
    });

    it("collapses identical expressions in one file and counts them", () => {
      const call = "QualifiedCName.fromSourceName(x);";
      const sites = ScopeJoinSites.sites(new Map([["src/a.ts", call + call]]));

      expect(sites).toEqual([
        { file: "src/a.ts", element: "fromSourceName(x)", count: 2 },
      ]);
    });

    it("keeps distinct expressions in one file apart", () => {
      const sites = ScopeJoinSites.sites(
        new Map([
          [
            "src/a.ts",
            "QualifiedCName.fromSourceName(x); QualifiedCName.fromSourceName(y);",
          ],
        ]),
      );

      expect(sites.map((row) => row.element)).toEqual([
        "fromSourceName(x)",
        "fromSourceName(y)",
      ]);
    });
  });

  describe("check", () => {
    // The mechanism, not today's population: a real file would redden these
    // tests the day its site is closed, which is not what they are about.
    const verdicts = [
      {
        file: "src/a.ts",
        element: "fromSourceName(x)",
        kind: "written-name" as const,
        why: "test fixture",
      },
      {
        file: "src/b.ts",
        element: "fromSourceName(x)",
        kind: "owner-c-name" as const,
        why: "test fixture",
      },
    ];
    const population = [
      { file: "src/a.ts", element: "fromSourceName(x)", count: 2 },
      { file: "src/b.ts", element: "fromSourceName(x)", count: 1 },
    ];
    const doc = ScopeJoinSites.render(population, verdicts);

    it("reports a missing document as a decision, not a CLI branch", () => {
      // `existsSync` used to sit in `main()`, so this branch was unreachable
      // from a test. Brought here with #1317's review.
      const outcome = ScopeJoinSites.checkOutcome(
        null,
        population,
        doc,
        verdicts,
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("is missing");
    });

    it("blames a hand edit only when the counts agree", () => {
      // THE ordering decision. It lived in `main()` as `stale && outcome.ok`,
      // and the script that copied this one spelled it `!ok` then `stale` --
      // both exiting 1, so nothing could fail on the difference.
      const handEdited = doc.replace(
        "Issues #1357 and #2116.",
        "Issues #1357 and #2116. Edited.",
      );
      const outcome = ScopeJoinSites.checkOutcome(
        handEdited,
        population,
        doc,
        verdicts,
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("edited by hand");
    });

    it("does not blame a hand edit when the population moved", () => {
      // The other half: a moved population makes the document stale as a
      // CONSEQUENCE, so naming a hand edit there points at the wrong cause.
      const moved = [
        { file: "src/a.ts", element: "fromSourceName(x)", count: 3 },
        { file: "src/b.ts", element: "fromSourceName(x)", count: 1 },
      ];
      const outcome = ScopeJoinSites.checkOutcome(
        doc,
        moved,
        ScopeJoinSites.render(moved, verdicts),
        verdicts,
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).not.toContain("edited by hand");
      expect(outcome.errors.join("\n")).toContain("grew from 2 to 3");
    });

    it("passes when the population is unchanged", () => {
      expect(
        ScopeJoinSites.checkOutcome(doc, population, doc, verdicts).ok,
      ).toBe(true);
    });

    it("fails when a call shape gains an occurrence", () => {
      const outcome = ScopeJoinSites.checkOutcome(
        doc,
        [
          { file: "src/a.ts", element: "fromSourceName(x)", count: 3 },
          { file: "src/b.ts", element: "fromSourceName(x)", count: 1 },
        ],
        doc,
        verdicts,
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("grew from 2 to 3");
    });

    it("fails when a file that had none gains one", () => {
      const outcome = ScopeJoinSites.checkOutcome(
        doc,
        [
          ...population,
          { file: "src/c.ts", element: "fromSourceName(x)", count: 1 },
        ],
        doc,
        [
          ...verdicts,
          {
            file: "src/c.ts",
            element: "fromSourceName(x)",
            kind: "written-name" as const,
            why: "test fixture",
          },
        ],
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("src/c.ts");
    });

    it("fails as stale when sites are removed, so a win gets recorded", () => {
      const outcome = ScopeJoinSites.checkOutcome(doc, [population[0]], doc, [
        verdicts[0],
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("down from 1 to 0");
    });

    it("fails on a call shape nobody has adjudicated", () => {
      // The point of the table. A new shape must be judged before it lands,
      // rather than joining an unlabeled population the next reader has to
      // re-derive -- which is how both #1295 claims went unchecked.
      const outcome = ScopeJoinSites.checkOutcome(doc, population, doc, [
        verdicts[0],
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("has no adjudication");
    });

    it("marks an unadjudicated site in the document it writes", () => {
      // The writer-facing half of the gate. `check` refuses an unadjudicated
      // site, but the document `write` emits is what the contributor reads
      // first, so a render that silently omitted or blank-filled the row would
      // hide the very thing they have to act on.
      expect(ScopeJoinSites.render(population, [verdicts[0]])).toContain(
        "**UNADJUDICATED**",
      );
    });

    it("stays red on an unadjudicated site after the document is regenerated", () => {
      // The one path that silently defeats this gate. Every other generated-doc
      // gate in this repo is greened by running its regenerate command, so a
      // contributor who hits "has no adjudication" reaches for `npm run
      // scope-joins` reflexively. It must not work: the judgement lives in
      // `ADJUDICATIONS`, which is source code, and regenerating only rewrites
      // the row that reports the gap.
      const regenerated = ScopeJoinSites.render(population, [verdicts[0]]);
      const outcome = ScopeJoinSites.checkOutcome(
        regenerated,
        population,
        regenerated,
        [verdicts[0]],
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("has no adjudication");
    });

    it("fails on a judgement that outlived its code", () => {
      // Without this, a fixed site keeps its verdict forever and the checklist
      // rots into the prose promise it replaced.
      const outcome = ScopeJoinSites.checkOutcome(doc, population, doc, [
        ...verdicts,
        {
          file: "src/gone.ts",
          element: "fromSourceName(x)",
          kind: "written-name" as const,
          why: "test fixture",
        },
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("matches no site");
    });

    it("renders the kind and the reason for every row", () => {
      expect(doc).toContain(
        "| `src/a.ts` | `fromSourceName(x)` | 2 | written-name |",
      );
      expect(doc).toContain(
        "| `src/b.ts` | `fromSourceName(x)` | 1 | owner-c-name |",
      );
      expect(doc).toContain("- `src/a.ts` `fromSourceName(x)`: test fixture");
    });

    it("reads back an expression holding a table pipe", () => {
      // `a || b` must be escaped in the table and unescaped by the parser, or a
      // committed document could never match its own population.
      const piped = [
        { file: "src/a.ts", element: "fromSourceName(a || b)", count: 1 },
      ];
      const pipedVerdicts = [{ ...verdicts[0], element: piped[0].element }];
      const pipedDoc = ScopeJoinSites.render(piped, pipedVerdicts);

      expect(
        ScopeJoinSites.checkOutcome(pipedDoc, piped, pipedDoc, pipedVerdicts)
          .ok,
      ).toBe(true);
    });

    it("renders the kind bullets in the declared precedence order", () => {
      // Finding 5 of the #1395 review: the `TKind` union and this preamble each
      // stated the precedence, and had drifted into stating OPPOSITE orders --
      // on a rule nothing computes, so only a reader would ever notice. Both now
      // derive from `KIND_SECTIONS`; this pins that they still travel together,
      // since making them agree once is not the same as making them unable to
      // disagree.
      const order = ["encoder", "written-name", "scope-path", "owner-c-name"];
      const positions = order.map((kind) => doc.indexOf(`- **${kind}**`));

      expect(positions.every((at) => at >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("reads a Prettier-formatted document", async () => {
      // Regression: the committed document is Prettier-formatted, which pads
      // table cells to a common width. A parser requiring single spaces failed
      // against the very file the generator had just written, so the gate was
      // red on its own output and would have been "fixed" by deleting it.
      const formatted = await format(doc, { parser: "markdown" });

      expect(formatted).not.toBe(doc);
      expect(
        ScopeJoinSites.checkOutcome(formatted, population, formatted, verdicts)
          .ok,
      ).toBe(true);
    });
  });
});
