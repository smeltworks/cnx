import { describe, expect, it } from "vitest";

import ControllingExpressionAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ControllingExpressionAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-022's controlling-expression rule -- E0701 (MISRA C:2012 Rule
 * 14.4) and E0702 (Rule 13.5) -- replacing four throws in `TypeValidator` that
 * all reached the user as `1:0`.
 *
 * The rule is purely syntactic, so these drive real source: the decomposition
 * of `||` and `&&` down to leaf operands is the whole check, and asserting it
 * against the grammar is the only way to know the decomposition matches what
 * the parser actually builds.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new ControllingExpressionAnalyzer(context).analyze(syntax);
};

const inIf = (condition: string): string =>
  `bool flag <- true;\nu32 n <- 1;\nvoid t() {\n    if (${condition}) { }\n}`;

describe("ControllingExpressionAnalyzer", () => {
  describe("E0701 -- a condition must be a comparison", () => {
    it("rejects a bare value, with a real position", () => {
      const found = errors(inIf("n"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
      expect(found[0].span.line).toBe(4);
      expect(found[0].span.column).toBeGreaterThan(0);
    });

    it("rejects a bare bool and suggests the explicit form", () => {
      const [found] = errors(inIf("flag"));
      expect(found.helpText).toContain("flag = true");
    });

    it("rejects a negation and suggests its inverse", () => {
      // `!flag` is not a comparison, and the suggestion has to flip with the
      // negation or it tells the author to write something else entirely.
      const [found] = errors(inIf("!flag"));
      expect(found.helpText).toContain("flag = false");
    });

    // #1195 review: the general case reads `!(...)` whole, names no
    // declaration, and offered `!(n<5) > 0` -- which is E0807 on a bool. A
    // negated bracketed group is written out from what it holds.
    it.each([
      ["!(n > 0)", "(n > 0) = false"],
      ["!((n > 0) && (n < 5))", "((n > 0) && (n < 5)) = false"],
      ["!(flag)", "flag = false"],
      ["!((flag))", "flag = false"],
    ])("suggests a form that compiles for %s", (condition, suggestion) => {
      const [found] = errors(inIf(condition));
      expect(found.code).toBe("E0701");
      expect(found.helpText).toContain(`e.g. ${suggestion}`);
    });

    it("offers the bool write-out only under `!`", () => {
      // `-(flag)` is not a negation; `flag = false` would drop the minus.
      const [found] = errors(inIf("-(flag)"));
      expect(found.code).toBe("E0701");
      expect(found.helpText).not.toContain("flag = false");
    });

    it("still rejects a negated group that holds neither", () => {
      // A number under `!` is #1734's question (MISRA 10.1), not this one's.
      const found = errors(inIf("!(n)"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
    });

    it("suggests a numeric form for a non-bool", () => {
      const [found] = errors(inIf("n"));
      expect(found.helpText).toContain("n > 0");
    });

    it("accepts an equality and a relational comparison", () => {
      expect(errors(inIf("n = 1"))).toEqual([]);
      expect(errors(inIf("n > 0"))).toEqual([]);
      expect(errors(inIf("flag = true"))).toEqual([]);
    });

    it("requires EVERY leaf of a `&&` to be a comparison", () => {
      // The decomposition is the rule. `n > 0 && flag` has one good operand
      // and one bare bool, and a check that stopped at the first would pass it.
      expect(errors(inIf("n > 0 && flag"))).toHaveLength(1);
      expect(errors(inIf("flag && n > 0"))).toHaveLength(1);
      expect(errors(inIf("n > 0 && flag = true"))).toEqual([]);
    });

    it("requires EVERY leaf of a `||` to be a comparison", () => {
      expect(errors(inIf("n > 0 || flag"))).toHaveLength(1);
      expect(errors(inIf("n > 0 || flag = true"))).toEqual([]);
    });

    it("rejects a ternary used as a condition", () => {
      const found = errors(
        "u32 n <- 1;\nvoid t() {\n    if ((n > 0) ? 1 : 0) { }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
      expect(found[0].message).toContain("ternary");
    });
  });

  describe("#1195 -- a bracketed operand is judged by what it holds", () => {
    // A parenthesized comparison is a comparison. The brackets used to make
    // every operand look like a bare value, so ordinary defensive style was
    // rejected while the same condition without them compiled.
    it.each([
      "(n > 0)",
      "((n > 0))",
      "(n > 0) && (n < 5)",
      "((n > 0) && (n < 5))",
      "(n = 0) || (n >= 32)",
      "(flag = true)",
      "(n > 0) && flag = true",
    ])("accepts %s", (condition) => {
      expect(errors(inIf(condition))).toEqual([]);
    });

    // Unwrapping must let nothing through that is rejected unbracketed. Only
    // a bare group unwraps, so every other shape -- a prefix, a postfix, an
    // operator outside the brackets -- stays one operand, judged as written.
    // Each case puts the group FIRST: without a group the operand is declined
    // at the last step whether or not a guard exists, so it proves nothing.
    // `(flag) && (n)` has two bad operands and must still report once.
    it.each([
      "(flag)",
      "((flag))",
      "((n))",
      "(n > 0) && (flag)",
      "(flag) && (n > 0)",
      "(flag) && (n)",
      "!(n > 0)",
      "(n > 0) | 1",
      "(n > 0) ^ 1",
      "(n > 0) & 1",
      "(n > 0) << 1",
      "(n > 0) + 1",
      "(n > 0) * 2",
      "(n > 0)[0]",
    ])("still rejects %s, once", (condition) => {
      const found = errors(inIf(condition));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
    });
  });

  describe("E0702 -- a condition may not call a function", () => {
    const withCall = (condition: string): string =>
      `bool isValid() {\n    return true;\n}\nvoid t() {\n    if (${condition}) { }\n}`;

    it("rejects a call, with a real position", () => {
      const found = errors(withCall("isValid() = true"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0702");
      expect(found[0].span.line).toBe(5);
    });

    it("rejects a call inside a bracketed comparison as a call", () => {
      // #1195: the brackets hid the call, and the operand was reported as a
      // bare value (E0701) -- the wrong rule for what the author wrote.
      const found = errors(withCall("(isValid() = true)"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0702");
    });

    // #1195 review: a call wrapped in its own brackets runs exactly as the
    // bare call does, so it is a call in the condition however it is spelled
    // -- on the right of `&&`/`||` too, which is what MISRA 13.5 forbids.
    it.each([
      "(isValid()) = true",
      "n > 0 && (isValid()) = true",
      "(n > 0) && ((isValid()) = true)",
      "n < 5 || ((isValid())) != false",
    ])("rejects the bracketed call in %s", (condition) => {
      const found = errors(
        `bool isValid() {\n    return true;\n}\nu32 n <- 1;\nvoid t() {\n    if (${condition}) { }\n}`,
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0702");
    });

    it("says nothing about brackets that hold no call", () => {
      expect(errors(inIf("(n + 1) > 0 && (flag = true)"))).toEqual([]);
    });

    it("rejects a negated and a double-negated call", () => {
      expect(errors(withCall("!isValid()"))[0].code).toBe("E0702");
      expect(errors(withCall("!!isValid()"))[0].code).toBe("E0702");
    });

    it("accepts the call hoisted out of the condition", () => {
      // What the diagnostic tells the author to do. A rule that rejected the
      // CALL rather than the call IN A CONDITION would fail here.
      expect(
        errors(
          [
            "bool isValid() {",
            "    return true;",
            "}",
            "void t() {",
            "    bool ready <- isValid();",
            "    if (ready = true) { }",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });

  describe("the five productions that carry a controlling expression", () => {
    // The enumeration is the risk: they are five listener methods, and a sixth
    // production added later would be silently unchecked. Each is asserted
    // here, and `controlling-expression-every-kind-error` asserts all five at
    // once so a dropped kind changes that fixture's diagnostic COUNT.
    const cases: [string, string][] = [
      ["if", "void t() {\n    u32 n <- 1;\n    if (n) { }\n}"],
      ["while", "void t() {\n    u32 n <- 1;\n    while (n) { }\n}"],
      ["do-while", "void t() {\n    u32 n <- 1;\n    do { } while (n);\n}"],
      [
        "for",
        "void t() {\n    u32 n <- 1;\n    for (u32 i <- 0; n; i +<- 1) { }\n}",
      ],
      ["ternary", "void t() {\n    u32 n <- 1;\n    u32 r <- (n) ? 1 : 0;\n}"],
    ];

    it.each(cases)("reports a bare value in a %s condition", (kind, source) => {
      const found = errors(source);
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
      expect(found[0].message).toContain(kind);
    });

    it("says nothing about `forever`, which has no condition", () => {
      // The one loop with no controlling expression, which is the point of it.
      // A rule that invented one would reject the language's own idiom.
      expect(
        errors(
          "mut u32 n <- 1;\nvoid t() {\n    forever {\n        n <- 1;\n    }\n}",
        ),
      ).toEqual([]);
    });

    it("says nothing about `for (;;)`, which E0707 owns", () => {
      expect(
        errors("void t() {\n    for (;;) { }\n}").filter(
          (e) => e.code === "E0701",
        ),
      ).toEqual([]);
    });
  });
});
