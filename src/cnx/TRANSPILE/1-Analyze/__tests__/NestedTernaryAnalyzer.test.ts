import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import NestedTernaryAnalyzer from "../NestedTernaryAnalyzer";

/**
 * #1322. ADR-022 forbids a ternary inside a ternary's branches; the nesting is
 * where the operator stops being readable and MISRA stops being satisfiable.
 *
 * The check it replaces was a SUBSTRING TEST on the branch's source text:
 *
 *     if (text.includes("?") && text.includes(":"))
 *
 * which rejects `(n = 1) ? "a?b:c" : "plain"` -- a legal ternary whose true
 * branch is a string literal that happens to contain both characters. Verified
 * by probe before this analyzer existed.
 *
 * A rule about SYNTAX asked about characters. 1.2's syntax already has the
 * answer, and asking it is both simpler and correct.
 */
const errors = (source: string) => {
  return new NestedTernaryAnalyzer().analyze(
    CnxSourceParser.parse(source).program,
  );
};

const inMain = (body: string): string =>
  `u32 main() {\n    u32 n <- 1;\n${body}\n    return 0;\n}`;

describe("NestedTernaryAnalyzer", () => {
  it("rejects a ternary in the true branch", () => {
    const found = errors(
      inMain("    u32 v <- (n = 1) ? ((n = 2) ? 3 : 4) : 5;"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0710");
    expect(found[0].message).toContain("true");
  });

  it("rejects a ternary in the false branch", () => {
    const found = errors(
      inMain("    u32 v <- (n = 1) ? 3 : ((n = 2) ? 4 : 5);"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("false");
  });

  it("accepts a branch that is a string containing ? and :", () => {
    // THE regression. The substring check rejected this, and it is ordinary
    // cnx: the characters are inside a literal, not operators.
    expect(
      errors(inMain('    string<16> s <- (n = 1) ? "a?b:c" : "plain";')),
    ).toEqual([]);
  });

  it("accepts a plain ternary", () => {
    expect(errors(inMain("    u32 v <- (n = 1) ? 3 : 4;"))).toEqual([]);
  });

  it("accepts two ternaries that are siblings, not nested", () => {
    // Sequential ternaries are fine; only nesting is forbidden. A check that
    // looked at the enclosing STATEMENT rather than the branch would reject
    // this.
    expect(
      errors(
        inMain("    u32 a <- (n = 1) ? 3 : 4;\n    u32 b <- (n = 2) ? 5 : 6;"),
      ),
    ).toEqual([]);
  });

  it("rejects a ternary inside the CONDITION -- the hole codegen left", () => {
    // REGRESSION. `validateNoNestedTernary` was called on the two branches and
    // never the condition, so this compiled and emitted C. ADR-022 says "no
    // nesting allowed" with no qualification, and the whole nest sits inside a
    // comparison, so E0701 is satisfied and does not fire either -- probed on a
    // real file, not reasoned about.
    //
    // Note the parentheses: `((n = 1) ? 2 : 3) = 2 ? 4 : 5` does NOT parse. An
    // earlier version of this test used that form, so it was asserting against
    // an error-recovered tree rather than legal cnx.
    const found = errors(
      inMain("    u32 v <- (((n = 1) ? 2 : 3) = 2) ? 4 : 5;"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0710");
    expect(found[0].message).toContain("condition");
  });

  it("carries a real position", () => {
    const [found] = errors(
      inMain("    u32 v <- (n = 1) ? ((n = 2) ? 3 : 4) : 5;"),
    );
    expect(found.span.line).toBe(3);
    expect(found.span.column).toBeGreaterThan(0);
  });
});
