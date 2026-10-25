import { describe, expect, it } from "vitest";

import EnumTypeSafetyAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/EnumTypeSafetyAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-017 enum type safety: E0428 (assignment) and E0434 (comparison),
 * replacing EIGHT throws in `output/` -- five in `EnumAssignmentValidator` and
 * three in `BinaryExprUtils`.
 *
 * The rule needs `knownEnums`, which 1.3 and 1.4 settle from the enums each
 * test's source declares -- the same path as production.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new EnumTypeSafetyAnalyzer(context).analyze(syntax);
};

describe("EnumTypeSafetyAnalyzer", () => {
  describe("assignment (E0428)", () => {
    it("rejects an integer literal, with a real position", () => {
      const found = errors(
        "enum State { IDLE, RUNNING }\nvoid main() {\n    State s <- State.IDLE;\n    s <- 1;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0428");
      expect(found[0].span.line).toBe(4);
      expect(found[0].span.column).toBeGreaterThan(0);
      expect(found[0].message).toContain("integer");
    });

    it("rejects an arithmetic expression of integers -- the folded case", () => {
      // REGRESSION. The codegen check matched the source text against a pattern for a bare
      // integer literal, so `1 + 1` was not one; constant folding to `2`
      // happens later, in codegen, and it emitted `State d = 2;`.
      const found = errors(
        "enum State { IDLE, RUNNING }\nvoid main() {\n    State d <- 1 + 1;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("integer");
    });

    it("rejects a member of a different enum", () => {
      const found = errors(
        "enum State { IDLE }\nenum Power { ON }\nvoid main() {\n    State s <- Power.ON;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toBe("Cannot assign Power enum to State enum");
    });

    // The three assignments the rule must stay SILENT on. One table rather
    // than three near-identical cases, with each row's reason kept: they are
    // the controls this rule turns on, and a reader needs to know why each one
    // is legal, not just that it passes.
    it.each([
      [
        "a member of the target enum",
        "enum State { IDLE, RUNNING }\nvoid main() {\n    State s <- State.IDLE;\n}",
      ],
      [
        // Typing a cast by what is INSIDE the parentheses would see the
        // literal and reject the form ADR-017 sanctions.
        "an explicit cast, which ADR-017 makes the conversion",
        "enum State { IDLE }\nvoid main() {\n    State s <- (State)1;\n}",
      ],
      [
        // An undeclared name is E0427's to report. Guessing here would produce
        // a second diagnostic for one mistake, and would fire on valid code
        // wherever this resolver has a gap.
        "a value nothing declares",
        "enum State { IDLE }\nvoid main() {\n    State s <- undeclared;\n}",
      ],
    ])("accepts %s", (_reason, source) => {
      expect(errors(source)).toEqual([]);
    });

    it("reports every offending assignment, not just the first", () => {
      const found = errors(
        "enum State { IDLE }\nvoid main() {\n    State a <- 1;\n    State b <- 2;\n}",
      );
      expect(found).toHaveLength(2);
    });

    it("says nothing about a compound operator, which is E0857's", () => {
      // One mistake must not yield two diagnostics.
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    mut State s <- State.IDLE;\n    s +<- 1;\n}",
        ).filter((e) => e.code === "E0428"),
      ).toEqual([]);
    });
  });

  describe("comparison (E0434)", () => {
    it("rejects an enum compared to an integer", () => {
      const found = errors(
        "enum State { IDLE }\nvoid main() {\n    State s <- State.IDLE;\n    if (s = 0) { }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0434");
      expect(found[0].span.line).toBe(4);
    });

    it("rejects two different enum types", () => {
      const found = errors(
        "enum State { IDLE }\nenum Power { ON }\nvoid main() {\n    State s <- State.IDLE;\n    if (s = Power.ON) { }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toBe("Cannot compare State enum to Power enum");
    });

    it("accepts an enum compared to its own member", () => {
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    State s <- State.IDLE;\n    if (s = State.IDLE) { }\n}",
        ),
      ).toEqual([]);
    });

    it("accepts a comparison with no enum on either side", () => {
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    u32 n <- 1;\n    if (n = 0) { }\n}",
        ),
      ).toEqual([]);
    });
  });

  describe("name resolution", () => {
    it("resolves a scope's own enum written bare, with `this.`, and qualified", () => {
      // The three spellings of one type. An earlier version resolved only some
      // of them, which INVERTED the rule inside a scope: correct assignments
      // were reported as non-enum values, and twelve fixtures caught it.
      const source = [
        "scope Motor {",
        "    public enum Mode { SLOW, FAST }",
        "    public this.Mode bare() {",
        "        this.Mode a <- Mode.SLOW;",
        "        this.Mode b <- this.Mode.FAST;",
        "        return a;",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });

    it("resolves a global enum written with `global.`", () => {
      // `global.` states FILE scope, so it must NOT be qualified by the
      // enclosing scope -- doing so produced a name matching nothing, which
      // read as "not an enum".
      const source = [
        "enum EGlobal { A, B }",
        "scope S {",
        "    public EGlobal read() {",
        "        global.EGlobal v <- global.EGlobal.A;",
        "        return v;",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });
  });
});

// #1991: read off 1.2's syntax, a `for` header's declaration is a site like any
// other -- the parse-tree listener hooked `variableDeclaration` alone, so
// `for (State s <- 1; ...)` compiled.
describe("EnumTypeSafetyAnalyzer -- sites on 1.2's syntax", () => {
  const at = (body: readonly string[]) =>
    errors(
      [
        "enum State { IDLE, RUNNING }",
        "scope S {",
        "    State held <- 1;",
        "}",
        "void main(u8 i) {",
        ...body.map((line) => `    ${line}`),
        "}",
      ].join("\n"),
    ).map((e) => `${e.code}@${e.span.line}:${e.span.column}`);

  it("reads a scope member, a for header and a comparison's right operand", () => {
    expect(
      at([
        "State s <- State.IDLE;",
        "for (State k <- 1; i < 3; i +<- 1) { }",
        "for (s <- 2; s = 1; s <- State.IDLE) { }",
        "s +<- 1;",
      ]),
    ).toEqual(["E0428@3:18", "E0428@7:20", "E0428@8:14", "E0434@8:21"]);
  });

  it("only equality and relational operators compare", () => {
    expect(
      at(["State s <- State.IDLE;", "u8 n <- s + 1;", "u8 m <- s & 1;"]),
    ).toEqual(["E0428@3:18"]);
  });

  it("a path of members that resolves to nothing names nothing", () => {
    expect(at(["State s <- this.Other.X;", "State t <- f();"])).toEqual([
      "E0428@3:18",
      "E0428@6:15",
    ]);
  });
});
