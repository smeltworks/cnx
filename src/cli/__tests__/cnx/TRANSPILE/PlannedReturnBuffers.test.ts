/**
 * #1209 (owner ruling, 2026-11-13): a function returning a `string<N>` or an
 * array fills a buffer its caller supplies, and a call fills a temporary of
 * the return type that its expression then reads. Here through a real run,
 * with a scope's methods one include away, so the caller's side is planned
 * from the callee's symbol.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../MockFileSystem";

const store = `scope Store {
    string<16> label <- "store";
    u8[4] bytes <- [9, 8, 7, 6];

    public string<16> name() {
        return this.label;
    }

    public u8[4] data() {
        return this.bytes;
    }
}
`;

async function run(body: string): Promise<{ code: string; errors: string[] }> {
  const fs = new MockFileSystem()
    .addFile("/project/store.cnx", store)
    .addFile("/project/consumer.cnx", `#include "store.cnx"\n\n${body}`);
  const result = await new Transpiler(
    {
      input: "/project/consumer.cnx",
      outDir: "/project/out",
      noCache: true,
      target: "host",
    },
    fs,
  ).transpile({ kind: "files" });
  const errors = result.errors.map((e) => e.message);
  return {
    code: errors.length === 0 ? fs.readFile("/project/out/consumer.c") : "",
    errors,
  };
}

const returns = `string<16> greet() {
    string<16> s <- "hi";
    return s;
}

u8[4] make() {
    u8[4] a <- [1, 2, 3, 4];
    return a;
}

u8[4] constant() {
    return [9, 8, 7, 6];
}

string<8>[2] pair() {
    string<8>[2] p <- ["a", "b"];
    return p;
}

u32 main() {
    string<16> g <- greet();
    u8[4] m <- make();
    u8 second <- make()[1];
    u8[4] copy <- m;
    u8[4] c <- constant();
    string<8>[2] names <- pair();
    string<8>[2] namesCopy <- names;
    string<16> n <- Store.name();
    u8 d <- Store.data()[1];
    return 0;
}
`;

describe("2.2 plans a caller-supplied return buffer (#1209)", () => {
  it("passes each string or array function its buffer", async () => {
    const { code, errors } = await run(returns);
    expect(errors).toEqual([]);
    expect(code).toContain("void greet(char cnx_return[17]) {");
    expect(code).toContain("cnx_string_copy(cnx_return, s, 16U);");
    expect(code).toContain("void make(uint8_t cnx_return[4]) {");
    expect(code).toContain("cnx_return[cnx_tmp0] = a[cnx_tmp0];");
    expect(code).toContain("void pair(char cnx_return[2][9]) {");
  });

  it("copies a returned list in through a temporary", async () => {
    const { code } = await run(returns);
    expect(code).toMatch(
      /const uint8_t (cnx_tmp\d+)\[4\] = \{9U, 8U, 7U, 6U\};[\s\S]*cnx_return\[(cnx_tmp\d+)\] = \1\[\2\];/,
    );
    expect(code).not.toMatch(/return \{/);
  });

  it("fills a temporary at each call, which its expression reads", async () => {
    const { code } = await run(returns);
    expect(code).toMatch(/uint8_t (cnx_tmp\d+)\[4\] = \{0\};\s+make\(\1\);/);
    expect(code).toMatch(
      /Store__data\((cnx_tmp\d+)\);\s+const uint8_t d = \1\[1U\];/,
    );
    expect(code).toMatch(
      /char (cnx_tmp\d+)\[17\] = \{0\};\s+Store__name\(\1\);/,
    );
  });

  it("copies another array of the same shape in, element by element", async () => {
    const { code } = await run(returns);
    expect(code).toContain("uint8_t copy[4] = {0};");
    expect(code).toMatch(/copy\[(cnx_tmp\d+)\] = m\[\1\];/);
    expect(code).toContain("char namesCopy[2][9] = {0};");
  });
});

describe("1.2 and 2.1 reject an array given neither a list nor an array (#1209)", () => {
  it.each([
    [
      "a scalar, inside a function",
      "void f() {\n    u8[2] a <- 5;\n}\n",
      "An array must be initialized by a list or an array, not '5'",
    ],
    [
      "another array, into an inferred size",
      "void f() {\n    u8[2] a <- [1, 2];\n    u8[] b <- a;\n}\n",
      "An array of an inferred size must be initialized by a list, not 'a'",
    ],
    [
      "another array, at file scope",
      "u8[2] a <- [1, 2];\nu8[2] b <- a;\n",
      "An array at file scope must be initialized by a list, not 'a'",
    ],
  ])("%s", async (_label, body, message) => {
    const { errors } = await run(body);
    expect(errors.some((e) => e.includes(message))).toBe(true);
  });
});
