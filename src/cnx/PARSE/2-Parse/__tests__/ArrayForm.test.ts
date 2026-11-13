import { describe, expect, it } from "vitest";

import CnxSourceParser from "../CnxSourceParser";

/**
 * ADR-035/036 array shape as 1.2 reports it (#1991), with the code read back
 * off the message the user sees.
 */
const errors = (source: string) =>
  CnxSourceParser.parse(source)
    .formErrors.filter((e) =>
      /^error\[E0(8(66|7[456]|92)|917)\]/.test(e.message),
    )
    .map((e) => ({
      code: /E0\d{3}/.exec(e.message)![0],
      line: e.line,
      column: e.column,
      message: e.message.replace(/^error\[E0\d{3}\]: /, ""),
    }));

describe("ArrayForm", () => {
  describe("E0874 -- C-style declarations and parameters", () => {
    it("rejects a trailing dimension on a declaration, naming the prefix form", () => {
      const found = errors("u16 arr[8];");
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0874");
      expect(found[0].message).toContain(
        "Use 'u16[8] arr' instead of 'u16 arr[8]'",
      );
      expect(found[0].line).toBe(1);
    });

    it("rejects the mixed form and every-dimension-after form", () => {
      const found = errors("void f() {\n    u8[4] m[8];\n    u8 n[4][8];\n}");
      expect(found.map((e) => e.line)).toEqual([2, 3]);
      expect(found[0].message).toContain(
        "Use 'u8[4][8] m' instead of 'u8[4] m[8]'",
      );
    });

    it("rejects a C-style parameter", () => {
      const found = errors("void f(u8 data[8]) {\n}");
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("C-style array parameter");
      expect(found[0].message).toContain("'u8[8] data'");
    });

    it("accepts the prefix form everywhere, and reproduces codegen's scope-member exemption", () => {
      // A scope member with a trailing dimension reached a generator that
      // never rejected it; thirty-one fixtures rely on that, so it is
      // reproduced and recorded rather than closed.
      const source = [
        "u8[4] okGlobal;",
        "void f(u8[8] data, u8[2][4] grid) {",
        "    u8[4][8] okLocal;",
        "}",
        "scope S {",
        "    public u8 legacy[32];",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });
  });

  describe("E0875 -- unbounded parameters", () => {
    it("rejects an unbounded dimension on a parameter", () => {
      const found = errors("void f(u8[] data) {\n}");
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0875");
    });

    it("accepts an inferred size on a declaration", () => {
      expect(errors("u8[] data <- [1, 2, 3];")).toEqual([]);
    });
  });

  describe("E0866 -- an initializer that is not a list", () => {
    it("rejects another array at file scope (the closed hole)", () => {
      // `uint8_t b[2] = a;` is not C, and file scope has no copy to run.
      const found = errors("u8[2] a <- [1, 2];\nu8[2] b <- a;");
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain(
        "at file scope must be initialized by a list",
      );
    });

    it("rejects another array into an inferred size", () => {
      const found = errors(
        "void f() {\n    u8[2] a <- [1, 2];\n    u8[] b <- a;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain(
        "of an inferred size must be initialized by a list",
      );
    });

    it("leaves a sized local's copy of another array to 2.1 (#1209)", () => {
      expect(
        errors("void f() {\n    u8[2] a <- [1, 2];\n    u8[2] b <- a;\n}"),
      ).toEqual([]);
    });

    it("rejects a string literal into a non-u8 array", () => {
      expect(errors('u16[] text <- "Hello";').map((e) => e.code)).toEqual([
        "E0866",
      ]);
    });

    it("accepts a string literal into a u8 array", () => {
      expect(errors('u8[] text <- "Hello";\nu8[6] sized <- "Hello";')).toEqual(
        [],
      );
    });
  });

  describe("E0876 -- fill-all on an inferred size", () => {
    it("rejects it, with the form as written", () => {
      const found = errors("u8[] d <- [0*];");
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0876");
      expect(found[0].message).toContain("[0*]");
    });
  });

  describe("E0892 -- a dimension with no size and nothing to count (#1822)", () => {
    it("reports every empty dimension of a multi-dimensional array, at its bracket", () => {
      const found = errors("u8[][] m <- [[1, 2, 3], [4, 5, 6]];");
      expect(found.map((e) => [e.code, e.column])).toEqual([
        ["E0892", 2],
        ["E0892", 4],
      ]);
      expect(found[1].message).toBe(
        "Array 'm' leaves dimension 2 without a size",
      );
    });

    it("stops at E0892, so the fill-all rule does not also fire", () => {
      // Without the early return, checkInitializer would add E0876 here.
      expect(errors("u8[][3] m <- [0*];").map((e) => e.code)).toEqual([
        "E0892",
      ]);
    });

    it("rejects a one-dimensional [] with no initializer to count", () => {
      const found = errors("u8[] nothing;");
      expect(found.map((e) => e.code)).toEqual(["E0892"]);
      expect(found[0].message).toContain("'nothing' leaves dimension 1");
    });

    it("rejects [] on a struct field, in the type and after the name", () => {
      const found = errors("struct S {\n    u8[] a;\n    u8 b[];\n}");
      expect(found.map((e) => [e.code, e.line])).toEqual([
        ["E0892", 2],
        ["E0892", 3],
      ]);
    });

    it("accepts a one-dimensional size counted from a list or a u8 string literal", () => {
      expect(errors('u8[] a <- [1, 2, 3];\nu8[] s <- "Hi";')).toEqual([]);
    });
  });

  it("spells a dimension in the E0874 suggestion as written", () => {
    expect(errors("u8 N <- 2;\nu16 arr[N + 1];")[0].message).toContain(
      "Use 'u16[N + 1] arr' instead of 'u16 arr[N + 1]'",
    );
  });

  describe("E0917 -- an array or a string declared in a for header (#1823)", () => {
    it("rejects the prefix and the C-style spelling alike, naming the array", () => {
      const found = errors(
        [
          "void f() {",
          "    mut u32 n <- 0;",
          "    for (u8[3] v <- [1, 2, 3]; n < 3; n <- n + 1) {}",
          "    for (u32 c[2]; n < 6; n <- n + 1) {}",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => [e.code, e.line, e.column])).toEqual([
        ["E0917", 3, 9],
        ["E0917", 4, 9],
      ]);
      expect(found[0].message).toBe(
        "An array is not a for loop variable: declare 'v' before the loop",
      );
    });

    it("rejects a sized and an unsized string, naming the string", () => {
      const found = errors(
        [
          "void f() {",
          "    mut u32 n <- 0;",
          '    for (string<8> s <- "ab"; n < 3; n <- n + 1) {}',
          '    for (string t <- "ab"; n < 6; n <- n + 1) {}',
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => [e.code, e.line, e.column])).toEqual([
        ["E0917", 3, 9],
        ["E0917", 4, 9],
      ]);
      expect(found.map((e) => e.message)).toEqual([
        "A string is not a for loop variable: declare 's' before the loop",
        "A string is not a for loop variable: declare 't' before the loop",
      ]);
    });

    it("accepts a scalar loop variable, with its modifiers", () => {
      const source = [
        "void f() {",
        "    for (mut u32 i <- 0; i < 3; i <- i + 1) {}",
        "    for (volatile mut u8 k <- 0; k < 3; k <- k + 1) {}",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });
  });
});
