import { describe, expect, it } from "vitest";

import SwitchStatementAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/SwitchStatementAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-025's switch rules, E0711-E0714, replacing five throws in
 * `TypeValidator` that every one of them reported as `1:0`.
 *
 * These drive REAL SOURCE rather than mock contexts. The tests they replace
 * built `CaseLabelContext` mocks by hand, which can only ever assert that the
 * reader agrees with the mock -- and the case-label normalization is exactly
 * where a mock and the grammar could quietly disagree, since `-0x1` reaches it
 * as a MINUS token plus a HEX_LITERAL rather than as one negative literal.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new SwitchStatementAnalyzer(context).analyze(syntax);
};

describe("SwitchStatementAnalyzer", () => {
  it("rejects a switch on a bool, with a real position", () => {
    const found = errors(
      [
        "bool flag <- true;",
        "u32 main() {",
        "    switch (flag) {",
        "        case true { }",
        "        default { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0711");
    expect(found[0].span.line).toBe(3);
    expect(found[0].span.column).toBeGreaterThan(0);
  });

  it("rejects a switch with fewer than two clauses", () => {
    const found = errors(
      [
        "u32 main() {",
        "    u32 n <- 1;",
        "    switch (n) {",
        "        case 1 { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0712");
  });

  it("accepts two clauses, the boundary the rule is one past", () => {
    expect(
      errors(
        [
          "u32 main() {",
          "    u32 n <- 1;",
          "    switch (n) {",
          "        case 1 { }",
          "        default { }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("rejects a duplicate case value", () => {
    const found = errors(
      [
        "u32 main() {",
        "    u32 n <- 1;",
        "    switch (n) {",
        "        case 1 { }",
        "        case 1 { }",
        "        default { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0713");
    expect(found[0].message).toContain("'1'");
  });

  it("sees through the spelling: -1 and -0x1 are the same case", () => {
    // The reason the label value is normalized rather than compared as text.
    const found = errors(
      [
        "u32 main() {",
        "    i32 n <- 1;",
        "    switch (n) {",
        "        case -1 { }",
        "        case -0x1 { }",
        "        default { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0713");
  });

  it("does not confuse 0b10 with 10", () => {
    // The mirror of the case above: normalizing has to change the VALUE, not
    // just strip the prefix. `0b10` is 2, and 2 is not 10.
    expect(
      errors(
        [
          "u32 main() {",
          "    u32 n <- 1;",
          "    switch (n) {",
          "        case 0b10 { }",
          "        case 10 { }",
          "        default { }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  describe("rooted labels (#1629)", () => {
    const labels = (a: string, b: string) =>
      [
        "u8 LIMIT <- 1;",
        "scope Panel {",
        "    u8 LIMIT <- 3;",
        "    public u32 pick(u8 s) {",
        "        switch (s) {",
        `            case ${a} { return 1; }`,
        `            case ${b} { return 2; }`,
        "            default { return 0; }",
        "        }",
        "    }",
        "}",
      ].join("\n");

    it("rejects the same rooted label twice", () => {
      const found = errors(labels("this.LIMIT", "this.LIMIT"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0713");
      expect(found[0].message).toContain("'this.LIMIT'");
    });

    it("keeps `this.LIMIT` and `global.LIMIT` apart: they are two consts", () => {
      expect(errors(labels("this.LIMIT", "global.LIMIT"))).toEqual([]);
    });

    it("rejects `LIMIT` beside `this.LIMIT`: one const, two spellings", () => {
      const found = errors(labels("this.LIMIT", "LIMIT"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0713");
      expect(found[0].message).toContain("'LIMIT'");
    });

    it("rejects `this.State.RUN` beside `State.RUN` in its scope (#147)", () => {
      const found = errors(
        [
          "scope Motor {",
          "    enum State { IDLE, RUN }",
          "    public u32 pick(State s) {",
          "        switch (s) {",
          "            case State.IDLE { return 1; }",
          "            case State.RUN || this.State.RUN { return 2; }",
          "        }",
          "        return 0;",
          "    }",
          "}",
        ].join("\n"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0713");
      expect(found[0].message).toContain("'this.State.RUN'");
    });

    it("keeps a local `LIMIT` and `global.LIMIT` apart: two consts", () => {
      const found = errors(
        [
          "u8 LIMIT <- 1;",
          "u32 pick(u8 s) {",
          "    u8 LIMIT <- 5;",
          "    switch (s) {",
          "        case LIMIT { return 1; }",
          "        case global.LIMIT { return 2; }",
          "        default { return 0; }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      );
      expect(found).toEqual([]);
    });

    it("rejects a local `LIMIT` beside `global.LIMIT` of one value: one C case (#2046)", () => {
      const found = errors(
        [
          "u8 LIMIT <- 1;",
          "u32 pick(u8 s) {",
          "    u8 LIMIT <- 1;",
          "    switch (s) {",
          "        case LIMIT { return 1; }",
          "        case global.LIMIT { return 2; }",
          "        default { return 0; }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => [e.code, e.span.line])).toEqual([["E0713", 6]]);
    });

    it("rejects a const beside the literal it folds to (#2046)", () => {
      const found = errors(labels("LIMIT", "3"));
      expect(found.map((e) => e.code)).toEqual(["E0713"]);
    });

    it("rejects `Panel.LIMIT` beside `this.LIMIT`: one const (#2046)", () => {
      const found = errors(labels("this.LIMIT", "Panel.LIMIT"));
      expect(found.map((e) => e.code)).toEqual(["E0713"]);
    });

    it("rejects two consts with one value (#2046)", () => {
      const found = errors(labels("global.LIMIT", "1"));
      expect(found.map((e) => e.code)).toEqual(["E0713"]);
    });

    it("keys an enum-typed const label on its member, without a crash", () => {
      const found = errors(
        [
          "enum EMode { IDLE, RUN }",
          "const EMode M <- EMode.IDLE;",
          "u32 pick(EMode s) {",
          "    switch (s) {",
          "        case M { return 1; }",
          "        case EMode.RUN { return 2; }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      );
      expect(found).toEqual([]);
    });

    it("rejects an enum-typed const beside its member (#2046)", () => {
      const found = errors(
        [
          "enum EMode { IDLE, RUN }",
          "const EMode M <- EMode.IDLE;",
          "u32 pick(EMode s) {",
          "    switch (s) {",
          "        case M { return 1; }",
          "        case EMode.IDLE { return 2; }",
          "        case EMode.RUN { return 3; }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual(["E0713"]);
    });

    it("rejects a char-initialized const in two spellings (#2046)", () => {
      const found = errors(
        [
          "u8 K <- 'A';",
          "u32 pick(u8 s) {",
          "    switch (s) {",
          "        case K { return 1; }",
          "        case global.K { return 2; }",
          "        default { return 0; }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual(["E0713"]);
    });

    it("rejects the same character label twice", () => {
      const found = errors(labels("'a'", "'a'"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0713");
    });
  });

  describe("enum exhaustiveness (E0714)", () => {
    const source = (cases: string): string =>
      [
        "enum EState { IDLE, RUNNING, STOPPED }",
        "u32 main() {",
        "    EState s <- EState.IDLE;",
        "    switch (s) {",
        cases,
        "    }",
        "    return 0;",
        "}",
      ].join("\n");

    it("rejects a switch that misses a variant", () => {
      const found = errors(
        source("        case EState.IDLE { }\n        case EState.RUNNING { }"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0714");
      expect(found[0].message).toContain("missing 1");
    });

    it("accepts a switch that covers every variant", () => {
      expect(
        errors(
          source(
            "        case EState.IDLE { }\n        case EState.RUNNING { }\n        case EState.STOPPED { }",
          ),
        ),
      ).toEqual([]);
    });

    it("counts what a `default(N)` says it absorbs", () => {
      expect(
        errors(source("        case EState.IDLE { }\n        default(2) { }")),
      ).toEqual([]);
    });

    it("rejects a `default(N)` whose count does not add up", () => {
      const found = errors(
        source("        case EState.IDLE { }\n        default(1) { }"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0714");
      expect(found[0].message).toContain("2 of 3");
    });

    it("says nothing about a bare `default`, which states no count", () => {
      // A `default` with no number makes no claim about how many variants it
      // absorbs, so there is nothing to check. Treating it as covering zero
      // would reject every switch that uses one.
      expect(
        errors(source("        case EState.IDLE { }\n        default { }")),
      ).toEqual([]);
    });

    it("says nothing when the switch expression is not an enum", () => {
      expect(
        errors(
          [
            "enum EState { IDLE, RUNNING, STOPPED }",
            "u32 main() {",
            "    u32 n <- 1;",
            "    switch (n) {",
            "        case 1 { }",
            "        default { }",
            "    }",
            "    return 0;",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });

  describe("case values as 1.2 returned them (#1991)", () => {
    const sw = (labels: string) =>
      `void f(i32 v) {\n    switch (v) {\n${labels}\n        default {\n        }\n    }\n}`;

    it("tells a negative label from a positive one", () => {
      expect(
        errors(sw("        case -1 {\n        }\n        case 1 {\n        }")),
      ).toEqual([]);
    });

    it("compares a binary label by value, and a char label as written, at the label", () => {
      const binary = errors(
        sw("        case 0b11 {\n        }\n        case 3 {\n        }"),
      );
      expect(binary.map((e) => [e.code, e.span.line])).toEqual([["E0713", 5]]);
      const chars = errors(
        sw("        case 'a' {\n        }\n        case 'a' {\n        }"),
      );
      expect(chars.map((e) => [e.code, e.span.line])).toEqual([["E0713", 5]]);
    });

    it("tells two char labels apart", () => {
      expect(
        errors(
          sw("        case 'a' {\n        }\n        case 'b' {\n        }"),
        ),
      ).toEqual([]);
    });

    it("reports a bare enum member label at the label", () => {
      const found = errors(
        `enum Color { RED, GREEN }\n${sw("        case 1 {\n        }\n        case RED {\n        }")}`,
      );
      expect(found.map((e) => [e.code, e.span.line, e.span.column])).toEqual([
        ["E0424", 6, 13],
      ]);
    });

    it("checks a switch in a scope's method", () => {
      const found = errors(
        "scope S {\n    public void f(bool b) {\n        switch (b) {\n            default {\n            }\n        }\n    }\n}",
      );
      expect(found.map((e) => e.code)).toEqual(["E0711"]);
    });
  });

  describe("a label must be a constant (E0717, #2051)", () => {
    const pick = (label: string) =>
      errors(
        [
          "mut u8 counter <- 2;",
          "u8 REAL <- 1;",
          "enum EMode { IDLE, RUN }",
          "struct Pt { u8 x; }",
          "scope Panel {",
          "    mut u8 level <- 1;",
          "    u8 OWN <- 3;",
          '    public string<4> S <- "ab";',
          "    public enum State { STOPPED, GOING }",
          "    bitmap8 Flags { a, b, c, d, e, f, g, h }",
          "    public u8 helper() { return 1; }",
          "    public u32 pick(u8 s, u8 p) {",
          "        u8 K <- 5;",
          '        string<4> L <- "x";',
          "        switch (s) {",
          `            case ${label} { return 1; }`,
          "            default { return 0; }",
          "        }",
          "    }",
          "}",
        ].join("\n"),
      );

    it.each([
      "level",
      "this.level",
      "global.counter",
      "counter",
      "helper",
      "this.helper",
      "global.Panel",
      "Panel.level",
      "Panel.helper",
      "p",
      "this.State",
      "State",
      "Panel.State",
      "global.EMode",
      "EMode",
      "global.Pt",
      "Pt",
      "this.Flags",
      "this.Flags.a",
      "global.Pt.x",
      "Pt.x",
      "this.S",
      "S",
      "Panel.S",
      "L",
    ])("rejects `%s`", (label) => {
      const found = pick(label);
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0717");
      expect(found[0].message).toBe(`Case label '${label}' is not a constant`);
    });

    it.each([
      "OWN",
      "this.OWN",
      "global.REAL",
      "REAL",
      "Panel.OWN",
      "K",
      "9",
      "this.State.STOPPED",
      "Panel.State.GOING",
      "global.EMode.RUN",
      "EMode.RUN",
    ])("accepts `%s`", (label) => {
      expect(pick(label)).toEqual([]);
    });
  });
});
