import { describe, expect, it } from "vitest";

import SafeDivisionAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/SafeDivisionAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-051's call shape: E0884 (four arguments) and E0885 (the first is
 * a variable that can receive the result).
 *
 * The arity rule and the "not a variable at all" arm are pure parse-tree work
 * and are asserted here. The arm that separates a declared FUNCTION from a
 * declared VARIABLE reads the program's symbols; `tests/adr-051/` asserts it
 * end to end.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new SafeDivisionAnalyzer(context).analyze(syntax);
};

const wrap = (body: string) =>
  `void main() {\n    u32 q <- 0;\n    bool err <- false;\n${body}\n}`;

describe("SafeDivisionAnalyzer (E0884)", () => {
  it.each([
    ["too few", "    err <- safe_div(q, 10, 2);", 3],
    ["too many", "    err <- safe_mod(q, 10, 2, 0, 1);", 5],
    ["none at all", "    err <- safe_div();", 0],
  ])("rejects %s arguments", (_label, body, count) => {
    const [found] = errors(wrap(body));
    expect(found.code).toBe("E0884");
    expect(found.message).toContain(`not ${count}`);
    expect(found.span.line).toBe(4);
  });

  it("accepts exactly four, for both builtins", () => {
    expect(
      errors(
        wrap(
          "    err <- safe_div(q, 10, 2, 0);\n    err <- safe_mod(q, 10, 3, 0);",
        ),
      ),
    ).toEqual([]);
  });
});

describe("SafeDivisionAnalyzer (E0885)", () => {
  it("rejects an expression as the output, which has no address", () => {
    const [found] = errors(wrap("    err <- safe_div(1 + 1, 10, 2, 0);"));
    expect(found.code).toBe("E0885");
    expect(found.message).toContain("must be a variable");
  });

  it("says nothing about a name it cannot resolve", () => {
    // An undeclared name is E0427's to report. Saying it twice for one mistake
    // is what the analyzer order exists to prevent, and guessing here would
    // fire on valid code wherever this resolver has a gap.
    expect(errors(wrap("    err <- safe_div(nope, 10, 2, 0);"))).toEqual([]);
  });

  it("accepts a global or a scope member as the output, and rejects a function", () => {
    // #1668: the output binds through Program's one binder, so a variable
    // that is not a local is still a variable, and a function is not one
    const program = [
      "u32 total <- 0;",
      "u32 helper() { return 1; }",
      "scope Acc {",
      "    u32 sum <- 0;",
      "    public void run() {",
      "        bool e <- false;",
      "        e <- safe_div(sum, 10, 2, 0);",
      "    }",
      "}",
      "void main() {",
      "    bool err <- false;",
      "    err <- safe_div(total, 10, 2, 0);",
      "    err <- safe_div(helper, 10, 2, 0);",
      "}",
    ].join("\n");
    const found = errors(program);
    // Only `helper`, on line 13: `total` and the member `sum` are variables
    expect(found.map((e) => [e.code, e.span.line])).toEqual([["E0885", 13]]);
  });

  // #1991: the position comes from 1.2's span of the first argument.
  it("reports E0885 at the first argument", () => {
    const [found] = errors(wrap("    err <- safe_div(1 + 1, 10, 2, 0);"));
    expect([found.span.line, found.span.column]).toEqual([4, 20]);
  });

  it("checks only a bare call, not an index or a chain", () => {
    expect(errors(wrap("    err <- safe_div[1];"))).toEqual([]);
    expect(errors(wrap("    err <- safe_div(1 + 1, 10, 2).x;"))).toEqual([]);
  });

  it("is not confused by a member access ending in the same name", () => {
    // `lib.safe_div(...)` is a different function; only a bare primary
    // identifier followed by one call op is ADR-051's builtin.
    expect(errors(wrap("    err <- lib.safe_div(1 + 1, 10, 2);"))).toEqual([]);
  });
});
