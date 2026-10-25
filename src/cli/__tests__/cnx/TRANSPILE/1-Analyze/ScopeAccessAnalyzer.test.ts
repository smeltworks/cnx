import { describe, expect, it } from "vitest";

import ScopeAccessAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ScopeAccessAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-016's scope-access rules -- E0435 (own scope by name), E0436
 * (private from outside), E0437 (a shadowed global reached bare) -- replacing
 * six throws across three codegen files, two of which decided the same rule
 * separately.
 *
 * The rules read the per-file symbol view, which each test's source declares
 * and 1.3/1.4 settle, as in production.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new ScopeAccessAnalyzer(context).analyze(syntax);
};

const GPIO = "register GPIO @ 0x40000000 {\n    DR: u32 rw @ 0x00,\n}\n";

describe("ScopeAccessAnalyzer", () => {
  describe("E0435 -- own scope by name", () => {
    it("rejects `Counter.value` inside Counter, with a real position", () => {
      const found = errors(
        "scope Counter {\n    i32 value <- 1;\n    void t() {\n        Counter.value <- 5;\n    }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0435");
      expect(found[0].span.line).toBe(4);
      expect(found[0].span.column).toBeGreaterThan(0);
    });

    it("rejects it as a TYPE too -- `M.T t;` inside M", () => {
      expect(
        errors(
          "scope M {\n    public struct T { u32 x; }\n    public void go() {\n        M.T t;\n    }\n}",
        )[0].code,
      ).toBe("E0435");
    });

    it("accepts `this.` and the deliberate `global.Scope.member`", () => {
      expect(
        errors(
          "scope C {\n    u32 v <- 1;\n    public u32 a() { return this.v; }\n    public u32 b() { return global.C.v; }\n}",
        ),
      ).toEqual([]);
    });
  });

  describe("E0436 -- private from outside", () => {
    it("rejects from file scope and from another scope, and says which", () => {
      const [outside] = errors(
        "scope A {\n    u32 v <- 1;\n}\nu32 main() { return A.v; }",
      );
      expect(outside.code).toBe("E0436");
      expect(outside.message).toContain("from outside the scope");
      const [other] = errors(
        "scope A {\n    u32 v <- 1;\n}\nscope B {\n    public u32 g() { return A.v; }\n}",
      );
      expect(other.message).toContain("from scope 'B'");
    });

    it("rejects it through `global.` as well -- qualification is not permission", () => {
      expect(
        errors(
          "scope A {\n    u32 v <- 1;\n}\nu32 main() { return global.A.v; }",
        )[0].code,
      ).toBe("E0436");
    });

    it("rejects a private TYPE", () => {
      expect(
        errors(
          "scope Internal {\n    private struct Secret { u32 v; }\n}\nvoid main() {\n    Internal.Secret s;\n}",
        )[0].code,
      ).toBe("E0436");
    });

    it("accepts a public member from outside", () => {
      expect(
        errors(
          "scope A {\n    public u32 v <- 1;\n}\nu32 main() { return A.v; }",
        ),
      ).toEqual([]);
    });
  });

  describe("E0437 -- a shadowed global reached bare", () => {
    it("rejects an enum shadowed by a scope member, and names the shadow", () => {
      const [found] = errors(
        "enum EColor { RED }\nscope T {\n    u32 EColor <- 1;\n    public u32 g() { return EColor.RED; }\n}",
      );
      expect(found.code).toBe("E0437");
      expect(found.message).toContain("scope member 'EColor' shadows");
    });

    it("rejects a register shadowed by a LOCAL variable", () => {
      const [found] = errors(
        GPIO +
          "scope M {\n    void t() {\n        mut u32 GPIO <- 1;\n        GPIO.DR <- 1;\n    }\n}",
      );
      expect(found.code).toBe("E0437");
      expect(found.message).toContain("local variable");
    });

    it("accepts the same enum where nothing shadows it, and via `global.`", () => {
      expect(
        errors(
          "enum EColor { RED }\nscope M {\n    public u32 g() { return EColor.RED; }\n}",
        ),
      ).toEqual([]);
      expect(
        errors(
          "enum EColor { RED }\nscope M {\n    u32 EColor <- 1;\n    public u32 g() { return global.EColor.RED; }\n}",
        ),
      ).toEqual([]);
    });

    it("says nothing at file scope -- a shadow outside a scope is codegen's concern, as before", () => {
      expect(
        errors(
          GPIO +
            "u32 main() {\n    mut u32 GPIO <- 1;\n    GPIO.DR <- 1;\n    return 0;\n}",
        ),
      ).toEqual([]);
    });
  });
});

describe("ScopeAccessAnalyzer on 1.2's syntax (#1991)", () => {
  it("checks every position a qualified name is written, in source order", () => {
    const source = [
      "scope M {",
      "    enum E { A, B }",
      "    struct T { u32 x; }",
      "    u32 v <- 1;",
      "}",
      "struct H {",
      "    M.T inner;",
      "}",
      "void f(M.E e) {",
      "    M.T[2] pair;",
      "    u32 n <- M.T.type_byte_length;",
      "    u8 k <- (M.E)0;",
      "    switch (e) {",
      "        case M.E.A {",
      "            M.v <- 2;",
      "        }",
      "        default { }",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => [e.span.line, e.code])).toEqual([
      [9, "E0436"],
      [10, "E0436"],
      [11, "E0436"],
      [12, "E0436"],
      [14, "E0436"],
      [15, "E0436"],
    ]);
  });

  it("does not read `this.A.x` as scope A's member x", () => {
    const source = [
      "scope A {",
      "    u32 x <- 1;",
      "}",
      "struct P {",
      "    u32 x;",
      "}",
      "scope B {",
      "    P A;",
      "    public u32 g() {",
      "        return this.A.x;",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });
});
