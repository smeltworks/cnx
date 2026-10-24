/**
 * #1449: the house form for a compliance annotation, asserted rather than
 * remembered.
 *
 * CLAUDE.md requires `/* <Standard> Rule <N>: <what> (<why>). *\/` and forbids
 * a nested `/*` inside the text (MISRA C:2012 Rule 3.1 -- an annotation that
 * violated a rule while citing one). Three sites used to build these strings by
 * hand and one had drifted: `forever` emitted no trailing period, and its
 * parenthetical named the cnx construct instead of what the naive C would
 * have done. A convention in prose could not catch that; this can.
 */

import ComplianceAnnotations from "../ComplianceAnnotations";
import type IComplianceAnnotation from "../types/IComplianceAnnotation";

/**
 * `/* MISRA C:2012 Rule 8.4: what (why). *\/`, or the language's own rule:
 * `/* C11 6.2.1p7, C++ [basic.scope.pdecl]: what (why). *\/`, or C's alone
 * where only C has the rule: `/* C11 6.7.9p4: what (why). *\/`
 */
const HOUSE_FORM =
  /^\/\* (?:MISRA C:2012 Rule \d+(?:\.\d+)*|C11 \d+(?:\.\d+)*p\d+(?:, C\+\+ \[[a-z.]+\])?): .+ \(.+\)\. \*\/$/;

describe("ComplianceAnnotations", () => {
  describe("every annotation the transpiler can emit", () => {
    it.each(ComplianceAnnotations.all().map((a) => [a.citation, a] as const))(
      "%s matches the house form",
      (_rule, annotation) => {
        expect(ComplianceAnnotations.render(annotation)).toMatch(HOUSE_FORM);
      },
    );

    it.each(ComplianceAnnotations.all().map((a) => [a.citation, a] as const))(
      "%s opens no nested comment (MISRA Rule 3.1)",
      (_rule, annotation) => {
        const rendered = ComplianceAnnotations.render(annotation);

        expect(rendered.slice(2, -2)).not.toContain("/*");
      },
    );

    it.each(ComplianceAnnotations.all().map((a) => [a.citation, a] as const))(
      "%s says what the naive form would have done, not just what this one does",
      (_rule, annotation) => {
        // The `why` is the half CLAUDE.md is specific about, and the half that
        // drifted. A why that merely restates the construct is not one.
        expect(annotation.why.length).toBeGreaterThan(annotation.what.length);
        expect(annotation.why.endsWith(".")).toBe(false);
      },
    );
  });

  it("lists every fixed row in all()", () => {
    // #2335 review: STRING_BUILT_APART was left out of all(), so none of the
    // checks above ever saw it. The parameterized rows are methods, so all()
    // lists those by hand.
    const rows = Object.values(ComplianceAnnotations).filter(
      (value): value is IComplianceAnnotation =>
        typeof value === "object" && value !== null && "citation" in value,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(ComplianceAnnotations.all()).toContain(row);
    }
  });

  it("cites exactly the rules it is known to cite", () => {
    // Fails loudly when a rule is added or removed, so the set an auditor would
    // enumerate stays visible in review rather than growing quietly.
    const rules = ComplianceAnnotations.all().map((a) => a.citation);

    expect(rules.sort()).toEqual([
      "C11 6.2.1p4, C++ [basic.scope.hiding]",
      "C11 6.2.1p7, C++ [basic.scope.pdecl]",
      "C11 6.5.13p4, C++ [expr.log.and]",
      "C11 6.5.14p4, C++ [expr.log.or]",
      "C11 6.5.15p4, C++ [expr.cond]",
      "C11 6.7.9p4",
      "MISRA C:2012 Rule 11.9",
      "MISRA C:2012 Rule 14.3",
      "MISRA C:2012 Rule 19.1",
      "MISRA C:2012 Rule 19.1",
      "MISRA C:2012 Rule 21.15",
      "MISRA C:2012 Rule 21.15",
      "MISRA C:2012 Rule 8.4",
    ]);
  });

  it("renders the float bits union with both pointer types it names", () => {
    const rendered = ComplianceAnnotations.render(
      ComplianceAnnotations.floatBitsUnion("double", "uint64_t"),
    );

    expect(rendered).toContain("double* vs uint64_t*");
    expect(rendered).toMatch(HOUSE_FORM);
  });

  it("renders a moved name with both of its names (#1643 review)", () => {
    const rendered = ComplianceAnnotations.renderMoves(
      ["hidesFileScope", "readsEnclosing"],
      "n",
      "main__n__2",
    );

    expect(rendered.split("\n")).toHaveLength(3);
    expect(rendered).toContain("`n` emitted as `main__n__2`");
    expect(ComplianceAnnotations.renderMoves([], "n", "n")).toBe("");
  });

  it("renders the slice unroll with both pointer types it names", () => {
    const rendered = ComplianceAnnotations.render(
      ComplianceAnnotations.sliceUnroll("uint8_t", "uint32_t"),
    );

    expect(rendered).toContain("uint8_t* vs uint32_t*");
    expect(rendered).toMatch(HOUSE_FORM);
  });
});
