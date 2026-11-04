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
      'char cnx_tmp0[3] = "";\n        cnx_string_copy(cnx_tmp0, t + 1U, 2U);\n        const uint32_t cnx_tmp1 = (uint32_t) strlen(cnx_tmp0);\n        for (uint32_t cnx_tmp2 = 0U; cnx_tmp2 < cnx_tmp1; cnx_tmp2++) {\n            s[2U + cnx_tmp2] = cnx_tmp0[cnx_tmp2];',
    );
    expect(code).toContain(
      "cnx_string_copy(cnx_tmp3, w, 2U);\n        const uint32_t cnx_tmp4 = (uint32_t) strlen(cnx_tmp3);\n        for (uint32_t cnx_tmp5 = 0U; cnx_tmp5 < cnx_tmp4; cnx_tmp5++) {\n            s[4U + cnx_tmp5] = cnx_tmp3[cnx_tmp5];",
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
      "cnx_string_copy(cnx_tmp0, s + 0U, 3U);\n        const uint32_t cnx_tmp1 = (uint32_t) strlen(cnx_tmp0);\n        for (uint32_t cnx_tmp2 = 0U; cnx_tmp2 < cnx_tmp1; cnx_tmp2++) {\n            s[1U + cnx_tmp2] = cnx_tmp0[cnx_tmp2];",
    );
    expect(code).not.toContain("s[2] = s[");
  });

  it("builds a concatenation apart and writes only its characters into a range (#2373)", async () => {
    const code = await generate(
      [
        "#pragma target host",
        "mut string<8> s;",
        "void f() {",
        '    s[0, 4] <- "a" + "b";',
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain(
      'char cnx_tmp0[5] = "";\n        (void) strncpy(cnx_tmp0, "a", 4);\n        (void) strncat(cnx_tmp0, "b", 4 - strlen(cnx_tmp0));\n        cnx_tmp0[4] = \'\\0\';\n        const uint32_t cnx_tmp1 = (uint32_t) strlen(cnx_tmp0);\n        for (uint32_t cnx_tmp2 = 0U; cnx_tmp2 < cnx_tmp1; cnx_tmp2++) {\n            s[cnx_tmp2] = cnx_tmp0[cnx_tmp2];',
    );
  });

  it("evaluates a range source once, not once per character (#2373)", async () => {
    const code = await generate(
      [
        "#pragma target host",
        'mut string<8> s <- "abcdefgh";',
        'string<8> t <- "QRS";',
        "u32 next() {",
        "    return 1;",
        "}",
        "void f() {",
        "    s[0, 3] <- t[next(), 3];",
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain("cnx_string_copy(cnx_tmp0, t + next(), 3U);");
    expect(code.match(/next\(\)/g)).toHaveLength(1);
  });
});
