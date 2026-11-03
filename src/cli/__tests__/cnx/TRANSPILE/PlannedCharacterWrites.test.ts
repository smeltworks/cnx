/**
 * #1748: 2.2 plans each string written into one character of a `string<N>`
 * (ADR-045: `s[i]` is a `string<1>`), and 2.3 writes that string's first
 * character. This runs the whole transpile, so it fails if 2.2 skips the
 * decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true },
    NodeFileSystem.instance,
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.2 plans every string written into one character", () => {
  it("writes the string's first character, for each form", async () => {
    const code = await generate(
      [
        "#pragma target host",
        'mut string<8> s <- "hello";',
        'string<8> t <- "QRS";',
        'string<1> one <- "z";',
        "mut u8 n <- 1;",
        "void f() {",
        '    s[0] <- "x";',
        '    s[1] <- "\\n";',
        '    s[2] <- "";',
        "    s[3] <- one;",
        "    s[4] <- t[1, 1];",
        '    s[5] <- (n > 0) ? "a" : "b";',
        "    s[6] <- t[0];",
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain("s[0] = 'x';");
    expect(code).toContain("s[1] = '\\n';");
    expect(code).toContain("s[2] = '\\0';");
    expect(code).toContain("s[3] = one[0];");
    expect(code).toContain("s[4] = t[1U];");
    expect(code).toMatch(/s\[5\] = \(.*"a".*"b".*\)\[0\];/);
    expect(code).toContain("s[6] = t[0U];");
  });

  it("copies a string into a range, one character at a time (#2373)", async () => {
    const code = await generate(
      [
        "#pragma target host",
        'mut string<8> s <- "hello";',
        'string<8> t <- "QRS";',
        'string<2> w <- "ab";',
        "void f() {",
        '    s[0, 2] <- "AB";',
        "    s[2, 2] <- t[1, 2];",
        "    s[4, 2] <- w;",
        '    s[6, 2] <- "Z";',
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain("s[0] = 'A';\n    s[1] = 'B';");
    expect(code).toContain(
      "const char* const cnx_tmp0 = &t[1U];\n        const char cnx_tmp1[2] = {cnx_tmp0[0], cnx_tmp0[1]};\n        s[2] = cnx_tmp1[0];\n        s[3] = cnx_tmp1[1];",
    );
    expect(code).toContain(
      "const char* const cnx_tmp2 = w;\n        const char cnx_tmp3[2] = {cnx_tmp2[0], cnx_tmp2[1]};\n        s[4] = cnx_tmp3[0];\n        s[5] = cnx_tmp3[1];",
    );
    expect(code).toContain("s[6] = 'Z';");
    expect(code).not.toContain("s[7] =");
  });

  it("reads an overlapping range source whole before writing (#2373)", async () => {
    const code = await generate(
      [
        "#pragma target host",
        'mut string<8> s <- "abcdefgh";',
        "void f() {",
        "    s[1, 3] <- s[0, 3];",
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain(
      "const char* const cnx_tmp0 = &s[0U];\n        const char cnx_tmp1[3] = {cnx_tmp0[0], cnx_tmp0[1], cnx_tmp0[2]};\n        s[1] = cnx_tmp1[0];",
    );
    expect(code).not.toContain("s[2] = s[");
  });

  it("evaluates a range source once, not once per character (#2373)", async () => {
    const code = await generate(
      [
        "#pragma target host",
        'mut string<8> s <- "abcdefgh";',
        'string<8> t <- "QRST";',
        "u32 next() {",
        "    return 1;",
        "}",
        "void f() {",
        "    s[0, 3] <- t[next(), 3];",
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain("const char* const cnx_tmp0 = &t[next()];");
    expect(code.match(/next\(\)/g)).toHaveLength(1);
  });
});
