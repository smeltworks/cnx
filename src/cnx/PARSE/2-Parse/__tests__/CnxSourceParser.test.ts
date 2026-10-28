/**
 * Unit tests for CnxSourceParser.
 * Tests cnx source parsing with error collection.
 */

import { describe, expect, it } from "vitest";
import CnxSourceParser from "../CnxSourceParser";

describe("CnxSourceParser", () => {
  describe("parse", () => {
    it("parses valid cnx source and returns tree with no errors", () => {
      const source = `u32 x <- 5;`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(0);
      expect(result.tree).toBeDefined();
      expect(result.tokenStream).toBeDefined();
      expect(result.declarationCount).toBe(1);
    });

    it("collects syntax errors with line and column info", () => {
      const source = `u32 x <- ;`; // Missing value

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors.length).toBeGreaterThan(0);
      expect(result.parseErrors[0].line).toBe(1);
      expect(result.parseErrors[0].column).toBeGreaterThanOrEqual(0);
      expect(result.parseErrors[0].severity).toBe("error");
      expect(result.parseErrors[0].message).toBeDefined();
    });

    it("returns tree even when there are parse errors", () => {
      const source = `u32 x <- ;`; // Invalid syntax

      const result = CnxSourceParser.parse(source);

      // Tree is still returned (partial parse)
      expect(result.tree).toBeDefined();
      expect(result.tokenStream).toBeDefined();
    });

    it("counts multiple declarations correctly", () => {
      const source = `
        u32 x <- 5;
        u32 y <- 10;
        void foo() { }
      `;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(0);
      expect(result.declarationCount).toBe(3);
    });

    it("handles empty source", () => {
      const source = ``;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(0);
      expect(result.declarationCount).toBe(0);
    });

    it("collects lexer errors for invalid characters", () => {
      // Backtick is not a valid cnx character - should trigger lexer error
      const source = "u32 x <- `invalid`;";

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors.length).toBeGreaterThan(0);
      expect(result.parseErrors[0].severity).toBe("error");
    });

    it("does not throw on malformed input", () => {
      // Even severely malformed input should return a result, not throw
      const source = "{{{{[[[[";

      expect(() => CnxSourceParser.parse(source)).not.toThrow();
      const result = CnxSourceParser.parse(source);
      expect(result.tree).toBeDefined();
    });
  });

  /**
   * #1306 / ADR-016: a nested scope is rejected with E0430 rather than ANTLR's
   * recovery text.
   *
   * These cases exist because the corpus fixtures cannot reach them. The
   * over-enforcement cases below stay green under a mutation that deletes the
   * rule-stack half of the predicate -- and pinning them as `.expected.error`
   * fixtures would mean asserting the raw ANTLR token list, which is the exact
   * thing #1306 removes. So they are asserted here instead.
   */
  describe("nested scope rejection (E0430)", () => {
    it("reports E0430 at the inner scope keyword", () => {
      const source = `scope Outer {
    u8 v <- 1;
    scope Inner {
        u8 w <- 2;
    }
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(1);
      expect(result.parseErrors[0].message).toBe(
        "error[E0430]: nested scopes are not allowed (ADR-016)",
      );
      // The advice sits on `help:`, the shape every other coded diagnostic uses.
      expect(result.parseErrors[0].helpText).toBe(
        "close the enclosing scope before declaring another, or use a flat scope such as Hardware_GPIO",
      );
      expect(result.parseErrors[0].line).toBe(3);
      expect(result.parseErrors[0].column).toBe(4);
    });

    it("names the missing brace first, because it cannot tell the two apart", () => {
      // A forgotten `}` before the next `scope` produces a token stream IDENTICAL
      // to a deliberate nesting -- the recognizer has nothing to separate them.
      // This author nested nothing, so advice that only said "use a flat scope"
      // sent them looking at the wrong line (#1306 review).
      const source = `scope A {
    u8 x <- 1;

scope B {
    u8 y <- 2;
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors[0].message).toContain("error[E0430]");
      expect(result.parseErrors[0].helpText).toMatch(
        /^close the enclosing scope/,
      );
    });

    it("reports E0430 when the nested scope carries a visibility modifier", () => {
      // The prefixed form reaches the listener through a different ANTLR path:
      // the innermost rule is `scopeMember`, not `scopeDeclaration`, and the
      // exception is a NoViableAltException rather than null. Both spellings must
      // match or half the syntax goes unreported.
      const source = `scope Outer {
    private scope Inner { u8 w <- 2; }
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors[0].message).toContain("error[E0430]");
      expect(result.parseErrors[0].line).toBe(2);
    });

    it("suppresses the recovery cascade so only the rule is reported", () => {
      // ANTLR moves the inner block out, then calls the outer `}` extraneous.
      // Without suppression the fixture would assert a ~30-token expectation set.
      const source = `scope Outer {
    scope Inner { u8 w <- 2; }
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(1);
    });

    it("reports every nested scope, not just the first", () => {
      // The cascade latch must drop recovery noise without swallowing a second
      // genuine finding.
      const source = `scope A {
    scope B { u8 x <- 1; }
}
scope C {
    scope D { u8 y <- 2; }
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(2);
      expect(result.parseErrors[1].message).toContain("error[E0430]");
      expect(result.parseErrors[1].line).toBe(5);
    });

    // OVER-ENFORCEMENT CONTROLS. A `scope` keyword in one of these positions is
    // still a syntax error, but it is NOT a nested scope, and calling it one would
    // tell the user to flatten a scope they never nested.
    it.each([
      ["a struct body", `struct S {\n    scope B { u8 x <- 1; }\n}`],
      ["a function body", `void main() {\n    scope B { u8 x <- 1; }\n}`],
      [
        "a register body",
        `register R @ 0x40000000 {\n    scope B { u8 x <- 1; }\n}`,
      ],
    ])(
      "does not claim a nested scope for a scope keyword in %s",
      (_, source) => {
        const result = CnxSourceParser.parse(source);

        expect(result.parseErrors.length).toBeGreaterThan(0);
        for (const error of result.parseErrors) {
          expect(error.message).not.toContain("E0430");
        }
      },
    );

    it("stays silent for a scope holding every legal member kind", () => {
      // The six alternatives `scopeMember` admits. Five open a brace, so a check
      // written against braces rather than against the `scope` keyword would fire
      // here.
      const source = `scope Legal {
    u8 plainValue <- 10;
    public enum Mode { OFF, ON }
    public struct Point { u32 x; }
    public bitmap8 Flags { Alpha, Rest[7] }
    register CTRL @ 0x40000000 { DR: u32 rw @ 0x00, }
    public u8 read() { return this.plainValue; }
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(0);
    });

    it("still reports an unrelated later error in the same file", () => {
      // The suppression covers the recovery's OWN noise -- the `no viable
      // alternative` inside the rejected construct, and the `}` left at file
      // scope by the block ANTLR moves out. It used to drop every later parser error,
      // so `u8 y <- ;` in a SEPARATE top-level function went unreported and the
      // author met it only after fixing the scope and re-running. That is a
      // different declaration, not a structure already known to be wrong
      // (#1306 review).
      const source = `scope Outer {
    scope Inner { u8 w <- 2; }
}

void main() {
    u8 y <- ;
}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(2);
      expect(result.parseErrors[0].message).toContain("error[E0430]");
      expect(result.parseErrors[1].message).not.toContain("E0430");
      expect(result.parseErrors[1].line).toBe(6);
    });

    it("still reports an ordinary syntax error when no scope is nested", () => {
      // The latch must not be armed by unrelated failures.
      const source = `scope A { u8 x <- 1; }
void main() { u8 y <- ; }`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors.length).toBeGreaterThan(0);
      expect(result.parseErrors[0].message).not.toContain("E0430");
    });
  });

  /**
   * Issue #2366: the C idiom `foo(void)` for a zero-parameter function is
   * rejected with E0926 rather than ANTLR's raw "missing IDENTIFIER" text.
   *
   * The one genuine near-miss -- `foo(const)`, a bare modifier with no type
   * or name, which fails from the SAME rule with the SAME offending ')' as
   * the real bug -- stays green under a mutation that drops the
   * previous-token check and keys only on the rule and the offending symbol
   * (verified by mutation during development). Pinning it as a
   * `.expected.error` fixture would mean asserting ANTLR's raw "expecting
   * {...}" token list, the exact kind of brittle, unrelated-to-this-bug text
   * #1306's precedent (above) avoids pinning. So it is asserted here instead.
   */
  describe("void parameter rejection (E0926)", () => {
    it("reports E0926 at the offending ')' for a C-style empty parameter list", () => {
      const source = `u32 main(void) {\n    return 0;\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(1);
      expect(result.parseErrors[0].message).toBe(
        "error[E0926]: 'void' is not a valid parameter type",
      );
      expect(result.parseErrors[0].helpText).toBe(
        "cnx has no C-style (void) parameter -- declare a zero-parameter function as foo(), or remove the void parameter if other parameters remain",
      );
      expect(result.parseErrors[0].line).toBe(1);
      expect(result.parseErrors[0].column).toBe(13);
    });

    it("reports E0926 for every void parameter, not just the first", () => {
      const source = `u32 main(void) {\n    return 0;\n}\nvoid helper(void) {\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(2);
      expect(result.parseErrors[0].message).toContain("E0926");
      expect(result.parseErrors[1].message).toContain("E0926");
    });

    it("reports E0926 when void trails a real parameter", () => {
      const source = `u32 f(i32 x, void) {\n    return x;\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(1);
      expect(result.parseErrors[0].message).toContain("E0926");
    });

    it("reports E0926 when void leads a real parameter, off the comma it leaves behind", () => {
      // The offending token here is the ',' that was meant to separate
      // parameters, not ')' -- the predicate keys on the token BEFORE the
      // offending one (always VOID) rather than the offending one itself
      // (which varies by shape), precisely so this case is caught too.
      const source = `u32 f(void, i32 x) {\n    return x;\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(1);
      expect(result.parseErrors[0].message).toContain("E0926");
    });

    it("does not misfire on the correct zero-parameter form", () => {
      const source = `u32 main() {\n    return 0;\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(0);
    });

    it("does not misfire on a parameter name that merely contains 'void'", () => {
      const source = `u32 f(i32 avoid) {\n    return avoid;\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors).toHaveLength(0);
    });

    // OVER-ENFORCEMENT CONTROL. A bare `const` with no type or name fails
    // from the same rule (RULE_parameter) with the same offending ')' as the
    // real bug -- but `type_()` never matched here, so the token before the
    // offending one is CONST, never VOID.
    it("does not claim E0926 for a bare 'const' with no type or name", () => {
      const source = `u32 main(const) {\n    return 0;\n}`;

      const result = CnxSourceParser.parse(source);

      expect(result.parseErrors.length).toBeGreaterThan(0);
      for (const error of result.parseErrors) {
        expect(error.message).not.toContain("E0926");
      }
    });
  });
});
