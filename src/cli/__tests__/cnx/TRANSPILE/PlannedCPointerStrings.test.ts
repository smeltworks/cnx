/**
 * #2348: a concatenation or a substring passed to a C `char*` parameter is
 * built into a temporary first (ADR-045), what cannot be built is E0947 or
 * E0948, and a C string under arithmetic is E0925 (ADR-046). This runs the
 * whole transpile, so it fails if 2.1 or 2.2 skips a decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

async function transpile(
  body: readonly string[],
): Promise<{ code: string; errors: string[] }> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true },
    NodeFileSystem.instance,
  );
  const result = await transpiler.transpile({
    kind: "source",
    source: [
      "#pragma target host",
      "#include <string.h>",
      'string<8> s <- "abc";',
      "mut i32 order;",
      "mut u64 total;",
      ...body,
      "",
    ].join("\n"),
  });
  return {
    code: result.files[0]?.code ?? "",
    errors: result.errors.map((e) => e.message),
  };
}

const codes = (errors: readonly string[]): string[] =>
  errors.flatMap((message) => /E\d{4}/.exec(message) ?? []);

describe("2.2 builds a string passed to a C char pointer (#2348)", () => {
  it("builds a concatenation and a substring at their parts' capacity", async () => {
    const found = await transpile([
      "void f() {",
      '    order <- strcmp(s + "!", "abc!");',
      '    order <- strcmp(s[1, 2], "bc");',
      '    order <- strcmp(s, "abc");',
      "}",
    ]);
    expect(codes(found.errors)).toEqual([]);
    expect(found.code).toMatch(/char cnx_tmp\d\[10\] = "";/);
    expect(found.code).toMatch(/char cnx_tmp\d\[3\] = "";/);
    expect(found.code).toContain('strcmp(s, "abc")');
  });

  it("builds a right operand's string only when it runs", async () => {
    const found = await transpile([
      "void f() {",
      '    bool b <- s.value_char_count > 6 && strcmp(s[4, 3], "x") = 0;',
      "}",
    ]);
    expect(codes(found.errors)).toEqual([]);
    expect(found.code).toMatch(
      /if \(cnx_tmp\d\) \{[^}]*char cnx_tmp\d\[4\] = "";/,
    );
  });

  it("rejects a part of unknown length (E0947)", async () => {
    const found = await transpile([
      "scope Names {",
      "    public u64 measure(string name) {",
      '        return strlen(name + "!");',
      "    }",
      "}",
    ]);
    expect(codes(found.errors)).toContain("E0947");
  });

  it("rejects a built string passed to a C function returning a pointer (E0948)", async () => {
    const found = await transpile([
      "void f() {",
      '    cstring c_at <- strstr(s + "de", "cd");',
      "    cstring c_ch <- strchr(s[0, 2], 'b');",
      '    cstring c_whole <- strstr(s, "b");',
      "}",
    ]);
    expect(codes(found.errors).filter((c) => c === "E0948")).toHaveLength(2);
  });

  it("checks a C argument's substring against its source (E0865)", async () => {
    const found = await transpile([
      "void f() {",
      '    order <- strcmp(s[6, 4], "x");',
      "}",
    ]);
    expect(codes(found.errors)).toContain("E0865");
  });

  it("rejects a C string under arithmetic but not beside a substring (E0925)", async () => {
    const found = await transpile([
      "void f() {",
      '    cstring c_pos <- strstr(s, "b");',
      "    if (c_pos != NULL) {",
      '        order <- strcmp(c_pos + 1, "c");',
      "    }",
      '    string<8> joined <- s[0, 1] + "!";',
      "}",
    ]);
    expect(codes(found.errors)).toEqual(["E0925"]);
  });

  it("keeps a NULL guard inside a loop or a branch from holding after it (E0908)", async () => {
    const found = await transpile([
      "u32 f(u32 n) {",
      '    cstring c_pos <- strstr(s, "b");',
      "    for (mut u32 i <- 0; i < n; i +<- 1) {",
      "        if (c_pos = NULL) {",
      "            return 1;",
      "        }",
      "    }",
      "    total <- strlen(c_pos);",
      '    cstring c_two <- strstr(s, "c");',
      "    if (c_two != NULL && strlen(c_two) > 0) {",
      "        total <- strlen(c_two);",
      "    }",
      "    return 0;",
      "}",
    ]);
    expect(codes(found.errors)).toEqual(["E0908"]);
  });
});
