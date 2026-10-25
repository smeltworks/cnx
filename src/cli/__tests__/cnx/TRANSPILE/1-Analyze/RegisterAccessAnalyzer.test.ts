import { describe, expect, it } from "vitest";

import RegisterAccessAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/RegisterAccessAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-004's access modifiers -- E0870 (a `wo` member read), E0871 (an
 * `ro` member written), E0872 (a zero assigned to a write-1 bit) -- replacing
 * four throws across three codegen files that resolved the register chain
 * three different ways and left the scoped spellings unchecked.
 *
 * The rules read the per-file symbol view, which each test's source declares
 * and 1.3/1.4 settle, as in production. A register `R` inside scope `Board`
 * is keyed `Board__R`, and its member `ST` is `Board__R__ST`.
 */

/**
 * A register declared on ONE line, so prefixing it to a source leaves every
 * line the tests assert where it was.
 */
const register = (name: string, members: Record<string, string>): string =>
  `register ${name} @ 0x40000000 { ${Object.entries(members)
    .map(([member, mod], i) => `${member}: u32 ${mod} @ ${i * 4},`)
    .join(" ")} } `;

const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new RegisterAccessAnalyzer(context).analyze(
    syntax,
    ValuePositions.of(syntax, context),
  );
};

const inMain = (body: string): string => `void main() {\n${body}\n}`;

describe("RegisterAccessAnalyzer", () => {
  describe("E0870 -- a write-only member is read", () => {
    it("rejects `R.CMD` in an initializer, with a real position", () => {
      const found = errors(
        register("R", { CMD: "wo" }) + inMain("    u32 v <- R.CMD;"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0870");
      expect(found[0].span.line).toBe(2);
      expect(found[0].span.column).toBeGreaterThan(0);
      expect(found[0].message).toContain("R.CMD has 'wo'");
    });

    it("accepts reads of rw, ro, w1c and w1s members", () => {
      // The control the rule turns on: only `wo` returns nothing when read. A
      // w1c status register is READ to see what is pending.
      expect(
        errors(
          register("R", { A: "rw", B: "ro", C: "w1c", D: "w1s" }) +
            inMain("    u32 v <- R.A + R.B + R.C + R.D;"),
        ),
      ).toEqual([]);
    });

    it("rejects the scoped spellings codegen checked separately", () => {
      const source = [
        `scope Board { public ${register("R", { CMD: "wo" })}`,
        "    public u32 a() { return this.R.CMD; }",
        "    public u32 b() { return R.CMD; }",
        "}",
        "u32 c() { return Board.R.CMD; }",
        "scope Other {",
        "    public u32 d() { return global.Board.R.CMD; }",
        "}",
      ].join("\n");
      const found = errors(source);
      expect(found.map((e) => e.span.line)).toEqual([2, 3, 5, 7]);
      expect(found[0].message).toContain("this.R.CMD");
      expect(found[3].message).toContain("global.Board.R.CMD");
    });

    it("rejects a compound assignment, which reads its target", () => {
      // REGRESSION. `R.SET +<- 1` emitted `R__SET += 1` -- a read of a
      // write-only register -- because the write path never asked.
      const found = errors(
        register("R", { SET: "wo" }) + inMain("    R.SET +<- 1;"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0870");
    });

    it("accepts a plain write to a wo member, zero included", () => {
      // `R.SET <- 0` writes the WHOLE member; a command register takes zero
      // as a value. Only the bit forms mean "clear".
      expect(
        errors(
          register("R", { SET: "wo" }) +
            inMain("    R.SET <- 0x42;\n    R.SET <- 0;"),
        ),
      ).toEqual([]);
    });

    it("says nothing when a local shadows the register's name", () => {
      // E0437's case, inside a scope; here the local is what `R` means, and
      // reading its field is another rule's business.
      expect(
        errors(
          register("R", { CMD: "wo" }) +
            "struct S { u32 CMD; }\nvoid main() {\n    S R;\n    u32 v <- R.CMD;\n}",
        ),
      ).toEqual([]);
    });
  });

  describe("E0871 -- a read-only member is written", () => {
    it("rejects `R.ST <- v`, a bit write, a range write and a compound", () => {
      const found = errors(
        register("R", { ST: "ro" }) +
          inMain(
            "    R.ST <- 1;\n    R.ST[3] <- true;\n    R.ST[0, 4] <- 5;\n    R.ST +<- 1;",
          ),
      );
      expect(found).toHaveLength(4);
      expect(new Set(found.map((e) => e.code))).toEqual(new Set(["E0871"]));
    });

    it("rejects the scoped spellings that codegen accepted", () => {
      // REGRESSION. `AssignmentValidator` keyed on the first two identifiers,
      // so `this.R.ST` looked up `this`-less `R__ST` (absent) and passed; the
      // emitted C assigned through a `volatile uint32_t const *` macro.
      const source = [
        `scope Board { public ${register("R", { ST: "ro" })}`,
        "    public void a() { this.R.ST <- 1; }",
        "    public void b() { this.R.ST[3] <- true; }",
        "}",
        "void c() { Board.R.ST <- 1; }",
        "scope Other {",
        "    public void d() { global.Board.R.ST <- 1; }",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.span.line])).toEqual([
        ["E0871", 2],
        ["E0871", 3],
        ["E0871", 5],
        ["E0871", 7],
      ]);
    });

    it("accepts a read of the same member", () => {
      expect(
        errors(register("R", { ST: "ro" }) + inMain("    u32 v <- R.ST;")),
      ).toEqual([]);
    });
  });

  describe("E0872 -- a zero assigned to a write-1 bit", () => {
    it("rejects `false` and `0` on a single bit, and `0` on a range", () => {
      const found = errors(
        register("R", { SET: "wo" }) +
          inMain(
            "    R.SET[3] <- false;\n    R.SET[3] <- 0;\n    R.SET[0, 4] <- 0;",
          ),
      );
      expect(found.map((e) => e.code)).toEqual(["E0872", "E0872", "E0872"]);
      expect(found[0].message).toContain("false to write-only register bit");
      expect(found[2].message).toContain("0 to write-only register bits");
    });

    it("rejects a zero however it is spelled", () => {
      // REGRESSION. Codegen compared the generated TEXT against "false" and
      // "0", so `0x0`, `0b0` and a const evaluating to zero were accepted and
      // emitted `R__SET = (1U << 3)` -- the bit the author meant to clear was
      // set instead.
      //
      // `tests/adr-004/register-wo-set-false-error` asserts the
      // `const u32 OFF <- 0` and `const bool DOWN <- false` arms end to end.
      const found = errors(
        register("R", { SET: "wo" }) +
          inMain("    R.SET[3] <- 0x0;\n    R.SET[3] <- 0b0;"),
      );
      expect(found.map((e) => e.span.line)).toEqual([2, 3]);
    });

    it("accepts true, a non-zero value, and a runtime value", () => {
      expect(
        errors(
          register("R", { SET: "wo" }) +
            "void main(u32 n) {\n    R.SET[3] <- true;\n    R.SET[0, 4] <- 0xF;\n    R.SET[3] <- n;\n}",
        ),
      ).toEqual([]);
    });

    it("applies to w1s and w1c bits, and not to rw ones", () => {
      // Codegen's `isWriteOnlyRegister` set: writing a zero to a write-1
      // register does nothing, whichever direction the 1 goes.
      const found = errors(
        register("R", { S: "w1s", C: "w1c", D: "rw" }) +
          inMain(
            "    R.S[1] <- false;\n    R.C[1] <- false;\n    R.D[1] <- false;",
          ),
      );
      expect(found.map((e) => e.span.line)).toEqual([2, 3]);
    });

    it("leaves a bitmap field write to the bitmap rules", () => {
      // `R.SET.FIELD <- 0` has a `.name` after the member, not a subscript;
      // codegen's bitmap path never checked zero and neither does this.
      expect(
        errors(register("R", { SET: "wo" }) + inMain("    R.SET.FIELD <- 0;")),
      ).toEqual([]);
    });
  });

  describe("E0872 -- a zero assigned to a field of a write-1 member (#2027)", () => {
    const FIELDS = [
      "bitmap8 Flags { Enable, Mode[3], Rest[4] }",
      "register PWM @ 0x40000000 { FLAGS: Flags w1c @ 0x00, CTRL: Flags rw @ 0x04, }",
    ].join(" ");

    it("rejects `false` on a one-bit field and `0` on a wider one", () => {
      const found = errors(
        FIELDS +
          inMain("    PWM.FLAGS.Enable <- false;\n    PWM.FLAGS.Mode <- 0;"),
      );
      expect(found.map((e) => [e.code, e.span.line])).toEqual([
        ["E0872", 2],
        ["E0872", 3],
      ]);
      expect(found[0].message).toBe(
        "Cannot assign false to write-only register bit PWM.FLAGS.Enable",
      );
      expect(found[1].message).toBe(
        "Cannot assign 0 to write-only register bits PWM.FLAGS.Mode",
      );
    });

    it("accepts a non-zero value, and a zero on an rw member's field", () => {
      expect(
        errors(
          FIELDS +
            inMain(
              "    PWM.FLAGS.Enable <- true;\n    PWM.FLAGS.Mode <- 2;\n    PWM.CTRL.Mode <- 0;",
            ),
        ),
      ).toEqual([]);
    });
  });

  it("says nothing without a symbol view", () => {
    // The view is real; it just declares no register `R`.
    expect(errors(inMain("    u32 v <- R.CMD;"))).toEqual([]);
  });
});

// #1991: read off 1.2's syntax, so a `global.`-rooted target and an index
// spelled as written are asserted directly.
describe("RegisterAccessAnalyzer -- E0872 on 1.2's syntax", () => {
  const e0872 = (body: string) =>
    errors(
      [
        "register GPIO @ 0x40000000 {",
        "    DR_SET: u32 wo @ 0x04,",
        "}",
        "scope S {",
        "    public void f() {",
        "        u8 i <- 0;",
        body,
        "    }",
        "}",
      ].join("\n"),
    )
      .filter((e) => e.code === "E0872")
      .map((e) => e.message);

  it("finds the bit after a `global.` root", () => {
    expect(e0872("        global.GPIO.DR_SET[3] <- false;")).toEqual([
      "Cannot assign false to write-only register bit global.GPIO.DR_SET[3]",
    ]);
  });

  it("names the index as it was written", () => {
    expect(e0872("        global.GPIO.DR_SET[i + 1] <- false;")).toEqual([
      "Cannot assign false to write-only register bit global.GPIO.DR_SET[i + 1]",
    ]);
  });
});
