/**
 * Unit tests for UndeclaredValueAnalyzer (E0427, #1353).
 *
 * The scope-qualified branch is the one no integration fixture reaches: it is
 * taken only when a bare name fails every unqualified lookup and then succeeds
 * under its scope-qualified spelling. A scope-declared register is the clearest
 * case, and it is also what #1336 made the value position responsible for --
 * `isValueName` answers yes for a register while `isTypeName` answers no.
 */
import { describe, it, expect } from "vitest";
import UndeclaredValueAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/UndeclaredValueAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

function analyze(source: string) {
  // Same precondition as E0426: the analyzer declines unless the transpiler
  // knows the file's whole name universe. These sources include nothing.
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
    overrides: { reachesForeignHeader: false },
  });
  return new UndeclaredValueAnalyzer(context).analyze(syntax);
}

describe("UndeclaredValueAnalyzer", () => {
  describe("the scope-qualified spelling", () => {
    it("accepts a scope-declared register named bare inside its scope", () => {
      // `Control` resolves only as `Board__Control`, and only through
      // `isValueName` -- `isTypeName` rejects a register by design (#1336).
      expect(
        analyze(`
          scope Board {
              public register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
              public void go() {
                  Control.DR <- 0x01;
              }
          }
        `),
      ).toHaveLength(0);
    });

    it("accepts a scope-declared register read bare inside its scope", () => {
      expect(
        analyze(`
          scope Board {
              public register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
              public u32 read() {
                  u32 seen <- Control.DR;
                  return seen;
              }
          }
        `),
      ).toHaveLength(0);
    });

    it("still rejects a name that no spelling resolves, inside a scope", () => {
      const errors = analyze(`
        scope Board {
            public u32 go() {
                return Nowhere;
            }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
      expect(errors[0].identifier).toBe("Nowhere");
    });
  });

  describe("the unqualified spelling", () => {
    it("accepts a global register in a value position", () => {
      expect(
        analyze(`
          register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
          u32 main() {
              u32 seen <- Control.DR;
              return seen;
          }
        `),
      ).toHaveLength(0);
    });

    it("rejects an undeclared name (E0427)", () => {
      const errors = analyze(`u32 main() { return Nowhere; }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
    });
  });

  /**
   * #1582. An assignment target is its own grammar rule, so the write position
   * is reached by its own listener hook -- but it must answer the SAME question
   * the read position answers, except where the spelling states otherwise.
   */
  describe("the write position", () => {
    it.each([
      ["a bare name declared nowhere", `u32 main() { nope <- 5; return 0; }`],
      [
        "a name local to another function",
        `void other() { u32 witness <- 1; }
         u32 main() { witness <- 5; return 0; }`,
      ],
      [
        "the base of a subscripted target",
        `u32 main() { nopeArr[0] <- 5; return 0; }`,
      ],
      [
        "the base of a member target",
        `u32 main() { nopeObj.field <- 5; return 0; }`,
      ],
      [
        "a `for` init clause",
        `u32 main() { u32 i <- 0; for (nopeInit <- 0; i < 3; i +<- 1) { } return 0; }`,
      ],
      [
        "a `for` update clause",
        `u32 main() { u32 i <- 0; for (i <- 0; i < 3; nopeUpdate +<- 1) { } return 0; }`,
      ],
    ])("rejects %s", (_label, source) => {
      const errors = analyze(source);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
    });

    it.each([
      ["a local", `u32 main() { mut u32 here <- 0; here <- 1; return 0; }`],
      [
        "a file-scope variable named bare",
        `mut u32 shared <- 0;
         u32 main() { shared <- 1; return 0; }`,
      ],
      [
        "a file-scope variable named through `global.`",
        `mut u32 shared <- 0;
         u32 main() { global.shared <- 1; return 0; }`,
      ],
      [
        "a scope member named through `this.`",
        `scope Motor { mut u32 speed <- 0;
           public u32 spin() { this.speed <- 1; return 0; } }`,
      ],
    ])("accepts %s", (_label, source) => {
      expect(analyze(source)).toHaveLength(0);
    });

    it("leaves `this.` outside a scope to E0431, rather than adding a second diagnostic", () => {
      expect(
        analyze(`u32 main() { this.whatever <- 1; return 0; }`),
      ).toHaveLength(0);
    });
  });

  /**
   * #1582. The two positions are reached by two listener hooks -- a write
   * target is its own grammar rule, and a rooted read takes its name from the
   * first postfix op rather than the primary -- but they ask ONE question, and
   * this table is that claim rather than a restatement of it: every row runs
   * BOTH ways and must answer the same.
   *
   * The pair is the assertion, in both directions. The first fix for #1582
   * gave the write position ADR-016's root split and left the read position
   * root-blind, so `this.declaredAtFileScope <- 8` was rejected while
   * `u32 v <- this.declaredAtFileScope` beside it emitted
   * `Motor__declaredAtFileScope` -- a name nothing declares -- at exit 0.
   * A single-position table cannot fail on that.
   */
  // #1991: the walk reads 1.2's syntax, so each place a name can stand is
  // listed here rather than found by a tree walk that visits them all.
  describe("every position 1.2 records", () => {
    function namesAndCarets(source: string) {
      const lines = source.split("\n");
      return analyze(source).map((e) => [
        e.identifier,
        e.span.column === lines[e.span.line - 1].indexOf(e.identifier),
      ]);
    }

    it("asks a chain's head once, not again as its primary", () => {
      expect(
        namesAndCarets(
          `u32 main() {\n    u32 v <- Missing.x;\n    return v;\n}`,
        ),
      ).toEqual([["Missing", true]]);
    });

    it("reaches a name inside parentheses and a type's dimension", () => {
      expect(
        namesAndCarets(
          `u32 main() {\n    u8[Size] a;\n    u32 v <- (Inner);\n    return v;\n}`,
        ),
      ).toEqual([
        ["Size", true],
        ["Inner", true],
      ]);
    });

    it("leaves a call's target to E0422 but still reads its arguments", () => {
      expect(
        namesAndCarets(
          `u32 known(u32 a) { return a; }\nu32 main() {\n    u32 v <- known(Arg);\n    u32 w <- missingFn();\n    return v + w;\n}`,
        ),
      ).toEqual([["Arg", true]]);
    });
  });

  describe("reads and writes ask one question", () => {
    const inScope = (body: string): string => `
      u32 declaredAtFileScope <- 0;
      scope Motor {
          u32 speed <- 0;
          public u32 spin() { ${body} return 0; }
      }
    `;

    it.each([
      ["a scope's own member through `this.`", "this.speed", null],
      [
        "a file-scope global through `global.`",
        "global.declaredAtFileScope",
        null,
      ],
      ["a file-scope global bare, inside a scope", "declaredAtFileScope", null],
      // The discriminating row: visible bare, and NOT a member of `Motor`. An
      // implementation that ignores the root finds it on the outward walk and
      // stays silent. Every other rooted row is visible both ways or neither.
      [
        "a file-scope global through `this.`",
        "this.declaredAtFileScope",
        "declaredAtFileScope",
      ],
      ["a scope member through `global.`", "global.speed", "speed"],
      ["a name declared nowhere, bare", "nothingAnywhere", "nothingAnywhere"],
      [
        "a name declared nowhere, through `this.`",
        "this.noSuchMember",
        "noSuchMember",
      ],
      [
        "a name declared nowhere, through `global.`",
        "global.noSuchGlobal",
        "noSuchGlobal",
      ],
    ])(
      "answers %s the same way read and written",
      (_label, spelling, named) => {
        for (const body of [`u32 sink <- ${spelling};`, `${spelling} <- 1;`]) {
          const errors = analyze(inScope(body));
          if (named === null) {
            expect(errors).toHaveLength(0);
            continue;
          }
          expect(errors).toHaveLength(1);
          expect(errors[0].code).toBe("E0427");
          expect(errors[0].identifier).toBe(named);
        }
      },
    );

    it.each([
      ["read", "u32 sink <- this.nope;"],
      ["write", "this.nope <- 1;"],
    ])(
      "puts the caret on the identifier, not the `this` keyword, on a %s",
      (_label, body) => {
        const source = inScope(body);
        const errors = analyze(source);
        expect(errors).toHaveLength(1);
        expect(errors[0].identifier).toBe("nope");

        // Derived from the source rather than written down, so a change to the
        // template's indentation cannot turn this into a stale number. `this` sits exactly
        // five columns earlier -- asserted below so the equality is known to
        // DISCRIMINATE, which `toBeGreaterThan(0)` never did: it holds for the
        // keyword's column too, and the caret regression it is named for would
        // leave it green.
        const line = source.split("\n")[errors[0].span.line - 1];
        expect(errors[0].span.column).toBe(line.indexOf("nope"));
        expect(line.indexOf("this.")).toBe(errors[0].span.column - 5);
      },
    );
  });

  /**
   * #1629. A case label is its own grammar rule, so it is reached by its own
   * hook, which asks the same question in each spelling the label admits.
   */
  describe("the case-label position", () => {
    const inSwitch = (label: string) => `
      const u8 REAL <- 1;
      enum EMode { IDLE, RUN }
      scope Panel {
          const u8 OWN <- 3;
          public u32 pick(u8 s) {
              switch (s) {
                  case ${label} { return 1; }
                  default { return 0; }
              }
          }
      }
    `;

    it.each([
      ["a bare name", "NOPE", "NOPE"],
      ["a `this.` name", "this.NOPE", "NOPE"],
      ["a `global.` name", "global.NOPE", "NOPE"],
      ["a file const asked of the scope", "this.REAL", "REAL"],
      ["the head of a qualified label", "NOPE.RUN", "NOPE"],
    ])("rejects %s that names nothing", (_label, label, name) => {
      const source = inSwitch(label);
      const errors = analyze(source);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
      expect(errors[0].identifier).toBe(name);
      const line = source.split("\n")[errors[0].span.line - 1];
      expect(errors[0].span.column).toBe(
        line.indexOf(name, line.indexOf("case")),
      );
    });

    it.each([
      ["a visible const", "REAL"],
      ["a scope const", "OWN"],
      ["a `this.` const", "this.OWN"],
      ["a `global.` const", "global.REAL"],
      ["a qualified enum member", "EMode.RUN"],
      ["a literal", "7"],
    ])("accepts %s", (_label, label) => {
      expect(analyze(inSwitch(label))).toHaveLength(0);
    });
  });
});
